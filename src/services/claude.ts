/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Story Rationality Control Model — Full Pipeline (6 Layers)
 *
 * Layer 0: Prompt Fortification (storyEngine.ts — rules 8-11)
 * Layer 1: Code Validation (storyValidator.ts — 12 automated checks)
 * Layer 2: Claude Semantic Review (storyReviewer.ts — 7 dimensions)
 * Layer 3: Auto-Fix (storyFixer.ts — targeted rewrite of failed stories)
 * Layer 4: Historical Learning (storyMemory.ts — track patterns)
 * Layer 5: Parent Feedback (storyFeedback.ts — ratings loop)
 *
 * Pipeline flow:
 *  1. Check history for theme warnings (Layer 4)
 *  2. Generate 2 stories in parallel with fortified prompt (Layer 0)
 *  3. Code validate both (Layer 1), pick best
 *  4. Claude review the best (Layer 2)
 *  5. Combine scores → accept or reject
 *  6. If rejected → auto-fix (Layer 3) → re-validate
 *  7. Record result in history (Layer 4)
 *  8. Final fallback if all else fails
 */

import { buildClaudePrompt } from '../lib/storyEngine';
import { fallbackStoryPayload } from '../lib/fallbackStory';
import type { AppLangCode } from '../lib/lang';
import { validateStory, type ValidationResult } from '../lib/storyValidator';
import { parseReviewResponse, combineScores, type ReviewResult } from '../lib/storyReviewer';
import { recordGeneration, isThemeStruggling, getThemeWeaknesses } from '../lib/storyMemory';
import { generateIllustrations } from './illustrations';
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
  /** Whether auto-fix was applied */
  fixApplied: boolean;
  /** Pipeline step where story was accepted */
  acceptedAt: 'carousel' | 'runner-up' | 'auto-fix' | 'soft-accept' | 'fallback';
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

/* ─── API Callers ─────────────────────────────────────────────────── */

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
    return null;
  }
}

async function callFix(
  story: GeneratedStoryPayload,
  config: StoryConfig,
  codeValidation: ValidationResult,
  reviewResult: ReviewResult | null,
): Promise<GeneratedStoryPayload | null> {
  try {
    const res = await fetch('/api/fix-story', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: story.title,
        content: story.content,
        config,
        codeValidation,
        reviewResult,
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { text?: string; error?: string };
    if (!data.text) return null;
    return parseStoryJson(data.text);
  } catch {
    return null;
  }
}

/* ─── Pipeline ────────────────────────────────────────────────────── */

interface Candidate {
  payload: GeneratedStoryPayload;
  codeResult: ValidationResult;
}

function buildReport(
  codeResult: ValidationResult,
  reviewResult: ReviewResult | null,
  finalScore: number,
  accepted: boolean,
  reason: string,
  fixApplied: boolean,
  acceptedAt: StoryQualityReport['acceptedAt'],
): StoryQualityReport {
  return {
    codeScore: codeResult.score,
    reviewScore: reviewResult?.score ?? null,
    finalScore,
    accepted,
    reason,
    codeIssues: codeResult.issues,
    reviewIssues: reviewResult?.issues ?? [],
    breakdown: codeResult.breakdown,
    fixApplied,
    acceptedAt,
  };
}

/**
 * Full 6-layer pipeline: fortified prompt → carousel → validate →
 * review → fix if needed → record history → return best story.
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
        const warning = `\n\nIMPORTANT — HISTORICAL QUALITY WARNING:
This theme has had recurring quality issues. PAY EXTRA ATTENTION to avoid these:
${weaknesses.map((w) => `- ${w}`).join('\n')}
These are the most common problems. Address them proactively in your story.`;
        prompt += warning;
        console.log(`[QC] Layer 4: Added ${weaknesses.length} historical warnings for theme "${theme}"`);
      }
    }

    // ── Layer 0+1: Generate 2 stories (fortified prompt) & validate ─
    const [rawA, rawB] = await Promise.all([
      callGenerate(prompt),
      callGenerate(prompt),
    ]);

    const storyA = parseStoryJson(rawA);
    const storyB = parseStoryJson(rawB);

    const candidates: Candidate[] = [];
    if (storyA) {
      candidates.push({ payload: storyA, codeResult: validateStory(storyA.content, config) });
    }
    if (storyB) {
      candidates.push({ payload: storyB, codeResult: validateStory(storyB.content, config) });
    }

    if (candidates.length === 0) {
      recordGeneration({
        timestamp: new Date().toISOString(),
        theme, language: langCode,
        codeScore: 0, reviewScore: null, finalScore: 0,
        accepted: false, fixApplied: false, issues: ['Both generations failed to parse'],
      });
      return fallbackStoryPayload(langCode);
    }

    candidates.sort((a, b) => b.codeResult.score - a.codeResult.score);
    console.log(
      `[QC] Carousel: ${candidates.map((c, i) => `Story ${i + 1}: ${c.codeResult.score}`).join(' | ')}`,
    );

    const best = candidates[0]!;

    // Very low code score = skip everything
    if (best.codeResult.score < 30) {
      console.log('[QC] Both below minimum — attempting auto-fix on best');
      const fixed = await callFix(best.payload, config, best.codeResult, null);
      if (fixed) {
        const fixedCode = validateStory(fixed.content, config);
        if (fixedCode.score >= 50) {
          console.log(`[QC] Auto-fix salvaged story: ${fixedCode.score}`);
          // Generate illustrations for the fixed story
          const illustrations = await generateIllustrations(fixed, config).catch(() => []);
          const report = buildReport(fixedCode, null, fixedCode.score, true, 'Salvaged via auto-fix', true, 'auto-fix');
          recordGeneration({
            timestamp: new Date().toISOString(),
            theme, language: langCode,
            codeScore: fixedCode.score, reviewScore: null, finalScore: fixedCode.score,
            accepted: true, fixApplied: true, issues: fixedCode.issues,
          });
          return { ...fixed, illustrations, qualityReport: report };
        }
      }
      recordGeneration({
        timestamp: new Date().toISOString(),
        theme, language: langCode,
        codeScore: best.codeResult.score, reviewScore: null, finalScore: best.codeResult.score,
        accepted: false, fixApplied: true, issues: best.codeResult.issues,
      });
      return fallbackStoryPayload(langCode);
    }

    // ── Start illustration generation in PARALLEL with review ───
    // This means zero extra wait time — images generate while Claude reviews
    const illustrationPromise = generateIllustrations(best.payload, config).catch(() => [] as StoryIllustration[]);

    // ── Layer 2: Claude semantic review on best ─────────────────
    const reviewResult = await callReview(best.payload, config, best.codeResult);
    if (reviewResult) {
      console.log(`[QC] Review: ${reviewResult.score}/100`);
    }

    // ── Combine scores ──────────────────────────────────────────
    const decision = combineScores(best.codeResult, reviewResult);
    console.log(`[QC] Decision: ${decision.reason}`);

    if (decision.accepted) {
      const illustrations = await illustrationPromise;
      const report = buildReport(best.codeResult, reviewResult, decision.finalScore, true, decision.reason, false, 'carousel');
      recordGeneration({
        timestamp: new Date().toISOString(),
        theme, language: langCode,
        codeScore: best.codeResult.score, reviewScore: reviewResult?.score ?? null,
        finalScore: decision.finalScore,
        accepted: true, fixApplied: false,
        issues: [...best.codeResult.issues, ...(reviewResult?.issues ?? [])],
      });
      return { ...best.payload, illustrations, qualityReport: report };
    }

    // ── Try runner-up ───────────────────────────────────────────
    if (candidates.length > 1) {
      const runner = candidates[1]!;
      if (runner.codeResult.score >= 40) {
        console.log(`[QC] Trying runner-up (code: ${runner.codeResult.score})`);
        const runnerReview = await callReview(runner.payload, config, runner.codeResult);
        const runnerDecision = combineScores(runner.codeResult, runnerReview);

        if (runnerDecision.accepted) {
          // Generate illustrations for runner-up (best's illustrations are for wrong story)
          const runnerIllustrations = await generateIllustrations(runner.payload, config).catch(() => []);
          const report = buildReport(runner.codeResult, runnerReview, runnerDecision.finalScore, true, runnerDecision.reason, false, 'runner-up');
          recordGeneration({
            timestamp: new Date().toISOString(),
            theme, language: langCode,
            codeScore: runner.codeResult.score, reviewScore: runnerReview?.score ?? null,
            finalScore: runnerDecision.finalScore,
            accepted: true, fixApplied: false,
            issues: [...runner.codeResult.issues, ...(runnerReview?.issues ?? [])],
          });
          return { ...runner.payload, illustrations: runnerIllustrations, qualityReport: report };
        }
      }
    }

    // ── Layer 3: Auto-fix on the best candidate ─────────────────
    console.log('[QC] Both rejected — attempting auto-fix');
    const fixed = await callFix(best.payload, config, best.codeResult, reviewResult);

    if (fixed) {
      const fixedCode = validateStory(fixed.content, config);
      console.log(`[QC] Fixed story code score: ${fixedCode.score}`);

      if (fixedCode.score >= 55) {
        // Use best's illustrations if content similar, otherwise regenerate
        const illustrations = await illustrationPromise;
        const report = buildReport(fixedCode, reviewResult, fixedCode.score, true, `Auto-fixed: code ${fixedCode.score}`, true, 'auto-fix');
        recordGeneration({
          timestamp: new Date().toISOString(),
          theme, language: langCode,
          codeScore: fixedCode.score, reviewScore: reviewResult?.score ?? null,
          finalScore: fixedCode.score,
          accepted: true, fixApplied: true,
          issues: fixedCode.issues,
        });
        return { ...fixed, illustrations, qualityReport: report };
      }
    }

    // ── Soft accept if code ≥ 45 ────────────────────────────────
    if (best.codeResult.score >= 45) {
      const illustrations = await illustrationPromise;
      console.log(`[QC] Soft accept: ${best.codeResult.score}`);
      const report = buildReport(best.codeResult, reviewResult, decision.finalScore, false, `Soft accept: ${decision.reason}`, false, 'soft-accept');
      recordGeneration({
        timestamp: new Date().toISOString(),
        theme, language: langCode,
        codeScore: best.codeResult.score, reviewScore: reviewResult?.score ?? null,
        finalScore: decision.finalScore,
        accepted: false, fixApplied: false,
        issues: [...best.codeResult.issues, ...(reviewResult?.issues ?? [])],
      });
      return { ...best.payload, illustrations, qualityReport: report };
    }

    // ── Final fallback ──────────────────────────────────────────
    console.log('[QC] All layers exhausted — fallback story');
    recordGeneration({
      timestamp: new Date().toISOString(),
      theme, language: langCode,
      codeScore: best.codeResult.score, reviewScore: reviewResult?.score ?? null,
      finalScore: decision.finalScore,
      accepted: false, fixApplied: true,
      issues: ['All quality layers exhausted — used fallback'],
    });
    return fallbackStoryPayload(langCode);
  } catch (e) {
    console.error('generateStoryWithCarousel:', e);
    return fallbackStoryPayload(langCode);
  }
}
