# CLAUDE.md

A browser game about cross-bridge rice noodles (过桥米线) in Kunming. It uses three.js r170 ES modules for the 3D town and canvas 2D for the drawn kitchen and cooking scenes. There is no build step.

## Run
- Serve it: `cd prototype && python3 -m http.server 8765`, then open http://localhost:8765/.
- Jump straight to a scene with a hash:
  - `#opening`, `#opening2` (Dublin only), `#day2`, `#evening`, `#shop` (drawn noodle shop);
  - `#live` (livestream), `#chilli` (Chilli's bowl), `#taste`.
- Unit tests: `node --test prototype/tests/shopcore.test.mjs`.
- Screenshots: `NODE_PATH=/opt/node22/lib/node_modules node prototype/tools/shots.cjs <outdir> [phone]`. Playwright and Chromium are pre-installed; don't run `playwright install`. Convert the PNGs to JPG before committing.

## Working agreement (from the owner's brief, `design/brief_mission.jpg`)
- Work in phases A to F (see `PLAN.md`), one at a time. After each phase:
  - screenshot into `design/after_phaseX/`;
  - compare against `design/ref_*`;
  - keep the console at zero errors;
  - commit;
  - report as DONE (tested), DONE BUT NOT TESTED, NOT DONE / PROBLEMS, and "what to look at";
  - then wait.
- Never claim something works without a screenshot. Never delete working features without asking. Report tool failures exactly.
- Story: `docs/STORY_OUTLINE.md`. Don't change the plot or the beats. Lines may be polished.
- Art: cozy, soft, rounded (Animal Crossing × Kunming). The heroine follows `design/ref_main-character.jpg`; the town follows `design/ref_world-concepts.jpg`. Use only CC0 or permissive assets, and list them in `prototype/assets/CREDITS.md`.

## Code map
`docs/research/CODE_MAP.md` has the map. The key files are:
- `world.js`: the town, lights, sky and colliders;
- `characters.js`: the toon characters;
- `player.js`;
- `story.js` and `opening.js`: the scenes;
- `shop2d.js`, `shopcore.js` and `shopdata.js`: the drawn shop and its rules;
- `cook2d.js`;
- `draw2d.js`: the 2D kit;
- `dressing.js`, `decor.js` and `life.js`: props and ambient life.
