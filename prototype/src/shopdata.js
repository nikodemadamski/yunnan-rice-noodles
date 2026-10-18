// Noodle-shop content as data (Papa's-style menu, Cozy-style guest archetypes).
// The logic in shopcore.js never hard-codes a dish or a guest.

export const BROTHS = {
  hen: { name: 'Old hen broth', ico: '🐔', color: '#f2c14e' },
  chilli: { name: 'Red chilli broth', ico: '🌶️', color: '#e0603a' },
};

export const PARTS = {
  meat: { name: 'Raw slices', ico: '🥩' },
  egg: { name: 'Quail egg', ico: '🥚' },
  ham: { name: 'Xuanwei ham', ico: '🍖' },
  mushroom: { name: 'Wild mushrooms', ico: '🍄' },
  tofu: { name: 'Tofu skin', ico: '🫓' },
  chives: { name: 'Chives', ico: '🌿' },
  noodles: { name: 'Rice noodles', ico: '🍜' },
};

// parts are in the order they cross the bridge: raw things first (the broth
// cooks them), greens after, noodles last.
export const MENU = {
  classic: { name: 'Classic Cross-Bridge', broth: 'hen', parts: ['meat', 'egg', 'chives', 'noodles'], price: 18 },
  ham: { name: 'Ham & Mushroom', broth: 'hen', parts: ['ham', 'mushroom', 'chives', 'noodles'], price: 20 },
  spicy: { name: 'Red Bridge', broth: 'chilli', parts: ['meat', 'tofu', 'chives', 'noodles'], price: 19 },
  kids: { name: 'Little Bridge', broth: 'hen', parts: ['egg', 'noodles'], price: 10 },
};

// patience and tip are multipliers. Guests don't order from a menu: they *ask*,
// in their own words, and you work out the bowl (Good Pizza, Great Pizza).
// Each visit uses the next ask. An ask can want a broth, some parts (with
// counts), ban parts, cap how many things go in, or need it piping hot.
// `no` is what they say when you get that part wrong.
export const GUESTS = {
  li: { name: 'Mr Li', ico: '👴', patience: 1.6, tip: 0.8, fav: 'classic', line: 'The classic, please. Like his.',
    asks: [
      { say: 'The classic, please. Like Old Zhao made it.', broth: 'hen', need: { meat: 1, egg: 1, chives: 1 } },
      { say: 'Something that tastes like home… my wife always put in a slice of ham.', broth: 'hen', need: { ham: 1 }, no: { ham: 'No ham? …Never mind.' } },
    ] },
  student: { name: 'Uni student', ico: '🧑‍🎓', patience: 0.8, tip: 1.2, fav: 'spicy', line: 'Red Bridge! Exam in an hour!',
    asks: [
      { say: 'Exam in an hour. Something that WAKES ME UP!', broth: 'chilli', no: { broth: 'This wouldn’t wake a kitten…' } },
      { say: 'I failed. Make it hurt. And give me something soft.', broth: 'chilli', need: { tofu: 1 }, no: { tofu: 'Nothing soft in here…' } },
    ] },
  kid: { name: 'Kid & mum', ico: '🧒', patience: 0.9, tip: 1.1, fav: 'kids', line: 'Little Bridge! With an EGG!',
    asks: [{ say: 'EGGS! Two eggs! And NO green stuff!!', broth: 'hen', need: { egg: 2 }, ban: ['chives'], no: { chives: 'EWW! GREEN STUFF!', egg: 'I said TWO eggs!', broth: 'Too spicy! Waaah!' } }] },
  auntie: { name: 'Dance auntie', ico: '💃', patience: 1.1, tip: 1.0, fav: 'ham', line: 'Ham and mushroom. Quick, rehearsal at six!',
    asks: [{ say: 'Something light, dear. I dance at six. No meat.', need: { mushroom: 1 }, ban: ['meat', 'ham'], max: 4, no: { meat: 'Meat?! I’ll dance like a buffalo!', ham: 'Ham is meat, dear.', max: 'Too heavy! I’ll never do the splits.', mushroom: 'A few mushrooms would be nice…' } }] },
  lan: { name: 'Xiao Lan', ico: '🫐', patience: 0.7, tip: 1.3, fav: 'classic', line: 'One classic, Duck. I’m on a break. Hurry!',
    asks: [{ say: 'Anything, Duck, but HOT. I’ve been on the scooter all day.', hot: true, need: { meat: 1 }, no: { hot: 'Lukewarm. Like my career.', meat: 'Some meat for the road?' } }] },
};

// Day 1 of the reopened shop: who arrives when (seconds).
export const DAY1 = [
  { at: 0, who: 'li' },
  { at: 14, who: 'student' },
  { at: 32, who: 'kid' },
  { at: 52, who: 'auntie' },
  { at: 72, who: 'lan' },
];

// Noodle basket timing: firm until `cook`, perfect for `perfect` seconds,
// then slowly turns soft over `soft` seconds (gentle: never ruined).
export const NOODLE = { cook: 7, perfect: 3, soft: 6 };

// Seconds of patience for a guest with multiplier 1.
export const BASE_PATIENCE = 50;

// Reopening night: a real rush. Orders overlap, two baskets aren't enough for
// everyone, so you choose who to cook for first (watch their patience bars).
export const NIGHT1 = [
  { at: 0, who: 'li' },
  { at: 7, who: 'student' },
  { at: 18, who: 'kid' },
  { at: 27, who: 'auntie' },
  { at: 40, who: 'lan' },
  { at: 50, who: 'student' },
  { at: 61, who: 'li' },
];

// Broth fill: the line on the bowl. Heat: seconds until a bowl goes cold.
export const FILL = { lo: 0.72, hi: 0.9 };
export const HEAT = { plain: 22, fat: 75 };
