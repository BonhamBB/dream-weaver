// Copyright 2026 Midnight Magic
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

export interface StoryEvent {
  id: string;
  storyId: string;
  childProfileId: string | null;
  theme: string;
  length: string;
  mode: string;
  timestamp: string;
  listenDurationSeconds: number; // 0 if not listened
  rating: number; // 0 if not rated
  completedListening: boolean;
}

export interface AnalyticsSummary {
  totalStories: number;
  totalListeningMinutes: number;
  favoriteTheme: string | null;
  averageRating: number;
  storiesThisWeek: number;
  storiesThisMonth: number;
  themeDistribution: Record<string, number>;
  weeklyActivity: number[]; // last 7 days, stories per day
}

const LS_KEY = 'dw-analytics';

/** Load all story events from localStorage. */
function loadEvents(): StoryEvent[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as StoryEvent[];
  } catch {
    return [];
  }
}

/** Persist the full events array to localStorage. */
function saveEvents(events: StoryEvent[]): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(events));
  } catch (e) {
    console.error('[analytics] Failed to save events:', e);
  }
}

/**
 * Record a new story event. The id and timestamp are generated automatically.
 */
export function recordStoryEvent(
  event: Omit<StoryEvent, 'id' | 'timestamp'>,
): void {
  const full: StoryEvent = {
    ...event,
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
  };
  const events = loadEvents();
  events.push(full);
  saveEvents(events);
}

/**
 * Update the listen duration (and optionally mark as completed) for an
 * existing story event, matched by storyId.
 */
export function updateListenDuration(
  storyId: string,
  seconds: number,
): void {
  const events = loadEvents();
  const idx = events.findIndex((e) => e.storyId === storyId);
  if (idx === -1) return;
  events[idx].listenDurationSeconds = seconds;
  saveEvents(events);
}

/**
 * Build an analytics summary from all recorded events.
 */
export function getAnalyticsSummary(): AnalyticsSummary {
  const events = loadEvents();
  const now = new Date();

  // -- Total stories
  const totalStories = events.length;

  // -- Total listening minutes
  const totalListeningSeconds = events.reduce(
    (sum, e) => sum + e.listenDurationSeconds,
    0,
  );
  const totalListeningMinutes = Math.round(totalListeningSeconds / 60);

  // -- Theme distribution
  const themeDistribution: Record<string, number> = {};
  for (const e of events) {
    themeDistribution[e.theme] = (themeDistribution[e.theme] ?? 0) + 1;
  }

  // -- Favorite theme (most common)
  let favoriteTheme: string | null = null;
  let maxCount = 0;
  for (const [theme, count] of Object.entries(themeDistribution)) {
    if (count > maxCount) {
      maxCount = count;
      favoriteTheme = theme;
    }
  }

  // -- Average rating (only count rated events)
  const ratedEvents = events.filter((e) => e.rating > 0);
  const averageRating =
    ratedEvents.length > 0
      ? ratedEvents.reduce((sum, e) => sum + e.rating, 0) / ratedEvents.length
      : 0;

  // -- Stories this week (last 7 days)
  const weekAgo = new Date(now);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const storiesThisWeek = events.filter(
    (e) => new Date(e.timestamp) >= weekAgo,
  ).length;

  // -- Stories this month (last 30 days)
  const monthAgo = new Date(now);
  monthAgo.setDate(monthAgo.getDate() - 30);
  const storiesThisMonth = events.filter(
    (e) => new Date(e.timestamp) >= monthAgo,
  ).length;

  // -- Weekly activity: stories per day for the last 7 days
  const weeklyActivity: number[] = [];
  for (let i = 6; i >= 0; i--) {
    const dayStart = new Date(now);
    dayStart.setDate(dayStart.getDate() - i);
    dayStart.setHours(0, 0, 0, 0);

    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const count = events.filter((e) => {
      const t = new Date(e.timestamp);
      return t >= dayStart && t < dayEnd;
    }).length;
    weeklyActivity.push(count);
  }

  return {
    totalStories,
    totalListeningMinutes,
    favoriteTheme,
    averageRating,
    storiesThisWeek,
    storiesThisMonth,
    themeDistribution,
    weeklyActivity,
  };
}

/**
 * Return the most recent story events, newest first.
 * Defaults to 20 if no limit is provided.
 */
export function getRecentEvents(limit = 20): StoryEvent[] {
  try {
    const events = loadEvents();
    return events
      .sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      )
      .slice(0, limit);
  } catch {
    return [];
  }
}
