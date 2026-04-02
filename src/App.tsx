/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useMemo, useCallback, useRef, type ErrorInfo, Component, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Home as HomeIcon,
  Plus,
  BookOpen,
  Heart,
  User,
  Settings as SettingsIcon,
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  ChevronRight,
  ChevronLeft,
  Star,
  Share2,
  AlertTriangle,
  Trash2,
  Download,
  RefreshCw,
  BookPlus,
  X,
  Timer,
  AlertCircle,
  Music,
  Volume2,
} from 'lucide-react';

import { cn } from '@/src/lib/utils';
import {
  claudeLanguageName,
  getStoredLangCode,
  isRtl,
  migrateLanguageKeyInStorage,
  persistLangCode,
  type AppLangCode,
} from './lib/lang';
import { smartDefaults } from './lib/storyEngine';
import { UI_STRINGS, type UIStrings } from './lib/uiStrings';
import {
  LS,
  migrateLegacyStorage,
  loadStories,
  saveStory,
  loadFavoriteIds,
  saveFavoriteIds,
  deleteStory as deleteStoryFromStorage,
  exportStoryAsText,
} from './lib/storage';
import type {
  Screen,
  Story,
  StoryConfig,
  ChildRow,
  StoryTheme,
  StoryLength,
  StoryMode,
  AgeFocus,
} from './types';
import { generateStoryWithCarousel } from './services/claude';
import ReactMarkdown from 'react-markdown';
import LZString from 'lz-string';

// New module imports
import { loadChildProfiles, addChildProfile, removeChildProfile, AVATAR_OPTIONS, type ChildProfile } from './lib/childProfiles';
import { canGenerateStory, recordStoryGeneration, getRemainingFreeStories, isPremium, initPaywall, purchasePackage, restorePurchases, getOfferings } from './lib/paywall';
import { getAnalyticsSummary, recordStoryEvent } from './lib/analytics';
import { startAmbientMusic, stopAmbientMusic, type AmbientType } from './lib/audioEngine';
import { isElevenLabsAvailable, generateSpeech, playTTSAudio } from './lib/elevenlabs';
import { isFirebaseConfigured, signInWithGoogle, signOut as fbSignOut, onAuthChange, syncStoriesToCloud, loadStoriesFromCloud, mergeLocalAndCloud, syncFavoritesToCloud, loadFavoritesFromCloud, type FirebaseUser } from './lib/firebase';

/* ───────── Error Boundary ───────── */
class ErrorBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error('ErrorBoundary:', error, info); }
  render() { return this.state.hasError ? this.props.fallback : this.props.children; }
}

/* ───────── Toast System ───────── */
type ToastType = 'success' | 'error';
interface ToastData { id: number; message: string; type: ToastType; }
let toastCounter = 0;

const ToastContainer = ({ toasts, onDismiss }: { toasts: ToastData[]; onDismiss: (id: number) => void }) => (
  <div className="fixed top-4 left-1/2 z-[999] -translate-x-1/2 w-[calc(100%-2rem)] max-w-[398px] space-y-2 pointer-events-none">
    <AnimatePresence>
      {toasts.map((t) => (
        <motion.div
          key={t.id}
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className={cn('toast pointer-events-auto flex items-center gap-3', t.type === 'error' ? 'toast-error' : 'toast-success')}
          onClick={() => onDismiss(t.id)}
        >
          {t.type === 'error' ? <AlertCircle size={16} /> : <Sparkles size={16} />}
          <span className="flex-1">{t.message}</span>
          <X size={14} className="opacity-40 shrink-0" />
        </motion.div>
      ))}
    </AnimatePresence>
  </div>
);

/* ───────── Delete Confirmation Modal ───────── */
const ConfirmDeleteModal = ({ t, onConfirm, onCancel }: { t: UIStrings; onConfirm: () => void; onCancel: () => void }) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    className="confirm-overlay"
    onClick={onCancel}
  >
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.9, opacity: 0 }}
      className="confirm-card"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="text-3xl">🗑️</div>
      <p className="text-white/70 text-sm">{t.confirmDeleteMsg}</p>
      <div className="flex gap-3">
        <button type="button" onClick={onCancel} className="flex-1 min-h-[44px] rounded-xl border border-white/10 text-sm text-white/50 hover:bg-white/5">{t.cancel}</button>
        <button type="button" onClick={onConfirm} className="flex-1 min-h-[44px] rounded-xl bg-red-500/20 border border-red-500/30 text-sm text-red-400 hover:bg-red-500/30">{t.deleteStory}</button>
      </div>
    </motion.div>
  </motion.div>
);

/* ───────── Helpers ───────── */

function emptyStoryConfig(lang: AppLangCode): StoryConfig {
  return {
    children: [],
    theme: null,
    mode: 'normal',
    length: 'bedtime',
    storyLanguage: lang,
    ageFocus: null,
    customPrompt: '',
  };
}

/* Theme color mapping for story cards */
const THEME_COLORS: Record<string, string> = {
  magic: 'from-purple-900/40 to-indigo-900/40',
  nature: 'from-emerald-900/40 to-teal-900/40',
  wisdom: 'from-amber-900/40 to-yellow-900/40',
  emotions: 'from-pink-900/40 to-rose-900/40',
  moral: 'from-blue-900/40 to-sky-900/40',
  modern: 'from-red-900/40 to-orange-900/40',
  daily: 'from-amber-800/40 to-stone-900/40',
};

const THEME_ICONS: Record<StoryTheme, string> = {
  magic: '✨',
  nature: '🌿',
  wisdom: '📚',
  emotions: '💜',
  moral: '⚖️',
  modern: '🏠',
  daily: '📅',
};

/* ───────── Floating Particles ───────── */
const Particles = () => (
  <div className="particles">
    {Array.from({ length: 12 }, (_, i) => (
      <div
        key={i}
        className="particle"
        style={{
          left: `${8 + Math.random() * 84}%`,
          bottom: '-10px',
          '--duration': `${12 + Math.random() * 18}s`,
          '--delay': `${Math.random() * 10}s`,
          width: `${1.5 + Math.random() * 2}px`,
          height: `${1.5 + Math.random() * 2}px`,
          opacity: 0.3 + Math.random() * 0.4,
        } as React.CSSProperties}
      />
    ))}
  </div>
);

/* ───────── Navbar ───────── */
const Navbar = ({
  activeScreen,
  setScreen,
}: {
  activeScreen: Screen;
  setScreen: (s: Screen) => void;
}) => {
  const navItems = [
    { id: 'home' as const, icon: HomeIcon },
    { id: 'mixer' as const, icon: Plus },
    { id: 'library' as const, icon: BookOpen },
    { id: 'favorites' as const, icon: Heart },
    { id: 'profile' as const, icon: User },
  ];

  return (
    <nav className="fixed bottom-0 left-1/2 z-50 flex h-20 w-full max-w-[430px] -translate-x-1/2 items-center justify-around card-dark px-2">
      {navItems.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => setScreen(item.id)}
          className={cn(
            'min-h-[44px] min-w-[44px] p-3 rounded-2xl transition-all duration-300',
            activeScreen === item.id
              ? 'bg-gold/20 text-gold'
              : 'text-white/30 hover:text-white/50',
          )}
        >
          <item.icon size={22} />
        </button>
      ))}
    </nav>
  );
};

/* ───────── Loading Screen ───────── */
const LoadingScreen = ({ lang }: { lang: AppLangCode }) => {
  const [subIdx, setSubIdx] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  const subs = useMemo(
    () => [
      UI_STRINGS[lang].loading1,
      UI_STRINGS[lang].loading2,
      UI_STRINGS[lang].loading3,
      UI_STRINGS[lang].loading4,
      UI_STRINGS[lang].loading5,
    ],
    [lang],
  );

  useEffect(() => {
    setSubIdx(0);
    const t0 = Date.now();
    const tick = setInterval(() => setElapsed(Math.floor((Date.now() - t0) / 1000)), 250);
    const sub = setInterval(() => setSubIdx((i) => (i + 1) % 5), 3000);
    return () => {
      clearInterval(tick);
      clearInterval(sub);
    };
  }, [lang]);

  const mm = Math.floor(elapsed / 60);
  const ss = elapsed % 60;

  return (
    <div className="fixed inset-0 z-[200] flex min-h-[100dvh] flex-col items-center justify-center bg-deep px-6">
      <Particles />
      <motion.div
        className="book-glow mb-8 text-6xl"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
      >
        📖
      </motion.div>
      <p className="text-lg font-medium text-gold text-glow">{UI_STRINGS[lang].weaving}</p>
      <div className="mt-3 flex gap-1">
        <span className="writing-dot inline-block h-1.5 w-1.5 rounded-full bg-gold/60" />
        <span className="writing-dot inline-block h-1.5 w-1.5 rounded-full bg-gold/60" />
        <span className="writing-dot inline-block h-1.5 w-1.5 rounded-full bg-gold/60" />
      </div>
      <p className="mt-4 min-h-[44px] text-center text-sm text-white/40">{subs[subIdx]}</p>
      <p className="mt-4 font-mono text-xs tabular-nums text-white/25">
        {mm}:{ss.toString().padStart(2, '0')}
      </p>
    </div>
  );
};

/* ───────── Language Options ───────── */
const LANG_OPTIONS: { code: AppLangCode; label: string; flag: string }[] = [
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'he', label: 'עברית', flag: '🇮🇱' },
  { code: 'es', label: 'Español', flag: '🇪🇸' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'ar', label: 'العربية', flag: '🇸🇦' },
  { code: 'ja', label: '日本語', flag: '🇯🇵' },
];

/* ───────── Onboarding ───────── */
const Onboarding = ({
  lang,
  onLangChange,
  onStart,
  onSkip,
}: {
  lang: AppLangCode;
  onLangChange: (code: AppLangCode) => void;
  onStart: () => void;
  onSkip: () => void;
}) => {
  const t = UI_STRINGS[lang];

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12" dir={isRtl(lang) ? 'rtl' : 'ltr'}>
      <Particles />
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 w-full max-w-[390px] space-y-8"
      >
        <div className="space-y-2">
          <p className="text-center text-xs font-bold uppercase tracking-widest text-white/30">{t.languageLabel}</p>
          <div className="flex gap-2 overflow-x-auto pb-2 px-1 snap-x snap-mandatory scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' }}>
            {LANG_OPTIONS.map(({ code, label, flag }) => (
              <button
                key={code}
                type="button"
                onClick={() => onLangChange(code)}
                className={cn(
                  'snap-center shrink-0 min-h-[44px] rounded-2xl border px-4 text-sm font-medium transition-all flex items-center gap-2',
                  lang === code
                    ? 'border-gold/40 bg-gold/15 text-gold'
                    : 'border-white/8 bg-white/3 text-white/60 hover:bg-white/6',
                )}
              >
                <span>{flag}</span>
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="text-center space-y-3">
          <motion.div
            className="text-5xl mb-2"
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 3, repeat: Infinity }}
          >
            🌙
          </motion.div>
          <h1 className="text-4xl font-bold tracking-tight text-glow">{t.onboardingTitle}</h1>
          <p className="text-base text-white/50">{t.onboardingSubtitle}</p>
        </div>

        <button
          type="button"
          onClick={onStart}
          className="dream-button group w-full min-h-[52px] rounded-2xl text-lg font-bold text-deep"
        >
          {t.startDreaming}
        </button>
        <button
          type="button"
          onClick={onSkip}
          className="w-full py-2 text-center text-sm text-white/30 hover:text-white/50"
        >
          {t.skip}
        </button>
      </motion.div>
    </div>
  );
};

/* ───────── Home ───────── */
const Home = ({
  t,
  onSelectStory,
  onStartMixer,
  onViewFavorites,
  onOpenSettings,
  onOpenKids,
  onOpenDashboard,
  onOpenRoutine,
  onOpenUpgrade,
  savedStories,
  favoriteIds,
  ratings,
  remaining,
  premium,
}: {
  t: UIStrings;
  onSelectStory: (s: Story) => void;
  onStartMixer: () => void;
  onViewFavorites: () => void;
  onOpenSettings: () => void;
  onOpenKids: () => void;
  onOpenDashboard: () => void;
  onOpenRoutine: () => void;
  onOpenUpgrade: () => void;
  savedStories: Story[];
  favoriteIds: string[];
  ratings: Record<string, number>;
  remaining: number;
  premium: boolean;
}) => {
  const sorted = useMemo(
    () => [...savedStories].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
    [savedStories],
  );
  const continueStory = sorted[0];

  return (
    <div className="w-full space-y-8 px-5 pb-28 pt-8">
      <header className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🌙</span>
          <h1 className="text-2xl font-bold tracking-tight text-glow">{t.appName}</h1>
        </div>
        <button
          type="button"
          onClick={onOpenSettings}
          className="min-h-[44px] min-w-[44px] p-2 text-white/40 hover:text-white/60"
          aria-label={t.settings}
        >
          <SettingsIcon size={22} />
        </button>
      </header>

      {/* Create new story CTA */}
      <motion.button
        type="button"
        onClick={onStartMixer}
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
        className="w-full rounded-3xl overflow-hidden"
      >
        <div className="relative p-6 bg-gradient-to-br from-midnight via-night to-deep border border-white/8 rounded-3xl breathe-glow">
          <div className="text-left space-y-2">
            <span className="text-3xl">✨</span>
            <h2 className="text-xl font-bold text-starlight">{t.createHero}</h2>
            <p className="text-sm text-white/40">{t.createHeroSub}</p>
          </div>
          <div className="absolute top-6 right-6 bg-gold/20 text-gold p-3 rounded-full">
            <Plus size={22} />
          </div>
        </div>
      </motion.button>

      {/* Quick actions row */}
      <div className="grid grid-cols-3 gap-2">
        <button type="button" onClick={onOpenRoutine} className="card-glass rounded-2xl p-3 text-center space-y-1 min-h-[44px]">
          <span className="text-xl block" aria-hidden="true">🌙</span>
          <p className="text-[10px] font-medium text-white/50">{t.bedtimeRoutine}</p>
        </button>
        <button type="button" onClick={onOpenKids} className="card-glass rounded-2xl p-3 text-center space-y-1 min-h-[44px]">
          <span className="text-xl block" aria-hidden="true">👶</span>
          <p className="text-[10px] font-medium text-white/50">{t.myKids}</p>
        </button>
        <button type="button" onClick={onOpenDashboard} className="card-glass rounded-2xl p-3 text-center space-y-1 min-h-[44px]">
          <span className="text-xl block" aria-hidden="true">📊</span>
          <p className="text-[10px] font-medium text-white/50">{t.parentDashboard}</p>
        </button>
      </div>

      {/* Free tier indicator */}
      {!premium && (
        <button type="button" onClick={onOpenUpgrade} className="w-full rounded-2xl border border-gold/15 bg-gold/5 p-3 flex items-center justify-between">
          <span className="text-xs text-gold/60">{remaining} {t.storiesLeft}</span>
          <span className="text-xs font-medium text-gold">{t.upgradeNow} →</span>
        </button>
      )}

      {/* Continue reading */}
      {continueStory && (
        <section className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-white/30">{t.continueReading}</h3>
          <div
            className="card-glass rounded-2xl p-4 flex gap-4 items-center cursor-pointer min-h-[44px]"
            onClick={() => onSelectStory(continueStory)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && onSelectStory(continueStory)}
          >
            <div className={cn(
              'w-14 h-14 rounded-xl flex items-center justify-center text-2xl bg-gradient-to-br shrink-0',
              THEME_COLORS[continueStory.theme ?? 'magic'],
            )}>
              {THEME_ICONS[(continueStory.theme ?? 'magic') as StoryTheme] ?? '✨'}
            </div>
            <div className="flex-1 space-y-1 min-w-0">
              <h4 className="font-semibold text-starlight truncate">{continueStory.title}</h4>
              <p className="text-white/35 text-xs line-clamp-1">{continueStory.content.slice(0, 80)}...</p>
            </div>
            <div className="bg-gold/15 text-gold p-2.5 rounded-full shrink-0">
              <Play size={14} fill="currentColor" />
            </div>
          </div>
        </section>
      )}

      {/* Stories collection */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-white/30">{t.enchantedCollections}</h3>
        {sorted.length === 0 ? (
          <p className="text-sm text-white/25">{t.noCollectionStories}</p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {sorted.map((story) => (
              <button
                key={story.id}
                type="button"
                onClick={() => onSelectStory(story)}
                className="text-left card-glass rounded-2xl overflow-hidden min-h-[44px] group"
              >
                <div className={cn(
                  'aspect-[4/3] flex items-center justify-center text-4xl bg-gradient-to-br',
                  THEME_COLORS[story.theme ?? 'magic'],
                )}>
                  {THEME_ICONS[(story.theme ?? 'magic') as StoryTheme] ?? '✨'}
                  {favoriteIds.includes(story.id) && (
                    <div className="absolute top-2 right-2 bg-rose/60 p-1.5 rounded-full">
                      <Heart size={10} fill="white" className="text-white" />
                    </div>
                  )}
                </div>
                <div className="p-3 space-y-1">
                  <p className="text-xs font-semibold line-clamp-2 text-starlight/90">{story.title}</p>
                  {ratings[story.id] > 0 && (
                    <div className="flex items-center gap-1">
                      <Star size={10} className="text-gold fill-gold" />
                      <span className="text-[10px] text-gold font-bold">{ratings[story.id]}</span>
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Favorites row */}
      {favoriteIds.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-white/30">{t.yourFavorites}</h3>
            <button
              type="button"
              onClick={onViewFavorites}
              className="flex min-h-[44px] items-center gap-1 text-xs font-medium text-gold/70"
            >
              {t.viewAll} <ChevronRight size={14} />
            </button>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar -mx-1 px-1">
            {sorted
              .filter((s) => favoriteIds.includes(s.id))
              .map((story) => (
                <div
                  key={story.id}
                  className="min-w-[130px] space-y-2 cursor-pointer"
                  onClick={() => onSelectStory(story)}
                  onKeyDown={(e) => e.key === 'Enter' && onSelectStory(story)}
                  role="button"
                  tabIndex={0}
                >
                  <div className={cn(
                    'aspect-[3/4] rounded-2xl flex items-center justify-center text-3xl bg-gradient-to-br',
                    THEME_COLORS[story.theme ?? 'magic'],
                  )}>
                    {THEME_ICONS[(story.theme ?? 'magic') as StoryTheme] ?? '✨'}
                  </div>
                  <h4 className="font-medium text-xs px-1 line-clamp-1 text-white/60">{story.title}</h4>
                </div>
              ))}
          </div>
        </section>
      )}
    </div>
  );
};

/* ───────── Mixer ───────── */
const Mixer = ({
  onGenerateStory,
  lang,
  t,
}: {
  onGenerateStory: (cfg: StoryConfig) => void;
  lang: AppLangCode;
  t: UIStrings;
}) => {
  const [config, setConfig] = useState<StoryConfig>(() => emptyStoryConfig(lang));
  const [childFormOpen, setChildFormOpen] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [draftAge, setDraftAge] = useState(6);
  const [draftHero, setDraftHero] = useState(false);
  const [ageFocusError, setAgeFocusError] = useState(false);

  const themeTiles: { id: StoryTheme; icon: string; label: string; desc: string; css: string }[] = useMemo(
    () => [
      { id: 'magic', icon: '✨', label: t.themeMagic, desc: t.themeMagicDesc, css: 'theme-magic' },
      { id: 'nature', icon: '🌿', label: t.themeNature, desc: t.themeNatureDesc, css: 'theme-nature' },
      { id: 'wisdom', icon: '📚', label: t.themeWisdom, desc: t.themeWisdomDesc, css: 'theme-wisdom' },
      { id: 'emotions', icon: '💜', label: t.themeEmotions, desc: t.themeEmotionsDesc, css: 'theme-emotions' },
      { id: 'moral', icon: '⚖️', label: t.themeMoral, desc: t.themeMoralDesc, css: 'theme-moral' },
      { id: 'modern', icon: '🏠', label: t.themeModern, desc: t.themeModernDesc, css: 'theme-modern' },
      { id: 'daily', icon: '📅', label: t.themeDaily, desc: t.themeDailyDesc, css: 'theme-daily' },
    ],
    [t],
  );

  const lengthOptions: { id: StoryLength; icon: string; label: string; desc: string }[] = useMemo(
    () => [
      { id: 'kiss', icon: '🐭', label: t.lengthKiss, desc: t.lengthKissDesc },
      { id: 'bedtime', icon: '🐻', label: t.lengthBedtime, desc: t.lengthBedtimeDesc },
      { id: 'adventure', icon: '🐉', label: t.lengthAdventure, desc: t.lengthAdventureDesc },
    ],
    [t],
  );

  useEffect(() => {
    setConfig((prev) => ({ ...prev, storyLanguage: lang }));
  }, [lang]);

  const ages = config.children
    .map((c) => c.age)
    .filter((a) => Number.isFinite(a) && a >= 1 && a <= 12);
  const gap = ages.length >= 2 ? Math.max(...ages) - Math.min(...ages) : null;
  const ageGapBand = gap === null ? null : gap <= 2 ? 'ok' : gap <= 4 ? 'yellow' : 'orange';

  useEffect(() => {
    if (gap === null || gap < 5) {
      setConfig((p) => (p.ageFocus != null ? { ...p, ageFocus: null } : p));
    }
  }, [gap]);

  const addChildFromForm = () => {
    if (config.children.length >= 4) return;
    const name = draftName.trim() || 'Child';
    const age = Math.min(12, Math.max(1, draftAge));
    const row: ChildRow = {
      id: `c-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name,
      age,
      makeHero: Boolean(draftHero),
    };
    setConfig((p) => ({ ...p, children: [...p.children, row] }));
    setDraftName('');
    setDraftAge(6);
    setDraftHero(false);
    setChildFormOpen(false);
  };

  const removeChild = (id: string) => {
    setConfig((p) => ({ ...p, children: p.children.filter((c) => c.id !== id) }));
  };

  const run = (cfg: StoryConfig) => {
    if (gap !== null && gap >= 5 && !cfg.ageFocus) {
      setAgeFocusError(true);
      return;
    }
    setAgeFocusError(false);
    onGenerateStory(cfg);
  };

  const handleQuick = () => {
    if (config.theme === null && config.children.length === 0) {
      onGenerateStory(smartDefaults(lang));
      return;
    }
    run({ ...config, storyLanguage: config.storyLanguage });
  };

  const handleCreate = () => run({ ...config, storyLanguage: config.storyLanguage });

  return (
    <div className="w-full space-y-6 px-5 pb-28 pt-8" dir={isRtl(lang) ? 'rtl' : 'ltr'}>
      {/* Quick generate */}
      <button
        type="button"
        onClick={handleQuick}
        className="dream-button w-full min-h-[52px] rounded-2xl text-lg font-bold text-deep"
      >
        <span className="flex items-center justify-center gap-2">{t.tellMeStory}</span>
      </button>

      <div className="soft-divider my-2" />
      <p className="text-center text-xs uppercase tracking-widest text-white/25">{t.orCustomize}</p>

      {/* Children section */}
      <div className="card-glass space-y-3 rounded-2xl p-4">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold uppercase tracking-widest text-white/30">{t.whoInStory}</h4>
          <button
            type="button"
            disabled={config.children.length >= 4}
            onClick={() => config.children.length < 4 && setChildFormOpen((o) => !o)}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-white/10 bg-white/5 disabled:opacity-30 text-white/50"
            aria-label={t.addChild}
          >
            <Plus size={20} />
          </button>
        </div>
        <p className="text-sm text-white/25">{t.whoInStoryPlaceholder}</p>

        {childFormOpen && config.children.length < 4 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-3 rounded-xl border border-white/8 bg-night/50 p-3"
          >
            <input
              type="text"
              placeholder={t.childNamePlaceholder}
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              className="min-h-[44px] w-full rounded-xl border border-white/8 bg-deep/50 px-3 text-sm text-white placeholder:text-white/25 focus:border-gold/30 focus:outline-none"
            />
            <div className="flex items-center gap-2">
              <label className="text-xs text-white/40">{t.ageLabel}</label>
              <input
                type="number"
                min={1}
                max={12}
                value={draftAge}
                onChange={(e) => setDraftAge(Number.parseInt(e.target.value, 10) || 1)}
                className="min-h-[44px] w-20 rounded-xl border border-white/8 bg-deep/50 px-2 text-sm text-white focus:border-gold/30 focus:outline-none"
              />
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-white/60">
              <input
                type="checkbox"
                checked={draftHero}
                onChange={(e) => setDraftHero(e.target.checked)}
                className="h-4 w-4 rounded border-white/20 accent-gold"
              />
              {t.makeHero}
            </label>
            <button
              type="button"
              onClick={addChildFromForm}
              className="min-h-[44px] w-full rounded-xl bg-gold/20 py-2 text-sm font-semibold text-gold"
            >
              {t.addButton}
            </button>
          </motion.div>
        )}

        {config.children.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {config.children.map((child) => (
              <span
                key={child.id}
                className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 py-1.5 pl-3 pr-1 text-sm text-white/70"
              >
                {child.name.trim() || 'Child'}, {child.age}
                <button
                  type="button"
                  onClick={() => removeChild(child.id)}
                  className="min-h-[44px] min-w-[44px] rounded-full text-white/30 hover:text-white/60"
                  aria-label="Remove"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}

        {ageGapBand === 'yellow' && (
          <div className="rounded-xl border border-gold/30 bg-gold/5 p-3 text-xs text-gold/80">
            {t.ageGapSmall}
          </div>
        )}
        {ageGapBand === 'orange' && (
          <div className="space-y-2 rounded-xl border border-rose/30 bg-rose/5 p-3 text-xs text-rose/80">
            <div className="flex gap-2">
              <AlertTriangle className="shrink-0 text-rose" size={16} />
              <p>{t.ageGapBig}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {(['younger', 'older', 'balance'] as AgeFocus[]).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => {
                    setConfig((p) => ({ ...p, ageFocus: f }));
                    setAgeFocusError(false);
                  }}
                  className={cn(
                    'min-h-[44px] rounded-xl border px-3 text-sm',
                    config.ageFocus === f
                      ? 'border-gold/40 bg-gold/15 text-gold'
                      : 'border-white/10 bg-deep/50 text-white/50',
                  )}
                >
                  {f === 'younger' ? t.younger : f === 'older' ? t.older : t.balance}
                </button>
              ))}
            </div>
            {ageFocusError && <p className="text-rose">{t.ageGapChooseFocus}</p>}
          </div>
        )}
      </div>

      {/* Theme selector */}
      <div className="space-y-3">
        <h4 className="text-xs font-bold uppercase tracking-widest text-white/30">{t.themeTitle}</h4>
        <div className="space-y-2">
          {themeTiles.map((tile) => (
            <motion.button
              key={tile.id}
              type="button"
              whileTap={{ scale: 0.98 }}
              onClick={() =>
                setConfig((p) => ({ ...p, theme: p.theme === tile.id ? null : tile.id }))
              }
              className={cn(
                'theme-card w-full rounded-2xl p-4 text-left flex items-start gap-4',
                tile.css,
                config.theme === tile.id && 'selected',
              )}
            >
              <span className="text-3xl shrink-0 mt-0.5">{tile.icon}</span>
              <div className="space-y-0.5 min-w-0">
                <p className="font-semibold text-sm" style={{ color: config.theme === tile.id ? 'var(--theme-color)' : 'rgba(255,255,255,0.8)' }}>
                  {tile.label}
                </p>
                <p className="text-xs text-white/35 line-clamp-1">{tile.desc}</p>
              </div>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Length selector */}
      <div className="space-y-3">
        <h4 className="text-xs font-bold uppercase tracking-widest text-white/30">{t.storyLength}</h4>
        <div className="space-y-2">
          {lengthOptions.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setConfig((p) => ({ ...p, length: opt.id }))}
              className={cn(
                'w-full rounded-2xl border p-4 text-left flex items-center gap-4 transition-all',
                config.length === opt.id
                  ? 'border-gold/30 bg-gold/8 text-gold'
                  : 'border-white/6 bg-white/2 text-white/50',
              )}
            >
              <span className="text-2xl">{opt.icon}</span>
              <div>
                <p className="font-semibold text-sm">{opt.label}</p>
                <p className="text-xs opacity-60">{opt.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Mode toggle */}
      <div className="space-y-3">
        <h4 className="text-xs font-bold uppercase tracking-widest text-white/30">{t.storyMode}</h4>
        <div className="grid grid-cols-2 gap-2">
          {([
            { id: 'normal' as StoryMode, label: t.modeNormal, desc: t.modeNormalDesc, icon: '📖' },
            { id: 'interactive' as StoryMode, label: t.modeInteractive, desc: t.modeInteractiveDesc, icon: '🎮' },
          ]).map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setConfig((p) => ({ ...p, mode: opt.id }))}
              className={cn(
                'rounded-2xl border p-4 text-center transition-all space-y-2',
                config.mode === opt.id
                  ? 'border-lavender/30 bg-lavender/8 text-lavender'
                  : 'border-white/6 bg-white/2 text-white/40',
              )}
            >
              <span className="text-2xl block">{opt.icon}</span>
              <p className="font-semibold text-xs">{opt.label}</p>
              <p className="text-[10px] opacity-60 leading-tight">{opt.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Create button */}
      <button
        type="button"
        onClick={handleCreate}
        className="dream-button min-h-[52px] w-full rounded-2xl text-lg font-bold text-deep"
      >
        {t.createStory}
      </button>
    </div>
  );
};

/* ───────── Star Rating ───────── */
const StarRating = ({
  rating,
  onRate,
}: {
  rating: number;
  onRate: (r: number) => void;
}) => {
  const [hover, setHover] = useState(0);
  const display = hover || rating;

  return (
    <div
      className="relative z-[100] flex items-center justify-center gap-0.5 flex-wrap py-1"
      onMouseLeave={() => setHover(0)}
      role="radiogroup"
      aria-label="Rate this story"
    >
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          role="radio"
          aria-checked={rating === star}
          aria-label={`${star} out of 5 stars`}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onRate(star);
          }}
          onMouseEnter={() => setHover(star)}
          className="flex min-h-[44px] min-w-[44px] touch-manipulation cursor-pointer items-center justify-center rounded-xl transition-transform duration-150 hover:scale-110 active:scale-95 focus:outline-none"
        >
          <Star
            size={26}
            className={cn(
              'transition-all duration-150',
              star <= display
                ? 'text-gold fill-gold drop-shadow-[0_0_8px_rgba(212,165,116,0.45)]'
                : 'text-white/20 fill-transparent hover:text-gold/40 hover:fill-gold/15',
            )}
          />
        </button>
      ))}
    </div>
  );
};

/* ───────── Interactive Story Parser ───────── */
function parseInteractiveStory(content: string): { segments: string[]; choices: { prompt: string; pathA: string; pathB: string }[] } {
  const choiceRegex = /---CHOICE---\s*([\s\S]*?)---PATH_A---\s*([\s\S]*?)---PATH_B---\s*([\s\S]*?)(?=---CHOICE---|$)/g;
  const segments: string[] = [];
  const choices: { prompt: string; pathA: string; pathB: string }[] = [];
  let lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = choiceRegex.exec(content)) !== null) {
    segments.push(content.slice(lastIndex, match.index).trim());
    choices.push({
      prompt: match[1]?.trim() ?? '',
      pathA: match[2]?.trim() ?? '',
      pathB: match[3]?.trim() ?? '',
    });
    lastIndex = match.index + match[0].length;
  }
  segments.push(content.slice(lastIndex).trim());
  return { segments, choices };
}

/* ───────── Story Reader ───────── */
const SLEEP_TIMER_OPTIONS = [5, 10, 15, 20, 30];

const StoryReader = ({
  story,
  onBack,
  isFavorite,
  onToggleFavorite,
  rating,
  onRate,
  contentDir,
  t,
  onRegenerate,
  onSequel,
  onDelete,
  onExport,
  showToast,
}: {
  story: Story;
  onBack: () => void;
  isFavorite: boolean;
  onToggleFavorite: (s: Story) => void;
  rating: number;
  onRate: (r: number) => void;
  contentDir: 'ltr' | 'rtl';
  t: UIStrings;
  onRegenerate: () => void;
  onSequel: () => void;
  onDelete: () => void;
  onExport: () => void;
  showToast: (msg: string, type: ToastType) => void;
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [showShareToast, setShowShareToast] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Sleep timer state
  const [sleepMinutes, setSleepMinutes] = useState(0); // 0 = off
  const [sleepRemaining, setSleepRemaining] = useState(0);
  const sleepIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Quiet mode
  const [quietFading, setQuietFading] = useState(false);

  // Premium TTS state
  const [ttsAvailable, setTtsAvailable] = useState(false);
  const [usePremiumVoice, setUsePremiumVoice] = useState(false);
  const [ttsLoading, setTtsLoading] = useState(false);
  const ttsAudioRef = useRef<ReturnType<typeof playTTSAudio> | null>(null);

  // Ambient music state
  const [ambientType, setAmbientType] = useState<AmbientType>('none');

  // Check ElevenLabs availability on mount
  useEffect(() => {
    isElevenLabsAvailable().then((ok) => { setTtsAvailable(ok); setUsePremiumVoice(ok); });
  }, []);

  // Interactive mode
  const [chosenPaths, setChosenPaths] = useState<number[]>([]);
  const isInteractive = story.content.includes('---CHOICE---');
  const parsed = useMemo(() => isInteractive ? parseInteractiveStory(story.content) : null, [story.content, isInteractive]);

  const { mainMd, bridgeBody } = useMemo(() => {
    const contentToUse = isInteractive && parsed
      ? buildInteractiveContent(parsed, chosenPaths)
      : story.content;
    const parts = contentToUse.split(/\n##\s*Dream Bridge\s*\n/i);
    if (parts.length >= 2) {
      const bridge = parts[parts.length - 1] ?? '';
      const main = parts.slice(0, -1).join('\n\n');
      const body = bridge.trim().replace(/^##\s*Dream Bridge\s*\n?/i, '').trim();
      return { mainMd: main.trim(), bridgeBody: body };
    }
    return { mainMd: contentToUse, bridgeBody: null as string | null };
  }, [story.content, isInteractive, parsed, chosenPaths]);

  // Helper to build visible content based on chosen paths
  function buildInteractiveContent(p: ReturnType<typeof parseInteractiveStory>, paths: number[]): string {
    let result = '';
    for (let i = 0; i < p.segments.length; i++) {
      result += p.segments[i] + '\n\n';
      if (i < p.choices.length && i < paths.length) {
        result += (paths[i] === 0 ? p.choices[i].pathA : p.choices[i].pathB) + '\n\n';
      }
    }
    return result.trim();
  }

  // Next pending choice index
  const nextChoiceIdx = isInteractive && parsed ? Math.min(chosenPaths.length, parsed.choices.length - 1) : -1;
  const hasNextChoice = isInteractive && parsed && chosenPaths.length < parsed.choices.length;

  const stopAllAudio = useCallback(() => {
    // Stop premium TTS
    if (ttsAudioRef.current) { ttsAudioRef.current.stop(); ttsAudioRef.current = null; }
    // Stop browser TTS
    window.speechSynthesis.cancel();
    // Stop ambient music
    stopAmbientMusic();
    setAmbientType('none');
    setIsPlaying(false);
    setTtsLoading(false);
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      const winScroll = document.documentElement.scrollTop;
      const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
      const scrolled = height > 0 ? (winScroll / height) * 100 : 0;
      setScrollProgress(scrolled);
    };
    window.addEventListener('scroll', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll);
      stopAllAudio();
      if (sleepIntervalRef.current) clearInterval(sleepIntervalRef.current);
    };
  }, [stopAllAudio]);

  // Sleep timer countdown
  useEffect(() => {
    if (sleepIntervalRef.current) clearInterval(sleepIntervalRef.current);

    if (sleepMinutes > 0) {
      setSleepRemaining(sleepMinutes * 60);
      sleepIntervalRef.current = setInterval(() => {
        setSleepRemaining((prev) => {
          if (prev <= 1) {
            // Timer expired — trigger quiet fade
            stopAllAudio();
            setSleepMinutes(0);
            setQuietFading(true);
            if (sleepIntervalRef.current) clearInterval(sleepIntervalRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      setSleepRemaining(0);
    }

    return () => { if (sleepIntervalRef.current) clearInterval(sleepIntervalRef.current); };
  }, [sleepMinutes]);

  const cycleSleepTimer = () => {
    const currentIdx = SLEEP_TIMER_OPTIONS.indexOf(sleepMinutes);
    if (currentIdx === -1 || currentIdx === SLEEP_TIMER_OPTIONS.length - 1) {
      setSleepMinutes(0);
      showToast(t.sleepTimerOff, 'success');
    } else if (sleepMinutes === 0) {
      setSleepMinutes(SLEEP_TIMER_OPTIONS[0]);
      showToast(`${t.sleepTimerSet} — ${SLEEP_TIMER_OPTIONS[0]} ${t.minutesShort}`, 'success');
    } else {
      const next = SLEEP_TIMER_OPTIONS[currentIdx + 1];
      setSleepMinutes(next);
      showToast(`${t.sleepTimerSet} — ${next} ${t.minutesShort}`, 'success');
    }
  };

  const togglePlay = async () => {
    const cleanText = story.content.replace(/[#*`_~\[\]()]/g, '').replace(/---(?:CHOICE|PATH_[AB])---/g, '');
    const fullText = `${story.title}. ${cleanText}`;

    // --- Premium ElevenLabs TTS ---
    if (usePremiumVoice && ttsAvailable) {
      // If already playing, pause
      if (isPlaying && ttsAudioRef.current) {
        ttsAudioRef.current.pause();
        setIsPlaying(false);
        return;
      }
      // If paused, resume
      if (!isPlaying && ttsAudioRef.current) {
        ttsAudioRef.current.play();
        setIsPlaying(true);
        return;
      }
      // Generate new speech
      setTtsLoading(true);
      const blob = await generateSpeech(fullText, 'warm_female');
      setTtsLoading(false);
      if (!blob) {
        // Fallback to browser TTS if ElevenLabs fails
        browserTTSFallback(fullText);
        return;
      }
      const ctrl = playTTSAudio(blob);
      ttsAudioRef.current = ctrl;
      ctrl.onEnd(() => { setIsPlaying(false); ttsAudioRef.current = null; });
      ctrl.play();
      setIsPlaying(true);
      return;
    }

    // --- Browser SpeechSynthesis fallback ---
    const synth = window.speechSynthesis;
    if (synth.speaking && !synth.paused) {
      synth.pause();
      setIsPlaying(false);
      return;
    }
    if (synth.paused) {
      synth.resume();
      setIsPlaying(true);
      return;
    }
    browserTTSFallback(fullText);
  };

  const browserTTSFallback = (text: string) => {
    const synth = window.speechSynthesis;
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.85;
    utterance.pitch = 1.05;
    utterance.onend = () => setIsPlaying(false);
    utterance.onerror = () => setIsPlaying(false);
    synth.speak(utterance);
    setIsPlaying(true);
  };

  const handleBack = () => {
    stopAllAudio();
    onBack();
  };

  const handleShare = async () => {
    try {
      const storyData = JSON.stringify(story);
      const compressed = LZString.compressToEncodedURIComponent(storyData);
      const shareUrl = `${window.location.origin}${window.location.pathname}?story=${compressed}`;
      if (navigator.share) {
        await navigator.share({
          title: `Dream Weaver: ${story.title}`,
          text: story.title,
          url: shareUrl,
        });
      } else {
        await navigator.clipboard.writeText(shareUrl);
        setShowShareToast(true);
        setTimeout(() => setShowShareToast(false), 3000);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const BackIcon = contentDir === 'rtl' ? ChevronRight : ChevronLeft;

  const sleepTimerPercent = sleepMinutes > 0 ? ((sleepMinutes * 60 - sleepRemaining) / (sleepMinutes * 60)) * 100 : 0;
  const sleepDisplay = sleepRemaining > 0 ? `${Math.floor(sleepRemaining / 60)}:${(sleepRemaining % 60).toString().padStart(2, '0')}` : null;

  return (
    <div className="min-h-screen bg-deep" dir={contentDir}>
      {/* Quiet mode fade overlay */}
      {quietFading && (
        <div className="quiet-overlay quiet-fade" onAnimationEnd={() => setQuietFading(false)} />
      )}

      {/* Delete confirmation */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <ConfirmDeleteModal
            t={t}
            onConfirm={() => { setShowDeleteConfirm(false); onDelete(); }}
            onCancel={() => setShowDeleteConfirm(false)}
          />
        )}
      </AnimatePresence>

      {/* Progress bar */}
      <div className="fixed top-0 left-0 right-0 z-[60] h-0.5 max-w-[430px] mx-auto w-full bg-white/5">
        <div
          className="h-full bg-gold/60 transition-all duration-150"
          style={{ width: `${scrollProgress}%` }}
        />
      </div>

      {/* Header */}
      <header className="fixed top-0 left-1/2 z-[55] flex h-14 w-full max-w-[430px] -translate-x-1/2 items-center justify-between px-4 card-dark">
        <button
          type="button"
          onClick={handleBack}
          className="min-h-[44px] min-w-[44px] flex items-center justify-center text-white/40 hover:text-white/60"
          aria-label={t.back}
        >
          <BackIcon size={22} />
        </button>
        <span className="text-xs font-medium text-white/30 truncate max-w-[30%]">{story.title}</span>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => onToggleFavorite(story)}
            className={cn(
              'min-h-[44px] min-w-[44px] flex items-center justify-center transition-all',
              isFavorite ? 'text-rose' : 'text-white/40 hover:text-white/60',
            )}
            aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          >
            <Heart size={18} fill={isFavorite ? 'currentColor' : 'none'} />
          </button>
          <button
            type="button"
            onClick={handleShare}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-white/40 hover:text-white/60"
            aria-label="Share"
          >
            <Share2 size={16} />
          </button>
          <button
            type="button"
            onClick={onExport}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-white/40 hover:text-white/60"
            aria-label={t.exportStory}
          >
            <Download size={16} />
          </button>
          <button
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-white/40 hover:text-red-400/60"
            aria-label={t.deleteStory}
          >
            <Trash2 size={16} />
          </button>
        </div>
      </header>

      {/* Story content */}
      <div className="mx-auto w-full max-w-[430px] px-6 pb-[28rem] pt-20 sm:px-8">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-8"
        >
          <h1 className="font-display text-3xl font-bold leading-tight text-starlight">{story.title}</h1>

          <div className="soft-divider" />

          <div dir={contentDir} className="story-prose">
            <ReactMarkdown>{mainMd}</ReactMarkdown>

            {/* Interactive mode: show choice cards if there's a pending choice */}
            {hasNextChoice && parsed && nextChoiceIdx >= 0 && (
              <div className="my-10 space-y-4">
                <p className="text-center text-sm font-medium text-gold/60">{t.choosePath}</p>
                <motion.button
                  type="button"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  onClick={() => setChosenPaths((p) => [...p, 0])}
                  className="choice-card"
                >
                  <span className="text-gold/70 text-xs font-bold uppercase tracking-wider">{t.pathA}</span>
                  <p className="mt-1 text-sm text-white/60">{parsed.choices[nextChoiceIdx].prompt.split('\n')[0] || t.pathA}</p>
                </motion.button>
                <motion.button
                  type="button"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  onClick={() => setChosenPaths((p) => [...p, 1])}
                  className="choice-card"
                >
                  <span className="text-lavender/70 text-xs font-bold uppercase tracking-wider">{t.pathB}</span>
                  <p className="mt-1 text-sm text-white/60">{parsed.choices[nextChoiceIdx].prompt.split('\n')[1] || t.pathB}</p>
                </motion.button>
              </div>
            )}

            {bridgeBody != null && bridgeBody.length > 0 && (
              <div className="mx-auto mt-12 max-w-md text-center">
                <div className="soft-divider mb-6" />
                <p className="mb-4 text-sm font-medium tracking-wide text-gold/50">
                  <span className="mr-1.5" aria-hidden="true">🌙</span>
                  {t.dreamBridgeTitle}
                </p>
                <div className="story-prose [&_p]:text-sm [&_p]:text-white/35 [&_p]:text-center">
                  <ReactMarkdown>{bridgeBody}</ReactMarkdown>
                </div>
              </div>
            )}
          </div>

          {/* Rating */}
          <div className="relative z-[100] flex flex-col items-center space-y-4 pt-8 pb-4">
            <div className="soft-divider w-full mb-4" />
            <p className="font-medium text-white/40">{t.howWasDream}</p>
            <StarRating rating={rating} onRate={onRate} />
            {rating > 0 && (
              <p className="text-sm font-medium text-gold">
                {rating === 5 ? t.rateMagic : t.rateThankYou}
              </p>
            )}
          </div>

          {/* Action buttons: regenerate + sequel */}
          <div className="space-y-3 pb-8">
            <button
              type="button"
              onClick={onRegenerate}
              className="flex w-full items-center justify-center gap-2 min-h-[48px] rounded-2xl border border-gold/20 text-sm font-medium text-gold/70 hover:bg-gold/5 transition-colors"
            >
              <RefreshCw size={16} />
              {t.regenerate}
            </button>
            <button
              type="button"
              onClick={onSequel}
              className="flex w-full items-center justify-center gap-2 min-h-[48px] rounded-2xl border border-lavender/20 text-sm font-medium text-lavender/70 hover:bg-lavender/5 transition-colors"
            >
              <BookPlus size={16} />
              {t.sequel}
            </button>
          </div>
        </motion.div>
      </div>

      {/* Share toast */}
      <AnimatePresence>
        {showShareToast && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-40 left-1/2 z-[70] flex w-[calc(100%-2rem)] max-w-[398px] -translate-x-1/2 items-center justify-center gap-2 rounded-full card-glass px-6 py-3 text-sm font-medium"
          >
            <Sparkles size={14} className="text-gold" />
            {t.linkCopied}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Audio controls */}
      <div className="pointer-events-none fixed bottom-0 left-1/2 z-50 w-full max-w-[430px] -translate-x-1/2 p-4 pb-6">
        <div className="card-dark space-y-4 rounded-[32px] p-5 shadow-2xl">
          <div className="pointer-events-auto flex items-center justify-around">
            <button
              type="button"
              onClick={stopAllAudio}
              className="min-h-[44px] flex flex-col items-center text-white/30 hover:text-white/50"
              aria-label={t.reset}
            >
              <RotateCcw size={20} />
              <span className="mt-1 text-[10px]">{t.reset}</span>
            </button>
            <button
              type="button"
              onClick={togglePlay}
              disabled={ttsLoading}
              className={cn(
                'w-14 h-14 min-h-[44px] min-w-[44px] rounded-full text-deep flex items-center justify-center shadow-lg active:scale-95 transition-transform',
                ttsLoading ? 'bg-gold/50 animate-pulse' : 'bg-gold',
              )}
              aria-label={ttsLoading ? 'Loading...' : isPlaying ? 'Pause' : 'Play'}
            >
              {ttsLoading ? (
                <span className="text-xs font-bold">...</span>
              ) : isPlaying ? (
                <Pause size={28} fill="currentColor" />
              ) : (
                <Play size={28} fill="currentColor" className="ml-0.5" />
              )}
            </button>
            <button
              type="button"
              onClick={cycleSleepTimer}
              className={cn(
                'min-h-[44px] flex flex-col items-center transition-colors',
                sleepMinutes > 0 ? 'text-gold' : 'text-white/30 hover:text-white/50',
              )}
              aria-label={t.sleepTimer}
            >
              <Timer size={20} />
              <span className="text-[10px] mt-1">{sleepDisplay ?? t.sleepTimer}</span>
            </button>
          </div>

          {/* Sleep timer bar */}
          {sleepMinutes > 0 && (
            <div className="pointer-events-auto px-4">
              <div className="sleep-timer-bar">
                <div className="sleep-timer-fill" style={{ width: `${sleepTimerPercent}%` }} />
              </div>
              <p className="text-center text-[10px] text-gold/40 mt-1">{sleepDisplay} left</p>
            </div>
          )}

          {/* Ambient music selector */}
          <div className="pointer-events-auto flex items-center justify-center gap-2 px-2">
            <Music size={14} className="text-white/30 shrink-0" />
            {(['none', 'piano', 'nature', 'lullaby'] as AmbientType[]).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => {
                  if (type === 'none') { stopAmbientMusic(); setAmbientType('none'); }
                  else { stopAmbientMusic(); startAmbientMusic(type); setAmbientType(type); }
                }}
                className={cn(
                  'rounded-full px-3 py-1 text-[10px] font-medium transition-colors',
                  ambientType === type
                    ? 'bg-lavender/30 text-lavender'
                    : 'text-white/30 hover:text-white/50',
                )}
              >
                {type === 'none' ? '⏹' : type === 'piano' ? '🎹' : type === 'nature' ? '🌿' : '🌙'}
              </button>
            ))}
          </div>

          {/* Voice toggle (premium vs browser) */}
          {ttsAvailable && (
            <div className="pointer-events-auto flex items-center justify-center gap-3">
              <Volume2 size={14} className="text-white/30 shrink-0" />
              <button
                type="button"
                onClick={() => {
                  if (isPlaying) stopAllAudio();
                  setUsePremiumVoice(true);
                }}
                className={cn(
                  'rounded-full px-3 py-1 text-[10px] font-medium transition-colors',
                  usePremiumVoice ? 'bg-gold/20 text-gold' : 'text-white/30 hover:text-white/50',
                )}
              >
                {t.premiumVoice}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (isPlaying) stopAllAudio();
                  setUsePremiumVoice(false);
                }}
                className={cn(
                  'rounded-full px-3 py-1 text-[10px] font-medium transition-colors',
                  !usePremiumVoice ? 'bg-gold/20 text-gold' : 'text-white/30 hover:text-white/50',
                )}
              >
                {t.browserVoice}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/* ───────── Profile ───────── */
const ProfileScreen = ({
  t,
  languageName,
  storyCount,
  onHome,
}: {
  t: UIStrings;
  languageName: string;
  storyCount: number;
  onHome: () => void;
}) => (
  <div className="w-full space-y-6 px-5 pb-28 pt-8">
    <h1 className="text-2xl font-bold text-glow">{t.profile}</h1>
    <div className="card-glass space-y-5 rounded-2xl p-6">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-white/25">{t.storyLanguageLabel}</p>
        <p className="mt-1 text-lg font-medium text-starlight">{languageName}</p>
      </div>
      <div className="soft-divider" />
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-white/25">{t.storiesSaved}</p>
        <p className="mt-1 text-lg font-medium text-starlight">{storyCount}</p>
      </div>
    </div>
    <button
      type="button"
      onClick={onHome}
      className="min-h-[44px] w-full rounded-2xl border border-gold/20 py-3 text-sm font-medium text-gold/70 transition-colors hover:bg-gold/5"
    >
      {t.backHome}
    </button>
  </div>
);

/* ───────── Settings ───────── */
const SettingsScreen = ({
  lang,
  onLangChange,
  onBack,
  t,
  firebaseUser,
  onSignInGoogle,
  onSignOut,
  onSyncCloud,
}: {
  lang: AppLangCode;
  onLangChange: (code: AppLangCode) => void;
  onBack: () => void;
  t: UIStrings;
  firebaseUser: FirebaseUser | null;
  onSignInGoogle: () => void;
  onSignOut: () => void;
  onSyncCloud: () => void;
}) => (
  <div className="w-full space-y-6 px-5 pb-28 pt-8">
    <h1 className="text-2xl font-bold text-glow">{t.settingsTitle}</h1>
    <p className="text-sm text-white/35">{t.settingsLanguageHint}</p>
    <div className="flex gap-2 overflow-x-auto pb-2 snap-x snap-mandatory" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' }}>
      {LANG_OPTIONS.map(({ code, label, flag }) => (
        <button
          key={code}
          type="button"
          onClick={() => onLangChange(code)}
          className={cn(
            'snap-center shrink-0 min-h-[44px] rounded-2xl border px-4 py-2 text-sm font-medium transition-all flex items-center gap-2',
            lang === code
              ? 'border-gold/40 bg-gold/15 text-gold'
              : 'border-white/8 bg-white/3 text-white/60 hover:bg-white/6',
          )}
        >
          <span>{flag}</span>
          <span>{label}</span>
        </button>
      ))}
    </div>

    {/* Firebase Account Section */}
    {isFirebaseConfigured() && (
      <div className="space-y-3 rounded-2xl border border-white/8 bg-white/3 p-4">
        <h2 className="text-sm font-semibold text-starlight/80">{t.signIn}</h2>
        {firebaseUser ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              {firebaseUser.photoURL && (
                <img src={firebaseUser.photoURL} alt="" className="w-8 h-8 rounded-full" />
              )}
              <div className="text-sm text-white/60">
                {firebaseUser.displayName || firebaseUser.email || 'Anonymous'}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onSyncCloud}
                className="flex-1 min-h-[44px] rounded-2xl border border-gold/30 bg-gold/10 py-2.5 text-sm font-medium text-gold hover:bg-gold/20 transition-colors"
              >
                ☁️ Sync
              </button>
              <button
                type="button"
                onClick={onSignOut}
                className="flex-1 min-h-[44px] rounded-2xl border border-rose/30 bg-rose/10 py-2.5 text-sm font-medium text-rose hover:bg-rose/20 transition-colors"
              >
                {t.signOutLabel}
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={onSignInGoogle}
            className="min-h-[44px] w-full rounded-2xl border border-gold/30 bg-gold/10 py-3 text-sm font-medium text-gold hover:bg-gold/20 transition-colors"
          >
            {t.signInGoogle}
          </button>
        )}
      </div>
    )}

    <button
      type="button"
      onClick={onBack}
      className="min-h-[44px] w-full rounded-2xl border border-white/10 py-3 text-sm font-medium text-white/50 hover:bg-white/3"
    >
      {t.back}
    </button>
  </div>
);

/* ───────── Favorites ───────── */
const FavoritesList = ({
  t,
  stories,
  onSelectStory,
  ratings,
}: {
  t: UIStrings;
  stories: Story[];
  onSelectStory: (s: Story) => void;
  ratings: Record<string, number>;
}) => (
  <div className="w-full space-y-6 px-5 pb-28 pt-8">
    <header>
      <h1 className="text-2xl font-bold tracking-tight text-glow">{t.favoritesTitle}</h1>
      <p className="mt-1 text-white/35 text-sm">{t.favoritesSub}</p>
    </header>
    {stories.length === 0 ? (
      <p className="text-white/25 text-sm">{t.noFavorites}</p>
    ) : (
      <div className="grid grid-cols-2 gap-3">
        {stories.map((story) => (
          <motion.button
            key={story.id}
            type="button"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onSelectStory(story)}
            className="card-glass flex min-h-[44px] flex-col overflow-hidden rounded-2xl text-left"
          >
            <div className={cn(
              'aspect-square w-full shrink-0 flex items-center justify-center text-4xl bg-gradient-to-br',
              THEME_COLORS[story.theme ?? 'magic'],
            )}>
              {THEME_ICONS[(story.theme ?? 'magic') as StoryTheme] ?? '✨'}
            </div>
            <div className="flex flex-1 flex-col justify-between p-3">
              <h3 className="line-clamp-2 text-xs font-semibold leading-snug text-starlight/90">{story.title}</h3>
              {ratings[story.id] > 0 && (
                <div className="mt-1 flex items-center gap-1">
                  <Star size={10} className="fill-gold text-gold" />
                  <span className="text-[10px] font-bold text-gold">{ratings[story.id]}</span>
                </div>
              )}
            </div>
          </motion.button>
        ))}
      </div>
    )}
  </div>
);

/* ───────── My Kids Screen ───────── */
const MyKidsScreen = ({
  t,
  profiles,
  onAdd,
  onRemove,
  onBack,
}: {
  t: UIStrings;
  profiles: ChildProfile[];
  onAdd: (name: string, age: number, avatar: string) => void;
  onRemove: (id: string) => void;
  onBack: () => void;
}) => {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [age, setAge] = useState(5);
  const [avatar, setAvatar] = useState(AVATAR_OPTIONS[0]);

  const handleAdd = () => {
    if (!name.trim()) return;
    onAdd(name.trim(), age, avatar);
    setName('');
    setAge(5);
    setAvatar(AVATAR_OPTIONS[0]);
    setShowForm(false);
  };

  return (
    <div className="w-full space-y-6 px-5 pb-28 pt-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-glow">{t.myKids}</h1>
          <p className="text-xs text-white/30 mt-1">{t.myKidsDesc}</p>
        </div>
        <button type="button" onClick={() => setShowForm((s) => !s)} className="min-h-[44px] min-w-[44px] rounded-xl border border-white/10 bg-white/5 flex items-center justify-center text-white/50" aria-label={t.addKid}>
          <Plus size={20} />
        </button>
      </div>

      {showForm && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="card-glass rounded-2xl p-4 space-y-3">
          <input type="text" placeholder={t.childNamePlaceholder} value={name} onChange={(e) => setName(e.target.value)} className="min-h-[44px] w-full rounded-xl border border-white/8 bg-deep/50 px-3 text-sm text-white placeholder:text-white/25 focus:border-gold/30 focus:outline-none" />
          <div className="flex items-center gap-2">
            <label className="text-xs text-white/40">{t.ageLabel}</label>
            <input type="number" min={1} max={12} value={age} onChange={(e) => setAge(Number(e.target.value) || 1)} className="min-h-[44px] w-20 rounded-xl border border-white/8 bg-deep/50 px-2 text-sm text-white focus:border-gold/30 focus:outline-none" />
          </div>
          <div>
            <p className="text-xs text-white/40 mb-2">{t.selectAvatar}</p>
            <div className="flex flex-wrap gap-2">
              {AVATAR_OPTIONS.slice(0, 12).map((a) => (
                <button key={a} type="button" onClick={() => setAvatar(a)} className={cn('w-10 h-10 rounded-full text-xl flex items-center justify-center transition-all', avatar === a ? 'bg-gold/20 ring-2 ring-gold/40' : 'bg-white/5 hover:bg-white/10')}>
                  {a}
                </button>
              ))}
            </div>
          </div>
          <button type="button" onClick={handleAdd} className="min-h-[44px] w-full rounded-xl bg-gold/20 text-sm font-semibold text-gold">{t.addButton}</button>
        </motion.div>
      )}

      {profiles.length === 0 ? (
        <p className="text-sm text-white/25">{t.noKidsYet}</p>
      ) : (
        <div className="space-y-3">
          {profiles.map((p) => (
            <div key={p.id} className="card-glass rounded-2xl p-4 flex items-center gap-4">
              <span className="text-3xl">{p.avatar}</span>
              <div className="flex-1">
                <p className="font-semibold text-starlight">{p.name}</p>
                <p className="text-xs text-white/35">{t.ageLabel}: {p.age} · {p.storiesHeard} {t.storiesHeard}</p>
              </div>
              <button type="button" onClick={() => onRemove(p.id)} className="min-h-[44px] min-w-[44px] flex items-center justify-center text-white/20 hover:text-red-400" aria-label="Remove">
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}

      <button type="button" onClick={onBack} className="min-h-[44px] w-full rounded-2xl border border-white/10 py-3 text-sm text-white/50 hover:bg-white/3">{t.back}</button>
    </div>
  );
};

/* ───────── Parent Dashboard ───────── */
const ParentDashboardScreen = ({ t, onBack }: { t: UIStrings; onBack: () => void }) => {
  const summary = useMemo(() => getAnalyticsSummary(), []);
  const themeNames: Record<string, string> = { magic: t.themeMagic, nature: t.themeNature, wisdom: t.themeWisdom, emotions: t.themeEmotions, moral: t.themeMoral, modern: t.themeModern, daily: t.themeDaily };
  const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const maxActivity = Math.max(...summary.weeklyActivity, 1);

  return (
    <div className="w-full space-y-6 px-5 pb-28 pt-8">
      <h1 className="text-2xl font-bold text-glow">{t.parentDashboard}</h1>
      <p className="text-xs text-white/30">{t.parentDashboardDesc}</p>

      {summary.totalStories === 0 ? (
        <p className="text-sm text-white/25">{t.noDataYet}</p>
      ) : (
        <>
          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: t.totalStories, value: summary.totalStories.toString(), icon: '📚' },
              { label: t.totalListening, value: `${summary.totalListeningMinutes} min`, icon: '🎧' },
              { label: t.favoriteTheme, value: themeNames[summary.favoriteTheme ?? ''] ?? '—', icon: '⭐' },
              { label: t.avgRating, value: summary.averageRating > 0 ? summary.averageRating.toFixed(1) : '—', icon: '💫' },
            ].map((s) => (
              <div key={s.label} className="card-glass rounded-2xl p-4 space-y-1">
                <span className="text-xl" aria-hidden="true">{s.icon}</span>
                <p className="text-lg font-bold text-starlight">{s.value}</p>
                <p className="text-[10px] uppercase tracking-wider text-white/30">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Weekly activity bar chart */}
          <div className="card-glass rounded-2xl p-4 space-y-3">
            <p className="text-xs font-bold uppercase tracking-widest text-white/30">{t.weeklyActivity}</p>
            <div className="flex items-end justify-between gap-1 h-20">
              {summary.weeklyActivity.map((count, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full rounded-t bg-gold/30" style={{ height: `${Math.max(4, (count / maxActivity) * 64)}px` }} />
                  <span className="text-[9px] text-white/25">{days[i]}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      <button type="button" onClick={onBack} className="min-h-[44px] w-full rounded-2xl border border-white/10 py-3 text-sm text-white/50 hover:bg-white/3">{t.back}</button>
    </div>
  );
};

/* ───────── Upgrade Screen ───────── */
const UpgradeScreen = ({
  t, onPurchase, onRestore, onBack, remaining,
}: {
  t: UIStrings;
  onPurchase: (pkg: string) => void;
  onRestore: () => void;
  onBack: () => void;
  remaining: number;
}) => {
  const [prices, setPrices] = useState<{ monthly: string | null; yearly: string | null }>({ monthly: null, yearly: null });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getOfferings().then((o) => {
      if (o) setPrices({ monthly: o.monthly?.priceString ?? null, yearly: o.yearly?.priceString ?? null });
    });
  }, []);

  const handlePurchase = async (pkg: string) => {
    setLoading(true);
    await onPurchase(pkg);
    setLoading(false);
  };

  return (
    <div className="w-full space-y-6 px-5 pb-28 pt-8">
      <div className="text-center space-y-2 pt-8">
        <span className="text-5xl block" aria-hidden="true">✨</span>
        <h1 className="text-2xl font-bold text-glow">{t.upgradeTitle}</h1>
        <p className="text-sm text-white/40">{t.upgradeDesc}</p>
      </div>

      {/* Free plan */}
      <div className="card-glass rounded-2xl p-5 space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-white/70">{t.freePlan}</h3>
          <span className="text-xs text-white/30">$0</span>
        </div>
        <p className="text-xs text-white/35">{t.freePlanDesc}</p>
        <p className="text-xs text-gold/60">{remaining} {t.storiesLeft}</p>
      </div>

      {/* Monthly plan */}
      <div className="rounded-2xl border border-gold/30 bg-gold/5 p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gold">{t.premiumPlan}</h3>
          <span className="text-sm font-bold text-gold">{prices.monthly ?? '$4.99/mo'}</span>
        </div>
        <p className="text-xs text-white/50">{t.premiumPlanDesc}</p>
        <ul className="text-xs text-white/40 space-y-1">
          <li>• Unlimited stories</li>
          <li>• Premium AI voices (ElevenLabs)</li>
          <li>• Background ambient music</li>
          <li>• Bedtime routine mode</li>
          <li>• Parent dashboard & insights</li>
          <li>• Cloud sync across devices</li>
        </ul>
        <button
          type="button"
          disabled={loading}
          onClick={() => handlePurchase('$rc_monthly')}
          className={cn('dream-button w-full min-h-[48px] rounded-xl text-sm font-bold text-deep', loading && 'opacity-50')}
        >
          {loading ? '...' : t.upgradeNow}
        </button>
      </div>

      {/* Yearly plan */}
      <div className="rounded-2xl border border-lavender/30 bg-lavender/5 p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-lavender">Premium Yearly</h3>
          <div className="text-right">
            <span className="text-sm font-bold text-lavender">{prices.yearly ?? '$39.99/yr'}</span>
            <span className="block text-[10px] text-lavender/50">Save ~33%</span>
          </div>
        </div>
        <button
          type="button"
          disabled={loading}
          onClick={() => handlePurchase('$rc_annual')}
          className={cn(
            'w-full min-h-[48px] rounded-xl text-sm font-bold transition-colors',
            'bg-lavender/20 text-lavender border border-lavender/30 hover:bg-lavender/30',
            loading && 'opacity-50',
          )}
        >
          {loading ? '...' : 'Subscribe Yearly'}
        </button>
      </div>

      {/* Restore + back */}
      <button type="button" onClick={onRestore} className="min-h-[44px] w-full text-center text-xs text-gold/40 hover:text-gold/60">
        Restore purchases
      </button>
      <button type="button" onClick={onBack} className="min-h-[44px] w-full rounded-2xl border border-white/10 py-3 text-sm text-white/50 hover:bg-white/3">{t.back}</button>
    </div>
  );
};

/* ───────── Bedtime Routine ───────── */
const ROUTINE_STEPS = ['music', 'story', 'dreamBridge', 'lightsOut'] as const;
const ROUTINE_DURATIONS = [300, 0, 120, 30]; // seconds (music=5min, story=variable, bridge=2min, lights=30s)

const BedtimeRoutineScreen = ({
  t,
  onStartStory,
  onBack,
  resumeAtStep,
}: {
  t: UIStrings;
  onStartStory: () => void;
  onBack: () => void;
  resumeAtStep?: number;
}) => {
  const [activeStep, setActiveStep] = useState<number>(resumeAtStep ?? -1);
  const [elapsed, setElapsed] = useState(0);
  const stepLabels = [t.routineMusic, t.routineStory, t.routineDreamBridge, t.routineLightsOut];
  const stepIcons = ['🎵', '📖', '🌙', '🌑'];

  useEffect(() => {
    if (activeStep < 0) return;
    const tick = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(tick);
  }, [activeStep]);

  useEffect(() => {
    if (activeStep === 0) {
      startAmbientMusic('piano');
    } else if (activeStep === 2) {
      // Dream Bridge: gentle lullaby
      startAmbientMusic('lullaby');
    } else if (activeStep === 3) {
      // Lights Out: fade everything
      stopAmbientMusic();
    }
  }, [activeStep]);

  // Auto-advance music step after 5 minutes
  useEffect(() => {
    if (activeStep === 0 && elapsed >= ROUTINE_DURATIONS[0]) {
      setActiveStep(1);
      setElapsed(0);
      stopAmbientMusic();
      onStartStory();
    }
  }, [activeStep, elapsed, onStartStory]);

  // Auto-advance Dream Bridge after 3 minutes → Lights Out
  useEffect(() => {
    if (activeStep === 2 && elapsed >= 180) {
      setActiveStep(3);
      setElapsed(0);
    }
  }, [activeStep, elapsed]);

  const startRoutine = () => {
    setActiveStep(0);
    setElapsed(0);
  };

  return (
    <div className="w-full space-y-6 px-5 pb-28 pt-8">
      <h1 className="text-2xl font-bold text-glow">{t.bedtimeRoutine}</h1>
      <p className="text-xs text-white/30">{t.bedtimeRoutineDesc}</p>

      {/* Steps timeline */}
      <div className="space-y-3">
        {ROUTINE_STEPS.map((_, i) => (
          <div key={i} className={cn(
            'card-glass rounded-2xl p-4 flex items-center gap-4 transition-all',
            activeStep === i && 'border-gold/30 bg-gold/5',
            activeStep > i && 'opacity-50',
          )}>
            <span className="text-2xl" aria-hidden="true">{stepIcons[i]}</span>
            <div className="flex-1">
              <p className={cn('font-semibold text-sm', activeStep === i ? 'text-gold' : 'text-white/60')}>{stepLabels[i]}</p>
              {activeStep === i && i === 0 && (
                <p className="text-xs text-gold/50 mt-1">{Math.floor((ROUTINE_DURATIONS[0] - elapsed) / 60)}:{((ROUTINE_DURATIONS[0] - elapsed) % 60).toString().padStart(2, '0')}</p>
              )}
              {activeStep === i && i === 2 && (
                <p className="text-xs text-lavender/50 mt-1">{Math.floor((180 - elapsed) / 60)}:{((180 - elapsed) % 60).toString().padStart(2, '0')}</p>
              )}
              {activeStep === i && i === 3 && (
                <p className="text-xs text-white/30 mt-1 animate-pulse">🌙 Sweet dreams...</p>
              )}
            </div>
            {activeStep > i && <span className="text-gold text-sm">✓</span>}
            {activeStep === i && <div className="w-2 h-2 rounded-full bg-gold animate-pulse" />}
          </div>
        ))}
      </div>

      {activeStep < 0 && (
        <button type="button" onClick={startRoutine} className="dream-button w-full min-h-[52px] rounded-2xl text-lg font-bold text-deep">{t.startRoutine}</button>
      )}

      {/* Manual advance for Dream Bridge */}
      {activeStep === 2 && (
        <button type="button" onClick={() => { setActiveStep(3); setElapsed(0); }} className="dream-button w-full min-h-[48px] rounded-2xl text-sm font-medium text-deep">
          {t.routineLightsOut} →
        </button>
      )}

      <button type="button" onClick={() => { stopAmbientMusic(); onBack(); }} className="min-h-[44px] w-full rounded-2xl border border-white/10 py-3 text-sm text-white/50 hover:bg-white/3">{t.back}</button>
    </div>
  );
};

/* ───────── Main App ───────── */
export default function App() {
  const [lang, setLang] = useState<AppLangCode>(() => getStoredLangCode());
  const [screen, setScreen] = useState<Screen>('home');
  const [selectedStory, setSelectedStory] = useState<Story | null>(null);
  const [savedStories, setSavedStories] = useState<Story[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const [lastConfig, setLastConfig] = useState<StoryConfig | null>(null);
  const [childProfiles, setChildProfiles] = useState<ChildProfile[]>([]);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [routineMode, setRoutineMode] = useState(false);

  const t = UI_STRINGS[lang];

  const showToast = useCallback((message: string, type: ToastType) => {
    const id = ++toastCounter;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    migrateLegacyStorage();
    migrateLanguageKeyInStorage();
    initPaywall();
    setLang(getStoredLangCode());
    setSavedStories(loadStories());
    setFavoriteIds(loadFavoriteIds());
    try {
      const r = localStorage.getItem(LS.ratings);
      setRatings(r ? JSON.parse(r) : {});
    } catch {
      setRatings({});
    }
    setChildProfiles(loadChildProfiles());
    const onboarded = localStorage.getItem(LS.onboarded) === 'true';
    setScreen(onboarded ? 'home' : 'onboarding');

    // Firebase auth listener
    if (isFirebaseConfigured()) {
      const unsub = onAuthChange((user) => {
        setFirebaseUser(user ? { uid: user.uid, displayName: user.displayName, email: user.email, photoURL: user.photoURL } : null);
      });
      return unsub;
    }
  }, []);

  useEffect(() => {
    persistLangCode(lang);
    document.documentElement.lang = lang;
    document.documentElement.dir = isRtl(lang) ? 'rtl' : 'ltr';
  }, [lang]);

  useEffect(() => {
    localStorage.setItem(LS.ratings, JSON.stringify(ratings));
  }, [ratings]);

  useEffect(() => {
    saveFavoriteIds(favoriteIds);
  }, [favoriteIds]);

  const favoriteStories = useMemo(
    () => savedStories.filter((s) => favoriteIds.includes(s.id)),
    [savedStories, favoriteIds],
  );

  const readerDir = useMemo(() => {
    const code = (selectedStory?.config?.storyLanguage ?? lang) as AppLangCode;
    return isRtl(code) ? 'rtl' : 'ltr';
  }, [selectedStory, lang]);

  const toggleFavorite = (story: Story) => {
    setFavoriteIds((prev) =>
      prev.includes(story.id) ? prev.filter((fid) => fid !== story.id) : [...prev, story.id],
    );
  };

  const handleRate = (storyId: string, rating: number) => {
    setRatings((prev) => ({ ...prev, [storyId]: rating }));
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const shared = params.get('story');
    if (shared) {
      try {
        const raw = LZString.decompressFromEncodedURIComponent(shared);
        if (raw) {
          const s = JSON.parse(raw) as Story;
          setSelectedStory(s);
          setScreen('reader');
          window.history.replaceState({}, document.title, window.location.origin + window.location.pathname);
        }
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  const handleAddKid = (name: string, age: number, avatar: string) => {
    addChildProfile(name, age, avatar);
    setChildProfiles(loadChildProfiles());
  };

  const handleRemoveKid = (id: string) => {
    removeChildProfile(id);
    setChildProfiles(loadChildProfiles());
  };

  const handlePurchase = async (packageId: string) => {
    const success = await purchasePackage(packageId);
    if (success) {
      showToast('Premium activated! ✨', 'success');
      setScreen('home');
    } else {
      showToast('Purchase cancelled or failed', 'error');
    }
  };

  const handleRestore = async () => {
    const restored = await restorePurchases();
    if (restored) {
      showToast('Premium restored! ✨', 'success');
      setScreen('home');
    } else {
      showToast('No previous purchases found', 'error');
    }
  };

  const handleSignInGoogle = async () => {
    try {
      await signInWithGoogle();
      showToast(t.signInGoogle + ' ✓', 'success');
    } catch (e) {
      console.error('Google sign-in failed:', e);
      showToast('Sign-in failed', 'error');
    }
  };

  const handleSignOut = async () => {
    try {
      await fbSignOut();
      setFirebaseUser(null);
      showToast(t.signOutLabel + ' ✓', 'success');
    } catch (e) {
      console.error('Sign-out failed:', e);
    }
  };

  const handleSyncCloud = async () => {
    if (!firebaseUser) return;
    try {
      // Upload local to cloud
      await syncStoriesToCloud(firebaseUser.uid, savedStories);
      await syncFavoritesToCloud(firebaseUser.uid, favoriteIds);
      // Download cloud and merge
      const cloudStories = await loadStoriesFromCloud(firebaseUser.uid) as Story[];
      const merged = mergeLocalAndCloud(savedStories, cloudStories);
      for (const s of merged) saveStory(s);
      setSavedStories(loadStories());
      const cloudFavs = await loadFavoritesFromCloud(firebaseUser.uid);
      const mergedFavs = [...new Set([...favoriteIds, ...cloudFavs])];
      setFavoriteIds(mergedFavs);
      showToast('☁️ Synced!', 'success');
    } catch (e) {
      console.error('Cloud sync failed:', e);
      showToast('Sync failed', 'error');
    }
  };

  const runStoryGeneration = async (cfg: StoryConfig) => {
    // Paywall check
    if (!canGenerateStory()) {
      setScreen('upgrade');
      return;
    }

    setScreen('loading');
    setLastConfig(cfg);
    try {
      const result = await generateStoryWithCarousel(cfg);
      const newStory: Story = {
        id: crypto.randomUUID(),
        title: result.title || 'A Magical Tale',
        content: result.content || '',
        theme: cfg.theme ?? 'magic',
        config: cfg,
        createdAt: new Date().toISOString(),
        rating: 0,
      };
      saveStory(newStory);
      setSavedStories(loadStories());
      setSelectedStory(newStory);
      setScreen('reader');
      recordStoryGeneration();
      recordStoryEvent({
        storyId: newStory.id,
        childProfileId: null,
        theme: cfg.theme ?? 'daily',
        length: cfg.length,
        mode: cfg.mode,
        listenDurationSeconds: 0,
        rating: 0,
        completedListening: false,
      });
    } catch (e) {
      console.error(e);
      const isNetworkError = e instanceof TypeError && e.message.includes('fetch');
      showToast(isNetworkError ? t.errorNetwork : t.errorGenerating, 'error');
      setScreen('mixer');
    }
  };

  const handleRegenerate = () => {
    const cfg = selectedStory?.config ?? lastConfig;
    if (cfg) {
      runStoryGeneration(cfg);
    } else {
      runStoryGeneration(smartDefaults(lang));
    }
  };

  const handleSequel = () => {
    if (!selectedStory?.config) {
      showToast(t.errorGenerating, 'error');
      return;
    }
    const sequelConfig: StoryConfig = {
      ...selectedStory.config,
      customPrompt: `This is a SEQUEL / Part 2. Continue the story titled "${selectedStory.title}". The previous story ended with: "${selectedStory.content.slice(-500)}". Create a new chapter that continues the adventure. Do NOT repeat the previous story — build on it with new events. Keep the same heroes, tone, and theme. End with a new Dream Bridge.`,
    };
    runStoryGeneration(sequelConfig);
  };

  const handleDeleteStory = () => {
    if (!selectedStory) return;
    deleteStoryFromStorage(selectedStory.id);
    setSavedStories(loadStories());
    setFavoriteIds(loadFavoriteIds());
    try {
      const r = localStorage.getItem(LS.ratings);
      setRatings(r ? JSON.parse(r) : {});
    } catch { setRatings({}); }
    setSelectedStory(null);
    setScreen('home');
    showToast(t.deleteStory, 'success');
  };

  const handleExportStory = () => {
    if (!selectedStory) return;
    const text = exportStoryAsText(selectedStory);
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedStory.title.replace(/[^a-zA-Z0-9\u0590-\u05ff\u0600-\u06ff\u3040-\u30ff\u4e00-\u9fff ]/g, '').trim() || 'story'}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(t.storyExported, 'success');
  };

  const completeOnboarding = (langCode: AppLangCode) => {
    persistLangCode(langCode);
    setLang(langCode);
    localStorage.setItem(LS.onboarded, 'true');
    setScreen('home');
  };

  const skipOnboarding = () => {
    completeOnboarding('en');
  };

  return (
    <ErrorBoundary fallback={<div className="flex min-h-screen items-center justify-center bg-deep text-white"><div className="text-center space-y-4"><p className="text-4xl">😔</p><p className="text-lg text-white/60">Something went wrong.</p><button type="button" onClick={() => window.location.reload()} className="mt-4 rounded-xl bg-gold/20 px-6 py-3 text-sm text-gold">Reload</button></div></div>}>
    <div className="min-h-screen bg-deep text-white">
      <Particles />
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <div className="dream-app-shell">
        <AnimatePresence mode="wait">
          {screen === 'onboarding' && (
            <motion.div key="onboarding" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <Onboarding
                lang={lang}
                onLangChange={(c) => setLang(c)}
                onStart={() => completeOnboarding(lang)}
                onSkip={skipOnboarding}
              />
            </motion.div>
          )}

          {screen === 'home' && (
            <motion.div key="home" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <Home
                t={t}
                onSelectStory={(s) => {
                  setSelectedStory(s);
                  setScreen('reader');
                }}
                onStartMixer={() => setScreen('mixer')}
                onViewFavorites={() => setScreen('favorites')}
                onOpenSettings={() => setScreen('settings')}
                onOpenKids={() => setScreen('kids')}
                onOpenDashboard={() => setScreen('parentDashboard')}
                onOpenRoutine={() => setScreen('bedtimeRoutine')}
                onOpenUpgrade={() => setScreen('upgrade')}
                savedStories={savedStories}
                favoriteIds={favoriteIds}
                ratings={ratings}
                remaining={getRemainingFreeStories()}
                premium={isPremium()}
              />
            </motion.div>
          )}

          {screen === 'mixer' && (
            <motion.div key="mixer" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <Mixer onGenerateStory={runStoryGeneration} lang={lang} t={t} />
            </motion.div>
          )}

          {screen === 'loading' && (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="min-h-screen">
              <LoadingScreen lang={lang} />
            </motion.div>
          )}

          {screen === 'favorites' && (
            <motion.div key="favorites" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <FavoritesList
                t={t}
                stories={favoriteStories}
                onSelectStory={(s) => {
                  setSelectedStory(s);
                  setScreen('reader');
                }}
                ratings={ratings}
              />
            </motion.div>
          )}

          {screen === 'library' && (
            <motion.div key="library" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full space-y-6 px-5 pb-28 pt-8">
              <div>
                <h1 className="text-2xl font-bold text-glow">{t.library}</h1>
                <p className="mt-1 text-xs text-white/30">{t.librarySub}</p>
              </div>
              {savedStories.length === 0 ? (
                <p className="text-white/25 text-sm">{t.noLibraryStories}</p>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {[...savedStories]
                    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
                    .map((story) => (
                      <div key={story.id} className="relative group">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedStory(story);
                            setScreen('reader');
                          }}
                          className="w-full min-h-[44px] overflow-hidden rounded-2xl text-left card-glass"
                        >
                          <div className={cn(
                            'aspect-[4/3] flex items-center justify-center text-3xl bg-gradient-to-br',
                            THEME_COLORS[story.theme ?? 'magic'],
                          )}>
                            <span aria-hidden="true">{THEME_ICONS[(story.theme ?? 'magic') as StoryTheme] ?? '✨'}</span>
                          </div>
                          <p className="line-clamp-2 p-3 text-xs font-semibold text-starlight/90">{story.title}</p>
                        </button>
                      </div>
                    ))}
                </div>
              )}
            </motion.div>
          )}

          {screen === 'profile' && (
            <motion.div key="profile" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <ProfileScreen
                t={t}
                languageName={claudeLanguageName(lang)}
                storyCount={savedStories.length}
                onHome={() => setScreen('home')}
              />
            </motion.div>
          )}

          {screen === 'settings' && (
            <motion.div key="settings" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <SettingsScreen
                lang={lang}
                onLangChange={(c) => setLang(c)}
                onBack={() => setScreen('home')}
                t={t}
                firebaseUser={firebaseUser}
                onSignInGoogle={handleSignInGoogle}
                onSignOut={handleSignOut}
                onSyncCloud={handleSyncCloud}
              />
            </motion.div>
          )}

          {screen === 'kids' && (
            <motion.div key="kids" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <MyKidsScreen
                t={t}
                profiles={childProfiles}
                onAdd={handleAddKid}
                onRemove={handleRemoveKid}
                onBack={() => setScreen('home')}
              />
            </motion.div>
          )}

          {screen === 'parentDashboard' && (
            <motion.div key="parentDashboard" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <ParentDashboardScreen t={t} onBack={() => setScreen('home')} />
            </motion.div>
          )}

          {screen === 'upgrade' && (
            <motion.div key="upgrade" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <UpgradeScreen t={t} onPurchase={handlePurchase} onRestore={handleRestore} onBack={() => setScreen('home')} remaining={getRemainingFreeStories()} />
            </motion.div>
          )}

          {screen === 'bedtimeRoutine' && (
            <motion.div key="bedtimeRoutine" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <BedtimeRoutineScreen
                t={t}
                resumeAtStep={routineMode ? 2 : undefined}
                onStartStory={() => {
                  setRoutineMode(true);
                  const cfg = smartDefaults(lang);
                  runStoryGeneration(cfg);
                }}
                onBack={() => { setRoutineMode(false); setScreen('home'); }}
              />
            </motion.div>
          )}

          {screen === 'reader' && selectedStory && (
            <motion.div key="reader" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <StoryReader
                story={selectedStory}
                onBack={() => { if (routineMode) { setScreen('bedtimeRoutine'); } else { setScreen('home'); } }}
                isFavorite={favoriteIds.includes(selectedStory.id)}
                onToggleFavorite={(s) => toggleFavorite(s)}
                rating={ratings[selectedStory.id] || 0}
                onRate={(r) => handleRate(selectedStory.id, r)}
                contentDir={readerDir}
                t={t}
                onRegenerate={handleRegenerate}
                onSequel={handleSequel}
                onDelete={handleDeleteStory}
                onExport={handleExportStory}
                showToast={showToast}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {screen !== 'reader' &&
          screen !== 'onboarding' &&
          screen !== 'loading' &&
          screen !== 'settings' &&
          screen !== 'kids' &&
          screen !== 'parentDashboard' &&
          screen !== 'upgrade' &&
          screen !== 'bedtimeRoutine' && (
            <Navbar activeScreen={screen} setScreen={setScreen} />
          )}
      </div>
    </div>
    </ErrorBoundary>
  );
}
