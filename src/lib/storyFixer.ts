/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Story Rationality Control Model — Layer 3: Auto-Fix Pipeline
 *
 * When a story fails validation, instead of falling back to a generic story,
 * this module sends the specific issues back to Claude for targeted rewriting.
 * Claude receives the original story + exact problems and produces a fixed version.
 */

import type { StoryConfig } from '../types';
import type { ValidationResult } from './storyValidator';
import type { ReviewResult } from './storyReviewer';
import type { AppLangCode } from './lang';
import { claudeLanguageName } from './lang';

/**
 * Build a fix prompt that sends the original story + its problems to Claude
 * and asks for a targeted rewrite.
 */
export function buildFixPrompt(
  story: { title: string; content: string },
  config: StoryConfig,
  codeResult: ValidationResult,
  reviewResult: ReviewResult | null,
): string {
  const code = (config.storyLanguage || 'en') as AppLangCode;
  const langName = claudeLanguageName(code);

  // Collect all issues from both layers
  const allIssues: string[] = [...codeResult.issues];
  if (reviewResult) {
    allIssues.push(...reviewResult.issues);
  }

  // Deduplicate similar issues
  const uniqueIssues = [...new Set(allIssues)];

  // Build severity-ordered issue list
  const issueList = uniqueIssues.map((issue, i) => `  ${i + 1}. ${issue}`).join('\n');

  // Build breakdown context
  const breakdownLines = Object.entries(codeResult.breakdown)
    .filter(([, score]) => score < 5) // Only show weak areas
    .map(([check, score]) => `  - ${check}: ${score} (weak)`)
    .join('\n');

  return `You are a bedtime story EDITOR. You must FIX the story below.

## Original Story
Title: "${story.title}"

${story.content}

## Problems Found (MUST ALL BE FIXED)
${issueList}

## Weak Areas in Automated Scoring
${breakdownLines || '  (none critical)'}

## Fix Instructions
1. KEEP the parts that work well — don't rewrite what isn't broken.
2. FIX every issue listed above. Each one must be addressed.
3. Maintain the same language (${langName}), characters, and general plot.
4. The fixed story must still end with ## Dream Bridge.
5. Preserve the story's heart and emotional core — just fix the problems.

## Specific Fix Patterns
- "World coherence" issues → Add explanation for unexplained elements, or remove them.
- "Open threads" → Resolve every character and subplot, or remove the thread cleanly.
- "Solution depth" → Add a failed attempt before the breakthrough. Show the hero earning it.
- "Tone/creepy" → Replace unsettling imagery with warm alternatives. Darkness → starlight. Shadow → moonbeam.
- "Dream Bridge" issues → Rewrite the ending to wind down gradually: slower, softer, warmer.
- "Show don't tell" → Replace "felt scared" with physical sensations (trembling, tight chest, etc.)
- "Instant understanding" → Replace with gradual realization: small clue → questioning → deeper clue → understanding.
- "Character disappears" → Give them a clear, warm exit or bring them back for the resolution.

## Output
Respond with ONLY a raw JSON object. No markdown fences. No explanation.
{
  "title": "fixed title in ${langName}",
  "content": "full fixed story in markdown in ${langName}, ## Dream Bridge at end"
}
Escape newlines inside "content" so the JSON is valid.`;
}
