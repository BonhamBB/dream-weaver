/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Paywall / subscription management.
 *
 * On native (Capacitor): uses RevenueCat for real Google Play subscriptions.
 * On web / dev: falls back to localStorage mock.
 */

export type SubscriptionTier = 'free' | 'premium';

export interface SubscriptionState {
  tier: SubscriptionTier;
  storiesGeneratedToday: number;
  lastGenerationDate: string; // YYYY-MM-DD
  premiumSince: string | null;
}

const LS_KEY = 'dw-subscription';
const FREE_DAILY_LIMIT = 2;

// RevenueCat product identifiers (match Google Play Console)
export const RC_PRODUCT_MONTHLY = 'dreamweaver_premium_monthly';
export const RC_PRODUCT_YEARLY = 'dreamweaver_premium_yearly';
export const RC_ENTITLEMENT = 'premium';

/* ------------------------------------------------------------------ */
/*  RevenueCat native bridge                                           */
/* ------------------------------------------------------------------ */

let rcInitialized = false;
let rcPurchases: typeof import('@revenuecat/purchases-capacitor').Purchases | null = null;

/**
 * Returns true when running inside Capacitor (Android/iOS).
 */
function isNative(): boolean {
  return typeof (window as unknown as Record<string, unknown>).Capacitor !== 'undefined';
}

/**
 * Initialize RevenueCat. Call once on app start.
 * Silently no-ops on web or if the API key is not set.
 */
export async function initPaywall(): Promise<void> {
  if (rcInitialized || !isNative()) return;
  const apiKey = import.meta.env.VITE_REVENUECAT_API_KEY;
  if (!apiKey) return;

  try {
    const { Purchases } = await import('@revenuecat/purchases-capacitor');
    await Purchases.configure({ apiKey });
    rcPurchases = Purchases;
    rcInitialized = true;

    // Sync entitlements → local state
    await syncEntitlements();
  } catch (e) {
    console.warn('[paywall] RevenueCat init failed, using local fallback:', e);
  }
}

/**
 * Sync RevenueCat entitlements to local subscription state.
 */
async function syncEntitlements(): Promise<void> {
  if (!rcPurchases) return;
  try {
    const { customerInfo } = await rcPurchases.getCustomerInfo();
    const hasPremium = customerInfo.entitlements.active[RC_ENTITLEMENT] !== undefined;
    const state = loadSubscription();
    if (hasPremium && state.tier !== 'premium') {
      state.tier = 'premium';
      state.premiumSince = new Date().toISOString();
      saveSubscription(state);
    } else if (!hasPremium && state.tier === 'premium') {
      state.tier = 'free';
      state.premiumSince = null;
      saveSubscription(state);
    }
  } catch (e) {
    console.warn('[paywall] syncEntitlements failed:', e);
  }
}

/**
 * Get available packages (monthly + yearly) from RevenueCat.
 * Returns null on web or if RC is not configured.
 */
export async function getOfferings(): Promise<{
  monthly: { priceString: string; identifier: string } | null;
  yearly: { priceString: string; identifier: string } | null;
} | null> {
  if (!rcPurchases) return null;
  try {
    const offerings = await rcPurchases.getOfferings();
    const current = offerings.current;
    if (!current) return null;
    return {
      monthly: current.monthly
        ? { priceString: current.monthly.product.priceString, identifier: current.monthly.identifier }
        : null,
      yearly: current.annual
        ? { priceString: current.annual.product.priceString, identifier: current.annual.identifier }
        : null,
    };
  } catch (e) {
    console.warn('[paywall] getOfferings failed:', e);
    return null;
  }
}

/**
 * Purchase a package by identifier via RevenueCat.
 * Returns true on success, false on failure/cancel.
 */
export async function purchasePackage(packageIdentifier: string): Promise<boolean> {
  if (!rcPurchases) {
    // Web fallback: instant mock upgrade
    upgradeToPremium();
    return true;
  }
  try {
    const offerings = await rcPurchases.getOfferings();
    const current = offerings.current;
    if (!current) return false;

    const pkg = current.availablePackages.find((p: { identifier: string }) => p.identifier === packageIdentifier);
    if (!pkg) return false;

    await rcPurchases.purchasePackage({ aPackage: pkg });
    await syncEntitlements();
    return isPremium();
  } catch (e) {
    console.warn('[paywall] purchase failed:', e);
    return false;
  }
}

/**
 * Restore previous purchases (e.g. after reinstall).
 */
export async function restorePurchases(): Promise<boolean> {
  if (!rcPurchases) return false;
  try {
    await rcPurchases.restorePurchases();
    await syncEntitlements();
    return isPremium();
  } catch (e) {
    console.warn('[paywall] restore failed:', e);
    return false;
  }
}

/* ------------------------------------------------------------------ */
/*  Local state (daily counter, tier cache)                            */
/* ------------------------------------------------------------------ */

function todayDateString(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function defaultState(): SubscriptionState {
  return {
    tier: 'free',
    storiesGeneratedToday: 0,
    lastGenerationDate: todayDateString(),
    premiumSince: null,
  };
}

export function loadSubscription(): SubscriptionState {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return defaultState();
    const state = JSON.parse(raw) as SubscriptionState;
    if (state.lastGenerationDate !== todayDateString()) {
      state.storiesGeneratedToday = 0;
      state.lastGenerationDate = todayDateString();
      saveSubscription(state);
    }
    return state;
  } catch {
    return defaultState();
  }
}

function saveSubscription(state: SubscriptionState): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('[paywall] Failed to save subscription:', e);
  }
}

export function canGenerateStory(): boolean {
  const state = loadSubscription();
  if (state.tier === 'premium') return true;
  return state.storiesGeneratedToday < FREE_DAILY_LIMIT;
}

export function recordStoryGeneration(): void {
  const state = loadSubscription();
  state.storiesGeneratedToday += 1;
  state.lastGenerationDate = todayDateString();
  saveSubscription(state);
}

export function getRemainingFreeStories(): number {
  const state = loadSubscription();
  if (state.tier === 'premium') return Infinity;
  return Math.max(0, FREE_DAILY_LIMIT - state.storiesGeneratedToday);
}

/** Mock upgrade for web/dev. On native, use purchasePackage() instead. */
export function upgradeToPremium(): void {
  const state = loadSubscription();
  state.tier = 'premium';
  state.premiumSince = new Date().toISOString();
  saveSubscription(state);
}

export function downgradeToFree(): void {
  const state = loadSubscription();
  state.tier = 'free';
  state.premiumSince = null;
  saveSubscription(state);
}

export function isPremium(): boolean {
  return loadSubscription().tier === 'premium';
}

export function getSubscription(): SubscriptionState {
  return loadSubscription();
}
