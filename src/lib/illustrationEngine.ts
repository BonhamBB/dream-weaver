/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Illustration Engine — Extracts visual scenes from a story and
 * builds image generation prompts for each scene.
 *
 * Two strategies:
 *  1. Scene markers: If the story contains <!-- SCENE: ... --> markers
 *     (added by the generation prompt), extract them directly.
 *  2. Fallback: Split story into sections and create prompts from content.
 */

import type { IllustrationStyle } from '../types';

export interface SceneDescription {
  /** 0-based index within the story */
  index: number;
  /** The text description for image generation */
  description: string;
  /** Approximate character position in story content */
  position: number;
}

/** Style modifiers for image generation */
const STYLE_PROMPTS: Record<IllustrationStyle, string> = {
  watercolor: 'beautiful watercolor children\'s book illustration, soft pastel colors, dreamy and gentle, hand-painted style, warm lighting',
  cartoon: 'charming cartoon illustration for children, bright vibrant colors, friendly rounded shapes, Disney-Pixar inspired, warm and inviting',
  storybook: 'classic storybook illustration, rich detailed oil painting style, golden age children\'s book art, enchanting and magical atmosphere, warm tones',
};

/** Negative prompt to avoid inappropriate content */
const NEGATIVE_PROMPT = 'scary, dark, violent, blood, horror, realistic photo, photographic, ugly, deformed, disfigured, blurry, bad anatomy, extra limbs, text, watermark, signature, adult content, nudity';

/**
 * Extract scene markers from story content.
 * Looks for <!-- SCENE: description --> HTML comments.
 */
export function extractSceneMarkers(content: string): SceneDescription[] {
  const scenes: SceneDescription[] = [];
  const regex = /<!--\s*SCENE:\s*(.+?)\s*-->/gi;
  let match: RegExpExecArray | null;
  let index = 0;

  while ((match = regex.exec(content)) !== null) {
    scenes.push({
      index,
      description: match[1]!.trim(),
      position: match.index,
    });
    index++;
  }

  return scenes;
}

/**
 * Fallback: Split story into sections and generate scene descriptions.
 * Uses paragraph boundaries and section headers to find natural break points.
 */
export function extractScenesFallback(content: string, targetCount: number = 4): SceneDescription[] {
  // Remove Dream Bridge section — we don't illustrate the sleep transition
  const withoutBridge = content.replace(/##\s*Dream\s*Bridge[\s\S]*$/i, '').trim();

  // Split into paragraphs (double newline or markdown headers)
  const paragraphs = withoutBridge
    .split(/\n\n+|(?=^##\s)/m)
    .map((p) => p.trim())
    .filter((p) => p.length > 50); // Skip short paragraphs

  if (paragraphs.length === 0) return [];

  // Pick evenly spaced paragraphs
  const step = Math.max(1, Math.floor(paragraphs.length / targetCount));
  const scenes: SceneDescription[] = [];

  for (let i = 0; i < paragraphs.length && scenes.length < targetCount; i += step) {
    const para = paragraphs[i]!;
    // Clean markdown and take first 200 chars as scene description
    const cleaned = para
      .replace(/[#*_~`]/g, '')
      .replace(/\[.*?\]\(.*?\)/g, '')
      .trim()
      .slice(0, 200);

    // Find position in original content
    const position = content.indexOf(para.slice(0, 50));

    scenes.push({
      index: scenes.length,
      description: cleaned,
      position: position >= 0 ? position : 0,
    });
  }

  return scenes;
}

/**
 * Extract scenes from a story — tries markers first, falls back to heuristic.
 */
export function extractScenes(content: string, targetCount: number = 4): SceneDescription[] {
  const markers = extractSceneMarkers(content);
  if (markers.length >= 2) return markers.slice(0, targetCount);
  return extractScenesFallback(content, targetCount);
}

/**
 * Build the image generation prompt for a scene.
 * Combines scene description + style + children's book context.
 */
export function buildImagePrompt(
  scene: SceneDescription,
  style: IllustrationStyle = 'watercolor',
  storyTitle: string = '',
): string {
  const stylePrompt = STYLE_PROMPTS[style];
  const context = storyTitle ? ` from the story "${storyTitle}"` : '';

  return `${stylePrompt}, a scene${context}: ${scene.description}`;
}

/**
 * Build the full prompt for Claude to extract scene descriptions from a story.
 * Used when we want Claude to pick the best visual moments.
 */
export function buildSceneExtractionPrompt(
  storyContent: string,
  storyTitle: string,
  targetCount: number = 4,
): string {
  return `You are an art director for a children's book. Given this bedtime story, pick exactly ${targetCount} scenes that would make the best illustrations.

## Story: "${storyTitle}"

${storyContent}

## Instructions
Pick ${targetCount} key visual moments that:
1. Are spread evenly through the story (beginning, early-middle, late-middle, climax)
2. Show ACTION or EMOTION (not static descriptions)
3. Are visually interesting and child-friendly
4. Do NOT include the Dream Bridge section

For each scene, write a vivid visual description (2-3 sentences) that an artist could paint from.
Include: characters' appearance, setting details, lighting, mood, key action.

Respond with ONLY a raw JSON array. No markdown fences. No explanation.
[
  "Scene 1 description...",
  "Scene 2 description...",
  "Scene 3 description...",
  "Scene 4 description..."
]`;
}

/** Get the negative prompt for image generation */
export function getNegativePrompt(): string {
  return NEGATIVE_PROMPT;
}

/**
 * How many illustrations based on story length.
 */
export function illustrationCount(length: 'kiss' | 'bedtime' | 'adventure'): number {
  switch (length) {
    case 'kiss': return 2;
    case 'bedtime': return 4;
    case 'adventure': return 6;
    default: return 4;
  }
}
