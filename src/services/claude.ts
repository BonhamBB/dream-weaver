/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { buildClaudePrompt } from '../lib/storyEngine';
import { fallbackStoryPayload } from '../lib/fallbackStory';
import type { AppLangCode } from '../lib/lang';
import { validateStory } from '../lib/storyValidator';
import type { StoryConfig } from '../types';

export interface GeneratedStoryPayload {
  title: string;
  content: string;
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

/**
 * Two parallel generations; validate; pick highest score; fallback if max < 30.
 */
export async function generateStoryWithCarousel(
  config: StoryConfig,
): Promise<GeneratedStoryPayload> {
  const langCode = (config.storyLanguage || 'en') as AppLangCode;
  const prompt = buildClaudePrompt(config);

  async function callOnce(): Promise<string> {
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

  try {
    const [rawA, rawB] = await Promise.all([callOnce(), callOnce()]);

    const storyA = parseStoryJson(rawA);
    const storyB = parseStoryJson(rawB);

    const vA = storyA
      ? validateStory(storyA.content, config)
      : { valid: false, issues: ['Invalid JSON from model A'], score: 0 };
    const vB = storyB
      ? validateStory(storyB.content, config)
      : { valid: false, issues: ['Invalid JSON from model B'], score: 0 };

    console.log(`Story 1 score: ${vA.score} | Story 2 score: ${vB.score}`);

    const ranked: { payload: GeneratedStoryPayload; score: number }[] = [];
    if (storyA) ranked.push({ payload: storyA, score: vA.score });
    if (storyB) ranked.push({ payload: storyB, score: vB.score });

    if (ranked.length === 0) {
      return fallbackStoryPayload(langCode);
    }

    ranked.sort((a, b) => b.score - a.score);
    const best = ranked[0]!;
    if (best.score >= 30) {
      return best.payload;
    }
    return fallbackStoryPayload(langCode);
  } catch (e) {
    console.error('generateStoryWithCarousel:', e);
  }

  return fallbackStoryPayload(langCode);
}
