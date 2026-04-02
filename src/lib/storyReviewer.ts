/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Story Rationality Control Model — Layer 2: Claude Semantic Reviewer
 *
 * Sends the generated story back to Claude for deep semantic analysis.
 * Catches issues that code checks cannot: world coherence, character
 * consistency, plot holes, open threads, solution depth, and more.
 */

import type { StoryConfig } from '../types';
import type { ValidationResult } from './storyValidator';

export interface ReviewResult {
  /** 0–100 semantic quality score */
  score: number;
  /** Per-dimension scores */
  dimensions: {
    worldCoherence: number;       // 0-20: Are settings/rules internally consistent?
    characterConsistency: number;  // 0-15: Do characters behave consistently?
    plotCompleteness: number;      // 0-15: Are all threads resolved?
    solutionDepth: number;         // 0-15: Is the resolution earned, not instant?
    toneForBedtime: number;        // 0-15: Is the overall tone appropriate?
    languageQuality: number;       // 0-10: Grammar, word choice, fluency
    dreamBridgeNaturalness: number; // 0-10: Does the ending flow naturally?
  };
  /** Specific issues found */
  issues: string[];
  /** Brief overall assessment */
  summary: string;
}

/**
 * Build the review prompt that asks Claude to evaluate the story.
 * Uses structured output for reliable parsing.
 */
export function buildReviewPrompt(
  story: { title: string; content: string },
  config: StoryConfig,
  codeValidation: ValidationResult,
): string {
  const childrenDesc = config.children.length > 0
    ? config.children.map((c) => `${c.name} (age ${c.age}${c.makeHero ? ', hero' : ''})`).join(', ')
    : 'No specific children (generic hero)';

  const codeIssuesList = codeValidation.issues.length > 0
    ? codeValidation.issues.map((i) => `  - ${i}`).join('\n')
    : '  (none)';

  return `You are a bedtime story quality reviewer for a children's app called Dream Weaver.
Your job is to evaluate a generated story for LOGICAL COHERENCE, NARRATIVE QUALITY, and BEDTIME APPROPRIATENESS.

## Story Context
- Theme: ${config.theme ?? 'AI chose'}
- Mode: ${config.mode}
- Length: ${config.length}
- Language: ${config.storyLanguage}
- Target audience: ${childrenDesc}

## Automated Code Check Results (score: ${codeValidation.score}/100)
Issues already detected by code:
${codeIssuesList}

## The Story
Title: "${story.title}"

${story.content}

---

## Your Task
Evaluate this story across 7 dimensions. For each, give a score AND explain any problems found.
Be STRICT but FAIR. A good bedtime story should:
- Have a world that makes sense (if there's a cave, explain why it's there)
- Have characters that behave consistently (no sudden personality changes without reason)
- Resolve ALL threads it opens (if grandmother is mentioned, she must matter)
- Earn its resolution (the hero must struggle, grow, or sacrifice — not just instantly understand)
- Be calming toward the end (this is for bedtime — wind down, don't ramp up)
- Use correct, fluent language (no misused words, no awkward phrasing)
- Transition naturally into the Dream Bridge (not an abrupt gear-shift)

Respond with ONLY a raw JSON object. No markdown fences. No explanation outside the JSON.
{
  "worldCoherence": <0-20>,
  "worldCoherenceNotes": "<specific issues or 'Good'>",
  "characterConsistency": <0-15>,
  "characterConsistencyNotes": "<specific issues or 'Good'>",
  "plotCompleteness": <0-15>,
  "plotCompletenessNotes": "<specific issues or 'Good'>",
  "solutionDepth": <0-15>,
  "solutionDepthNotes": "<specific issues or 'Good'>",
  "toneForBedtime": <0-15>,
  "toneForBedtimeNotes": "<specific issues or 'Good'>",
  "languageQuality": <0-10>,
  "languageQualityNotes": "<specific issues or 'Good'>",
  "dreamBridgeNaturalness": <0-10>,
  "dreamBridgeNaturalnessNotes": "<specific issues or 'Good'>",
  "overallSummary": "<2-3 sentence overall assessment>",
  "criticalIssues": ["<issue1>", "<issue2>"]
}`;
}

/**
 * Parse the Claude reviewer's JSON response into a ReviewResult.
 * Returns null if parsing fails.
 */
export function parseReviewResponse(raw: string): ReviewResult | null {
  try {
    const trimmed = raw.trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

    const parsed = JSON.parse(trimmed) as Record<string, unknown>;

    const num = (key: string, max: number): number => {
      const v = Number(parsed[key]);
      if (!Number.isFinite(v)) return 0;
      return Math.min(max, Math.max(0, v));
    };

    const str = (key: string): string => {
      const v = parsed[key];
      return typeof v === 'string' ? v : '';
    };

    const arr = (key: string): string[] => {
      const v = parsed[key];
      if (!Array.isArray(v)) return [];
      return v.filter((x): x is string => typeof x === 'string');
    };

    const dimensions = {
      worldCoherence: num('worldCoherence', 20),
      characterConsistency: num('characterConsistency', 15),
      plotCompleteness: num('plotCompleteness', 15),
      solutionDepth: num('solutionDepth', 15),
      toneForBedtime: num('toneForBedtime', 15),
      languageQuality: num('languageQuality', 10),
      dreamBridgeNaturalness: num('dreamBridgeNaturalness', 10),
    };

    const score = Object.values(dimensions).reduce((a, b) => a + b, 0);

    // Collect issues from notes
    const issues: string[] = [];
    const noteKeys = [
      'worldCoherenceNotes', 'characterConsistencyNotes',
      'plotCompletenessNotes', 'solutionDepthNotes',
      'toneForBedtimeNotes', 'languageQualityNotes',
      'dreamBridgeNaturalnessNotes',
    ];
    for (const key of noteKeys) {
      const note = str(key);
      if (note && note.toLowerCase() !== 'good' && note.trim().length > 2) {
        issues.push(note);
      }
    }
    // Add critical issues
    issues.push(...arr('criticalIssues'));

    return {
      score,
      dimensions,
      issues,
      summary: str('overallSummary'),
    };
  } catch {
    return null;
  }
}

/**
 * Combine code validation score and Claude review score into a final decision.
 *
 * Code check: 60% weight (fast, deterministic, catches structural issues)
 * Claude review: 40% weight (slower, semantic, catches logical issues)
 *
 * Both must pass their individual thresholds for the story to be accepted.
 */
export function combineScores(
  codeResult: ValidationResult,
  reviewResult: ReviewResult | null,
): {
  finalScore: number;
  accepted: boolean;
  reason: string;
} {
  // If review failed (parsing error, network error), fall back to code-only
  if (!reviewResult) {
    return {
      finalScore: codeResult.score,
      accepted: codeResult.score >= 60,
      reason: codeResult.score >= 60
        ? 'Accepted (code-only — review unavailable)'
        : `Rejected: code score ${codeResult.score}/100 below threshold`,
    };
  }

  const combined = Math.round(codeResult.score * 0.6 + reviewResult.score * 0.4);

  // Both must meet minimum thresholds
  const codePass = codeResult.score >= 50;   // Slightly lower threshold since review compensates
  const reviewPass = reviewResult.score >= 45; // ~45/100 = minimum semantic quality
  const combinedPass = combined >= 55;

  const accepted = codePass && reviewPass && combinedPass;

  let reason: string;
  if (accepted) {
    reason = `Accepted: combined ${combined}/100 (code ${codeResult.score}, review ${reviewResult.score})`;
  } else {
    const fails: string[] = [];
    if (!codePass) fails.push(`code ${codeResult.score}/100 < 50`);
    if (!reviewPass) fails.push(`review ${reviewResult.score}/100 < 45`);
    if (!combinedPass) fails.push(`combined ${combined}/100 < 55`);
    reason = `Rejected: ${fails.join(', ')}`;
  }

  return { finalScore: combined, accepted, reason };
}
