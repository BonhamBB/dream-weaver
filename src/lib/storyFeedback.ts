/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Story Rationality Control Model — Layer 5: Parent Feedback Loop
 *
 * Tracks parent ratings and correlates them with generation parameters.
 * This data feeds back into the system:
 *  - Low-rated stories influence which themes/combinations are avoided
 *  - High-rated stories reinforce successful patterns
 *  - Aggregate feedback is available on the parent dashboard
 */

const FEEDBACK_KEY = 'dw-story-feedback';
const MAX_FEEDBACK = 200;

export interface StoryFeedback {
  storyId: string;
  /** 1-5 star rating from parent */
  rating: number;
  /** Theme of the story */
  theme: string;
  /** Language */
  language: string;
  /** Story length type */
  length: string;
  /** QC final score at generation time */
  qcScore: number;
  /** Timestamp */
  timestamp: string;
}

export interface FeedbackInsights {
  /** Average parent rating */
  avgRating: number;
  /** How well QC score predicts parent satisfaction */
  qcCorrelation: 'strong' | 'moderate' | 'weak' | 'insufficient_data';
  /** Themes ranked by avg parent rating */
  themeRankings: { theme: string; avgRating: number; count: number }[];
  /** Minimum QC score that typically satisfies parents (rating >= 4) */
  satisfactionThreshold: number;
}

function loadFeedback(): StoryFeedback[] {
  try {
    const raw = localStorage.getItem(FEEDBACK_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw) as StoryFeedback[];
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function saveFeedback(data: StoryFeedback[]): void {
  const trimmed = data.slice(-MAX_FEEDBACK);
  try {
    localStorage.setItem(FEEDBACK_KEY, JSON.stringify(trimmed));
  } catch {
    localStorage.setItem(FEEDBACK_KEY, JSON.stringify(trimmed.slice(-100)));
  }
}

/** Record a parent's rating for a story */
export function recordFeedback(feedback: StoryFeedback): void {
  const existing = loadFeedback();
  // Update if already rated, otherwise add
  const idx = existing.findIndex((f) => f.storyId === feedback.storyId);
  if (idx >= 0) {
    existing[idx] = feedback;
  } else {
    existing.push(feedback);
  }
  saveFeedback(existing);
}

/** Get insights from parent feedback history */
export function getFeedbackInsights(): FeedbackInsights {
  const data = loadFeedback();

  if (data.length === 0) {
    return {
      avgRating: 0,
      qcCorrelation: 'insufficient_data',
      themeRankings: [],
      satisfactionThreshold: 55,
    };
  }

  // Average rating
  const avgRating = data.reduce((s, f) => s + f.rating, 0) / data.length;

  // Theme rankings
  const themeMap = new Map<string, { total: number; count: number }>();
  for (const f of data) {
    const entry = themeMap.get(f.theme) ?? { total: 0, count: 0 };
    entry.total += f.rating;
    entry.count += 1;
    themeMap.set(f.theme, entry);
  }
  const themeRankings = [...themeMap.entries()]
    .map(([theme, { total, count }]) => ({
      theme,
      avgRating: Math.round((total / count) * 10) / 10,
      count,
    }))
    .sort((a, b) => b.avgRating - a.avgRating);

  // QC → satisfaction correlation
  // Find the QC score threshold where parents are typically satisfied (rating >= 4)
  const satisfied = data.filter((f) => f.rating >= 4);
  const unsatisfied = data.filter((f) => f.rating < 4);

  let qcCorrelation: FeedbackInsights['qcCorrelation'] = 'insufficient_data';
  let satisfactionThreshold = 55; // default

  if (satisfied.length >= 5 && unsatisfied.length >= 3) {
    const avgQcSatisfied = satisfied.reduce((s, f) => s + f.qcScore, 0) / satisfied.length;
    const avgQcUnsatisfied = unsatisfied.reduce((s, f) => s + f.qcScore, 0) / unsatisfied.length;
    const gap = avgQcSatisfied - avgQcUnsatisfied;

    if (gap > 15) qcCorrelation = 'strong';
    else if (gap > 8) qcCorrelation = 'moderate';
    else qcCorrelation = 'weak';

    // Set threshold: midpoint between satisfied and unsatisfied avg QC
    satisfactionThreshold = Math.round((avgQcSatisfied + avgQcUnsatisfied) / 2);
  }

  return {
    avgRating: Math.round(avgRating * 10) / 10,
    qcCorrelation,
    themeRankings,
    satisfactionThreshold,
  };
}

/**
 * Get themes that parents consistently rate poorly.
 * Used to add extra prompt reinforcement for these themes.
 */
export function getPoorlyRatedThemes(): string[] {
  const data = loadFeedback();
  const themeMap = new Map<string, { total: number; count: number }>();

  for (const f of data) {
    const entry = themeMap.get(f.theme) ?? { total: 0, count: 0 };
    entry.total += f.rating;
    entry.count += 1;
    themeMap.set(f.theme, entry);
  }

  return [...themeMap.entries()]
    .filter(([, { total, count }]) => count >= 3 && total / count < 3.0)
    .map(([theme]) => theme);
}
