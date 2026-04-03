/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Client-side service for generating story illustrations.
 * Calls the Express server which proxies FAL.ai.
 */

import type { StoryConfig, StoryIllustration, IllustrationStyle } from '../types';

/** Check if illustration generation is available */
export async function isIllustrationAvailable(): Promise<boolean> {
  try {
    const res = await fetch('/api/illustrations/status');
    if (!res.ok) return false;
    const data = (await res.json()) as { available?: boolean };
    return data.available === true;
  } catch {
    return false;
  }
}

/**
 * Generate illustrations for a story.
 * Returns an array of illustrations with image URLs.
 *
 * This runs AFTER story generation and can run in parallel with
 * the quality review step for optimal performance.
 */
export async function generateIllustrations(
  story: { title: string; content: string },
  config: StoryConfig,
  style: IllustrationStyle = 'watercolor',
): Promise<StoryIllustration[]> {
  try {
    const res = await fetch('/api/illustrations/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: story.title,
        content: story.content,
        config,
        style,
      }),
    });

    if (!res.ok) {
      console.warn('[Illustrations] Generation failed:', res.status);
      return [];
    }

    const data = (await res.json()) as {
      illustrations?: StoryIllustration[];
      error?: string;
    };

    if (data.error) {
      console.warn('[Illustrations] Error:', data.error);
      return [];
    }

    return data.illustrations ?? [];
  } catch (e) {
    console.warn('[Illustrations] Network error:', e);
    return [];
  }
}
