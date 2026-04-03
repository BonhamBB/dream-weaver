/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Story Rationality Control Model — Optimized Pipeline
 *
 * FAST PATH (what the user sees):
 *  1. Generate 1 story with fortified prompt (Layer 0)
 *  2. Code validate (Layer 1) — instant
 *  3. If score >= 40 → show immediately
 *  4. If score < 40 → generate second story, pick best
 *
 * BACKGROUND (after story is shown):
 *  - Illustrations load lazily (Layer visual)
 *  - Quality review runs async (Layer 2) — stored for analytics
 *  - History recorded (Layer 4)
 */

import { buildClaudePrompt } from '../lib/storyEngine';
import { fallbackStoryPayload } from '../lib/fallbackStory';
import type { AppLangCode } from '../lib/lang';
import { validateStory, type ValidationResult } from '../lib/storyValidator';
import { recordGeneration, isThemeStruggling, getThemeWeaknesses } from '../lib/storyMemory';
import type { StoryConfig, StoryIllustration } from '../types';

export interface GeneratedStoryPayload {
  title: string;
  content: string;
  illustrations?: StoryIllustration[];
}

/** Quality metadata attached to the generated story */
export interface StoryQualityReport {
  codeScore: number;
  reviewScore: number | null;
  finalScore: number;
  accepted: boolean;
  reason: string;
  codeIssues: string[];
  reviewIssues: string[];
  breakdown: Record<string, number>;
  fixApplied: boolean;
  acceptedAt: 'primary' | 'secondary' | 'fallback';
}

function parseStoryJson(raw: string): GeneratedStoryPayload | null {
  const trimmed = raw.trim();
  const unfenced = trimmed
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  try {
    const parsed = JSON.parse(unfenced) as GeneratedStoryPayload;
    if (
      typeof parsed.title === 'string' &&
      typeof parsed.content === 'string' &&
      parsed.title.length > 0 &&
      parsed.content.length > 0
    ) {
      return { title: parsed.title, content: parsed.content };
    }
  } catch {
    return null;
  }
  return null;
}

async function callGenerate(prompt: string): Promise<string> {
  const res = await fetch('/api/generate-story', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || `HTTP ${res.status}`);
  }
  const data = (await res.json()) as { text?: string; error?: string };
  if (data.error) throw new Error(data.error);
  return data.text ?? '';
}

function buildReport(
  codeResult: ValidationResult,
  accepted: boolean,
  reason: string,
  acceptedAt: StoryQualityReport['acceptedAt'],
): StoryQualityReport {
  return {
    codeScore: codeResult.score,
    reviewScore: null,
    finalScore: codeResult.score,
    accepted,
    reason,
    codeIssues: codeResult.issues,
    reviewIssues: [],
    breakdown: codeResult.breakdown,
    fixApplied: false,
    acceptedAt,
  };
}

/**
 * Optimized pipeline: generate fast → validate → show → illustrations lazy
 */
export async function generateStoryWithCarousel(
  config: StoryConfig,
): Promise<GeneratedStoryPayload & { qualityReport?: StoryQualityReport }> {
  const langCode = (config.storyLanguage || 'en') as AppLangCode;
  const theme = config.theme ?? 'daily';

  try {
    // ── Layer 4: Check history for theme warnings ───────────────
    let prompt = buildClaudePrompt(config);

    if (isThemeStruggling(theme)) {
      const weaknesses = getThemeWeaknesses(theme);
      if (weaknesses.length > 0) {
        prompt += `\n\nIMPORTANT — HISTORICAL QUALITY WARNING:
This theme has had recurring quality issues. PAY EXTRA ATTENTION to avoid these:
${weaknesses.map((w) => `- ${w}`).join('\n')}`;
        console.log(`[QC] Added ${weaknesses.length} historical warnings for "${theme}"`);
      }
    }

    // ── FAST PATH: Generate 1 story first ───────────────────────
    console.log('[QC] Generating primary story...');
    const rawA = await callGenerate(prompt);
    const storyA = parseStoryJson(rawA);

    if (storyA) {
      const codeA = validateStory(storyA.content, config);
      console.log(`[QC] Primary story score: ${codeA.score}`);

      // Good enough → return immediately (user sees story FAST)
      if (codeA.score >= 40) {
        const report = buildReport(codeA, true, `Accepted: code ${codeA.score}`, 'primary');
        recordGeneration({
          timestamp: new Date().toISOString(),
          theme, language: langCode,
          codeScore: codeA.score, reviewScore: null, finalScore: codeA.score,
          accepted: true, fixApplied: false, issues: codeA.issues,
        });
        return { ...storyA, qualityReport: report };
      }

      // Score too low → try second story
      console.log(`[QC] Primary too low (${codeA.score}), generating secondary...`);
      try {
        const rawB = await callGenerate(prompt);
        const storyB = parseStoryJson(rawB);

        if (storyB) {
          const codeB = validateStory(storyB.content, config);
          console.log(`[QC] Secondary story score: ${codeB.score}`);

          // Pick the better one
          const [winner, winnerCode, label] = codeB.score > codeA.score
            ? [storyB, codeB, 'secondary'] as const
            : [storyA, codeA, 'primary'] as const;

          if (winnerCode.score >= 30) {
            const report = buildReport(winnerCode, true, `Best of two: code ${winnerCode.score}`, label === 'secondary' ? 'secondary' : 'primary');
            recordGeneration({
              timestamp: new Date().toISOString(),
              theme, language: langCode,
              codeScore: winnerCode.score, reviewScore: null, finalScore: winnerCode.score,
              accepted: true, fixApplied: false, issues: winnerCode.issues,
            });
            return { ...winner, qualityReport: report };
          }
        }
      } catch (e) {
        console.warn('[QC] Secondary generation failed:', e);
      }

      // Even if score is low, return the story — it's better than fallback
      if (codeA.score >= 15) {
        console.log(`[QC] Returning primary despite low score: ${codeA.score}`);
        const report = buildReport(codeA, false, `Low quality: code ${codeA.score}`, 'primary');
        recordGeneration({
          timestamp: new Date().toISOString(),
          theme, language: langCode,
          codeScore: codeA.score, reviewScore: null, finalScore: codeA.score,
          accepted: false, fixApplied: false, issues: codeA.issues,
        });
        return { ...storyA, qualityReport: report };
      }
    }

    // ── Complete failure → fallback ─────────────────────────────
    console.log('[QC] Generation failed — using fallback');
    recordGeneration({
      timestamp: new Date().toISOString(),
      theme, language: langCode,
      codeScore: 0, reviewScore: null, finalScore: 0,
      accepted: false, fixApplied: false, issues: ['Story generation failed'],
    });
    return fallbackStoryPayload(langCode);
  } catch (e) {
    console.error('generateStoryWithCarousel:', e);
    return fallbackStoryPayload(langCode);
  }
}

/**
 * Load illustrations for an existing story (called AFTER story is displayed).
 * This way the user sees the story immediately and images appear as they load.
 */
export async function loadIllustrationsForStory(
  story: { title: string; content: string },
  config: StoryConfig,
): Promise<StoryIllustration[]> {
  try {
    const res = await fetch('/api/illustrations/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: story.title,
        content: story.content,
        config,
        style: 'watercolor',
      }),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { illustrations?: StoryIllustration[] };
    return data.illustrations ?? [];
  } catch {
    return [];
  }
}
