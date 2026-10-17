# 过桥 — Crossing the Bridge (working title)

Gameplay brainstorm, v0.1.

> A vibe coder at a tech firm in Ireland can't stop thinking about cross-bridge rice noodles.
> 22 days of annual leave, no money, a missing grandpa, a stolen recipe, and a delivery scooter.
> Can you taste all of Yunnan and rebuild the perfect bowl before you have to go back to work?

---

## 1. The idea everything hangs on

**The cross-bridge noodle legend is already a delivery story.**

In the folk tale from Mengzi, a scholar studies on an island. Every day his wife carries food to him across a bridge, and every day it arrives cold. Then she notices that a layer of chicken fat on top of the broth keeps the heat in. She brings the boiling soup, the raw meat and the noodles separately, and he puts the bowl together when it reaches him. That's 过桥米线, "crossing-the-bridge noodles".

So the dish was invented by someone **delivering food to a person she loved and working out how to keep it hot on the way.** You're a delivery rider, and the game is that legend played out again.

What that gives the design:

- **Delivery is the theme, not filler.** Every order is a small version of the wife crossing the bridge.
- **The finale uses the core mechanic.** The last mission is to cook the bowl and carry it, hot, across a real bridge to grandpa. Everything you've practised for 22 days pays off there.
- **"The secret is simplicity" has a reason.** The answer isn't some rare ingredient. It's good broth, the oil layer, timing, and *who it's for*. That's the God of Cookery ending (黯然销魂饭, Sorrowful Rice: anyone can be the God of Cookery if there's heart in it), told through Yunnan's own legend.

---

## 2. What we're taking from God of Cookery (食神, 1996)

| God of Cookery | Our game |
|---|---|
| Arrogant top chef loses everything, ends up on the street | Comfortable tech worker leaves the laptop and gets on a scooter |
| Learns from street food and ordinary people | Learns from every restaurant, food stall and grandma in the province |
| Huge, over-the-top food reveals (light beams, slow motion, the "Pissing Beef Balls") | **"Food Reveal" moments**: when you taste something amazing, the cute Animal Crossing style goes full dramatic anime for 3 seconds |
| A villain who steals and turns cooking into a commercial machine | The neighbour opens a shiny chain restaurant using "Grandpa's recipe" |
| The answer is heart, not technique | The answer is simplicity and who you cook for |

Keep the comedy: slapstick, absurd confidence, sudden sincerity.

---

## 3. Presentation (Animal Crossing as the main inspiration)

- **Look:** simple round characters, big readable faces, soft colours, chunky low-poly world. Every Yunnan region gets its own colour palette (red earth in Dongchuan, Dai bamboo houses in Xishuangbanna, white Bai houses in Dali, snow and prayer flags in Shangri-La).
- **Speech bubbles:** Animal Crossing-style bubbly text boxes, words appearing letter by letter, key words in colour.
- **"Animalese" voice, Yunnan version:** each letter plays a short, sped-up syllable. **Our twist is Mandarin tones.** Each character gets a tone profile: cheerful people go up (2nd tone), grumpy people go down (4th tone), grandma wobbles (3rd tone). It would sound like a made-up Chinese-ish babble, which is unique and also a little in-joke. For a minority character, sample a few syllables from their language for flavour (Bai, Dai, Naxi, Yi…).
- **Emotes:** Animal Crossing-style reactions (sweat drop, sparkle, rain cloud, lightbulb, heart). Food reactions get the strongest ones.

---

## 4. The core loop: one day out of 22

```
MORNING       Grandma's kitchen: taste yesterday's experiment bowl, get a clue
   ↓
DAY           Take orders on the delivery app, 3–5 deliveries (each one a small story)
   ↓
EVENING       Bring "findings" home → choose which go into tomorrow's bowl
   ↓
NIGHT         Phone: texts from grandpa's friends, your boss, the rival, the mystery customer
```

The 22-day calendar is the pressure. Festivals land on fixed days (Torch Festival, Water-Splashing Festival, wild mushroom season), so planning *where* you are on *which* day matters.

---

## 5. Making deliveries not boring

Design rule: **you are never just driving from A to B.** Every delivery has three short beats, and each one can carry its own surprise.

### Beat 1 – The pick-up (the restaurant)
- Every restaurant is a character. The owner is an NPC with their own arc.
- **The "kitchen peek":** a short, dramatic cutaway of the dish being cooked (God of Cookery style). If the owner likes you enough, you get a **Finding** (an ingredient, a technique, or a "taste memory") for grandma.
- Sometimes the owner gives you a staff meal. Tasting a dish yourself is how you "collect" it in your **Food Dex** (the "try every food in Yunnan" goal).

### Beat 2 – The ride (short, physical, food-focused)
Keep rides to **30–90 seconds**. The challenge is the **food**, not the road.

- **Bag packing puzzle (Tetris for your thermal bag):** soup must stay upright, the bubble tea can't go under the watermelon, the ice cream can't sit next to the hotpot. Quick, satisfying, with new item shapes every region.
- **Heat & slosh meters:** take a bump too fast and the soup spills; dawdle and it goes cold. The **oil-layer trick** from the legend becomes an upgrade you *earn* in the story ("Grandma teaches you why the chicken fat matters").
- **Regional hazards:** each region adds one new ride rule instead of making the riding harder:
  - Dali: wind off Erhai Lake, lids blow off
  - Xishuangbanna: Water-Splashing Festival, protect the food from water guns
  - Shangri-La: altitude and cold, heat drains twice as fast
  - Mountain villages: goats, chickens, a buffalo in the road (befriend the herder → shortcut through the pasture)
  - Mushroom season: rain, mud, and…

- **The mushroom episode:** if you eat badly cooked 见手青 wild mushrooms (a real, famous Yunnan thing), you start seeing "little people" for one delivery. The world gets weird and the rides become surreal. Funny, memorable, and very Yunnan.

### Beat 3 – The drop-off (finding the customer)
This is where most of the fun lives. Every order has **customer notes**, and the notes are puzzles:

- "Don't knock, baby sleeping. Leave it with the man in the red hat at the market." → find him in a crowd
- "Third door after the tree that looks like a duck"
- "I'm on the train in carriage 7, it leaves in 3 minutes" → sprint along the platform
- "It's a surprise for my girlfriend, she must NOT see you" → stealth delivery
- An address written in **Naxi Dongba pictographs** (the last living pictographic script in the world) → a visual puzzle; learn symbols as you go
- A Bai grandmother who only speaks Bai → learn greeting words, earn trust
- A lonely customer who asks you to sit and eat with them → you can say no (faster, better rating) or yes (slower, but you get a story and maybe a Finding)

### Variety engine
Every delivery = **Customer × Twist × Region rule.**
Hand-write the customers and twists; let the system remix which twist shows up where. No two deliveries play the same.

### Don't pad it
- **Fewer, better deliveries:** 3–4 hand-crafted deliveries a day (3–6 min each). 22 days × ~3 = ~70 deliveries, roughly a 6–8 hour game.
- Routine "money" orders can be done in a **one-tap montage** (a 5-second animated cutaway plus your earnings), so you never grind.

### The order board is a choice
The app shows more orders than you can take. You choose based on:
- **Money** (you're broke, rent and gas cost something)
- **Food** (a restaurant you haven't tried yet)
- **People** (a customer whose story you're following)
- **Rumours** (a tip from grandma's mahjong friends: "the old man at the Jianshui stall knows something about your grandpa")

That's the real decision every day. Money vs. food vs. people vs. the mystery.

---

## 6. NPCs: "an NPC on the surface, a person underneath"

Every major character has **three layers**, revealed over repeat visits:

1. **The gag:** what you see the first time. (The guy who always orders 12 portions of fried bee larvae.)
2. **The pattern:** what their **order history** tells you without anyone saying it. (He orders 12 because his whole village football team eats together after training… they lost every match this year.)
3. **The heart:** a scene, a secret, or a favour unlocked at high friendship. They give you a Finding or open a shortcut, and they turn up at the finale.

**Order history as storytelling** (no dialogue needed):
- A student orders cheap noodles at 2 a.m. every night for a week… then one day orders a feast for six. Exam passed. 🎉
- An old man orders a meal for two every day. One day you deliver and see why.
- Someone orders only plain broth with no toppings… from a different town every day… always one step ahead of you. **(Is that grandpa?)**

### Character sketches
- **Grandma (奶奶):** heart of the game. Tiny, fierce, cooks everything you bring home, no matter how awful. Plays mahjong, has spies everywhere.
- **The Neighbour (老王, "Old Wang"):** just grandpa's next-door neighbour, no secret family twist. He took grandpa's recipe and buried it under *everything*: 48 toppings, gold leaf, cheese, neon signs, ads on every bus, influencer livestreams. His **"Supreme Mega Cross-Bridge Noodle"** (超级至尊过桥米线) chain is winning. Loud, smug, a little pathetic, very funny.
- **The Rival Rider:** rides for **Blueberry** (蓝莓), the blue rival app. Faster than you, always cheerful, becomes a friend. Has their own reason to be riding.
- **Your Boss (in Ireland):** keeps messaging. "Quick one 🙏 can you just prompt the Q3 deck?" You can answer at red lights (a funny mini-game) for small extra cash and a running joke.
- **The AI chatbot:** still on your phone. You can ask it about food. It's confident and often wrong ("Cross-bridge noodles are traditionally served with cheddar"). A soft satire of where you came from.

---

## 7. The evening "Bowl Lab": a deduction game

This is the brain of the game, and it's what makes **disgusting results useful**.

A cross-bridge bowl has slots:

| Slot | Examples you could find |
|---|---|
| Broth | old hen, duck, pork bone, Xuanwei ham bone, yak bone |
| Oil layer | chicken fat, rapeseed oil, nothing |
| Thin-sliced raw meat | pork loin, fish, ham, chicken |
| Extras | quail egg, chives, pea shoots, edible flowers, rushan (Bai milk fan), mushrooms |
| Noodle | fresh fermented rice noodle, dry, thick, thin |
| Ritual | the *order* things go into the bowl, and how hot the soup is |

Every Finding you bring home unlocks options. Each evening you choose a combination, grandma cooks it, and she tastes it **remembering grandpa's bowl**:

- She gives **Wordle-style feedback per slot**: "the broth is right… the egg is in, but too early… the flowers, absolutely not."
- **Each correct slot unlocks a memory of grandpa** (a short flashback scene). The recipe puzzle and the grandpa mystery are **the same progress bar**.
- Bad bowls get the best reactions: grandma's face goes through 5 emotions, the cat leaves the room, the neighbour's dog won't eat it. Still useful, because it rules things out.

### The real lesson: subtract, don't add

**Decided:** grandpa's original secret was **simplicity**. The neighbour won with *more*: more toppings, more ads, more "extra". Greatness is in simple things done perfectly.

The Bowl Lab should teach this through play instead of telling you:
- **Early game, adding feels good.** Every Finding unlocks a shiny new option, and customers at the neighbour's chain cheer for big, loaded bowls. If you test your bowl on customers, extra toppings score "hype points" fast.
- **Grandma's feedback says the opposite.** The more you pile on, the further it drifts from grandpa's bowl.
- **Late game, the puzzle flips to taking things away.** The final bowl has only a few things in it, each done perfectly: broth simmered the right number of hours, the oil layer, the soup at the right heat, the ingredients going in the right order.
- **The joke ending:** a player who stacks every topping gets told the bowl tastes *exactly like the neighbour's*.

It also mirrors where the protagonist came from. The tech world is "add more features, more hype, more AI". The protagonist recognises the neighbour's playbook, and the journey is learning to stop.

**Final twist:** you can get every slot "right" and it still isn't grandpa's bowl. The missing piece isn't an ingredient. It's that the bowl is made *for someone* and brought to them hot, across the bridge.

---

## 8. Story beats (draft, open to change)

**Decided:** grandpa isn't family. He's the old man who ran a small cross-bridge noodle shop in **Kunming**, the best bowl you've ever eaten, from a trip years ago. You're a stranger who loved his noodles so much you drop everything to help him **get his restaurant back**. Grandma (his wife) takes you in. You sleep on a folding bed in the back of the shuttered shop.

That's a stronger premise than family: nobody *expects* you to help. You're the foreigner who showed up, which is funny, touching, and everyone in town has an opinion about it.

**The protagonist (decided):** Irish, barely any Chinese, completely dazed. Gets by on a translator app and the AI chatbot. See section 9.

1. **Prologue, Ireland:** you're typing business prompts to an AI. Your prompts slowly drift: "Q3 synergy deck" → "Q3 deck, noodle themed" → "show me how cross-bridge noodles are made". This is the tutorial; the player is literally typing.
2. You look up grandpa's shop in Kunming, the one from your trip… **CLOSED.** ("What?!?!") You tell your boss it's an emergency and book a flight.
3. **Arrival in Kunming:** the shutters are down. Grandma (who somehow remembers you, "the tall foreigner who ate three bowls") tells you grandpa has disappeared, the neighbour stole the recipe, and the neighbour's shiny chain is opening across the street.
4. **You're broke.** First paycheck isn't until you're back at work, and you have **22 days of annual leave**. You sign up as a delivery rider.
5. **Days 1–21:** deliver, taste, befriend, experiment, follow the plain-broth customer.
6. **The truth about grandpa:** the neighbour's flashy chain took all his customers. Grandpa started doubting himself ("maybe simple isn't enough any more"), tried adding toppings and gimmicks, and his bowl got *worse*. Ashamed, he closed the shop and disappeared. (God of Cookery's fall-and-rise, from grandpa's side.) Your bowl proves he was right all along.
7. **Day 22, the finale:** cook the bowl and deliver it, hot, across the bridge to grandpa. He tastes it, and the shop reopens. Everyone you met along the way shows up.
8. **Ending choice:** fly back to the laptop… or not?

---

## 9. The protagonist: Irish, lost in translation

**Decided:** from Ireland, barely speaks Chinese, dazed, survives on a translator app and AI.

- **Translator app (parody name, e.g. "Goggle Translate"):** point your phone at menus, signs and order notes to translate them, AR-style. It's *usually* right. Real Yunnan dish names translate hilariously: 饵块 (erkuai, a rice cake) → **"Bait Block"**, 乳扇 → "Milk Fan", 过桥米线 → "Crossing Bridge Rice Thread", 臭豆腐 → "Stinky Tofu" (accurate, sadly).
- **Speech bubbles start half in Chinese.** The app fills in a translation, sometimes wrong. A wrongly translated order note can send you to the wrong place, which is a delivery twist in itself.
- **You learn as you play.** Words you've picked up (from grandma, customers, signs) stop needing translation and appear in English straight away. By day 22 the bubbles are mostly readable. This is a progress bar you *feel*.
- **Vocabulary carries over on Restart**, like all knowledge (good for speedrunners and very satisfying).
- **The AI chatbot:** confident, eager, often wrong. Useful for hints, terrible for facts.
- **The Irish connection: potatoes.** Kunming *loves* potatoes: fried potato chunks (炸洋芋) on every corner, Yunnan grows tons of them. Potatoes are the one thing the Irishman truly understands. A running gag, and a real moment where locals start respecting you. (Also: Irish breakfast tea vs. Pu'er tea.)

---

## 10. Being Plankton: stealing secret recipes (and failing)

**Decided:** like Plankton in SpongeBob trying to steal the Krabby Patty formula, you scheme to discover every restaurant's secret recipe. **It's hard, you fail a lot, and the failing is the fun.**

Every restaurant guards one signature secret. The owners won't tell a random foreigner. So you scheme:

| Scheme | How it might go |
|---|---|
| **Use the uniform** | You're a delivery rider, so you're *allowed* in to pick up. Stall at the counter and peek into the kitchen. |
| **Disguises** | Fake moustache, "health inspector", "famous food vlogger" with your phone on a stick. |
| **Eavesdrop with the translator** | Hold your phone up to the chef's conversation… and get a terrible translation ("add the grandmother to the pot"). |
| **Dig through the bins** | Empty packets and labels reveal ingredients. Smelly. |
| **Follow them to the 5 a.m. market** | See what they buy. Don't get spotted. |
| **Bribe the cat / the kid / the dishwasher** | Everyone wants something. |
| **Ask the AI** | "Step 1: Become the restaurant." Useless. Very funny. |

How failing works:
- **Failure is never wasted.** Every failed scheme gives a funny scene *and* a clue fragment.
- **Getting caught has consequences:** trust drops, and some owners ban you, so you can't pick up from them. That changes your route and your income.
- **Escalating disasters:** chased out by grandma with a cleaver, locked in the walk-in fridge, accidentally hired as the dishwasher (which actually gets you the recipe).

**The honest route also works:** become a regular, help out, and the owner may just *teach* you. The game never says which way is right:
- **Plankton route:** faster and riskier (the speedrun favourite).
- **Friendship route:** slower, deeper, and needed for the best ending.
- **The mirror:** the more you scheme, the more grandma notices that you're starting to act like the neighbour.

---

## 11. Our delivery app: 小黄鸭 "Little Yellow Duck"

**Decided:** no real brands. A funny fruit/veg/animal name, a yellow outfit, an e-bike.

Suggestion: **Little Yellow Duck (小黄鸭 Xiǎo Huáng Yā)**
- Yellow jacket, yellow helmet **with a little duck bill on the front**
- E-bike horn goes *quack*
- The app is a cheerful duck that gives you ratings with increasingly passive-aggressive emojis
- Rival app: **Blueberry (蓝莓)**, riders in blue

Other options if the duck doesn't land: Mango Dash (芒果), Banana Bolt, Corn Rush, Lemon Zoom.

---

## 12. Home base: Kunming (春城, the Spring City)

**Decided:** Kunming is the no. 1 region and the heart of the game. It's mild all year round (hence "Spring City"), the perfect e-bike city.

Most of the game happens here. Other regions (Dali, Jianshui, Mengzi where the noodle legend began, Xishuangbanna, Lijiang, Shangri-La) are **day trips by high-speed train** later in the 22 days, with their own customers and rules.

**Kunming delivery zones** (unlocked over time):
- **Grandpa's street:** the hub. Grandma, the shuttered shop, the neighbour's neon chain across the road, mahjong aunties.
- **Green Lake (翠湖):** in winter, thousands of **red-billed gulls** fly in from Siberia and dive at anything edible. A delivery hazard *and* a postcard. Students from Yunnan University nearby order at 2 a.m.
- **Old town & the Golden Horse and Jade Rooster Arches (金马碧鸡坊):** crowds, tourists, food stalls. Crowd-search deliveries.
- **Dounan Flower Market (斗南):** one of the biggest flower markets in Asia. Night deliveries through a maze of flowers, flower cakes (鲜花饼).
- **Dianchi Lake & the Western Hills:** a long scenic climb to Dragon Gate. A "keep the soup hot uphill" challenge.
- **Guandu Ancient Town (官渡古镇):** temples, old snacks, grandmas with opinions.
- **Stone Forest (石林), on the outskirts:** the far delivery. Sani (Yi) customers, a maze of rock pillars.

**Kunming food to collect:** small-pot rice noodles (小锅米线), tofu-pudding rice noodles (豆花米线), grilled erkuai (烧饵块), fried potato chunks (炸洋芋), steam-pot chicken (汽锅鸡), flower cakes (鲜花饼), Yiliang roast duck (宜良烤鸭), cold rice noodles (凉米线), grilled tofu (烤豆腐), and wild mushroom hotpot in season.

---

## 13. Endings & what happens if you fail

**Decided:** missing the deadline doesn't mean game over. The world moves on without you, and it's harder.

**Day 22 arrives without the recipe → "Overtime".**
- The bad ending plays: the shop is sold, and the neighbour's chain puts its sign over grandpa's door.
- Then the game asks: **Restart** (back to day 1, you keep your knowledge) or **Continue as is**.
- **Continue as is** keeps playing in a worse world:
  - You didn't go back to work, so you're fired. The boss's messages stop. Delivering is now your actual job.
  - The chain spreads: restaurants you loved turn into chain outlets, some NPCs move away, and some Findings are gone for good.
  - Rent is real now. Money pressure goes up.
  - You can still win, but it's a **late, bittersweet ending**: grandpa gets a stall instead of his shop, or he gets the shop back but you've lost something along the way.

So the endings ladder from best to worst:

| Ending | How |
|---|---|
| **Golden bowl** | Recipe solved + grandpa found by day 22, plus his *original* secret uncovered |
| **The bridge** | Recipe solved + grandpa found by day 22 |
| **Late bowl** | Solved in Overtime |
| **Chain store** | Never solved; the neighbour wins (you can keep playing forever as a rider) |

---

## 14. Freedom & speedrunning

**Decided:** the story guides you, the gameplay leaves you free. It should be friendly for new players **and** tempting for speedrunners.

The best reference is **Zelda: Majora's Mask** (and **Outer Wilds** for the knowledge side):
- **Fixed calendar, fixed schedules.** Like Majora's 3 days, the 22 days run on a clock. NPCs, festivals, and restaurant openings happen at set times. Learn the schedule and you can plan a perfect route.
- **"Order history notebook" = Majora's Bombers' Notebook.** Your phone tracks every customer: their schedule, their orders, how far their story has got. New players use it as a guide; speedrunners use it as a route planner.
- **Knowledge is progression (Outer Wilds style).** The recipe is something you *know*, not an item you grind for. A first-time player discovers it over 22 days. A returning player who already knows the answer can head straight for the few Findings they need and solve it on day 3. **That's the any% run.**
- **Many roads to each answer.** Every bowl slot can be unlocked by 2–3 different Findings in different regions. No single mandatory path; casual players stumble into one, speedrunners route the fastest.
- **Sequence breaks are allowed.** If you work out where grandpa is early and get there, the game lets you. Don't block clever players with invisible walls.

### Built-in speedrun support
- **In-game timer** (real time + in-game days) and a **"speedrun mode"** toggle that shows it.
- **All dialogue and cutscenes skippable**, text speed adjustable.
- **Deterministic systems:** orders, weather and events come from a seed. Same seed = same run (a "set seed" option for races).
- **A high skill ceiling on movement:** the scooter should have real *tech* (drift boosts, curb hops, a perfect-brake that saves the soup). Easy to ride, hard to master.
- **Natural categories:**
  - **Any%**: reach a good ending as fast as possible
  - **Golden Bowl%**: best ending
  - **100% / "Every dish in Yunnan"**: complete Food Dex + every NPC story
  - **Zero Spill%**: never spill a drop (a fun challenge category)

### Open for everyone else
- No real fail state, just the harder Overtime path.
- Optional hints from grandma ("Maybe ask the mushroom lady about the broth?").
- A **Relaxed mode** where the soup doesn't go cold and timers are gentle.

---

## 15. 2D or 3D? Decide by gameplay

**Decided:** gameplay first, no 2D/3D war.

**Recommendation: 3D, Animal Crossing-style low-poly with a tilted, mostly fixed camera.** Because of what the gameplay needs:
- **Yunnan is mountains.** Switchback roads, terraced fields, bridges over gorges, and the **finale on a bridge**. Height matters, and that reads much better in 3D.
- **The ride has to feel good.** Soup slosh, drifting, curb hops and speedrun tech are easier to make *feel* great with 3D physics.
- **"Food Reveal" moments** need the camera to swoop in dramatically, God of Cookery style.
- **Simple 3D is cheap.** Animal Crossing characters are basic shapes with big faces, much less work than hand-animating every frame of a 2D sprite.

**Where 2D still wins:** the **phone UI** (delivery app, notebook, chats, AI chatbot), the **bag-packing puzzle**, and the **Bowl Lab** can all be flat 2D screens. That's the Animal Crossing approach too: a 3D world with a 2D phone.

---

## 16. Remaining open questions

- **Protagonist's name and look.** (And grandpa's and grandma's names.)
- **Season:** winter gives the Green Lake gulls; summer (rainy season) gives wild mushroom season and the "little people" episode. Can't have both in the same 22 days, unless the game starts in late autumn.
- **Is the duck the app?** Or another fruit/veg/animal?
- **Map:** confirmed Kunming as the hub; other regions as train day trips (recommended: easier to build, better for speedrun routing).

---

## 17. Suggested first prototype (vertical slice)

Build **one day** before anything else, to answer the big question: *are deliveries fun?*

1. One Kunming neighbourhood (grandpa's shuttered shop + the neighbour's chain across the street) with 3 restaurants and 5 customers.
2. The bag-packing puzzle + a 60-second ride with heat/slosh.
3. 3 hand-written deliveries with different twists (crowd search, stealth, lonely customer), riding for Little Yellow Duck.
4. One evening Bowl Lab with 3 slots.
5. One Plankton scheme on one restaurant (peek into the kitchen in uniform; get caught, get a clue).
6. The translator app on order notes, with a few deliberately wrong translations.
7. Placeholder "animalese" voice with tones.

Engine suggestion: **Godot 4** (free, light, strong 3D for a stylised low-poly look, quick to iterate). For an even faster throwaway test, the bag puzzle and Bowl Lab could be prototyped as a web page first.
