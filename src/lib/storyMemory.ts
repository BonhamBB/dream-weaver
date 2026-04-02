/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Story Rationality Control Model — Layer 4: Historical Learning
 *
 * Tracks which story seed/setting/trait/twist combinations produce
 * high or low quality scores. Uses this data to:
 *  - Avoid combinations that consistently produce bad stories
 *  - Prefer combinations that produce good stories
 *  - Provide analytics for the parent dashboard
 */

const STORAGE_KEY = 'dw-story-memory';
const MAX_ENTRIES = 500; // Keep last 500 generation records

export interface GenerationRecord {
  /** ISO timestamp */
  timestamp: string;
  /** Theme used */
  theme: string;
  /** Language */
  language: string;
  /** Code validation score (Layer 1) */
  codeScore: number;
  /** Claude review score (Layer 2), null if unavailable */
  reviewScore: number | null;
  /** Combined final score */
  finalScore: number;
  /** Whether the story was accepted */
  accepted: boolean;
  /** Whether auto-fix was needed */
  fixApplied: boolean;
  /** Specific issues found (for pattern analysis) */
  issues: string[];
}

export interface MemoryStats {
  totalGenerated: number;
  acceptedFirstTry: number;
  fixedAndAccepted: number;
  rejected: number;
  avgCodeScore: number;
  avgReviewScore: number;
  avgFinalScore: number;
  /** Most common issues across all generations */
  topIssues: { issue: string; count: number }[];
  /** Acceptance rate over time (last 10, 50, all) */
  acceptanceRate: { last10: number; last50: number; all: number };
}

/** Load all generation records from localStorage */
function loadRecords(): GenerationRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const records = JSON.parse(raw) as GenerationRecord[];
    return Array.isArray(records) ? records : [];
  } catch {
    return [];
  }
}

/** Save records to localStorage */
function saveRecords(records: GenerationRecord[]): void {
  // Trim to max entries (keep most recent)
  const trimmed = records.slice(-MAX_ENTRIES);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // Storage full — remove oldest half
    const half = trimmed.slice(Math.floor(trimmed.length / 2));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(half));
  }
}

/** Record a new story generation result */
export function recordGeneration(record: GenerationRecord): void {
  const records = loadRecords();
  records.push(record);
  saveRecords(records);
}

/** Get aggregated statistics from generation history */
export function getMemoryStats(): MemoryStats {
  const records = loadRecords();
  const total = records.length;

  if (total === 0) {
    return {
      totalGenerated: 0,
      acceptedFirstTry: 0,
      fixedAndAccepted: 0,
      rejected: 0,
      avgCodeScore: 0,
      avgReviewScore: 0,
      avgFinalScore: 0,
      topIssues: [],
      acceptanceRate: { last10: 0, last50: 0, all: 0 },
    };
  }

  const acceptedFirstTry = records.filter((r) => r.accepted && !r.fixApplied).length;
  const fixedAndAccepted = records.filter((r) => r.accepted && r.fixApplied).length;
  const rejected = records.filter((r) => !r.accepted).length;

  const avgCode = records.reduce((s, r) => s + r.codeScore, 0) / total;
  const reviewRecords = records.filter((r) => r.reviewScore !== null);
  const avgReview = reviewRecords.length > 0
    ? reviewRecords.reduce((s, r) => s + (r.reviewScore ?? 0), 0) / reviewRecords.length
    : 0;
  const avgFinal = records.reduce((s, r) => s + r.finalScore, 0) / total;

  // Count issue frequency
  const issueCounts = new Map<string, number>();
  for (const record of records) {
    for (const issue of record.issues) {
      // Normalize issue text (strip numbers, lowercase)
      const normalized = issue.toLowerCase().replace(/\d+/g, 'N').trim();
      issueCounts.set(normalized, (issueCounts.get(normalized) ?? 0) + 1);
    }
  }
  const topIssues = [...issueCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([issue, count]) => ({ issue, count }));

  // Acceptance rates
  const calcRate = (slice: GenerationRecord[]) =>
    slice.length > 0 ? slice.filter((r) => r.accepted).length / slice.length : 0;

  return {
    totalGenerated: total,
    acceptedFirstTry,
    fixedAndAccepted,
    rejected,
    avgCodeScore: Math.round(avgCode),
    avgReviewScore: Math.round(avgReview),
    avgFinalScore: Math.round(avgFinal),
    topIssues,
    acceptanceRate: {
      last10: Math.round(calcRate(records.slice(-10)) * 100),
      last50: Math.round(calcRate(records.slice(-50)) * 100),
      all: Math.round(calcRate(records) * 100),
    },
  };
}

/**
 * Check if a specific theme is "struggling" — low average scores
 * over recent generations. Used to decide whether to add extra
 * prompt instructions for that theme.
 */
export function isThemeStruggling(theme: string): boolean {
  const records = loadRecords()
    .filter((r) => r.theme === theme)
    .slice(-10); // Last 10 for this theme

  if (records.length < 3) return false; // Not enough data

  const avgScore = records.reduce((s, r) => s + r.finalScore, 0) / records.length;
  return avgScore < 55;
}

/**
 * Get the most common issues for a given theme.
 * Used to add targeted warnings to the generation prompt.
 */
export function getThemeWeaknesses(theme: string): string[] {
  const records = loadRecords()
    .filter((r) => r.theme === theme && r.issues.length > 0)
    .slice(-20);

  if (records.length < 3) return [];

  const issueCounts = new Map<string, number>();
  for (const record of records) {
    for (const issue of record.issues) {
      const normalized = issue.toLowerCase().replace(/\d+/g, 'N').trim();
      issueCounts.set(normalized, (issueCounts.get(normalized) ?? 0) + 1);
    }
  }

  // Return issues that appear in >30% of generations for this theme
  const threshold = records.length * 0.3;
  return [...issueCounts.entries()]
    .filter(([, count]) => count >= threshold)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([issue]) => issue);
}
