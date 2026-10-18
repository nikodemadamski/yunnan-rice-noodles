# Prior art: people who already reverse-engineered or rebuilt these systems

Instead of reverse-engineering everything ourselves, we study projects that already did it, like [tangosdev/sm64ds-decomp](https://github.com/tangosdev/sm64ds-decomp) did for Super Mario 64 DS.

**Rule:** decompilations are reconstructed Nintendo code, so they're for **studying how systems work, never for copying** into our game. Open-source projects with a permissive licence (MIT etc.) can be reused, crediting them.

All repos below were checked to exist (`git ls-remote`, Oct 2026).

## Talking (dialogue, voices, emotions)

| Project | What it is | Use |
|---|---|---|
| [ACreTeam/ac-decomp](https://github.com/ACreTeam/ac-decomp) | Animal Crossing (GameCube) decompilation; game code 100% matched in 2025 | Study: message box, animalese voice, emotions |
| [zeldaret/af](https://github.com/zeldaret/af) | Animal Forest (N64 original) decompilation | Study |
| [pmret/papermario](https://github.com/pmret/papermario) | Paper Mario (N64) decompilation: famous speech bubbles, text effects | Study: message control codes, bubbles |
| [Acedio/animalese.js](https://github.com/Acedio/animalese.js) | JavaScript animalese voice generator | Candidate for reuse (check licence + samples) |
| [izure1/animalese-tts](https://github.com/izure1/animalese-tts) | Animalese TTS engine (npm, MIT per its listing) | Candidate for reuse |

## Story & cutscenes

| Project | What it is | Use |
|---|---|---|
| [pmret/papermario](https://github.com/pmret/papermario) | EVT scripting: actors, camera, waits, dialogue in one script language | Study |
| [zeldaret/oot](https://github.com/zeldaret/oot) | Ocarina of Time decompilation: cutscene command system | Study |
| [pret/pokeemerald](https://github.com/pret/pokeemerald) | Pokémon Emerald decompilation: event scripts | Study |
| [dialogic-godot/dialogic](https://github.com/dialogic-godot/dialogic) | Godot dialogue/cutscene editor (MIT) | Candidate for the Godot build |
| [nathanhoad/godot_dialogue_manager](https://github.com/nathanhoad/godot_dialogue_manager) | Godot dialogue scripting | Candidate |
| [inkle/ink](https://github.com/inkle/ink) | ink narrative scripting language (80 Days, Heaven's Vault) | Candidate |
| [YarnSpinnerTool/YarnSpinner-Godot](https://github.com/YarnSpinnerTool/YarnSpinner-Godot) | Yarn Spinner for Godot (Night in the Woods, A Short Hike) | Candidate |

## Cooking (Cooking Mama gestures, Papa's stations)

No decompilation of Cooking Mama or open-source clone of Papa's games was found (searched Oct 2026); the closest are open-source cooking games:

| Project | What it is | Use |
|---|---|---|
| [wesely1996/cooking-game](https://github.com/wesely1996/cooking-game) | "Pass the Plate!": Godot 4, gesture mini-games to prepare ingredients | Study / reuse per licence |
| [daltonbr/Undercooked](https://github.com/daltonbr/Undercooked) | Overcooked-style cooking game (Unity): stations, ingredient states, orders | Study / reuse per licence |
| [AkhileshEdd/Cozy-mini-restaurant](https://github.com/AkhileshEdd/Cozy-mini-restaurant) | Cozy 3D restaurant game, Godot 4 | Study / reuse per licence |

## Findings

_Deep-dive notes per project are added below as each investigation finishes._

### Animalese voice libraries (Acedio/animalese.js, izure1/animalese-tts)

**Verdict: keep our own Web Audio synth; borrow three techniques. Don't adopt either library.**

- **animalese.js** (2014, ~60 lines): a 26-slot letter sprite (`animalese.wav`, 0.15 s per letter A–Z), naive resampling for pitch, a fixed 0.075 s per letter, and an optional "shorten words to first + last letter" mode; it renders a whole WAV and plays it through an `<audio>` tag. **Licence:** code MIT, audio **CC BY 4.0** (Josh Simmons), so it's shippable with credit.
- **animalese-tts** (TypeScript, MIT): per-language phoneme analysers (English, Japanese, Korean; **no Chinese**), linear-interpolated resampling with an anti-alias filter, a sentence-level **sine melody + random jitter** on pitch, punctuation pauses that **reset the melody**, and pacing that drops syllables when speech runs ahead. **Its sample WAVs have no stated licence**, so we must not ship them.

**Borrow:**
1. Optional *recorded grain* (our own recording, or the CC BY sprite) pitched with Web Audio `playbackRate` ramps, which also gives us Mandarin tone contours for free; keep the oscillator as fallback.
2. A slow sine melody across a sentence, layered under our per-syllable tone contours.
3. Punctuation (`。，！？.,!?`) inserts a pause and resets the melody.

### Open-source cooking games (cooking-game, Undercooked, Cozy-mini-restaurant)

**Licences decide reuse:** **Undercooked is MIT** (Dalton Lima, 2020; assets made by the author, except the third-party `Assets/3rdParty/Lean/*`), so its scripts can be adapted with the notice kept. **cooking-game and Cozy-mini-restaurant have no licence file**, which means all rights reserved: study the ideas, write our own code.

- **cooking-game ("Pass the Plate!", Godot 4): the cleanest architecture.**
  - The kitchen is a pure-logic core (`core/shift.gd`): the game sends *intents*, calls `tick(delta)` and reads *events*. The same core runs bots, LAN play and unit tests.
  - Recipes are data (`data/packs/*.json`): `{station, inputs, action, work}` for hand-work, `{cook_time, perfect_window, burn_time}` for cooking, plus *assemblies* `{base: "plate", parts: [...]}`.
  - Station state holds progress, done, `since_ready` and burnt. "Perfect" means taking food out inside the window.
  - **Gestures** (`game/kitchen/minigame.gd`): a tap counts on press; a swipe counts every 70 px from an anchor; a circle counts when the accumulated angle reaches 90% of a full turn. Each gesture is one unit of work, and work stays on the item, so you can leave and come back.
  - Orders have patience; `patience < 0` means a tutorial or judge who never leaves. Score = price + tip × patience fraction + perfect bonus, times a combo multiplier.
- **Undercooked (Unity, MIT):**
  - Ingredients go `Raw → Processed → Cooked` with one look per state.
  - Orders are a list of ingredients with a countdown and a 10-second warning; tips are tiered by time left.
  - Chopping is hold-to-chop and keeps its progress when you walk away.
  - The cooking pot has a staged burn timeline (green ✓ → smoke → beeps → black smoke → fire).
  - Its order matching ignores duplicate quantities: a bug to avoid.
- **Cozy-mini-restaurant (Godot 4, tap-only):**
  - Menu and guest *archetypes* are data multipliers (patience, tip, favourite dish, critic).
  - Stations go IDLE → COOKING → READY and **never burn** (cosy).
  - Customers go ARRIVING → THINKING → WAITING → EATING → LEAVING, with a green/yellow/red patience ring and stars from the patience fraction.

**Patterns we'll adopt:**
1. A pure-logic kitchen module (intents in, events out) that we can unit-test.
2. Recipes and bowl *assemblies* in JSON: broth is the base, toppings are parts in order.
3. Ingredient states as separate items (raw slices → cooked in broth), with proper multiset matching.
4. A gesture recogniser that emits work units (tap / swipe / circle / hold), with progress that survives leaving.
5. `cook_time` → `perfect_window` → (optional, gentle) overcook, with staged warnings.
6. An order-ticket model `{dish, patience, maxPatience}`; oldest match served first; tutorials never time out.
7. Pluggable scoring rules (tip by patience, perfect bonus, combo, star thresholds).
8. Customer archetypes as data (Mr Li: patient, small tips, loves chicken-fat broth).

### Paper Mario decomp (pmret/papermario): speech bubbles and cutscene scripts

**No licence file**: reconstructed Nintendo code, ideas only.

- **Message markup:** writers use tags such as `[pause]`, `[wait]`, `[next]`, `[speed]`, `[shake]`, `[wave]`, `[option]`, `[voice]`, compiled to control codes (`include/enums.h`, `tools/build/msg/parse_compile.py`). Bubble styles: speech left/right/centre, sign, postcard, popup…
- **Typewriter** (`src/msg.c` `_update_message`): one state machine per printer, OPENING → PRINTING → WAITING / SCROLLING / CHOICE → CLOSING → DONE. Three speeds: normal, *hold* to go faster, *press* to flush instantly; a per-message "no skip" flag.
- **Voice blips:** two alternating samples (odd/even character code), pitch from the character code plus a per-voice shift, slight random volume, **stereo pan from the bubble's screen x**, silent at pauses. A *speaking* flag switches the NPC between talk and idle animations.
- **Bubble animation** (`src/msg_draw.c`): opens over 6 frames (grows out of the speaker with sin-out easing), closes over 4 frames (shrink + fade); a tail tracks the speaker. Per-glyph effects: shake = 0–1 px random jitter, wave = cosine offset by character index.
- **EVT script engine** (`src/evt/*`, `include/script_api/macros.h`): every command can *block* until done (`Wait`, `SpeakToPlayer`, `NpcMoveTo`, `WaitForCam`). `Thread` runs things side by side; `ChildThread` dies with its parent; camera "shots" are tiny reusable preset scripts.
- A real cutscene (`src/world/area_kmr/kmr_11/scenes.c`): disable input → camera preset → slow pan + wait → NPCs walk side by side on threads → lines → a door opens with a lerp loop → footsteps with growing camera shake → music + jumps on threads → dialogue with camera cuts per speaker → release.

**Takeaways for us:** our `cutscene()`/`beat()`/`walkTo()` async design already mirrors EVT. Next: inline text markup (`[pause]`, `<wave>`, `<shake>`), a bubble that grows out of the speaker, pan by screen position, and a *speaking* flag for talk animations.

### Dialogue tooling for the Godot build

**All four are MIT. Recommendation: [Dialogue Manager](https://github.com/nathanhoad/godot_dialogue_manager).**

| Tool | Fit |
|---|---|
| **Dialogue Manager** (GDScript, Godot 4.6+) | Screenplay format almost identical to our `story.js` lines; `$> await Cutscene.walk(...)` makes the dialogue wait for camera moves and walks; `[#face=sad]` tags per line; Godot-native translation (Chinese + English locales); the tool holds no state (our own `Flags` autoload saves the 22 days). Needs our own Animal Crossing-style bubble scene. |
| Dialogic 2 | Visual editor and a ready speech bubble that points at 3D speakers, but still **alpha**, and it keeps its own state. Runner-up. |
| ink + godot-ink | Best for heavy branching and save state, but needs **C#** (no web export), can't await game events, and has no localisation support. |
| Yarn Spinner for Godot | Strongest localisation, but C# (no web export) and pre-1.0. |

Example of our Day 1 scene in Dialogue Manager format:

```
~ shop_reunion
$> Cutscene.shot("grandma")
Grandma: [#face=happy] Aiyo! It's YOU! The tall foreigner who ate [b]three bowls[/b]!
You: [#face=shock] Grandma Zhao! What happened? Where's Grandpa Zhao?
Grandma: [#face=sad] Gone.[wait=0.6] One morning his apron was on the hook, and he… was gone.
$> await Cutscene.walk("wang", Vector2(-15, 1.5), 3.0)
- I'll fix this. I have the PERFECT recipe. => perfect
- Uh… I have a recipe from an AI? => ai
```

Plan: one `.dialogue` file per day (`day01` … `day22`), a `Cutscene` autoload with the camera / NPC / emote API that `npcs.js` and `ui.js` provide today, and a `Flags` autoload for story state.

### Animal Crossing decomp (ACreTeam/ac-decomp): talking and cutscenes

**Licence:** CC0 for the community's reconstruction, but the design and logic are Nintendo's, so we only study it.

- **Text box** (`include/m_msg.h`, `src/game/m_msg.c`):
  - One window with 8 states (hide, appear, normal, typing, disappear + waits). State changes are *requests* applied at the end of the frame.
  - **Opening:** grows over 18 frames with ease-in/out, then a 20-frame pause before typing.
  - **Typing** (`m_msg_cursol.c_inc`): a letter every other frame; B = fast text. Skipping a page is only allowed where the text says so.
  - **Advancing:** a pulsing arrow; pressing goes to the next page or closes; some messages close by themselves after a set time (`MsgTimeEnd`), which is the same idea as our auto-advance.
  - About 120 control codes inside the text: pause, insert a name or item, choices, colour, size, start/stop music, sound effects, random follow-up messages.
- **Animalese voice** (`m_msg_sound.c_inc`, `m_font_main.c_inc`, `jaudio_NES/game/game64.c_inc`):
  - A 256-entry table maps letters to 26 letter sounds; punctuation is silent.
  - The **next letter is passed too**, so consonant + vowel pairs merge into syllables and long vowels stretch, with a little randomness on repeats. That's why it sounds like babble, not spelling.
  - **Per character:** each villager has a voice id plus a pitch/speed preset from its personality type. Bigger text = louder and higher.
  - **Mood codes in the text** (normal, angry, sad, fun, sleepy, gloomy) shape pitch *over time*: angry = random spikes, sad/sleepy = slow downward drift, fun = bouncy.
  - **Player setting:** full animalese, a simple "bebebe" click, or silent.
- **Reactions** (`ac_npc_talk.c_inc`, `m_demo.h`):
  - The text writes small numbers into a shared table (reaction code, mood + minutes, timed actions like handing over an item).
  - The speaking NPC reads the table each frame, plays an "in → loop" animation from about 43 manga reactions, spawns the icon on a set animation frame, then clears it. The dialogue code never needs to know which character it is.
- **Cutscenes ("demos")** (`src/game/m_demo.c`):
  - One manager; only one scene runs at a time. Actors *request* a scene and a priority rule picks the winner. For talking, the NPC is chosen 60% by facing angle and 40% by distance.
  - **Lifecycle:** wait → ready → run → stop, each type with a start check (the player has turned to face the NPC) and an end check (the window closed). The manager handles the camera and input lock in one place.
  - **Talking** freezes both actors, opens the window, plays a zoom sound and **lowers the music**.
  - **Long scenes are "director" actors** (`ac_intro_demo.c`): a step list of init + per-frame functions that wait on conditions (the train arrived, the player reached a spot, the NPC finished speaking).

**Takeaways for us:**
1. Inline text commands for writers: `{pause:20}`, `{mood:sad}`, `{emote:shock}`, `{choice}`, `{next:id}`.
2. Voice that looks at the *next* letter to merge consonant + vowel into syllables, and mood codes that shape pitch over time (angry spikes, sad drift).
3. Reactions as fire-and-forget signals the speaker picks up.
4. Lower the music while someone talks.
5. Pick who you talk to by facing angle + distance (60/40).
6. Our async `cutscene()` scripts are the web version of AC's director actors, so the design holds.

## Summary: what we'll build next

| From | Feature | Status |
|---|---|---|
| Animal Crossing + Paper Mario | Inline text commands (`{pause}`, `{mood}`, `{emote}`, `<wave>`, `<shake>`) | Next |
| Animal Crossing + animalese-tts | Syllable-merging voice, mood pitch-over-time, sentence melody, punctuation pauses | Next |
| Paper Mario | Bubble grows out of the speaker, sound panned by screen position, talk/idle "speaking" flag | Next |
| Animal Crossing | Duck the music while talking; talk target by facing + distance | Next |
| Pass the Plate! + Undercooked + Cozy + Papa's | Noodle-shop mode: menu/guests as data, pure-logic core (unit-tested), order tickets, timer rings that keep running, perfect window, multiset topping check, cosy patience, Star Customers | **Done** (`prototype/src/shop*.js`) |
| Pass the Plate! | Gesture recogniser (tap / swipe / circle / hold) for prep work | Next |
| Dialogue Manager | Story format for the Godot build | When we move to Godot |
