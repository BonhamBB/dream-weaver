/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { secureSet, secureGet } from './secureStorage';

export interface ChildProfile {
  id: string;
  name: string;
  age: number;
  avatar: string; // emoji avatar
  favoriteThemes: string[];
  storiesHeard: number;
  createdAt: string;
}

const LS_KEY = 'dw-child-profiles';
const MAX_NAME_LENGTH = 50;

/** Predefined avatar options */
export const AVATAR_OPTIONS = [
  '🧒', '👧', '👦',
  '🧒🏽', '👧🏽', '👦🏽',
  '🧒🏻', '👧🏻', '👦🏻',
  '🧒🏿', '👧🏿', '👦🏿',
  '🦸', '🦸‍♀️', '🧚', '🧜‍♀️',
  '🦄', '🐻', '🐰', '🦊',
];

/** Validate child name input */
function sanitizeName(name: string): string {
  return name.replace(/<[^>]*>/g, '').trim().slice(0, MAX_NAME_LENGTH);
}

// In-memory cache to avoid async reads on every call
let profilesCache: ChildProfile[] | null = null;

/** Load all child profiles (encrypted). */
export function loadChildProfiles(): ChildProfile[] {
  if (profilesCache) return profilesCache;
  // Sync read from localStorage first (handles legacy + encrypted)
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    // Try JSON parse directly (legacy unencrypted)
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      profilesCache = parsed as ChildProfile[];
      // Migrate to encrypted in background
      secureSet(LS_KEY, raw);
      return profilesCache;
    }
  } catch {
    // Might be encrypted
  }
  // Try async decryption (will be available next call)
  secureGet(LS_KEY).then((decrypted) => {
    if (decrypted) {
      try {
        const parsed = JSON.parse(decrypted);
        if (Array.isArray(parsed)) profilesCache = parsed as ChildProfile[];
      } catch { /* ignore */ }
    }
  });
  return profilesCache ?? [];
}

/** Persist the full profiles array (encrypted). */
export function saveChildProfiles(profiles: ChildProfile[]): void {
  profilesCache = profiles;
  const json = JSON.stringify(profiles);
  // Write encrypted
  secureSet(LS_KEY, json);
  // Also write plain for sync read on next load (will be migrated)
  try { localStorage.setItem(LS_KEY, json); } catch { /* ignore */ }
}

/** Create and persist a new child profile. */
export function addChildProfile(
  name: string,
  age: number,
  avatar: string,
): ChildProfile {
  const cleanName = sanitizeName(name);
  if (!cleanName) throw new Error('Invalid name');
  const clampedAge = Math.max(0, Math.min(18, Math.floor(age)));

  const profile: ChildProfile = {
    id: crypto.randomUUID(),
    name: cleanName,
    age: clampedAge,
    avatar,
    favoriteThemes: [],
    storiesHeard: 0,
    createdAt: new Date().toISOString(),
  };
  const profiles = loadChildProfiles();
  profiles.push(profile);
  saveChildProfiles(profiles);
  return profile;
}

/** Remove a child profile by id. */
export function removeChildProfile(id: string): void {
  const profiles = loadChildProfiles().filter((p) => p.id !== id);
  saveChildProfiles(profiles);
}

/** Partially update a child profile. */
export function updateChildProfile(
  id: string,
  updates: Partial<ChildProfile>,
): void {
  const profiles = loadChildProfiles();
  const idx = profiles.findIndex((p) => p.id === id);
  if (idx === -1) return;
  profiles[idx] = { ...profiles[idx], ...updates, id };
  saveChildProfiles(profiles);
}

/** Increment the storiesHeard counter. */
export function incrementStoriesHeard(id: string): void {
  const profiles = loadChildProfiles();
  const idx = profiles.findIndex((p) => p.id === id);
  if (idx === -1) return;
  profiles[idx].storiesHeard += 1;
  saveChildProfiles(profiles);
}

/** Retrieve a single child profile by id. */
export function getChildProfile(id: string): ChildProfile | null {
  try {
    return loadChildProfiles().find((p) => p.id === id) ?? null;
  } catch {
    return null;
  }
}
