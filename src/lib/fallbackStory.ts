/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { AppLangCode } from './lang';

export function fallbackStoryPayload(lang: AppLangCode): {
  title: string;
  content: string;
} {
  const blocks: Record<AppLangCode, { title: string; content: string }> = {
    en: {
      title: 'A Gentle Tale',
      content: `Once upon a time, a soft light gathered at the edge of sleep, waiting just for you.

## Dream Bridge

Everything slows. Your shoulders soften. The stars lean a little closer. Let your eyes grow heavy when they are ready — breathe in calm, drift toward peaceful rest. The night is quiet and safe. And now your eyes are getting heavy too... let the stars carry you into your own dream until morning.`,
    },
    he: {
      title: 'סיפור עדין',
      content: `פעם, בקצה השינה, נדלק אור רך שמחכה רק לך.

## Dream Bridge

הכול מאט. הכתפיים נרכות. הכוכבים מתקרבים. תנו לעיניים להכבד כשאתם מוכנים — שימו לב לנשימה, לשקט, למנוחה. הלילה רך ובטוח. ועכשיו גם העיניים שלכם נהיות כבדות... תנו לכוכבים לשאת אתכם אל חלום משלכם עד הבוקר.`,
    },
    es: {
      title: 'Un cuento suave',
      content: `Había una vez una luz suave al borde del sueño, esperándote.

## Dream Bridge

Todo se aquieta. Tus hombros se aflojan. Las estrellas se acercan un poco. Deja que tus ojos se vuelvan pesados cuando quieran — respira calma, deja que el descanso llegue. La noche es quieta y segura. Y ahora tus ojos también se vuelven pesados... deja que las estrellas te lleven a tu propio sueño hasta la mañana.`,
    },
    fr: {
      title: 'Un conte doux',
      content: `Il était une fois une douce lumière au bord du sommeil, qui t'attendait.

## Dream Bridge

Tout ralentit. Tes épaules se détendent. Les étoiles se rapprochent un peu. Laisse tes paupières s'alourdir quand tu es prêt — respire le calme, laisse venir le repos. La nuit est douce et sûre. Et maintenant tes yeux deviennent lourds aussi... laisse les étoiles t'emporter vers ton propre rêve jusqu'au matin.`,
    },
    ar: {
      title: 'حكاية لطيفة',
      content: `كان يا ما كان، نورٌ لطيفٌ عند حافة النوم ينتظرك.

## Dream Bridge

كل شيء يهدأ. تستريح أكتافك. تقترب النجوم قليلاً. دع عينيك تثقلان عندما تكون جاهزًا — تنفّس الهدوء، دع الراحة تأتي. الليل هادئ وآمن. والآن عيناك تثقلان أيضًا... دع النجوم تحملك إلى حلمك حتى الصباح.`,
    },
    ja: {
      title: 'やさしいおはなし',
      content: `むかしむかし、眠りのほとりに、あなただけを待つやさしい光がともりました。

## Dream Bridge

すべてがゆっくりになります。肩の力がぬけていきます。お星さまがそっと近づいてきます。まぶたが重くなったら、そっと目を閉じて — 静かに息をして、やすらぎに身をまかせましょう。夜は静かで安全です。さあ、あなたの目ももう重くなってきました… お星さまに乗って、朝までじぶんだけの夢の世界へ旅立ちましょう。`,
    },
  };
  return blocks[lang];
}
