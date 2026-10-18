# Reference games: Animal Crossing, Cooking Mama, Papa's

Research done in parallel by three research agents (web search; Flipline/fandom pages were not directly reachable from the build container, so some details come from search summaries). We study **how these games play**, not their code or assets: they're proprietary, and we're building our own.

Method used: understand what's available → gather what's missing → define the problem → choose a simple approach → set a goal → act.

---

## Animal Crossing: the feel

**What matters most**
- **Animalese:** each letter plays a short sped-up syllable; every villager type has its own base pitch; **mood shifts the pitch** (higher when happy, lower when sad/angry); fast-scrolling raises speed and pitch. Open-source animalese ports add slight random intonation.
- **Reactions** as an overhead icon language: `!`, steam, notes, a dark swirl. A "you're talking my ear off" pose after too many chats in a row.
- **8 personality types** (lazy, jock, cranky, smug, normal, peppy, snooty, big sister), each with its own dialogue pool, plus a per-villager **catchphrase** at the end of lines that the player can rename.
- **Camera:** about 30–45° down, plus a "rolling log" curved-world vertex shader that bends the ground away so the sky shows; fog fades distant streets.
- **Calm loop:** real-time clock, no fail state, small daily tasks that refill when claimed (Nook Miles+), mail and gifts arrive *tomorrow*.
- **Friendship points:** +1 ordinary gift, +2 liked, −2 junk; unlocks (daily gift ≈30, catchphrase change ≈100, photo at max).
- **Sound:** a track for every hour, a rain layer that drops the percussion, 3D ambience per surface/tree, soft pitched UI plucks.

**Where we deliberately differ:** Animal Crossing advances text on a button press. Our producer asked for auto-playing cutscenes (tapping was distracting), so story scenes auto-advance; tap still skips ahead.

## Cooking Mama: the gesture kitchen

**What matters most**
- A recipe = **4–8 short steps of 5–10 s**, ~1 minute per dish, drawn from a shared pool of gestures (chop, slice along a guide, peel, knead, stir in circles, keep heat in a zone, crack, flip, drag toppings in order).
- **Every input visibly changes the food** (a slice falls away, the meter fills) with its own little sound.
- **Grading per step** (Perfect/Good/OK/fail or gold/silver/bronze), a total out of 100, gold only at 100.
- **Failure never blocks the dish:** Mama's fiery eyes and "Don't worry, Mama will fix it!", then she finishes the step. "Better than Mama!" for a top step.
- **Generous input detection** (motion-control games were criticised for unreliable input) and a **1-second ghost-hand hint** at each step's start.
- Known faults to avoid: repetition (you've seen every task in ~10 minutes), one looping song.

## Papa's games (Flipline): the restaurant

**What matters most**
- **Station pipeline:** Order → 2–3 production stations → finish/serve; switch with tabs. The **ticket** (icons in order) travels with each order. (There is no "Papa's Noodleria"; Pastaria's boil station is the closest.)
- **Juggling:** every pot/pan has its **own timer ring** (under / ideal / over) that keeps running while you're at other stations.
- **Build scoring:** right ingredient, piece count, even spacing, placement; layer order matters.
- **Per-station % scores** averaged into points; points → tips (currency) and rank XP.
- **Customers:** waiting lowers only the wait score; Star Customer (≥80 adds a star, ≤59 resets); Bronze/Silver/Gold regulars; closers at day's end; a weekly critic who grants a tip-boosting ribbon.
- **Day loop:** a stream of customers → day summary → rank-up unlocks (new ingredients, holiday seasons every ~5 ranks) → a ticket mini-game → shop.

---

## What we applied (prototype, this round)

| Rule | Where |
|---|---|
| Mood-based voice pitch (+2 semitones happy, −2 sad) and ±1 semitone random jitter | `prototype/src/audio.js` `blip()` |
| Recipe = 7 short steps (~70 s): broth, slice, **crack egg**, **blanch noodles**, oil, build, taste | `prototype/src/kitchen.js` |
| One-second hint before every gesture step | `hint()` in `kitchen.js` |
| Fail-forward: "Don't worry, Grandma will fix it!"; "Better than Grandma!" for a top step | `stamp()` in `kitchen.js` |
| Papa's-style timer ring (under / ideal / over) for the noodles | `stepNoodles()` |
| Per-station % bars averaged with the recipe verdict; Gold / Silver / Bronze medal | `stepTaste()` |

## Next candidates (not built yet)

1. **Noodle-shop mode (Papa's):** after grandpa's shop reopens, a day = 6–10 customers with **ticket icons** (broth, heat, raw items, extras); the broth pot and noodle basket keep **timing while you build** other bowls; waiting only lowers the wait score (no one storms out). Star Customer badges for regulars like Mr Li.
2. **Personalities & catchphrases (Animal Crossing):** give each NPC a type (grumpy noodle master, peppy student, gossiping auntie…) and a local catchphrase at line ends ("嘛", "噶"), renameable later.
3. **Friendship points** for regular customers; letters with recipes or ingredients arriving the next morning.
4. **Hourly music + rain layer**, wok-sizzle and scooter-bell ambience.
5. **Curved-world shader** for the street view.
6. A **practice mode** per kitchen step (no grading).

## Sources

**Animal Crossing:** [Animalese (Nookipedia)](https://nookipedia.com/wiki/Animalese) · [Emotions](https://nookipedia.com/wiki/Emotions) · [Conversation](https://nookipedia.com/wiki/Conversation) · [Catchphrase](https://nookipedia.com/wiki/Catchphrase) · [Friendship](https://nookipedia.com/wiki/Friendship) · [animalese-swift](https://swiftpackageregistry.com/jakubpetrik/animalese-swift) · [World-bending effect](https://notslot.com/tutorials/2020/04/world-bending-effect) · [Nook Miles](https://animalcrossing.fandom.com/wiki/Nook_Miles) · [Accessibility by sound (Audiokinetic)](https://www.audiokinetic.com/en/blog/animal-crossing-is-playable-by-the-totally-blind)

**Cooking Mama:** [Pocket Gamer review](https://www.pocketgamer.com/cooking-mama/review/) · [GameSpot review](https://www.gamespot.com/reviews/cooking-mama-review/1900-6157831/) · [Wikipedia](https://en.wikipedia.org/wiki/Cooking_Mama_(video_game)) · [Cook Off wiki](https://cookingmama.fandom.com/wiki/Cooking_Mama:_Cook_Off) · [Engadget on Wii controls](https://www.engadget.com/2007-04-02-cooking-mama-cook-off-highlights-wii-remote-issues.html) · [TheGamer on Cookstar](https://www.thegamer.com/cooking-mama-cookstar-review/)

**Papa's:** [Flipline blog](https://www.flipline.com/blog/?p=19577) · [Pastaria cook station](https://www.flipline.com/blog/?p=3370) · [Taco Mia FAQ](https://i.flipline.com/games/papastacomia/faq.html) · [Wingeria FAQ](https://i.flipline.com/games/papaswingeria/faq.html) · [Star Customer Award](https://fliplinestudios.fandom.com/wiki/Star_Customer_Award) · [Order Station](https://fliplinefandom.fandom.com/wiki/Order_Station)
