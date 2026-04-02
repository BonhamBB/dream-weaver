/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Story Rationality Control Model — Layer 1: Automated Code Checks
 *
 * Weighted scoring (0–100) across 12 checks:
 *  1. Dream Bridge quality          (20 pts)
 *  2. Peaceful ending               (10 pts)
 *  3. Hero presence & consistency   (10 pts)
 *  4. Theme relevance               ( 5 pts)
 *  5. Narrative flow & transitions  (10 pts)
 *  6. Emotional arc                 ( 8 pts)
 *  7. Length compliance             ( 5 pts)
 *  8. Writing quality — red flags   ( 5 pts)
 *  9. Tone safety for bedtime       ( 8 pts)
 * 10. Show-don't-tell ratio         ( 7 pts)
 * 11. Vocabulary & sensory richness ( 7 pts)
 * 12. Pacing curve                  ( 5 pts)
 */

import type { StoryConfig, StoryTheme } from '../types';

export interface ValidationResult {
  valid: boolean;
  issues: string[];
  score: number;
  /** Per-check breakdown for debugging / reviewer context */
  breakdown: Record<string, number>;
}

/* ─── Word lists ──────────────────────────────────────────────────── */

const CALM_WORDS = new Set([
  'sleep', 'dream', 'dreams', 'eyes', 'close', 'quiet', 'soft', 'gentle',
  'rest', 'peaceful', 'drift', 'stars', 'moon', 'night', 'heavy', 'morning',
  'pillow', 'breathe', 'calm', 'safe', 'you', 'warm', 'blanket', 'whisper',
  'slowly', 'lullaby', 'hush', 'silence', 'yawn',
]);

const HARSH_WORDS = new Set([
  'fight', 'battle', 'attack', 'run', 'chase', 'scream', 'danger', 'fell',
  'hurt', 'blood', 'enemy', 'crash', 'escape', 'terror', 'death', 'kill',
  'wound', 'destroy', 'explode', 'stab', 'smash', 'rip', 'devour',
]);

/** Words that are creepy / unsettling for young children at bedtime */
const CREEPY_WORDS = new Set([
  'shadow', 'shadows', 'darkness', 'disappear', 'disappeared', 'vanish',
  'vanished', 'ghost', 'scream', 'screamed', 'terror', 'horror', 'creep',
  'crawl', 'lurk', 'lurking', 'haunted', 'haunt', 'grave', 'skull',
  'skeleton', 'blood', 'bleed', 'corpse', 'demon', 'devil', 'curse',
  'cursed', 'nightmare', 'trapped', 'suffocate', 'drown', 'drowned',
]);

const THEME_TERMS: Record<StoryTheme, string[]> = {
  magic: ['magic', 'spell', 'wizard', 'enchant', 'wand', 'potion', 'dragon', 'fairy', 'castle', 'kingdom', 'sorcerer', 'witch', 'charm', 'mystical', 'portal'],
  nature: ['animal', 'forest', 'tree', 'bird', 'river', 'garden', 'leaf', 'nest', 'fox', 'rabbit', 'bear', 'wolf', 'ocean', 'mountain', 'flower'],
  wisdom: ['wise', 'ancient', 'teach', 'learn', 'master', 'temple', 'story', 'truth', 'path', 'spirit', 'myth', 'legend', 'sage', 'tradition', 'sacred'],
  emotions: ['friend', 'feel', 'heart', 'tear', 'smile', 'hug', 'alone', 'together', 'trust', 'brave', 'love', 'afraid', 'hope', 'understand', 'belong'],
  moral: ['choice', 'right', 'wrong', 'decide', 'fair', 'honest', 'consequence', 'dilemma', 'judge', 'value', 'promise', 'truth', 'justice', 'forgive', 'responsible'],
  modern: ['school', 'phone', 'class', 'teacher', 'home', 'family', 'game', 'screen', 'friend', 'today', 'internet', 'message', 'homework', 'parent', 'city'],
  daily: [],
};

/* ─── Narrative flow markers ──────────────────────────────────────── */

const TRANSITION_MARKERS = [
  'but', 'however', 'then', 'suddenly', 'meanwhile', 'later', 'after',
  'because', 'so', 'therefore', 'finally', 'at last', 'when', 'before',
  'next', 'soon', 'once', 'until', 'although', 'yet', 'still',
];

const RESOLUTION_MARKERS = [
  'understood', 'realized', 'learned', 'knew', 'smiled', 'laughed',
  'hugged', 'forgave', 'accepted', 'peace', 'home', 'together',
  'safe', 'warm', 'love', 'friend', 'brave', 'free', 'whole',
  'hope', 'light', 'morning', 'new', 'begin', 'found',
];

/** Physical / sensory language — show-don't-tell signals */
const SENSORY_WORDS = [
  'trembl', 'shiver', 'whisper', 'gasp', 'sigh', 'clench', 'squeeze',
  'shook', 'shaking', 'breath', 'heartbeat', 'pulse', 'swallow',
  'blink', 'flinch', 'stumbl', 'tiptoe', 'grip', 'clutch', 'press',
  // sensory descriptors
  'warm', 'cold', 'soft', 'rough', 'bright', 'dim', 'glow', 'shimmer',
  'echo', 'rustle', 'crunch', 'splash', 'fragrant', 'scent', 'taste',
  'sweet', 'bitter', 'tingle', 'breeze', 'damp', 'crisp',
];

/** "Tell" patterns — emotional labels instead of showing */
const TELL_PATTERNS = [
  /(?:he|she|they|it|the \w+) (?:felt|was|were|seemed|became|looked) (?:very |so |really |extremely )?(?:happy|sad|angry|scared|afraid|lonely|brave|proud|jealous|excited|nervous|anxious|confused|frustrated|disappointed|worried|terrified|furious|delighted|heartbroken)/gi,
  /(?:filled with|overcome with|overwhelmed by) (?:joy|sadness|anger|fear|loneliness|bravery|pride|jealousy|excitement|worry)/gi,
];

/** Red flags — contradictions and lazy writing patterns */
const RED_FLAG_PATTERNS = [
  /and then everything was fine/i,
  /the end\.?\s*$/i,
  /it was all a dream/i,
  /woke up and realized/i,
  /happily ever after(?!.*dream bridge)/i,
  /and they all lived/i,
  /magically fixed/i,
  /problem solved itself/i,
  /instantly understood/i,
  /suddenly everything made sense/i,
];

/* ─── Helpers ─────────────────────────────────────────────────────── */

function stripMarkdown(s: string): string {
  return s
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[#*_~`]/g, ' ')
    .replace(/\[[^\]]*\]\([^)]*\)/g, ' ');
}

function words(text: string): string[] {
  return stripMarkdown(text)
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.replace(/[^a-z0-9\u0590-\u05ff\u0600-\u06ff\u0400-\u04ff\u3040-\u30ff\u4e00-\u9fff]/gi, ''))
    .filter(Boolean);
}

function wordInText(word: string, haystack: string): boolean {
  const re = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
  return re.test(haystack);
}

function countOccurrences(text: string, targets: string[]): number {
  let count = 0;
  const lower = text.toLowerCase();
  for (const t of targets) {
    if (wordInText(t, lower)) count++;
  }
  return count;
}

/** Count how many times partial-match targets appear in text */
function countPartialOccurrences(text: string, targets: string[]): number {
  let count = 0;
  const lower = text.toLowerCase();
  for (const t of targets) {
    if (lower.includes(t.toLowerCase())) count++;
  }
  return count;
}

function splitIntoThirds(text: string): [string, string, string] {
  const len = text.length;
  const third = Math.floor(len / 3);
  return [
    text.slice(0, third),
    text.slice(third, third * 2),
    text.slice(third * 2),
  ];
}

/** Split into ~equal sentence groups for pacing analysis */
function splitIntoSegments(text: string, n: number): string[] {
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 5);
  const perSeg = Math.max(1, Math.ceil(sentences.length / n));
  const segments: string[] = [];
  for (let i = 0; i < n; i++) {
    segments.push(sentences.slice(i * perSeg, (i + 1) * perSeg).join('. '));
  }
  return segments;
}

function expectedWordRange(length: StoryConfig['length']): [number, number] {
  switch (length) {
    case 'kiss': return [300, 700];
    case 'bedtime': return [900, 2200];
    case 'adventure': return [1800, 3500];
    default: return [500, 2500];
  }
}

/** Count unique words (vocabulary richness measure) */
function vocabularyDiversity(w: string[]): number {
  if (w.length === 0) return 0;
  const unique = new Set(w);
  return unique.size / w.length; // type-token ratio
}

/** Average sentence length in words */
function avgSentenceLength(text: string): number {
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 3);
  if (sentences.length === 0) return 0;
  const totalWords = sentences.reduce((sum, s) => sum + s.trim().split(/\s+/).length, 0);
  return totalWords / sentences.length;
}

/* ─── Main validator ──────────────────────────────────────────────── */

export function validateStory(content: string, config: StoryConfig): ValidationResult {
  const issues: string[] = [];
  const breakdown: Record<string, number> = {};
  const plain = stripMarkdown(content);
  if (!plain.trim()) {
    return { valid: false, issues: ['Story content is empty.'], score: 0, breakdown: {} };
  }

  const lower = plain.toLowerCase();
  const w = words(plain);
  const wordCount = w.length;

  /* ── 1. Dream Bridge (20 pts) ─────────────────────────────────── */
  let s1 = 0;
  const hasDreamBridgeHeader = /##\s*Dream\s*Bridge/i.test(content);
  const last200 = w.slice(-200);
  let calmHits = 0;
  for (const word of last200) {
    if (CALM_WORDS.has(word)) calmHits++;
  }

  if (hasDreamBridgeHeader && calmHits >= 5) {
    s1 = 20;
  } else if (hasDreamBridgeHeader && calmHits >= 3) {
    s1 = 14;
    issues.push('Dream Bridge exists but is weak — needs more calming language');
  } else if (calmHits >= 4) {
    s1 = 10;
    issues.push('Story ends calmly but missing ## Dream Bridge header');
  } else {
    issues.push('Dream Bridge missing or very weak');
  }
  breakdown['dreamBridge'] = s1;

  /* ── 2. Peaceful ending (10 pts) ──────────────────────────────── */
  let s2 = 10;
  const last100w = w.slice(-100);
  let harshAtEnd = 0;
  for (const word of last100w) {
    if (HARSH_WORDS.has(word)) harshAtEnd++;
  }
  if (harshAtEnd >= 3) {
    s2 = 0;
    issues.push('Story ends with too much tension/violence');
  } else if (harshAtEnd >= 1) {
    s2 = 5;
    issues.push('Minor tension at story end');
  }
  breakdown['peacefulEnding'] = s2;

  /* ── 3. Hero presence (10 pts) ────────────────────────────────── */
  let s3 = 10;
  const namedHeroes = config.children.filter((c) => c.makeHero === true && c.name.trim());
  if (namedHeroes.length > 0) {
    const charLen = plain.length;
    const q = Math.max(1, Math.floor(charLen * 0.25));
    const firstSeg = plain.slice(0, q).toLowerCase();
    const lastSeg = plain.slice(charLen - q).toLowerCase();
    for (const c of namedHeroes) {
      const n = c.name.trim().toLowerCase();
      if (!lower.includes(n)) {
        issues.push(`Hero "${c.name.trim()}" not found in story at all`);
        s3 = 0;
        break;
      }
      if (!firstSeg.includes(n)) {
        issues.push(`Hero "${c.name.trim()}" missing from story beginning`);
        s3 = Math.min(s3, 5);
      }
      if (!lastSeg.includes(n)) {
        issues.push(`Hero "${c.name.trim()}" disappears before the end`);
        s3 = Math.min(s3, 5);
      }
    }
  }
  breakdown['heroPresence'] = s3;

  /* ── 4. Theme relevance (5 pts) ───────────────────────────────── */
  let s4 = 5;
  const theme = config.theme;
  if (theme && theme !== 'daily') {
    const terms = THEME_TERMS[theme];
    if (terms.length > 0) {
      const hits = countOccurrences(lower, terms);
      if (hits === 0) {
        s4 = 0;
        issues.push("Story doesn't reflect chosen theme at all");
      } else if (hits < 3) {
        s4 = 2;
        issues.push('Theme is weakly represented');
      }
    }
  }
  breakdown['themeRelevance'] = s4;

  /* ── 5. Narrative structure & flow (10 pts) ───────────────────── */
  let s5 = 0;
  const [beginning, middle, end] = splitIntoThirds(lower);
  const transBegin = countOccurrences(beginning, TRANSITION_MARKERS);
  const transMid = countOccurrences(middle, TRANSITION_MARKERS);
  const transEnd = countOccurrences(end, TRANSITION_MARKERS);

  if (transBegin >= 2 && transMid >= 2 && transEnd >= 1) {
    s5 = 10;
  } else if (transBegin >= 1 && transMid >= 1 && transEnd >= 1) {
    s5 = 7;
  } else if (transBegin + transMid + transEnd >= 3) {
    s5 = 4;
    issues.push('Narrative flow is uneven — some sections lack transitions');
  } else {
    issues.push('Story lacks narrative structure — reads like disconnected scenes');
  }
  breakdown['narrativeFlow'] = s5;

  /* ── 6. Emotional arc (8 pts) ─────────────────────────────────── */
  let s6 = 0;
  const resBegin = countOccurrences(beginning, RESOLUTION_MARKERS);
  const resEnd = countOccurrences(end, RESOLUTION_MARKERS);

  if (resEnd > resBegin && resEnd >= 3) {
    s6 = 8;
  } else if (resEnd >= 2) {
    s6 = 5;
  } else if (resEnd >= 1) {
    s6 = 3;
    issues.push('Emotional resolution is weak');
  } else {
    issues.push('Story lacks emotional resolution — no clear arc');
  }
  breakdown['emotionalArc'] = s6;

  /* ── 7. Length compliance (5 pts) ──────────────────────────────── */
  let s7 = 5;
  const [minWords, maxWords] = expectedWordRange(config.length);
  if (wordCount < minWords) {
    s7 = 0;
    issues.push(`Story too short: ${wordCount} words (expected ${minWords}–${maxWords})`);
  } else if (wordCount > maxWords) {
    s7 = 2;
    issues.push(`Story too long: ${wordCount} words (expected ${minWords}–${maxWords})`);
  }
  breakdown['length'] = s7;

  /* ── 8. Writing quality — red flags (5 pts) ────────────────────── */
  let s8 = 5;
  let flagCount = 0;
  for (const pattern of RED_FLAG_PATTERNS) {
    if (pattern.test(plain)) {
      flagCount++;
    }
  }
  if (flagCount >= 3) {
    s8 = 0;
    issues.push('Multiple writing quality issues: lazy patterns detected');
  } else if (flagCount >= 1) {
    s8 = 2;
    issues.push('Minor writing quality issue: lazy ending or instant resolution detected');
  }
  breakdown['writingQuality'] = s8;

  /* ── 9. Tone safety for bedtime (8 pts) — NEW ─────────────────── */
  let s9 = 8;
  let creepyCount = 0;
  for (const word of w) {
    if (CREEPY_WORDS.has(word)) creepyCount++;
  }
  // Allow some darkness in middle of story (conflict), but penalize heavy concentration
  const youngest = config.children.length > 0
    ? Math.min(...config.children.map((c) => c.age).filter((a) => a > 0))
    : 7;

  // Stricter for younger children
  const creepyThreshold = youngest <= 5 ? 2 : youngest <= 9 ? 5 : 8;

  if (creepyCount > creepyThreshold * 2) {
    s9 = 0;
    issues.push(`Too many unsettling words (${creepyCount}) for age ${youngest} bedtime story`);
  } else if (creepyCount > creepyThreshold) {
    s9 = 3;
    issues.push(`Some unsettling language (${creepyCount} creepy words) — may not be ideal for bedtime`);
  }

  // Extra check: creepy words in the last third are worse (should be winding down)
  const lastThirdWords = w.slice(Math.floor(w.length * 0.66));
  let creepyAtEnd = 0;
  for (const word of lastThirdWords) {
    if (CREEPY_WORDS.has(word)) creepyAtEnd++;
  }
  if (creepyAtEnd >= 3 && s9 > 0) {
    s9 = Math.max(0, s9 - 3);
    issues.push('Unsettling language persists near story end — should calm down');
  }
  breakdown['toneSafety'] = s9;

  /* ── 10. Show-don't-tell ratio (7 pts) — NEW ──────────────────── */
  let s10 = 7;

  // Count "tell" violations
  let tellCount = 0;
  for (const pattern of TELL_PATTERNS) {
    const matches = plain.match(pattern);
    if (matches) tellCount += matches.length;
  }

  // Count "show" signals (sensory/physical language)
  const showCount = countPartialOccurrences(lower, SENSORY_WORDS);

  if (tellCount >= 5) {
    s10 = 0;
    issues.push(`Heavy "tell" language (${tellCount} instances) — emotions are labeled, not shown`);
  } else if (tellCount >= 3) {
    s10 = 3;
    issues.push(`Some "tell" language (${tellCount} instances) — prefer showing emotions physically`);
  } else if (tellCount >= 1 && showCount < 3) {
    s10 = 4;
    issues.push('Could use more sensory/physical language to show emotions');
  }

  // Bonus: if strong show signals present, forgive minor tells
  if (showCount >= 8 && tellCount <= 2) {
    s10 = 7;
  }
  breakdown['showDontTell'] = s10;

  /* ── 11. Vocabulary & sensory richness (7 pts) — NEW ──────────── */
  let s11 = 0;
  const ttr = vocabularyDiversity(w);
  const sensoryHits = showCount; // reuse from check 10

  // Type-token ratio: 0.4+ is decent for a story, 0.5+ is good
  if (ttr >= 0.5 && sensoryHits >= 5) {
    s11 = 7;
  } else if (ttr >= 0.45 && sensoryHits >= 3) {
    s11 = 5;
  } else if (ttr >= 0.35) {
    s11 = 3;
    issues.push('Vocabulary is somewhat repetitive');
  } else {
    s11 = 1;
    issues.push('Vocabulary is very repetitive — story feels flat');
  }
  breakdown['vocabularyRichness'] = s11;

  /* ── 12. Pacing curve (5 pts) — NEW ───────────────────────────── */
  let s12 = 0;

  // Good bedtime story pacing: sentences get shorter toward the end
  const segments = splitIntoSegments(plain, 4);
  if (segments.length >= 4) {
    const avgLens = segments.map((seg) => avgSentenceLength(seg));
    // Last segment should have shorter sentences than the peak (usually middle)
    const peakAvg = Math.max(avgLens[0]!, avgLens[1]!, avgLens[2]!);
    const endAvg = avgLens[3]!;

    if (endAvg < peakAvg && endAvg > 0) {
      s12 = 5; // Good pacing: sentences shorten toward end
    } else if (endAvg <= peakAvg * 1.1) {
      s12 = 3; // Acceptable: roughly even
    } else {
      s12 = 1;
      issues.push('Pacing issue: sentences don\'t slow down toward the end (bedtime = wind down)');
    }
  } else {
    s12 = 3; // Too short to analyze meaningfully
  }
  breakdown['pacing'] = s12;

  /* ── Final score ───────────────────────────────────────────────── */
  const score = s1 + s2 + s3 + s4 + s5 + s6 + s7 + s8 + s9 + s10 + s11 + s12;
  const valid = score >= 60;

  return { valid, issues, score, breakdown };
}
