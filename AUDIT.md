# AUDIT: Phase A (before)

Screenshots are in [`design/before/`](design/before/): desktop 1280×720, and `phone-*` at 390×844. They were taken with Playwright on headless Chromium, using `prototype/tools/shots.cjs`, `office-shots.cjs` and `town-shots.cjs`.

The browser console had **zero errors** in every capture: title, opening, Dublin office, Day 2, evening, shop, livestream and Chilli's bowl, on both desktop and phone.

**What exists today:**
- a three.js 3D town with toon-shaded characters built from primitive shapes (not sprites);
- drawn 2D canvas scenes for cooking: the shop, the livestream and Chilli's bowl;
- a WebAudio music generator.

**Targets** are the `design/ref_*` images:
- `ref_main-character` and `ref_world-concepts` (your sheets);
- the Good Pizza, Great Pizza screenshots (`ref_gpgp-*`);
- Animal Crossing, Stardew, Cuphead, Child of Light, Cooking Mama, Papa's Sushiria;
- the Ratatouille taste moment.

`design/current_*` are the bug screenshots you sent earlier.

---

## A. Clipping, collision and layering

1. **The player walks through people.** No NPC, crowd member or customer has a collider. The player and NPCs only collide with buildings (`world.js collide()`). Seen in `13-roam-stalls`, where the player overlaps the crowd.
2. **NPCs don't step aside.** NPCs push themselves out of walls but never out of the player's path. Crowds (aunties, stalls) can sit in the walking lane. See `12-roam-plaza` and `13-roam-stalls`.
3. **Characters overlap each other in staged scenes.** In the flashback crowd, two diners share one spot and their heads merge. See `02-intro-a` and `03-intro-b`.
4. **Grandpa's chef hat is cut off by the top of the frame** in the flashback close-ups, and he spends the whole scene with his back to the camera. See `03-intro-b`, `04-intro-c` and `phone-04-intro-c`.
5. **Buildings block the camera at some angles.** In `13b-roam-lake` and `phone-20-roam-lake`, the left third of the screen is a building wall. The cutaway only clips walls *above* 1.5 m, not walls *between* the camera and the player.
6. **The office walls end in an orange void** when the camera rises. See `02b-office-e`, where there is nothing past the office floor.
7. **The street lantern pole and string cover the shop's "转让 · FOR LEASE" sign**, which is the key story prop. See `09-dialogue-day2` and `phone-09…`.
8. **The test camera clips into the heroine's hair** at a 3/4 angle. Close-ups have no collision check. See the turntable note from the last round.

## B. Walls, floors, materials

9. **The flashback set (Kunming, three springs ago) is a flat yellow disc** with plain cartoon boxes for houses: no textures, no doors, nothing on the walls. See `02-intro-a` and `03-intro-b`.
10. **The office walls and floor are flat beige**, with no baseboards, no shadow where wall meets floor, and an empty back wall. See `02b-office-a` and `02b-office-d`.
11. **Town buildings have flat plaster walls.** They have windows and boxes, but no brick, cracks, moss, baseboards or ground shadow. See `11-roam-street` and `13b-roam-lake`.
12. **The pavement is good (cobbles), but the road is a plain flag tile.** Kerbs look like strips, and there is no gutter or moss. See `11-roam-street`.
13. **Interiors don't exist in 3D.** Grandma's kitchen and Old Zhao's shop are only drawn 2D panels. The 3D shop is a closed shutter.

## C. Characters and animation

14. **The characters are not sprites.** They are 3D primitive dolls (capsule body, sphere head, drawn face). This conflicts with your new rule "sprite sheets ONLY". The drawn cooking scenes draw humans with canvas shapes (`draw2d.js person()`), which the brief now forbids. See `16-kitchen-order`, `18-cook-livestream` and `19-cook-chilli`.
15. **Bodies don't act emotions.** Faces swap expressions and small emoji pop up ("?" in `02b-office-d`), but there is no hop, slump, stomp, jump or hand-on-chin. The walk is an arm swing plus a bounce.
16. **All NPCs are one body shape**, with different colours and hats. Stall owners and crowds read as clones. See `13-roam-stalls` and `12-roam-plaza`.
17. **The flashback close-up is too tight on phone.** The heroine's head and the table crowd the frame. See `phone-03-intro-b` and `phone-04-intro-c`.

## D. Empty areas and greenery

18. **The flashback plaza is empty**: no plants, props or sky. See `02-intro-a`.
19. **The plaza has big plain lawn and paving areas.** It needs bamboo, potted plants, laundry lines, camellia and bougainvillea. See `12-roam-plaza`.
20. **The office has one plant and a lot of empty desk and wall.** See `02b-office-a`.
21. **The shop-rules card and the "Day 2" / "Evening" cards sit on a flat dark void.** See `15-shop-rules` and the Day cards in the earlier run.
22. **The taste "soul note" scene is a black void with glowing scribbles** for about 3 minutes in the intro. It's meant to be dreamy, but it reads as a missing background. See `05-intro-d` to `08-intro-g`.

## E. Lighting and colour

23. **There is no real time-of-day tint.** There is only day and night (`setNight`). Morning gold, noon and evening orange don't exist.
24. **The night scene is a heavy blue that crushes faces.** Grandma and the duck helmet go muddy. See `14-evening`.
25. **The office is warm beige, not "grey and desaturated".** The colour-drain/colour-flood contrast you asked for isn't there yet. See `02b-office-a`.
26. **There is no palette file.** Colours are hard-coded hex values spread across about 15 files.

## F. Cooking (vs Good Pizza, Great Pizza)

27. **Already there:**
    - a three-panel kitchen (Order / Stove / Build);
    - an Okay / What? order bubble;
    - hold-to-pour with a fill line;
    - raw-first order rules;
    - drag-and-drop ingredients (mouse and touch);
    - eight ingredients;
    - a heat thermometer;
    - serving and scoring.
28. **Missing:**
    - the chopsticks stir;
    - broth that changes colour as it cooks;
    - a splash and bounce when an ingredient lands (there's a sound, but little motion);
    - sliding the bowl to the customer;
    - the customer eating with a reaction;
    - leaving with body language.
29. **The score is shown as a receipt with text and percentages, not hearts and coins.**
30. **There is no progression:** no coins-to-unlocks, bowl styles, shop decorations (plants) or recipe book.
31. **The tutorial is a rules card of four paragraphs** (`15-shop-rules`). The brief wants Grandpa's memory to *show* it for the first 3 bowls.
32. **The UI is text-heavy:**
    - ingredient names under every tray;
    - a caption bar;
    - a tabs-and-chips HUD.

    See `17-cooking-build`.
33. **On phone, the drawn kitchen is letterboxed** with a pink checker band above and below. See `phone-16…` to `phone-19…`.
34. **Mushrooms (jizong) and tofu skin exist; bean sprouts don't.** Pea shoots stand in for them. Chrysanthemum is the edible flower.

## G. Story staging, music and controls

35. **The intro runs 4+ minutes before the office.** It goes flashback, then taste, then office, and the long taste and soul-note section sits early.
36. **There are no Enter / A / Esc intro controls.** There is a Skip button and a tap-to-continue, but no autoplay toggle and no visible hold points.
37. **The music is a random-note triangle-wave generator.** There is one mood each for day, night and ride. There are no instruments (flute, whistle, drums), no composed tracks, and no per-scene tracks.
38. **There is no time-of-day music.**
39. **On a slow device, game time slows down.** Frame time is capped at 50 ms, so below 20 fps everything plays in slow motion. A 2.2 s "Day 2" card took about 20 s in the test browser. Real phones will usually manage 30–60 fps, but low-end ones will drag.

## H. Tools (Step 0 results)

| Tool | Installed? | Working? | Exact error if not |
|---|---|---|---|
| Superpowers plugin | ✅ `claude plugin install superpowers@claude-plugins-official` | ✅ installed and enabled; it loads in the next session | — |
| frontend-design skill | ✅ `.claude/skills/frontend-design` | ✅ | — |
| awesome-gamedev marketplace | ✅ added | ✅ | — |
| gamedev skills (10 of 74) | ✅ router, threejs-scene-setup, threejs-materials-lighting, threejs-gltf-loading, create-game-assets, audio-design, game-feel, game-ui-ux, dialogue-systems, camera-systems | ✅ | The list has no cozy/sim genre skill and no 2D skill except PixiJS/Phaser, which this repo doesn't use. |
| Playwright + Chromium | ✅ pre-installed at `/opt/pw-browsers` (did **not** run `npx playwright install`; the environment forbids re-downloading) | ✅ 49 screenshots in `design/before/` | — |
| Playwright MCP | ✅ in `.mcp.json` | ✅ the server starts and lists `browser_*` tools; it shows "pending approval" until the next session | — |
| PixelLab MCP | ✅ in `.mcp.json` | ❌ | `CONNECT tunnel failed, response 403` (the network policy blocks `api.pixellab.ai`), **and** `PIXELLAB_KEY` is not set: "Missing environment variables: PIXELLAB_KEY". `get_balance` could not be called. |
| ElevenLabs MCP | ✅ in `.mcp.json` | ❌ | `CONNECT tunnel failed, response 403` (the network policy blocks `api.elevenlabs.io`). Its OAuth sign-in also needs you, in a session that can reach it. |
| CC0 asset sites | — | ❌ | kenney.nl, opengameart.org, itch.io, freesound.org, polyhaven.com, quaternius.com, jsdelivr and unpkg all give 403. **GitHub clones work**, for example KayKit's CC0 character packs. |
