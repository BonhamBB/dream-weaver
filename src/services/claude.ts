/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Story generation with the Story Rationality Control Model:
 *
 * Pipeline:
 *  1. Generate 2 stories in parallel (carousel)
 *  2. Run code validation (Layer 1) on both — instant, deterministic
 *  3. Pick the best candidate by code score
 *  4. Run Claude semantic review (Layer 2) on the best candidate
 *  5. Combine scores → accept or reject
 *  6. If rejected, try the second candidate (if its code score was decent)
 *  7. If both rejected → fallback story
 */

import { buildClaudePrompt } from '../lib/storyEngine';
import { fallbackStoryPayload } from '../lib/fallbackStory';
import type { AppLangCode } from '../lib/lang';
import { validateStory, type ValidationResult } from '../lib/storyValidator';
import { parseReviewResponse, combineScores, type ReviewResult } from '../lib/storyReviewer';
import type { StoryConfig } from '../types';

export interface GeneratedStoryPayload {
  title: string;
  content: string;
}

/** Quality metadata attached to the generated story for debugging */
export interface StoryQualityReport {
  codeScore: number;
  reviewScore: number | null;
  finalScore: number;
  accepted: boolean;
  reason: string;
  codeIssues: string[];
  reviewIssues: string[];
  breakdown: Record<string, number>;
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
      return {
        title: parsed.title,
        content: parsed.content,
      };
    }
  } catch {
    return null;
  }
  return null;
}

/** Call the generate-story API once */
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

/** Call the review-story API (Layer 2 semantic review) */
async function callReview(
  story: GeneratedStoryPayload,
  config: StoryConfig,
  codeValidation: ValidationResult,
): Promise<ReviewResult | null> {
  try {
    const res = await fetch('/api/review-story', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: story.title,
        content: story.content,
        config,
        codeValidation,
      }),
    });
    if (!res.ok) return null;

    const data = (await res.json()) as { text?: string; error?: string };
    if (!data.text) return null;

    return parseReviewResponse(data.text);
  } catch {
    // Review is non-critical — story can still pass with code-only validation
    return null;
  }
}

interface Candidate {
  payload: GeneratedStoryPayload;
  codeResult: ValidationResult;
}

/**
 * Full pipeline: generate → validate → review → select best story.
 *
 * Returns both the story payload and the quality report.
 */
export async function generateStoryWithCarousel(
  config: StoryConfig,
): Promise<GeneratedStoryPayload & { qualityReport?: StoryQualityReport }> {
  const langCode = (config.storyLanguage || 'en') as AppLangCode;
  const prompt = buildClaudePrompt(config);

  try {
    // ── Step 1: Generate 2 stories in parallel ──────────────────
    const [rawA, rawB] = await Promise.all([
      callGenerate(prompt),
      callGenerate(prompt),
    ]);

    const storyA = parseStoryJson(rawA);
    const storyB = parseStoryJson(rawB);

    // ── Step 2: Code validation (Layer 1) on both ───────────────
    const candidates: Candidate[] = [];

    if (storyA) {
      candidates.push({
        payload: storyA,
        codeResult: validateStory(storyA.content, config),
      });
    }
    if (storyB) {
      candidates.push({
        payload: storyB,
        codeResult: validateStory(storyB.content, config),
      });
    }

    if (candidates.length === 0) {
      return fallbackStoryPayload(langCode);
    }

    // Sort by code score descending
    candidates.sort((a, b) => b.codeResult.score - a.codeResult.score);

    console.log(
      `[QC] Carousel scores: ${candidates.map((c, i) => `Story ${i + 1}: ${c.codeResult.score}`).join(' | ')}`,
    );

    // ── Step 3: If best candidate has very low code score, skip review ──
    const best = candidates[0]!;
    if (best.codeResult.score < 30) {
      console.log('[QC] Both stories below minimum code threshold — using fallback');
      return fallbackStoryPayload(langCode);
    }

    // ── Step 4: Claude semantic review (Layer 2) on best candidate ──
    const reviewResult = await callReview(best.payload, config, best.codeResult);

    if (reviewResult) {
      console.log(`[QC] Review score: ${reviewResult.score}/100`);
      if (reviewResult.issues.length > 0) {
        console.log(`[QC] Review issues: ${reviewResult.issues.join('; ')}`);
      }
    } else {
      console.log('[QC] Review unavailable — proceeding with code-only');
    }

    // ── Step 5: Combine scores ──────────────────────────────────
    const decision = combineScores(best.codeResult, reviewResult);
    console.log(`[QC] Decision: ${decision.reason}`);

    if (decision.accepted) {
      return {
        ...best.payload,
        qualityReport: {
          codeScore: best.codeResult.score,
          reviewScore: reviewResult?.score ?? null,
          finalScore: decision.finalScore,
          accepted: true,
          reason: decision.reason,
          codeIssues: best.codeResult.issues,
          reviewIssues: reviewResult?.issues ?? [],
          breakdown: best.codeResult.breakdown,
        },
      };
    }

    // ── Step 6: Try second candidate if available ────────────────
    if (candidates.length > 1) {
      const runner = candidates[1]!;
      if (runner.codeResult.score >= 40) {
        console.log(`[QC] Trying runner-up (code score: ${runner.codeResult.score})`);
        const runnerReview = await callReview(runner.payload, config, runner.codeResult);
        const runnerDecision = combineScores(runner.codeResult, runnerReview);

        if (runnerDecision.accepted) {
          console.log(`[QC] Runner-up accepted: ${runnerDecision.reason}`);
          return {
            ...runner.payload,
            qualityReport: {
              codeScore: runner.codeResult.score,
              reviewScore: runnerReview?.score ?? null,
              finalScore: runnerDecision.finalScore,
              accepted: true,
              reason: runnerDecision.reason,
              codeIssues: runner.codeResult.issues,
              reviewIssues: runnerReview?.issues ?? [],
              breakdown: runner.codeResult.breakdown,
            },
          };
        }
      }
    }

    // ── Step 7: Both rejected — use best anyway if code ≥ 45 ────
    // (Soft fallback: slightly below threshold is better than generic fallback)
    if (best.codeResult.score >= 45) {
      console.log(`[QC] Soft accept: best story code score ${best.codeResult.score} (below combined threshold but above soft floor)`);
      return {
        ...best.payload,
        qualityReport: {
          codeScore: best.codeResult.score,
          reviewScore: reviewResult?.score ?? null,
          finalScore: decision.finalScore,
          accepted: false,
          reason: `Soft accept: ${decision.reason}`,
          codeIssues: best.codeResult.issues,
          reviewIssues: reviewResult?.issues ?? [],
          breakdown: best.codeResult.breakdown,
        },
      };
    }

    console.log('[QC] All candidates rejected — using fallback story');
    return fallbackStoryPayload(langCode);
  } catch (e) {
    console.error('generateStoryWithCarousel:', e);
    return fallbackStoryPayload(langCode);
  }
}
