/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Dev proxy target: POST /api/generate-story
 * Set ANTHROPIC_API_KEY (or VITE_ANTHROPIC_API_KEY) in .env at project root.
 */

import 'dotenv/config';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import cors from 'cors';
import express, { type Request, type Response, type NextFunction } from 'express';
import Anthropic from '@anthropic-ai/sdk';

import { buildClaudePrompt } from './src/lib/storyEngine.ts';
import type { StoryConfig } from './src/types.ts';

const PORT = Number(process.env.PORT) || 8787;

/* ------------------------------------------------------------------ */
/*  Rate Limiter – 10 requests per minute per IP, pure in-memory      */
/* ------------------------------------------------------------------ */

const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX = 10;

interface RateBucket {
  tokens: number;
  lastRefill: number;
}

const rateBuckets = new Map<string, RateBucket>();

// Periodically prune stale buckets so the map doesn't grow unbounded.
setInterval(() => {
  const now = Date.now();
  for (const [ip, bucket] of rateBuckets) {
    if (now - bucket.lastRefill > RATE_LIMIT_WINDOW_MS * 2) {
      rateBuckets.delete(ip);
    }
  }
}, RATE_LIMIT_WINDOW_MS * 2);

function rateLimiter(req: Request, res: Response, next: NextFunction): void {
  const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown';
  const now = Date.now();

  let bucket = rateBuckets.get(ip);
  if (!bucket) {
    bucket = { tokens: RATE_LIMIT_MAX, lastRefill: now };
    rateBuckets.set(ip, bucket);
  }

  // Refill tokens based on elapsed time.
  const elapsed = now - bucket.lastRefill;
  if (elapsed >= RATE_LIMIT_WINDOW_MS) {
    bucket.tokens = RATE_LIMIT_MAX;
    bucket.lastRefill = now;
  }

  if (bucket.tokens <= 0) {
    res.status(429).json({ error: 'Too many requests. Limit is 10 per minute. Please try again later.' });
    return;
  }

  bucket.tokens -= 1;
  next();
}

/* ------------------------------------------------------------------ */
/*  Input Sanitization                                                 */
/* ------------------------------------------------------------------ */

/** Strip HTML tags from a string. */
function stripHtml(str: string): string {
  return str.replace(/<[^>]*>/g, '');
}

/**
 * Strip common prompt-injection patterns.
 * Removes attempts to break out of the intended prompt context.
 */
function stripInjectionPatterns(str: string): string {
  // Remove common injection delimiters and role overrides
  let cleaned = str;
  // Remove attempts to impersonate system/assistant roles
  cleaned = cleaned.replace(/\b(system|assistant|human)\s*:/gi, '');
  // Remove markdown-style instruction fences that try to inject new context
  cleaned = cleaned.replace(/```(system|instruction|prompt)[^`]*```/gi, '');
  // Remove XML-style tags commonly used for injection
  cleaned = cleaned.replace(/<\/?(?:system|instruction|prompt|context|rules|override|ignore)[^>]*>/gi, '');
  // Remove "ignore previous instructions" and similar patterns
  cleaned = cleaned.replace(/ignore\s+(all\s+)?(previous|above|prior)\s+(instructions|prompts|rules)/gi, '');
  // Remove "you are now" role-reassignment attempts
  cleaned = cleaned.replace(/you\s+are\s+now\b/gi, '');
  // Remove attempts to reveal system prompt
  cleaned = cleaned.replace(/(?:reveal|show|print|output|repeat)\s+(?:your\s+)?(?:system\s+)?prompt/gi, '');
  return cleaned;
}

/** Sanitize a single string field: strip HTML, strip injections, trim & truncate. */
function sanitizeString(value: unknown, maxLength: number): string {
  if (typeof value !== 'string') return '';
  let s = stripHtml(value);
  s = stripInjectionPatterns(s);
  return s.trim().slice(0, maxLength);
}

/** Sanitize all string fields inside a StoryConfig (mutates in place). */
function sanitizeConfig(config: StoryConfig): void {
  // Sanitize children names
  if (Array.isArray(config.children)) {
    for (const child of config.children) {
      if (typeof child.name === 'string') {
        child.name = sanitizeString(child.name, 50);
      }
    }
  }
  if (config.customPrompt != null) {
    config.customPrompt = sanitizeString(config.customPrompt, 500);
  }
}

/* ------------------------------------------------------------------ */
/*  Server Setup                                                       */
/* ------------------------------------------------------------------ */

function elevenLabsKey(): string | null {
  const k = process.env.ELEVENLABS_API_KEY?.trim();
  if (!k || k === 'your_key_here') return null;
  return k;
}

function apiKey(): string {
  const k = process.env.ANTHROPIC_API_KEY?.trim();
  if (!k || k.toLowerCase() === 'your_key_here') {
    throw new Error('Set ANTHROPIC_API_KEY in .env (never use VITE_ prefix for API keys)');
  }
  return k;
}

const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((s) => s.trim())
  : null; // null = allow all (dev mode)

const app = express();
app.use(cors({
  origin: ALLOWED_ORIGINS
    ? (origin, cb) => {
        if (!origin || ALLOWED_ORIGINS.includes(origin)) cb(null, true);
        else cb(new Error('CORS blocked'));
      }
    : true,
}));
app.use(express.json({ limit: '1mb' }));

app.post('/api/generate-story', rateLimiter, async (req, res) => {
  try {
    const bodyPrompt = req.body?.prompt;
    const config = req.body?.config as StoryConfig | undefined;
    let prompt: string;

    if (typeof bodyPrompt === 'string' && bodyPrompt.trim().length > 0) {
      // Sanitize a raw prompt the same way: strip HTML + injections, cap length.
      prompt = sanitizeString(bodyPrompt, 5000);
    } else if (config && typeof config === 'object') {
      sanitizeConfig(config);
      prompt = buildClaudePrompt(config);
    } else {
      res.status(400).json({ error: 'Missing prompt or config' });
      return;
    }

    const client = new Anthropic({ apiKey: apiKey() });
    const msg = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8192,
      messages: [{ role: 'user', content: prompt }],
    });

    const block = msg.content[0];
    const text = block?.type === 'text' ? block.text : '';
    res.json({ text });
  } catch (e) {
    console.error('generate-story:', e);
    res.status(500).json({ error: 'Failed to generate story. Please try again.' });
  }
});

/* ------------------------------------------------------------------ */
/*  TTS Rate Limiter – 5 requests per minute per IP, pure in-memory   */
/* ------------------------------------------------------------------ */

const TTS_RATE_LIMIT_MAX = 5;

const ttsRateBuckets = new Map<string, RateBucket>();

setInterval(() => {
  const now = Date.now();
  for (const [ip, bucket] of ttsRateBuckets) {
    if (now - bucket.lastRefill > RATE_LIMIT_WINDOW_MS * 2) {
      ttsRateBuckets.delete(ip);
    }
  }
}, RATE_LIMIT_WINDOW_MS * 2);

function ttsRateLimiter(req: Request, res: Response, next: NextFunction): void {
  const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown';
  const now = Date.now();

  let bucket = ttsRateBuckets.get(ip);
  if (!bucket) {
    bucket = { tokens: TTS_RATE_LIMIT_MAX, lastRefill: now };
    ttsRateBuckets.set(ip, bucket);
  }

  const elapsed = now - bucket.lastRefill;
  if (elapsed >= RATE_LIMIT_WINDOW_MS) {
    bucket.tokens = TTS_RATE_LIMIT_MAX;
    bucket.lastRefill = now;
  }

  if (bucket.tokens <= 0) {
    res.status(429).json({ error: 'Too many TTS requests. Limit is 5 per minute. Please try again later.' });
    return;
  }

  bucket.tokens -= 1;
  next();
}

/* ------------------------------------------------------------------ */
/*  TTS Endpoints                                                      */
/* ------------------------------------------------------------------ */

app.get('/api/tts/status', rateLimiter, (_req, res) => {
  res.json({ available: elevenLabsKey() !== null });
});

app.post('/api/tts/generate', ttsRateLimiter, async (req, res) => {
  try {
    const key = elevenLabsKey();
    if (!key) {
      res.status(503).json({ error: 'ElevenLabs API key not configured' });
      return;
    }

    const { text, voiceId } = req.body ?? {};

    if (typeof text !== 'string' || text.trim().length === 0) {
      res.status(400).json({ error: 'Missing or empty text' });
      return;
    }
    if (text.length > 5000) {
      res.status(400).json({ error: 'Text exceeds maximum length of 5000 characters' });
      return;
    }
    if (typeof voiceId !== 'string' || voiceId.trim().length === 0) {
      res.status(400).json({ error: 'Missing voiceId' });
      return;
    }

    const elevenRes = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': key,
          'Content-Type': 'application/json',
          Accept: 'audio/mpeg',
        },
        body: JSON.stringify({
          text: text.trim(),
          model_id: 'eleven_multilingual_v2',
          voice_settings: {
            stability: 0.7,
            similarity_boost: 0.8,
            style: 0.3,
          },
        }),
      },
    );

    if (!elevenRes.ok) {
      const errBody = await elevenRes.text();
      console.error('ElevenLabs API error:', elevenRes.status, errBody);
      res.status(elevenRes.status).json({ error: 'ElevenLabs API error' });
      return;
    }

    res.setHeader('Content-Type', 'audio/mpeg');
    const arrayBuffer = await elevenRes.arrayBuffer();
    res.send(Buffer.from(arrayBuffer));
  } catch (e) {
    console.error('tts/generate:', e);
    res.status(500).json({ error: 'Voice generation failed. Please try again.' });
  }
});

// Serve static frontend in production
const __dirname = dirname(fileURLToPath(import.meta.url));
app.use(express.static(join(__dirname, 'dist')));
app.get('*', (_req, res) => {
  res.sendFile(join(__dirname, 'dist', 'index.html'));
});

// Validate required config on startup
try { apiKey(); } catch (e) { console.error('⚠️', (e as Error).message); process.exit(1); }

app.listen(PORT, () => {
  console.log(`Dream Weaver API listening on http://localhost:${PORT}`);
  if (elevenLabsKey()) console.log('  ✓ ElevenLabs TTS enabled');
  else console.log('  ⚠ ElevenLabs TTS not configured (ELEVENLABS_API_KEY)');
  if (ALLOWED_ORIGINS) console.log(`  ✓ CORS restricted to: ${ALLOWED_ORIGINS.join(', ')}`);
  else console.log('  ⚠ CORS open (set ALLOWED_ORIGINS for production)');
});
