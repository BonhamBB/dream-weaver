/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { AppLangCode } from './lib/lang';

export type Screen =
  | 'onboarding'
  | 'home'
  | 'mixer'
  | 'loading'
  | 'reader'
  | 'favorites'
  | 'library'
  | 'profile'
  | 'settings'
  | 'kids'
  | 'parentDashboard'
  | 'upgrade'
  | 'bedtimeRoutine';

export interface Child {
  name: string;
  age: number;
  /** When true, this child's name is the protagonist; when false, traits only */
  makeHero?: boolean;
}

/** UI list row — stable `id` for React keys */
export type ChildRow = Child & { id: string };

export type StoryTheme =
  | 'magic'
  | 'nature'
  | 'wisdom'
  | 'emotions'
  | 'moral'
  | 'modern'
  | 'daily';

export type StoryLength = 'kiss' | 'bedtime' | 'adventure';

export type StoryMode = 'normal' | 'interactive';

export type AgeFocus = 'younger' | 'older' | 'balance';

export interface StoryConfig {
  children: ChildRow[];
  theme: StoryTheme | null;
  mode: StoryMode;
  length: StoryLength;
  /** Same codes as dw-language: en | he | es | fr | ar */
  storyLanguage: AppLangCode;
  ageFocus: AgeFocus | null;
  customPrompt?: string;
}

export interface Story {
  id: string;
  title: string;
  content: string;
  theme: string;
  config?: StoryConfig;
  createdAt: string;
  /** Persisted; UI may also use dw-ratings map */
  rating?: number;
  progress?: number;
  chapter?: string;
}
