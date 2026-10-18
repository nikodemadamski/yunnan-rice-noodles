# Crossing the Bridge: playable prototype (Day 1–2)

A browser prototype to answer one question: **are deliveries fun?**

## Play

The game uses ES modules, so it needs to be served (opening `index.html` directly from disk won't work):

```bash
cd prototype
python3 -m http.server 8000
# open http://localhost:8000
```

Shortcuts: `?start=day2` or `#day2` (skip to the delivery day), `?start=evening` or `#evening` (jump to grandma's Bowl Lab), `?name=Niko` (set the rider's name).

**Controls:** WASD / arrow keys to move or steer · E / Space / Enter to interact · O to open the Duck app. On a phone: on-screen joystick + yellow button.

**Cutscenes:** story moments play by themselves, with cinematic bars, a camera that frames each conversation, and lines that advance after a reading pause. A tap / E / Space jumps a line ahead (never required); **Skip ⏭** (or Esc) fast-forwards to the next choice or the end of the scene. Only choices wait for you.

## What's in it

| Story / design beat | Where |
|---|---|
| Prologue: typing prompts in Dublin, "PERMANENTLY CLOSED", boss chat (you name yourself), the AI's "perfect recipe" | `src/phone.js` |
| Day 1: Old Zhao's shuttered shop, Grandma, Old Wang's livestream, the public AI-bowl disaster, Little Chilli's plain bowl at night, the sign promise | `src/story.js` |
| Day 2: Little Yellow Duck sign-up, order board with Goggle-translated notes | `src/story.js`, `src/phone.js` |
| Deliveries: pick-up → bag-packing puzzle → ride (heat + slosh) → a twist at the drop-off | `src/deliveries.js`, `src/bag.js` |
| Twists: red-hat crowd search, stealth surprise (vision cone), lonely Mr Li (stay or go), quick-run montage | `src/deliveries.js` |
| Plankton scheme: sneak a look at Auntie Fu's secret jar | `src/peek.js` |
| Evening kitchen (Cooking Mama / Papa's style): simmer & skim the broth, slice on the lines, pour the oil layer, build the bowl in the legend's order before it cools, then a score ticket + grandma's verdict on the recipe | `src/kitchen.js` |
| Day 1's AI-recipe disaster (auto-plays) and the recipe data / verdicts | `src/bowllab.js` |
| God of Cookery "food reveal" moments, livestream bullet comments, emotes, barks | `src/ui.js` |
| Animalese-style voices with Mandarin tone contours, SFX, pentatonic music (all synthesised) | `src/audio.js` |
| Kunming neighbourhood: Green Lake (gulls, duck tree), market, plaza aunties, courtyard, stalls, Wang's neon | `src/world.js` |

## Tech

Plain JavaScript modules + [three.js](https://threejs.org) r170 (vendored in `vendor/`, MIT licence). No build step. All art is generated from simple shapes and canvas drawings; all audio is synthesised with the Web Audio API.

The real game is still planned for Godot 4 (see `docs/GAME_DESIGN_BRAINSTORM.md`); this prototype is for testing the feel of the loop quickly.
