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

// patience and tip are multipliers; fav is what they order.
export const GUESTS = {
  li: { name: 'Mr Li', ico: '👴', patience: 1.6, tip: 0.8, fav: 'classic', line: 'The classic, please. Like his.' },
  student: { name: 'Uni student', ico: '🧑‍🎓', patience: 0.8, tip: 1.2, fav: 'spicy', line: 'Red Bridge! Exam in an hour!' },
  kid: { name: 'Kid & mum', ico: '🧒', patience: 0.9, tip: 1.1, fav: 'kids', line: 'Little Bridge! With an EGG!' },
  auntie: { name: 'Dance auntie', ico: '💃', patience: 1.1, tip: 1.0, fav: 'ham', line: 'Ham and mushroom. Quick, rehearsal at six!' },
  lan: { name: 'Xiao Lan', ico: '🫐', patience: 0.7, tip: 1.3, fav: 'classic', line: 'One classic, Duck. I’m on a break. Hurry!' },
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
