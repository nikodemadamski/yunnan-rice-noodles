# PLAN: One More Bowl overhaul, phases B to F

I do one phase at a time and stop after each. After every phase:
- run `prototype/tools/shots.cjs` into `design/after_phaseX/`;
- compare against `design/ref_*` and fix, up to 3 loops;
- check for zero console errors;
- commit, then report in your format.

## Decisions I need from you before "go"

1. **Character art: sprites or 3D?** The brief says "sprite sheets ONLY (PixelLab or CC0)". But the game's world is 3D (three.js), and your character sheet is a "3D character model". Options:
   - **(a) PixelLab sprites.** You allow `api.pixellab.ai` and `api.elevenlabs.io` in the environment's Network access settings, and add `PIXELLAB_KEY` as an environment secret. Then I generate a sprite sheet for every character from your sheet, with idle, 8-direction walk and the 5 emotions. Those are billboards in the 3D town and real sprites in the 2D kitchen. PixelLab's output is pixel art, which is a different look from your soft, rounded sheet.
   - **(b) CC0 rigged 3D characters** (KayKit, which clones fine from GitHub). They come with real skeletal animations, and emotions acted with the whole body. They won't look like your heroine.
   - **(c) Keep your heroine as the 3D model built from your sheet and give her a real skeleton:** a squash-and-stretch walk, and hop, slump, stomp, jump and hand-on-chin poses. Then render sprite sheets *from* the 3D models for the 2D kitchen, so no canvas-drawn humans remain.

   **My recommendation is (c) now**, then swap in (a) per character if you unblock PixelLab and like its style.
2. **Grandma or Grandpa?** The brief says "Grandma's shop is closed", "Grandma's secret recipe" and "Grandma's memory". In the script (`docs/STORY_OUTLINE.md`), the shop is **Grandpa Zhao's**: he's missing, Grandma is alive and takes you in. You said not to change the plot, so I'll read it as **Grandpa's** shop, recipe and memory guiding the first 3 bowls, with Grandma unchanged. Correct me if you meant to swap them.
3. **Title.** "Spring City Lane / One More Bowl" or the current "Crossing the Bridge 过桥"? I'll keep the current one unless you pick.
4. **Palette-only rule.** I'll allow food its true colours (pink raw pork, gold broth, green chives) as an exception to the palette file. Everything else (sets, UI, clothes) will use only the palette.

## Phase B: World fixes (clipping, sorting, walls, floors)

- **Collisions:**
  - foot colliders for the player, every NPC, customer and crowd member (circle vs circle, plus the existing boxes);
  - counters and tables get boxes.
- **Clear lanes:** NPCs step aside out of the player's path (a short sidestep, then they resume). Crowds get "keep-clear" lanes along roads and doorways.
- **Staged scenes:** no overlapping marks. A spacing pass over every `place()` in the opening, Day 1 and Day 2, plus a runtime check that nudges overlapping actors.
- **Camera:**
  - a raycast from camera to player, so any building in between goes see-through;
  - fix the office void (finish the walls, add a back room or window wall);
  - close-up camera collision.
- **Walls:**
  - new textures: old brick, plaster with cracks and moss, wooden panels, tiled kitchen;
  - baseboards, window frames and contact shadows where walls meet the ground;
  - applied to the town, the office and the flashback set.
- **Floors:**
  - stone street tiles and gutters/kerbs in the town;
  - wooden floor in the shop and Grandma's room;
  - tiles in the kitchen;
  - a textured office carpet.
- Move the lantern pole off the FOR LEASE sign.

## Phase C: Art pass (palette, greenery, props, lighting, characters)

- **Palette file:** `src/palette.js` with cream, terracotta, jade, sky and lantern-red ramps. Every file imports it, and a lint test fails on stray hex colours outside it (food excepted).
- **Greenery:** potted plants on every doorstep, bamboo clumps, bougainvillea and camellia on walls, moss, laundry lines, and trees along the streets.
- **Props:** benches, crates, bikes, stalls and signs, filling the plaza, the flashback set and the office.
- **Lighting:**
  - time-of-day tints for morning gold, noon, evening orange and night blue (lanterns glow and faces stay readable);
  - soft blob shadows under every prop.
- **Ambient life:** lanterns swing, signs creak (sound plus rotation), leaves sway, steam rises, birds hop. Partly there already; finish it.
- **Characters:** per the decision in question 1. All five body emotions, with the walk and idle reworked.

## Phase D: Cooking (Good Pizza, Great Pizza loop for cross-bridge noodles)

- **Customer:**
  - walks to the counter (animated), with a speech bubble;
  - orders range from clear to vague ("Something like my mother's kitchen", "I'm sad today, make it warm");
  - Okay / What? stays.
- **Kitchen view:** a big close-up counter, with the ingredients in little bowls around the board. Bowls are drawn larger and get tap and hover feedback.
- **Build:**
  - hold to pour, with a fill line and steam (exists, polish);
  - the raw-first order: meat, then quail egg, then veg, then noodles last;
  - **new:** bean sprouts, mushrooms as their own item, a splash and bounce for every drop;
  - **new:** a chopsticks stir, and broth that warms in colour as it cooks.
- **Serve:** slide the bowl across the counter. The customer eats with a reaction, then leaves happy, neutral or sad, with body language.
- **Score:** hearts and coins only, no receipt text.
- **Progression:** coins unlock ingredients, bowl styles and shop decorations (plants appear in the shop), plus recipe pages toward Grandpa's secret recipe.
- **Tutorial:** Grandpa's memory, a translucent ghost hand that *does* the first 3 bowls with you, with no text cards.
- **UI:** icons, almost no words, and full-bleed on phone (no letterbox).

## Phase E: Story staging, cutscenes, music

- **Staging:** every scene staged, with moving actors, camera pans and zooms, and environment animation. Lines trimmed per "show, don't tell"; the plot is unchanged.
- **Intro order:** the grey office (desaturated, rain, typing to the chatbot), then the daydream (colour floods back), then the closed shop (dust, one wilted plant), then the arrival "life flip". The long taste section gets shortened and given a real background.
- **Controls:** Enter = next, A = autoplay, Esc = skip, with visible hold points.
- **Music:** composed tracks per scene and time of day (whistle, dizi-style flute, pipa pluck, light drums). With ElevenLabs if you unblock it. Otherwise properly composed melodies played by WebAudio instruments, and I'll tell you which it is.

## Phase F: Polish and full playthrough

- a full scripted playthrough (title → Day 2 → evening → shop night) on desktop and phone, with screenshots, zero console errors and a performance check;
- fix the slow-device time stretch (decouple game time from the frame cap).
