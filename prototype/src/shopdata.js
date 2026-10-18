// Noodle-shop content as data (Papa's-style menu, Cozy-style guest archetypes).
// The logic in shopcore.js never hard-codes a dish or a guest.

// The real dish (docs/design/GUOQIAO_MIXIAN.md): one broth, old hen and pork
// bones simmered for hours, sealed under a coin-thick layer of chicken oil.
// Chilli is a saucer of red oil you add, not the broth.
export const BROTHS = {
  hen: { name: 'Old hen & bone broth', ico: '🐔', color: '#f2c96a' },
};

// The saucers, in the order they cross the bridge into the broth:
// raw slices first (dipped in quail egg, cooked by the heat), then cooked
// meat, then flowers, then greens, and the noodles last.
// rank: 0 raw · 1 cooked · 2 flowers · 3 greens · 4 noodles · -1 any time
export const PARTS = {
  pork: { name: 'Raw pork loin', short: 'pork loin', ico: '🥩', rank: 0, zh: '生里脊' },
  fish: { name: 'Black fish slices', short: 'black fish', ico: '🐟', rank: 0, zh: '乌鱼片' },
  egg: { name: 'Quail egg', short: 'quail egg', ico: '🥚', rank: 0, zh: '鹌鹑蛋' },
  ham: { name: 'Xuanwei ham', short: 'Xuanwei ham', ico: '🍖', rank: 1, zh: '宣威火腿' },
  chrys: { name: 'Chrysanthemum petals', short: 'chrysanthemum', ico: '🌼', rank: 2, zh: '菊花' },
  pea: { name: 'Pea shoots', short: 'pea shoots', ico: '🌱', rank: 3, zh: '豌豆尖' },
  chives: { name: 'Garlic chives', short: 'chives', ico: '🌿', rank: 3, zh: '韭菜' },
  tofu: { name: 'Tofu skin', short: 'tofu skin', ico: '🫓', rank: 3, zh: '豆腐皮' },
  jizong: { name: 'Jizong mushroom', short: 'jizong', ico: '🍄', rank: 3, zh: '鸡枞' },
  chilli: { name: 'Chilli oil', short: 'chilli oil', ico: '🌶️', rank: -1, zh: '辣油' },
  noodles: { name: 'Rice noodles', short: 'rice noodles', ico: '🍜', rank: 4, zh: '米线' },
};
export const RAW = Object.keys(PARTS).filter(p => PARTS[p].rank === 0);

// Kunming shops name their sets after the exam ranks of the legend's scholar:
// 秀才 Xiucai (scholar), 举人 Juren (graduate), 状元 Zhuangyuan (top scholar).
export const MENU = {
  classic: { name: 'Juren set 举人', broth: 'hen', parts: ['pork', 'egg', 'ham', 'chrys', 'chives', 'noodles'], price: 22 },
  ham: { name: 'Juren set 举人', broth: 'hen', parts: ['ham', 'jizong', 'pea', 'noodles'], price: 22 },
  spicy: { name: 'Xiucai set 秀才', broth: 'hen', parts: ['pork', 'tofu', 'noodles'], price: 16 },
  kids: { name: 'Little scholar', broth: 'hen', parts: ['egg', 'noodles'], price: 10 },
  feast: { name: 'Zhuangyuan set 状元', broth: 'hen', parts: ['pork', 'fish', 'egg', 'ham', 'chrys', 'pea', 'tofu', 'noodles'], price: 38 },
};

// patience and tip are multipliers. Guests don't order from a menu: they *ask*,
// in their own words, and you work out the bowl (Good Pizza, Great Pizza).
// Each visit uses the next ask. An ask can want parts (with counts), ban parts,
// want at least / at most so many saucers, or need it scalding hot.
// `no` is what they say when you get that part wrong.
export const GUESTS = {
  li: { name: 'Mr Li', ico: '👴', patience: 1.6, tip: 0.8, fav: 'feast',
    asks: [
      { say: 'A Zhuangyuan bowl, please. The whole feast, like Old Zhao made it.', need: { pork: 1, egg: 1, ham: 1, chrys: 1 }, min: 6,
        no: { min: 'A Zhuangyuan bowl has more saucers than that…', chrys: 'Old Zhao always floated chrysanthemum on top.' } },
      { say: 'Something that tastes like home… my wife always slipped in Xuanwei ham.', need: { ham: 1 }, no: { ham: 'No ham? …Never mind.' } },
    ] },
  student: { name: 'Uni student', ico: '🧑‍🎓', patience: 0.8, tip: 1.2, fav: 'spicy',
    asks: [
      { say: 'Xiucai set, I’m broke. But exam in an hour: WAKE ME UP!', need: { chilli: 1 }, max: 4, no: { chilli: 'This wouldn’t wake a kitten…', max: 'I can’t afford all this!' } },
      { say: 'I failed. Make it hurt. And give me something soft.', need: { chilli: 1, tofu: 1 }, no: { chilli: 'It doesn’t even hurt…', tofu: 'Nothing soft in here…' } },
    ] },
  kid: { name: 'Kid & mum', ico: '🧒', patience: 0.9, tip: 1.1, fav: 'kids',
    asks: [{ say: 'Quail eggs! TWO! And NO green stuff!!', need: { egg: 2 }, ban: ['pea', 'chives'], no: { pea: 'EWW! GREEN STUFF!', chives: 'EWW! GREEN STUFF!', egg: 'I said TWO eggs!' } }] },
  auntie: { name: 'Dance auntie', ico: '💃', patience: 1.1, tip: 1.0, fav: 'ham',
    asks: [{ say: 'Something light, dear, I dance at six. No meat. Pretty, like flowers.', need: { chrys: 1 }, ban: ['pork', 'fish', 'ham'], max: 5,
      no: { pork: 'Meat?! I’ll dance like a buffalo!', fish: 'Fish is meat too, dear.', ham: 'Ham is meat, dear.', max: 'Too heavy! I’ll never do the splits.', chrys: 'Not even one flower?' } }] },
  lan: { name: 'Xiao Lan', ico: '🫐', patience: 0.7, tip: 1.3, fav: 'classic',
    asks: [{ say: 'Anything, Duck, but SCALDING. I’ve been on the scooter all day.', hot: true, need: { fish: 1 }, no: { hot: 'Lukewarm. Like my career.', fish: 'Some fish for the road?' } }] },
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
// Raw slices only cook if the broth is still this hot (0..1) when they go in.
export const COOK_HEAT = 0.55;
