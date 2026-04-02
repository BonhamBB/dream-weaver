/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Story, StoryConfig } from '../types';
import type { AppLangCode } from './lang';

function normalizeStoryLang(raw: string): AppLangCode {
  const t = raw.trim().toLowerCase();
  const m: Record<string, AppLangCode> = {
    en: 'en',
    he: 'he',
    es: 'es',
    fr: 'fr',
    ar: 'ar',
    english: 'en',
    hebrew: 'he',
    spanish: 'es',
    french: 'fr',
    arabic: 'ar',
  };
  return m[t] ?? 'en';
}

export const LS = {
  onboarded: 'dw-onboarded',
  language: 'dw-language',
  stories: 'dw-stories',
  favorites: 'dw-favorites',
  ratings: 'dw-ratings',
} as const;

const LEGACY = {
  language: 'dream-weaver-story-language',
  favorites: 'dream-weaver-favorites',
  ratings: 'dream-weaver-ratings',
} as const;

export function migrateLegacyStorage(): void {
  try {
    if (!localStorage.getItem(LS.language) && localStorage.getItem(LEGACY.language)) {
      localStorage.setItem(LS.language, localStorage.getItem(LEGACY.language)!);
    }
    if (!localStorage.getItem(LS.onboarded) && localStorage.getItem(LEGACY.language)) {
      localStorage.setItem(LS.onboarded, 'true');
    }
    if (!localStorage.getItem(LS.favorites) && localStorage.getItem(LEGACY.favorites)) {
      const favStories = JSON.parse(localStorage.getItem(LEGACY.favorites)!) as Story[];
      const ids = favStories.map((s) => s.id);
      localStorage.setItem(LS.favorites, JSON.stringify(ids));
    }
    if (!localStorage.getItem(LS.ratings) && localStorage.getItem(LEGACY.ratings)) {
      localStorage.setItem(LS.ratings, localStorage.getItem(LEGACY.ratings)!);
    }
  } catch {
    /* ignore */
  }
}

function migrateStoryConfig(cfg: StoryConfig | undefined): StoryConfig | undefined {
  if (!cfg) return undefined;
  const legacy = cfg as StoryConfig & Record<string, unknown>;
  const next = { ...legacy } as StoryConfig & Record<string, unknown>;

  // Migrate old storyWorld → theme
  if (!next.theme && next.storyWorld) {
    const sw = next.storyWorld as { category?: string } | null;
    if (sw?.category) {
      const categoryMap: Record<string, string> = {
        adventure: 'magic',
        folklore: 'wisdom',
        historical: 'wisdom',
        religion: 'wisdom',
      };
      (next as StoryConfig).theme = (categoryMap[sw.category] ?? 'magic') as StoryConfig['theme'];
    }
    delete next.storyWorld;
  }

  // Migrate old length values
  const len = next.length as string;
  if (len === 'short') (next as StoryConfig).length = 'kiss';
  else if (len === 'medium') (next as StoryConfig).length = 'bedtime';
  else if (len === 'long') (next as StoryConfig).length = 'adventure';

  // Ensure mode exists
  if (!next.mode) (next as StoryConfig).mode = 'normal';

  // Normalize language
  if (typeof next.storyLanguage === 'string') {
    (next as StoryConfig).storyLanguage = normalizeStoryLang(next.storyLanguage);
  }

  // Remove old fields
  delete next.vibe;
  delete next.innerChallenge;
  delete next.magicTwist;
  delete next.vibes;

  return next as StoryConfig;
}

export function loadStories(): Story[] {
  try {
    const raw = localStorage.getItem(LS.stories);
    if (!raw) return [];
    const list = JSON.parse(raw) as Story[];
    if (!Array.isArray(list)) return [];
    return list.map((s) => ({
      ...s,
      config: migrateStoryConfig(s.config),
    }));
  } catch {
    return [];
  }
}

export function saveStories(stories: Story[]): void {
  localStorage.setItem(LS.stories, JSON.stringify(stories.slice(0, 20)));
}

/** After successful generation: prepend, cap 20, ensure rating field */
export function saveStory(story: Story): void {
  const list = loadStories().filter((s) => s.id !== story.id);
  const next: Story = { ...story, rating: story.rating ?? 0 };
  saveStories([next, ...list]);
}

export function loadFavoriteIds(): string[] {
  try {
    const raw = localStorage.getItem(LS.favorites);
    if (!raw) return [];
    const ids = JSON.parse(raw) as string[];
    return Array.isArray(ids) ? ids : [];
  } catch {
    return [];
  }
}

export function saveFavoriteIds(ids: string[]): void {
  localStorage.setItem(LS.favorites, JSON.stringify(ids));
}

export function deleteStory(storyId: string): void {
  const stories = loadStories().filter((s) => s.id !== storyId);
  saveStories(stories);

  // Also clean up favorites
  const favs = loadFavoriteIds().filter((id) => id !== storyId);
  saveFavoriteIds(favs);

  // Clean up ratings
  try {
    const raw = localStorage.getItem(LS.ratings);
    if (raw) {
      const ratings = JSON.parse(raw) as Record<string, number>;
      delete ratings[storyId];
      localStorage.setItem(LS.ratings, JSON.stringify(ratings));
    }
  } catch { /* ignore */ }
}

export function exportStoryAsText(story: Story): string {
  const lines: string[] = [];
  lines.push(story.title);
  lines.push('═'.repeat(Math.min(story.title.length * 2, 60)));
  lines.push('');

  // Strip markdown formatting for clean text
  const clean = story.content
    .replace(/^##\s*/gm, '\n— ')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/[`#]/g, '');

  lines.push(clean);
  lines.push('');
  lines.push('─'.repeat(40));
  lines.push(`Generated by Dream Weaver`);
  lines.push(`Date: ${new Date(story.createdAt).toLocaleDateString()}`);

  return lines.join('\n');
}
