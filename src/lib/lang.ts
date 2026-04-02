/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { LS } from './storage';

export type AppLangCode = 'en' | 'he' | 'es' | 'fr' | 'ar' | 'ja';

const LEGACY_TO_CODE: Record<string, AppLangCode> = {
  en: 'en',
  he: 'he',
  es: 'es',
  fr: 'fr',
  ar: 'ar',
  ja: 'ja',
  english: 'en',
  hebrew: 'he',
  spanish: 'es',
  french: 'fr',
  arabic: 'ar',
  japanese: 'ja',
};

export function normalizeLangCode(raw: string | null | undefined): AppLangCode {
  if (!raw || typeof raw !== 'string') return 'en';
  const t = raw.trim().toLowerCase();
  if (t === 'en' || t === 'he' || t === 'es' || t === 'fr' || t === 'ar' || t === 'ja') return t;
  return LEGACY_TO_CODE[t] ?? 'en';
}

/** Read and normalize dw-language */
export function getStoredLangCode(): AppLangCode {
  try {
    return normalizeLangCode(localStorage.getItem(LS.language));
  } catch {
    return 'en';
  }
}

export function persistLangCode(code: AppLangCode): void {
  try {
    localStorage.setItem(LS.language, code);
  } catch {
    /* ignore */
  }
}

/** English name for Claude prompts */
export function claudeLanguageName(code: AppLangCode): string {
  const m: Record<AppLangCode, string> = {
    en: 'English',
    he: 'Hebrew',
    es: 'Spanish',
    fr: 'French',
    ar: 'Arabic',
    ja: 'Japanese',
  };
  return m[code];
}

export function isRtl(code: AppLangCode): boolean {
  return code === 'he' || code === 'ar';
}

/** Migrate legacy full language names to ISO-like codes */
export function migrateLanguageKeyInStorage(): void {
  try {
    const v = localStorage.getItem(LS.language);
    if (!v) return;
    const n = normalizeLangCode(v);
    if (n !== v) localStorage.setItem(LS.language, n);
  } catch {
    /* ignore */
  }
}
