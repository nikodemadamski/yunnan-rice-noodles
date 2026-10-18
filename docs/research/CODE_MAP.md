# How the prototype's code operates

Mapped with two tools:
- **REA** (`npm install --global rea-agents`): `rea analyze-javascript-application prototype --artifact-format directory --format json`, a static, evidence-backed reconstruction (no code executed). Native engines (Hopper/Ghidra/IDA) aren't needed for JavaScript.
- **graphify** (`pip install graphifyy`): `graphify update <folder>` builds a code knowledge graph locally (no LLM needed); then `graphify god-nodes`, `graphify affected "X"`, `graphify query "…"`.

Run both on a copy of `prototype/src` (or point graphify's output elsewhere) so `graphify-out/` doesn't land in the repo.

## Shape (REA)

- 18 JS files parsed, 0 parse failures. Our code: ~450 functions, 13 timers, 31 promises.
- **No import cycles.** `main.js` is the single root; `story.js` and `deliveries.js` hold most async "tasks" (the cutscene scripts).

```
main.js ─┬─ story.js ─┬─ deliveries.js ─┬─ bag.js, peek.js, phone.js, interact.js
         │            ├─ kitchen.js ─── bowllab.js (recipe data)
         │            └─ npcs.js, player.js, world.js
         ├─ ui.js (dialogue, cutscenes, panels) ── player.js, world.js, input.js, audio.js
         └─ world.js ── characters.js ── three
```

## Timing model (REA)

- Gameplay, cutscenes and the kitchen run on the **game's own frame clock** (`addTicker` / `wait` / `beat` in `core.js` and `ui.js`), so pausing in dialogue, **Skip**, and the cooking timers all stay in sync.
- The 13 wall-clock timers (`setTimeout`/`setInterval`) are cosmetic: toasts, bullet comments, the result pop, voice blips, the music loop, plus one short delay before opening the order board (`story.js`). None of them gate story progress.
- Global key listeners in `input.js`, `main.js` and `ui.js` are permanent by design; every temporary listener (kitchen, prologue typing, choices) is removed when its step ends.

## Hubs (graphify)

236 nodes, 905 edges, 6 communities (main, deliveries, audio/bag, kitchen, ui/input, world). Most connected: `sfx()`, `day1()`, `esc()`, `day2()`, `runOrder()`, `stepBroth()`, `evening()`, `beat()`, `openPanel()`/`closePanel()`, `talk()`.

**Blast radius:** `graphify affected "kitchen.js"` shows the kitchen is reached only through `evening()` in `story.js`, so kitchen changes can't break deliveries or Day 1.
