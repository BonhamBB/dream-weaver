/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { StoryConfig, StoryTheme } from '../types';
import type { AppLangCode } from './lang';
import { claudeLanguageName } from './lang';

/* ─── Utility ─────────────────────────────────────────────────────── */

function pickRandom<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

/* ─── Story Seeds (40 per theme = 280 total) ──────────────────────── */

export const THEME_SEEDS: Record<StoryTheme, readonly string[]> = {
  magic: [
    'A child discovers a door in the back of their closet that opens to a different world each night',
    'A wizard school where the final exam is to undo your best spell',
    'A kingdom where shadows are alive and choose their own humans',
    'A magic paintbrush that brings drawings to life — but only at midnight',
    'A flying carpet that only works when the rider tells it a true story',
    'A forest where every tree holds a frozen wish waiting to be released',
    'A child who can talk to the wind, but the wind speaks in riddles',
    'A library where the books argue with each other about who has the best ending',
    'A dragon who is terrified of fire and must find another way to be brave',
    'A pair of magical glasses that let you see what people are really feeling',
    'A village where music has real power — the right melody can grow flowers or move mountains',
    'A pocket watch that lets you relive any moment, but you can never change it',
    'An invisible friend who starts becoming visible at the worst possible times',
    'A child who wakes up one morning with the power to shrink to the size of an ant',
    'A cloud kingdom accessible only by climbing a rainbow that appears after crying',
    'A magical recipe book where each dish grants a temporary superpower',
    'A child befriends a star that fell from the sky and must help it return home',
    'A school for mythical creatures where a human accidentally enrolls',
    'A wishing well that grants wishes but always with an unexpected twist',
    'A key that opens any lock, but each use makes the holder forget one memory',
    'A child discovers they can enter paintings and live inside the scenes',
    'A magical garden where plants grow based on the gardener\'s emotions',
    'A pair of shoes that take you wherever you truly need to go (not where you want)',
    'A child finds a compass that points toward your heart\'s deepest desire',
    'A castle that rearranges its rooms every night — and someone is trapped inside',
    'A magical quill that writes stories that become real the next morning',
    'A snow globe that contains an entire living miniature world',
    'A child who collects lost dreams from under pillows and must return them',
    'An enchanted mirror that shows not your reflection, but your future self',
    'A secret language that only children can speak — adults forget it when they grow up',
    'A toy shop where the toys come alive when the last customer leaves',
    'A child discovers that clouds are actually sleeping giants',
    'A magical seed that grows into a tree with doors to every season',
    'A hat that makes you speak the language of whoever you\'re looking at',
    'A lighthouse whose beam can illuminate hidden magical creatures',
    'A child who accidentally swaps bodies with their pet for a day',
    'A staircase that appears in the backyard and leads to a floating island',
    'A blanket woven from moonlight that protects from nightmares',
    'A child discovers their shadow has its own personality and opinions',
    'A music box that plays a different melody for each person — the melody tells their story',
  ],

  nature: [
    'A fox who runs a secret postal service between the forest animals',
    'A bear cub who refuses to hibernate because it doesn\'t want to miss winter',
    'An old oak tree that tells the story of everything it has witnessed over 300 years',
    'A migration journey told from the perspective of the youngest bird in the flock',
    'A garden where the flowers compete in a talent show judged by the bees',
    'A river that remembers every creature that ever drank from it',
    'A family of hedgehogs who adopt a lost kitten',
    'A whale who sings a song so beautiful that the whole ocean stops to listen',
    'A squirrel who plants the wrong seeds and accidentally grows a magical forest',
    'An owl who teaches a night school for animals afraid of the dark',
    'A caterpillar who is terrified of becoming a butterfly',
    'A wolf who wants to be a vegetarian and must convince the pack',
    'A dolphin who discovers a sunken city and befriends its ghostly fish inhabitants',
    'A tiny ant who dreams of seeing the whole world from the top of a mountain',
    'The four seasons meet at a round table to decide who gets an extra week this year',
    'A spider whose web catches dreams instead of flies',
    'A deer and a rabbit who start a friendship despite their herds\' old rivalry',
    'A honeybee who gets lost and discovers a garden no one has visited in decades',
    'A snow leopard who protects a mountain secret known to no human',
    'A tortoise who carries a tiny world on its shell and doesn\'t know it',
    'A mother bird who must teach the runt of her nest to fly before winter arrives',
    'A mushroom network that carries messages between trees like an underground internet',
    'A firefly who lost its glow and must find a new way to light up the night',
    'A hermit crab searching for the perfect shell — a journey across the entire tide pool',
    'A salmon\'s first journey upstream, guided by an ancient instinct it doesn\'t understand',
    'A hummingbird so fast it accidentally travels through time to see the garden\'s past',
    'A colony of penguins who discover a warm island and must decide whether to stay',
    'An earthworm who hears the rain singing and follows the song to the surface',
    'A chameleon who is tired of changing colors and wants to just be one thing',
    'A pack of wolves who adopt a human baby and raise it alongside their cubs',
    'A coral reef that is slowly dying and the fish hold a council to save their home',
    'A bat who befriends a bird and they discover they have more in common than they thought',
    'A glacier that tells its story — slowly, over thousands of years, in one magical night',
    'A family of otters who build the most elaborate dam the river has ever seen',
    'A butterfly that remembers its life as a caterpillar — and misses it',
    'A seed that refuses to grow until it hears the right lullaby',
    'A frog prince — but told from the frog\'s perspective, and he doesn\'t want to be human',
    'A tree that sheds its leaves as letters, and each leaf tells a secret',
    'A starfish that lost an arm and must journey to find a new way to feel whole',
    'An elephant who remembers something from before it was born',
  ],

  wisdom: [
    'A Buddhist tale: a monk gives a child an empty bowl and says "fill it with something you cannot touch"',
    'The Greek myth of Icarus retold — but this time, the child chooses a different path',
    'A Sufi story: a merchant who sells patience, but runs out of his own',
    'A Talmudic puzzle: two children find one treasure, but only one can keep it — what does justice look like?',
    'The Norse myth of the world tree Yggdrasil, told through the eyes of a squirrel living in its branches',
    'An African griot tells a story within a story within a story, and the child must find the real lesson',
    'A Japanese tale of a kintsugi master who repairs broken hearts the way they repair broken pottery — with gold',
    'The Hindu tale of young Krishna stealing butter, but told as a lesson about desire and generosity',
    'A Native American story about Coyote who tricked the stars into forming constellations',
    'A Chinese legend of the jade rabbit on the moon who makes medicine for the sick',
    'A Maori creation myth where the sky and earth are separated by their own children',
    'The story of young Siddhartha seeing suffering for the first time and deciding to understand it',
    'A Celtic fairy tale about a selkie who must choose between the sea and a human child who needs them',
    'An Egyptian myth about Ma\'at\'s feather — what does it really mean for a heart to be lighter than a feather?',
    'A Persian story of Rumi as a child, discovering that the universe speaks through spinning',
    'A Zen koan turned into a story: "What was your face before your parents were born?"',
    'The Aboriginal dreamtime story of how the platypus came to be — a creature that belongs everywhere and nowhere',
    'A West African Anansi story where the spider must outsmart wisdom itself',
    'A Tibetan tale of the snow lion who guards the highest truth on the highest mountain',
    'The Mayan Popol Vuh hero twins who must outwit the lords of the underworld using only cleverness',
    'A Babylonian myth of Gilgamesh as a boy, learning that even kings cannot escape being human',
    'A Jewish folktale about the golem — what happens when you create something that has no soul?',
    'An Inuit tale of Sedna, who became the sea goddess and controls all the animals of the ocean',
    'A Korean legend of the sun and moon siblings who must outsmart a hungry tiger',
    'A Polynesian story of Maui pulling islands from the sea with a magical fishhook',
    'The Taoist tale of the empty boat — anger disappears when there is no one to blame',
    'An ancient Sumerian story about the first person who ever asked "why?"',
    'A Vietnamese legend of the dragon and fairy who gave birth to a hundred children',
    'The Russian tale of Baba Yaga — but told from her perspective, and she is not what she seems',
    'A Jain parable about the blind men and the elephant — but none of them are wrong',
    'An Aztec legend of Quetzalcoatl bringing knowledge to humans at great personal cost',
    'A Sikh story about Guru Nanak and the boulder — why feeding the hungry is prayer',
    'The Filipino tale of why the sky is so high — because humans took too much for granted',
    'A Cherokee story about two wolves inside every person — the one you feed is the one that wins',
    'An Ethiopian legend of the Queen of Sheba visiting Solomon — a meeting of two kinds of wisdom',
    'A Confucian tale about a child who teaches the master something the master forgot',
    'The Bhagavad Gita for children — Arjuna\'s doubt before the battle and Krishna\'s answer',
    'A Zoroastrian myth about the eternal battle between light and darkness inside every person',
    'A Lakota story about White Buffalo Calf Woman bringing the sacred pipe of peace',
    'An Irish myth of the salmon of knowledge — one taste of wisdom changes everything forever',
  ],

  emotions: [
    'A child whose best friend suddenly has a new best friend',
    'Moving to a new city where nobody knows your name',
    'A child who is always the last one picked for teams',
    'Jealousy when a new baby sibling gets all the attention',
    'Stage fright before the school play — and learning that shaking is not the same as failing',
    'A child who pretends to be happy at school but cries at home',
    'Two siblings who fight all the time until they realize they\'re scared of the same thing',
    'A child who builds an invisible wall around themselves and then can\'t get out',
    'The guilt of breaking something precious that belonged to someone you love',
    'A kid who lies about something small and watches the lie grow bigger every day',
    'Learning to say sorry when every part of you believes you were right',
    'A child who befriends an elderly neighbor and must face the concept of goodbye',
    'Being different — the only one in class who looks/speaks/believes differently',
    'A friendship between a very loud child and a very quiet child',
    'A child who is afraid of dogs and must walk past one every day to get to school',
    'The loneliness of being really good at something nobody else cares about',
    'A child who writes letters to a future version of themselves',
    'The day you realize your parents are not perfect — and that\'s okay',
    'A child who takes care of everyone else but forgets to take care of themselves',
    'Finding courage not in being fearless, but in doing the thing despite the fear',
    'A child who stutters and must give a speech in front of the whole school',
    'The anger that comes after losing someone and not knowing where to put it',
    'A child who was popular last year but this year nobody sits with them at lunch',
    'The weight of a secret that isn\'t yours to tell',
    'A child who is always compared to their older sibling',
    'The feeling of being left behind when everyone else seems to be growing up faster',
    'A child who expresses love through drawing because words feel too hard',
    'The first time you disappoint someone who believed in you',
    'A child who discovers that being kind and being liked are not always the same thing',
    'The strange grief of outgrowing your favorite toy',
    'A child who is afraid of the dark but won\'t admit it because they think they\'re too old',
    'Missing someone who moved away — and wondering if they miss you too',
    'A child who thinks they\'re not smart because they learn differently from everyone else',
    'The feeling when your parents argue and you think it\'s your fault',
    'A child who is brave online but shy in person',
    'Learning that sometimes helping means stepping back and letting someone try alone',
    'A child whose family doesn\'t have much money and feels ashamed at school',
    'The joy and terror of your first real crush',
    'A child who carries anxiety like a heavy backpack they can\'t take off',
    'The moment a child realizes they can forgive someone — and feels lighter',
  ],

  moral: [
    'You find a wallet full of money. The owner is rich. You are not. What do you do?',
    'Your best friend cheated on a test. The teacher asks if you saw anything.',
    'A kingdom where telling any lie makes flowers die — but truth sometimes hurts people',
    'Two villages share a river. One takes too much water. Both have children who are thirsty.',
    'A child finds a magical bird. Keeping it makes them happy. Releasing it saves the forest.',
    'A robot is programmed to always tell the truth. Is that the same as being honest?',
    'A group of children must decide: save the old tree or build a playground everyone wants',
    'A child can become invisible. First they use it for fun. Then they see something they shouldn\'t.',
    'You accidentally break your sibling\'s favorite toy. They blame the dog. Do you confess?',
    'A town votes to banish the one person who is different. One child must decide whether to speak up.',
    'A magic mirror shows you who you\'ll become — but only if you give up who you are now',
    'Two children each deserve the prize. There is only one. The judge is their friend.',
    'A child discovers their hero did something wrong long ago. Does the good erase the bad?',
    'You can save your pet or save a stranger\'s pet. There\'s no time for both.',
    'A child who always follows the rules meets a child who always breaks them. Who learns more?',
    'A story where the "bad guy" tells their side — and it makes sense',
    'Sharing a secret that could help everyone but would hurt one person',
    'A community must choose: keep their tradition or adapt to help newcomers',
    'The cost of revenge — a child who gets even and then must live with the result',
    'A child must decide between being popular and being kind — when they can\'t be both',
    'A child finds a time machine and could prevent a bad thing — but it would also erase a good thing',
    'Stealing medicine for a sick parent — is it wrong if it\'s for love?',
    'A school election where the nice candidate has bad ideas and the mean one has good ideas',
    'A child witnesses bullying and must choose: intervene and risk being next, or stay safe and silent',
    'A magical scale that measures fairness — but what\'s fair isn\'t always what\'s equal',
    'A child who promises to keep a friend\'s secret — but the secret is dangerous',
    'Two tribes at war. A child from each side becomes friends. What do they owe their people?',
    'A child who can read minds discovers their teacher is struggling — do they tell?',
    'A golden rule that works perfectly until it doesn\'t — when do rules need to be broken?',
    'A child is offered a power that helps others but costs their own happiness',
    'Forgiving someone who isn\'t sorry — is it for them or for you?',
    'A village where everyone is equal but nobody is free vs. a village where everyone is free but not equal',
    'A child must choose between telling the truth that destroys a friendship or a lie that preserves it',
    'An animal must choose between its pack and a member who broke the rules to save an outsider',
    'A child who takes credit for something they didn\'t do — and it helps everyone',
    'Is it wrong to give up on someone? The story of a child who kept trying and one who let go.',
    'A child finds a genie but the wishes always help one person by taking from another',
    'The difference between justice and mercy, told through two siblings judging their pet',
    'A machine that eliminates all suffering also eliminates growth — should it be turned on?',
    'A child who must decide: loyalty to family or loyalty to the truth',
  ],

  modern: [
    'A child whose parent works so much they only talk through voice messages',
    'The class group chat turns mean — and one child must decide whether to screenshot or speak up',
    'A kid who goes viral for something embarrassing and must face school the next day',
    'A child who is addicted to their tablet and one day it breaks — discovering the world outside',
    'Moving between two homes after parents\' divorce — a different bedroom every week',
    'A child who discovers their online friend is not who they claimed to be',
    'The pressure of being gifted — when adults expect you to be perfect at everything',
    'A school bully who turns out to be going through something terrible at home',
    'A child who loves coding and builds a game but nobody wants to play it',
    'Being the translator for your immigrant parents — when a child carries adult weight',
    'A snow day that forces a family to actually spend time together without screens',
    'A child who starts a petition at school and learns how hard it is to change things',
    'The anxiety of waiting for test results that will determine which school you attend',
    'A kid who lies about having a cool vacation because they stayed home',
    'A child who befriends an AI assistant and wonders if it has feelings',
    'The first day at a new school where everyone already has their friend groups',
    'A child who saves up for something expensive, buys it, and realizes it doesn\'t make them happy',
    'Being the "responsible one" in the family — when your parents rely on you too much',
    'A child whose grandparent doesn\'t understand technology and the child must teach them patiently',
    'Climate anxiety — a child who worries about the planet and feels too small to help',
    'A child whose parents are always on their phones and don\'t notice what\'s happening',
    'Online vs real life — a child who is a hero in a game but invisible at school',
    'A child who is homeschooled and desperately wants to fit in with neighborhood kids',
    'The pressure of social media — comparing your real life to everyone\'s highlight reel',
    'A child who must take care of a younger sibling while parents work double shifts',
    'A food allergy that makes every birthday party feel like an obstacle course',
    'A child whose family moves countries and must navigate being between two cultures',
    'The kid who always eats lunch alone and the day someone finally sits down',
    'A child whose best friend moves to another country — maintaining friendship across distance',
    'Growing up in a small apartment and dreaming of space',
    'A child who starts a YouTube channel and learns about the gap between views and real connection',
    'The day the internet goes down for a whole week and a neighborhood transforms',
    'A child who wears hand-me-downs and learns to turn embarrassment into creativity',
    'A family that loses their home and must start over — seen through the child\'s eyes',
    'A child with ADHD who discovers their "weakness" is actually a different kind of strength',
    'The kid who gets picked on for loving something "uncool" — and owns it anyway',
    'A child stuck between divorced parents who each talk badly about the other',
    'A snow day that becomes the day a lonely kid and a new neighbor finally connect',
    'A child who pretends to have a perfect family online while reality is much messier',
    'A sibling rivalry that escalates until both realize they\'re fighting over their parents\' love',
  ],

  daily: [
    'Monday — a story about starting fresh: a child who gets a second chance at something they failed',
    'Monday — new beginnings: moving to a new place and finding unexpected beauty there',
    'Monday — first steps: a character who tries something for the very first time',
    'Monday — reset: a magical alarm clock that gives you a brand new start',
    'Tuesday — courage: a child who must stand up for someone even though they\'re scared',
    'Tuesday — strength: the smallest creature in the forest saves everyone through determination',
    'Tuesday — bravery: facing the thing under the bed, which turns out to need help',
    'Tuesday — power: a story about the strength that comes from vulnerability',
    'Wednesday — wisdom: an old librarian shares the secret of the one book nobody has ever opened',
    'Wednesday — learning: a child discovers that mistakes are the best teachers',
    'Wednesday — knowledge: a riddle that can only be solved by admitting what you don\'t know',
    'Wednesday — curiosity: following a question all the way to its surprising answer',
    'Thursday — gratitude: a child writes thank-you letters to things they never noticed before',
    'Thursday — friendship: two unlikely friends discover they complete each other',
    'Thursday — giving: a child who has nothing gives the most valuable gift of all',
    'Thursday — connection: strangers on a train who change each other\'s lives in one ride',
    'Friday — rest: a busy family finally slows down and rediscovers each other',
    'Friday — preparation: the night before a big adventure — the anticipation is part of the magic',
    'Friday — letting go: a story about putting down the heavy things you carried all week',
    'Friday — celebration: the quiet joy of simply making it through',
    'Saturday — adventure: a treasure map found in an attic leads to something better than treasure',
    'Saturday — exploration: a child follows a mysterious sound through their neighborhood',
    'Saturday — freedom: a day with absolutely no plans leads to the best day ever',
    'Saturday — play: a game that becomes real, but the rules are kindness',
    'Sunday — reflection: a child sits by a lake and the water shows them their week\'s journey',
    'Sunday — dreams: a child plants a seed and imagines everything it could become',
    'Sunday — peace: the quiet hour before everyone wakes up — the house is magic',
    'Sunday — hope: a letter arrives from next week, and it says "everything will be okay"',
    'A story inspired by spring — the world waking up, new growth, hope after cold',
    'A story inspired by summer — long days, adventures, the feeling of infinite time',
    'A story inspired by autumn — letting go, change, the beauty of endings',
    'A story inspired by winter — stillness, reflection, warmth found in cold places',
    'A rainy-day story — the world sounds different when it\'s wet and grey and cozy',
    'A windy-day story — things blow into your life that change everything',
    'A story for a full moon night — when the world is silver and anything can happen',
    'A story for the shortest day of the year — finding light in the deepest dark',
    'A story for the longest day — so much daylight that even dreams come out to play',
    'A nighttime story about what happens in the world while children sleep',
    'A story that starts exactly at this time of day and follows one hour in slow motion',
    'A story about the space between yesterday and tomorrow — the gift of right now',
  ],
};

/* ─── Story Modifiers (combinatorial variety) ─────────────────────── */

const SETTINGS = [
  'in a city that floats above the clouds',
  'inside an ancient underground cave system',
  'on a small island in the middle of a vast ocean',
  'in a village hidden behind a waterfall',
  'at the edge of a desert where sand turns to glass',
  'in a tree-house city connected by rope bridges',
  'aboard a train that never stops',
  'in a market where you trade memories instead of money',
  'at the top of the tallest mountain in the world',
  'inside a snow globe that someone shook',
  'in a town where it rains upward',
  'on the back of a giant sleeping creature',
  'in a library that extends infinitely underground',
  'at a crossroads where three paths meet',
  'inside a painting hung in a forgotten museum',
  'in a garden at the edge of the world',
  'on a river that flows through time instead of space',
  'in a house where each room is a different season',
  'at a lighthouse on the shore of a starless sea',
  'in a forest where the trees whisper secrets to those who listen',
] as const;

const CHARACTER_TRAITS = [
  'who is stubbornly optimistic even when things look impossible',
  'who is afraid of making mistakes and must learn to try anyway',
  'who sees the world in colors nobody else can see',
  'who lost something precious and is afraid to love anything again',
  'who carries a secret that feels too big for their small body',
  'who talks too much because silence makes them nervous',
  'who never cries, even when they should',
  'who collects broken things because they believe everything deserves a second chance',
  'who is always the peacemaker but is tired of never getting to be angry',
  'who pretends not to care because caring hurts too much',
  'who asks questions nobody else thinks to ask',
  'who is brave for everyone else but terrified when alone',
  'who draws maps of places they\'ve never been',
  'who remembers every promise ever made to them',
  'who laughs at exactly the wrong moments',
] as const;

const TWISTS = [
  'But everything changes when the hero discovers they were wrong about the villain.',
  'But the real challenge turns out to be something the hero didn\'t expect at all.',
  'But the solution requires giving up the one thing the hero thought they needed most.',
  'But the hero learns that the problem was never what they thought it was.',
  'But someone unexpected shows up and changes everything.',
  'But the hero discovers they already had what they were searching for.',
  'But the rules of this world are the opposite of what the hero assumed.',
  'But helping others turns out to be the only way to help yourself.',
  'But the biggest obstacle is something inside the hero, not outside.',
  'But the "enemy" needs the hero\'s help more than anyone.',
  'But time is running out and the hero must choose between two impossible options.',
  'But the journey matters more than the destination.',
  'But what seemed like a curse turns out to be a gift.',
  'But the hero must trust someone they have every reason not to trust.',
  'But the answer was hidden in a story the hero heard long ago and forgot.',
] as const;

const EMOTIONAL_ARCS = [
  'A story about learning that being brave doesn\'t mean not being scared.',
  'A story about discovering that the thing you feared most can\'t actually hurt you.',
  'A story about realizing you are not alone, even when you feel invisible.',
  'A story about the strength that comes from asking for help.',
  'A story about finding beauty in something you thought was ugly or broken.',
  'A story about letting go of something you love so it can be free.',
  'A story about discovering who you really are, not who others expect you to be.',
  'A story about patience — the slowest path being the one that gets you there.',
  'A story about forgiving yourself for something you thought was unforgivable.',
  'A story about finding home in a person, not a place.',
] as const;

/** Build a unique story directive by combining random elements */
function buildStorySeed(theme: StoryTheme): string {
  const seed = pickRandom(THEME_SEEDS[theme]);
  const setting = pickRandom(SETTINGS);
  const trait = pickRandom(CHARACTER_TRAITS);
  const twist = pickRandom(TWISTS);
  const arc = pickRandom(EMOTIONAL_ARCS);

  return `STORY SEED (use as inspiration — adapt, expand, surprise):
"${seed}"

SETTING HINT: ${setting}
HERO TRAIT: A protagonist ${trait}
PLOT TWIST: ${twist}
EMOTIONAL ARC: ${arc}

IMPORTANT: These elements are seeds, not scripts. Combine what works, discard what doesn't.
Reshape everything to serve the story. The result should feel fresh, surprising, and whole —
not like a checklist. Trust your instincts as a storyteller.`;
}

/* ─── Theme Base Instructions ─────────────────────────────────────── */

const THEME_BASE: Record<StoryTheme, string> = {
  magic: `THEME — MAGIC & IMAGINATION:
Build a fantasy world with its own magic system. Include wonder, enchantment,
and impossible things that feel real. Magical creatures, hidden realms,
spells that cost something. The magic should serve the story's emotional core.`,

  nature: `THEME — NATURE & ANIMALS:
Talking animals with distinct personalities. Nature spirits, seasonal wisdom,
the rhythm of forests and oceans. Show respect for the natural world.
Animals teach something humans forgot. Sensory details: rustling leaves,
warm fur, cold streams, birdsong at dawn.`,

  wisdom: `THEME — WISDOM & REAL STORIES:
Based on real mythology, philosophy, or historical wisdom traditions.
Can draw from Buddhist parables, Greek myths, Sufi tales, Talmudic stories,
Indigenous wisdom, or real biographical moments. Educational but never preachy.
The lesson emerges from the story, never stated directly.`,

  emotions: `THEME — FRIENDSHIP & FEELINGS:
An emotional journey through relatable social situations. Fears, jealousy,
self-confidence, friendship, loneliness, belonging. The hero navigates
real feelings that children actually experience. Show emotions physically —
never label them. Resolution comes through connection and understanding.`,

  moral: `THEME — MORAL CHOICES:
A moral dilemma sits at the core of the story. There are no easy answers.
Both choices have real consequences. The hero must weigh competing values:
loyalty vs truth, safety vs justice, self vs community.
Like Aesop's fables but with real depth. End with reflection, not a neat lesson.`,

  modern: `THEME — TODAY'S WORLD:
Modern setting: school, tablets, social media, family dynamics, moving to a new city,
a parent who works too much, a friend who changed. Real-life challenges children face today.
Technology can be part of the story but is never the villain or savior.
Grounded, authentic, contemporary.`,

  daily: `THEME — DAILY STORY:
You choose the theme based on today's date and day of week.
Make it feel like today's story was meant for today.`,
};

/** Build the full theme instruction with a randomly-picked seed + modifiers */
function buildThemeInstruction(theme: StoryTheme): string {
  return `${THEME_BASE[theme]}

${buildStorySeed(theme)}`;
}

/* ─── Core Prompt Logic ───────────────────────────────────────────── */

/** Youngest child age, or 7 if none */
export function youngestAgeOrDefault(config: StoryConfig): number {
  const ages = config.children.map((c) => c.age).filter((a) => Number.isFinite(a) && a > 0);
  if (ages.length === 0) return 7;
  return Math.min(...ages);
}

function rule2Heroes(config: StoryConfig): string {
  const named = config.children.filter((c) => c.makeHero === true && c.name.trim());

  if (config.children.length === 0) {
    return `RULE 2 — HEROES:
No children OR makeHero=false for all:
Invent an original child hero. Give them a name, age, and a clear personality flaw
they must overcome by the end.`;
  }

  if (named.length > 0) {
    const list = named.map((c) => `${c.name.trim()} (age ${c.age})`).join(', ');
    return `RULE 2 — HEROES:
Children with makeHero=true:
The heroes are: ${list}.
Use their REAL names. Each has a DISTINCT role that is essential to solving the problem.
The story cannot be resolved by one hero alone.
Older child: leads decisions. Younger child: notices what others miss.`;
  }

  const ages = config.children.map((c) => c.age).filter((a) => a > 0);
  return `RULE 2 — HEROES:
Children with makeHero=false:
Invent heroes whose ages match: ${ages.join(', ')}. Do not use the children's real names.`;
}

function ruleAgeDepth(config: StoryConfig): string {
  const youngest = youngestAgeOrDefault(config);
  if (youngest <= 5) {
    return `RULE 4 — AGE DEPTH (youngest listener ≈ ${youngest}):
Age 2-5: Heroes and victory ONLY. Zero violence. Zero death. Zero darkness.
World as wonder and discovery. Simple sentences. Repetition is good.`;
  }
  if (youngest <= 9) {
    return `RULE 4 — AGE DEPTH (youngest listener ≈ ${youngest}):
Age 6-9: Real conflict can exist. Show consequences. Always resolve with hope.
No graphic detail. Complexity is welcome but darkness must lift.`;
  }
  return `RULE 4 — AGE DEPTH (youngest listener ≈ ${youngest}):
Age 10-12: Full truth is appropriate. War, loss, injustice — all can appear.
Always anchor in human resilience and meaning. Respect their intelligence.`;
}

function ruleInteractive(mode: StoryConfig['mode']): string {
  if (mode !== 'interactive') return '';
  return `
RULE — INTERACTIVE MODE (CRITICAL):
This is an interactive story with choices. Structure it as follows:
1. Write the opening section (setup and hook)
2. At a dramatic moment, present EXACTLY 2 choices formatted as:

---CHOICE---
**A:** [First option description]
**B:** [Second option description]
---END_CHOICE---

3. Then write BOTH paths:

---PATH_A---
[Story continuation if reader chose A]
---END_PATH_A---

---PATH_B---
[Story continuation if reader chose B]
---END_PATH_B---

4. Both paths MUST converge back to a shared ending with the Dream Bridge.
5. Include 2 choice points total in the story.
6. Each choice must feel meaningful — not just "go left or right" but real emotional/moral decisions.`;
}

/**
 * Random defaults for "Tell me a story now" — generates immediately.
 */
export function smartDefaults(langCode: AppLangCode): StoryConfig {
  const themes: StoryTheme[] = ['magic', 'nature', 'wisdom', 'emotions', 'moral', 'modern', 'daily'];
  const theme = themes[Math.floor(Math.random() * themes.length)]!;
  return {
    children: [],
    theme,
    mode: 'normal',
    length: 'bedtime',
    storyLanguage: langCode,
    ageFocus: null,
  };
}

function lengthWords(len: StoryConfig['length']): string {
  switch (len) {
    case 'kiss':
      return '~500 words. Short and sweet — a goodnight kiss in story form.';
    case 'bedtime':
      return '~1,500 words. A full bedtime story with proper arc and development.';
    case 'adventure':
      return '~2,500 words. A complete adventure told in chapters. Use ## Chapter headers to divide the story into 3-4 natural sections.';
    default:
      return '~1,500 words.';
  }
}

/**
 * Builds the full Claude user prompt. Model must return ONLY JSON per RULE 7.
 */
export function buildClaudePrompt(config: StoryConfig): string {
  const code = (config.storyLanguage || 'en') as AppLangCode;
  const langName = claudeLanguageName(code);

  const rule1 = `RULE 1 — LANGUAGE (FIRST RULE — MOST IMPORTANT):
Write EVERYTHING in ${langName}. The title, every sentence, the Dream Bridge —
all in ${langName}. If ${langName} is Hebrew or Arabic, write right-to-left naturally.
Do not mix languages. Do not explain in English.`;

  const rule3 = `RULE 3 — EMOTION (SHOW DON'T TELL):
FORBIDDEN: 'he felt afraid', 'she was angry', 'he felt lonely'.
REQUIRED: show it physically — trembling hands, a voice that drops to a whisper,
eyes that avoid the path ahead. Never label emotions. Show through body, breath, and action.`;

  const themeRule = config.theme
    ? buildThemeInstruction(config.theme)
    : `THEME: AI chooses freely — pick whatever theme fits best for a magical bedtime story.`;

  const dreamBridge = `RULE 5 — DREAM BRIDGE (MANDATORY — STORY FAILS WITHOUT IT):
The final section of the story is called ## Dream Bridge.
It is 4-6 sentences. It MUST:
1. Slow the pace dramatically — shorter sentences, softer words
2. Show the heroes settling down, eyes growing heavy
3. Reference the sky, stars, or night
4. Final sentence speaks DIRECTLY to the child:
   'And now your eyes are getting heavy too...'
   'The story will be here when you wake...'
   'Let the stars carry you into your own dream...'
The Dream Bridge must FLOW NATURALLY from the story — it's the story exhaling,
not an abrupt gear-shift. The last scene before Dream Bridge should already be
winding down (slower action, softer dialogue, arriving home or settling in).
This section is non-negotiable. Every story ends with it.`;

  const ruleWorldCoherence = `RULE 8 — WORLD COHERENCE (CRITICAL):
Every element you introduce MUST be explained and used:
- If there is a cave → explain WHY it exists, WHO lives there, and USE it in the plot.
- If a character is mentioned (grandmother, king, friend) → they MUST have a role. No decorative mentions.
- If a setting is described → it must MATTER to the plot. A forest must affect the journey. A mountain must be climbed.
- If a rule of the world is stated (e.g., "the dragon eats worlds") → it must be TRUE, or the consequences of it being FALSE must be explored.
FORBIDDEN: Introducing any character, place, or rule that doesn't pay off by the end.`;

  const ruleSolutionDepth = `RULE 9 — SOLUTION DEPTH (CRITICAL):
The hero's problem CANNOT be solved instantly or easily.
- The hero must TRY something that FAILS first (at least one failed attempt).
- The hero must SACRIFICE something, CHANGE something about themselves, or EARN the solution through effort.
- Understanding/empathy must be BUILT UP — never instant. Show the process:
  confusion → curiosity → small clue → deeper understanding → breakthrough.
- FORBIDDEN: "suddenly understood", "instantly realized", "magically knew", "everything made sense".
- The villain/obstacle must have REAL weight. If the antagonist turns out to be misunderstood,
  the hero must WORK to see past the surface — not just be told.`;

  const rulePlotThreads = `RULE 10 — NO OPEN THREADS:
Before writing, mentally list every character, location, and subplot you plan to introduce.
EVERY thread must be resolved:
- Every character who appears must have a clear exit (they leave, they transform, they stay — but it's clear).
- Every question raised must be answered (even if the answer is "some mysteries are meant to stay").
- Every promise made in the setup must be delivered in the resolution.
Self-check before finishing: "Is there anything I mentioned that I forgot to resolve?"`;

  const ruleBedtimeTone = `RULE 11 — BEDTIME TONE:
This is a BEDTIME story. The child will fall asleep to this. Therefore:
- NO characters disappearing "into shadows" or "into darkness" ominously.
- NO unexplained creepy imagery (empty caves, figures lurking, whispers with no source).
- Conflict is allowed in the MIDDLE of the story, but the last third MUST wind down.
- The emotional trajectory must be: wonder → tension → resolution → warmth → sleep.
- Use sensory comfort language in the final sections: warm, soft, gentle, golden light, quiet, cozy.
- If a scary element exists (dragon, storm, darkness), it MUST be fully resolved and made safe
  before the story enters its final quarter.`;

  const interactive = ruleInteractive(config.mode);

  return `You are a master bedtime story writer. Write a story for children.
Follow every rule below exactly. You will be SCORED on each rule.

${rule1}

${rule2Heroes(config)}

${rule3}

${ruleAgeDepth(config)}

${themeRule}

${dreamBridge}

${ruleWorldCoherence}

${ruleSolutionDepth}

${rulePlotThreads}

${ruleBedtimeTone}
${interactive}

RULE 6 — LENGTH:
${lengthWords(config.length)}

RULE 7 — OUTPUT:
Respond with ONLY a raw JSON object. No markdown fences. No explanation.
{
  "title": "title in ${langName}",
  "content": "full story in markdown in ${langName}, ## Dream Bridge at end"
}
Escape newlines inside "content" so the JSON is valid.

STORY CONFIG (context):
- Theme: ${config.theme ?? 'AI chooses'}
- Mode: ${config.mode}
- Age focus (siblings): ${config.ageFocus ?? 'not specified'}
- Parent notes: ${config.customPrompt?.trim() || '(none)'}`;
}
