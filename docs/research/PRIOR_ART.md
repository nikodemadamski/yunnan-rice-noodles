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
