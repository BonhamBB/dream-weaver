/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { StoryConfig, StoryTheme } from '../types';

export interface ValidationResult {
  valid: boolean;
  issues: string[];
  score: number;
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
  'hurt', 'blood', 'enemy', 'crash', 'escape', 'terror', 'death', 'kill', 'wound',
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

/** Words/phrases that signal narrative progression and logical flow */
const TRANSITION_MARKERS = [
  'but', 'however', 'then', 'suddenly', 'meanwhile', 'later', 'after',
  'because', 'so', 'therefore', 'finally', 'at last', 'when', 'before',
  'next', 'soon', 'once', 'until', 'although', 'yet', 'still',
];

/** Words that signal emotional resolution / story arc completion */
const RESOLUTION_MARKERS = [
  'understood', 'realized', 'learned', 'knew', 'smiled', 'laughed',
  'hugged', 'forgave', 'accepted', 'peace', 'home', 'together',
  'safe', 'warm', 'love', 'friend', 'brave', 'free', 'whole',
  'hope', 'light', 'morning', 'new', 'begin', 'found',
];

/** Red flags — contradictions and lazy writing patterns */
const RED_FLAG_PATTERNS = [
  /and then everything was fine/i,
  /the end\.?\s*$/i,  // abrupt ending without Dream Bridge
  /it was all a dream/i,
  /woke up and realized/i,
  /happily ever after(?!.*dream bridge)/i,
  /(?:he|she|they) felt (happy|sad|angry|scared|afraid|lonely|brave)/i, // "tell" instead of "show"
  /(?:he|she|they) (?:was|were) (happy|sad|angry|scared|afraid|lonely|brave)/i,
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

/** Split story into rough thirds to check arc progression */
function splitIntoThirds(text: string): [string, string, string] {
  const len = text.length;
  const third = Math.floor(len / 3);
  return [
    text.slice(0, third),
    text.slice(third, third * 2),
    text.slice(third * 2),
  ];
}

/* ─── Length validation ────────────────────────────────────────────── */

function expectedWordRange(length: StoryConfig['length']): [number, number] {
  switch (length) {
    case 'kiss': return [300, 700];
    case 'bedtime': return [900, 2200];
    case 'adventure': return [1800, 3500];
    default: return [500, 2500];
  }
}

/* ─── Main validator ──────────────────────────────────────────────── */

/**
 * Validates generated story with weighted scoring (0–100).
 *
 * Checks:
 * 1. Dream Bridge quality (25 pts)
 * 2. Peaceful ending — no harsh words at end (15 pts)
 * 3. Hero presence throughout (15 pts)
 * 4. Theme relevance (10 pts)
 * 5. Story structure — narrative flow and transitions (15 pts)
 * 6. Emotional arc — setup → conflict → resolution (10 pts)
 * 7. Length compliance (5 pts)
 * 8. Writing quality — no red flags (5 pts)
 */
export function validateStory(content: string, config: StoryConfig): ValidationResult {
  const issues: string[] = [];
  const plain = stripMarkdown(content);
  if (!plain.trim()) {
    return { valid: false, issues: ['Story content is empty.'], score: 0 };
  }

  const lower = plain.toLowerCase();
  const w = words(plain);
  const wordCount = w.length;

  /* ── 1. Dream Bridge (25 pts) ─────────────────────────────────── */
  let s1 = 0;
  const hasDreamBridgeHeader = /##\s*Dream\s*Bridge/i.test(content);
  const last200 = w.slice(-200);
  let calmHits = 0;
  for (const word of last200) {
    if (CALM_WORDS.has(word)) calmHits++;
  }

  if (hasDreamBridgeHeader && calmHits >= 5) {
    s1 = 25;
  } else if (hasDreamBridgeHeader && calmHits >= 3) {
    s1 = 18;
    issues.push('Dream Bridge exists but is weak — needs more calming language');
  } else if (calmHits >= 4) {
    s1 = 12;
    issues.push('Story ends calmly but missing ## Dream Bridge header');
  } else {
    issues.push('Dream Bridge missing or very weak');
  }

  /* ── 2. Peaceful ending (15 pts) ──────────────────────────────── */
  let s2 = 15;
  const last100w = w.slice(-100);
  let harshAtEnd = 0;
  for (const word of last100w) {
    if (HARSH_WORDS.has(word)) harshAtEnd++;
  }
  if (harshAtEnd >= 3) {
    s2 = 0;
    issues.push('Story ends with too much tension/violence');
  } else if (harshAtEnd >= 1) {
    s2 = 8;
    issues.push('Minor tension at story end');
  }

  /* ── 3. Hero presence (15 pts) ────────────────────────────────── */
  let s3 = 15;
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
        s3 = Math.min(s3, 7);
      }
      if (!lastSeg.includes(n)) {
        issues.push(`Hero "${c.name.trim()}" disappears before the end`);
        s3 = Math.min(s3, 7);
      }
    }
  }

  /* ── 4. Theme relevance (10 pts) ──────────────────────────────── */
  let s4 = 10;
  const theme = config.theme;
  if (theme && theme !== 'daily') {
    const terms = THEME_TERMS[theme];
    if (terms.length > 0) {
      const hits = countOccurrences(lower, terms);
      if (hits === 0) {
        s4 = 0;
        issues.push("Story doesn't reflect chosen theme at all");
      } else if (hits < 3) {
        s4 = 5;
        issues.push('Theme is weakly represented');
      }
    }
  }

  /* ── 5. Narrative structure & flow (15 pts) ────────────────────── */
  let s5 = 0;
  const [beginning, middle, end] = splitIntoThirds(lower);

  // Check for narrative transitions throughout the story
  const transBegin = countOccurrences(beginning, TRANSITION_MARKERS);
  const transMid = countOccurrences(middle, TRANSITION_MARKERS);
  const transEnd = countOccurrences(end, TRANSITION_MARKERS);

  // Good stories have transitions distributed across all parts
  if (transBegin >= 2 && transMid >= 2 && transEnd >= 1) {
    s5 = 15; // Strong narrative flow
  } else if (transBegin >= 1 && transMid >= 1 && transEnd >= 1) {
    s5 = 10; // Adequate flow
  } else if (transBegin + transMid + transEnd >= 3) {
    s5 = 6;
    issues.push('Narrative flow is uneven — some sections lack transitions');
  } else {
    issues.push('Story lacks narrative structure — reads like disconnected scenes');
  }

  /* ── 6. Emotional arc (10 pts) ─────────────────────────────────── */
  let s6 = 0;

  // Resolution markers should appear more in the last third than the first
  const resBegin = countOccurrences(beginning, RESOLUTION_MARKERS);
  const resEnd = countOccurrences(end, RESOLUTION_MARKERS);

  if (resEnd > resBegin && resEnd >= 3) {
    s6 = 10; // Clear emotional arc — resolves at the end
  } else if (resEnd >= 2) {
    s6 = 7; // Some resolution
  } else if (resEnd >= 1) {
    s6 = 4;
    issues.push('Emotional resolution is weak');
  } else {
    issues.push('Story lacks emotional resolution — no clear arc');
  }

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
    issues.push('Minor writing quality issue: "tell not show" or lazy ending detected');
  }

  /* ── Final score ───────────────────────────────────────────────── */
  const score = s1 + s2 + s3 + s4 + s5 + s6 + s7 + s8;
  const valid = score >= 60;

  return { valid, issues, score };
}
