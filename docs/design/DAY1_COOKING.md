# Day 1 cooking: "PromptPal Live" and Little Chilli's bowl

Research: Venba (recipe = a damaged letter from Mum; deduction feels like remembering; gentle failure), Cooking Mama (one physical verb per step, < 10 s, generous input, Mama demonstrates then you copy), Unpacking / A Little to the Left (objects and sound tell the story; restraint), God of Cookery / Food Wars (the plainest dish gets the biggest staging, via contrast).

## (a) PromptPal Live: the comedic disaster
Phone chat on the left (PromptPal's steps), the kitchen in the centre, Wang's stream overlay on top, Grandma's face in a corner.
**The core joke: every absurd step you execute well gets a gold "PERFECT!".** You succeed exactly at the wrong thing.

| # | PromptPal says | Gesture | Escalation |
|---|---|---|---|
| 1 | "Unwrap 1 premium stock cube 🧊" | Drag cube → pot | Comments: "就这？" · Grandma 😐 |
| 2 | "Stir clockwise 20× to activate umami 🙂" | Circle-stir | At 20: "Great! 20 more." |
| 3 | "Fusion is the future: grate 200 g cheddar" | Scrub back and forth | The cheese pile overflows the frame |
| 4 | "Aerate the noodles: pour from height" | Pour (drag down) | Splash on Wang's lens |
| 5 | "Luxury tier: apply gold leaf gently" | Taps | A leaf sticks to your face. "金人" |
| 6 | "Finish: insert sparkler, then strike to light ✨" | Fast swipe | Hit-stop → finale |

- An "Are you sure?" button makes PromptPal double down ("97% confident 🙂") and the step gets *bigger*.
- Comments scale with your energy: faster gestures mean denser comments and hearts.
- **Finale:** fizz, crust, foam, a smoke alarm; slow push-in on Grandma's five faces; freeze → red **VIRAL** stamp, the viewer count jumps to 2.3M; hard cut to silence.

## (b) Little Chilli's bowl: quiet restraint
Night, warm stall glow, **no timer, no score, no music**. Chilli's hands demonstrate each step once; you copy.
1. **Warm the bowl:** hold 3 s; frost fades to steam. "Cold bowl, cold soup."
2. **Ladle slowly:** a slow drag from pot to bowl. Too fast → ripple and spill; her hand settles over yours: "慢。" (Slow.)
3. **One shine of oil:** one hold = one drop. **Temptation:** the jar keeps glowing, a chilli jar slides in, your dying phone buzzes "Add gold leaf? 🙂". **The right move is to do nothing**; after 3 s of stillness: "…Good." The phone dies. Adding more → greasy; she sighs, wipes, and you redo it (no fail state).
4. **A few chives:** each pinch drops 3–5 pieces; at most 7 is right. More, and she silently lifts the extras off.
5. **Hands off:** "Lift your hands." Then swipe up to slurp.

**Reveal:** freeze on the slurp; light beams; the steam draws a stone bridge; a sepia silhouette flashback of young Chilli on a kerb and Grandpa setting down this exact bowl: "Less, Little Chilli. Always less." Cut back: "…Eat. Don't talk."
**Hidden key:** save the player's restraint (warm, slow, one drop, ≤ 7 chives, waited). The Day 22 bowl asks for the same gestures.

## Gestures (Pointer Events, canvas units 560×340, EMA velocity α≈0.3)
| Gesture | Rule | Feedback |
|---|---|---|
| Tap | < 250 ms, moved < 12 px, radius + 16 px | pop, 6 particles, 1.08× bounce |
| Hold | ≥ N s, moved < 20 px; ring fills | rising hum, steam puff |
| Drag-to-target | release within radius + 24 px → snap, else ease back | tick, splash, 80 ms hit-stop |
| Circle-stir | sum signed Δatan2 around centre; radius 0.35–1.3 R; ignore jumps > 1 rad | swirl trail, pitch rises per lap |
| Scrub | axis reversals ≥ 25 px apart, each < 300 ms | rasp, shreds falling, 2 px shake |
| Swipe/strike | ≥ 80 px in < 250 ms, ±30° of target direction | whoosh, sparks, 100 ms hit-stop |
| Pour | drag down ≥ 150 px | glug, stream particles, rising level |
| Sprinkle | each tap spawns 3–5 pieces ±20 px | soft patter |
| Slow-drag | EMA speed < 220 px/s (160 after correction) | calm water; over: slosh + hand |
| Stillness | no pointer for 3 s while temptations show | ambience swells → "…Good." |

Juice: hit-stop 50–100 ms on impacts only; screen shake only in the comedy scene, never in Chilli's; small particle counts; camera locked in (b).

Sources: [Venba: Xbox Wire](https://news.xbox.com/en-us/2023/07/19/venba-interview/) · [Shacknews](https://shacknews.com/article/134708/venba-preview-gdc-2023) · [Cooking Mama: StrategyWiki](https://strategywiki.org/wiki/Cooking_Mama) · [Unpacking sound (NME)](https://www.nme.com/news/unpacking-features-over-14000-sound-effect-files-3087521) · [$1 Recognizer](https://depts.washington.edu/acelab/proj/dollar/index.html) · [Juice (AAAI)](https://ojs.aaai.org/index.php/AIIDE/article/download/18889/18654/22655)

## Implementation (3D, current)
Both scenes now run on the 3D kitchen counter shared with Grandma's evening bowl
(`prototype/src/kitchen3d.js` engine, `prototype/src/day1cook3d.js` scenes):
- PromptPal Live: Grandma and Old Wang watch from behind the counter; the
  PromptPal chat, LIVE badge, viewer count and flying comments are DOM overlays;
  every step is a direct 3D gesture (drag the cube, stir round the pot, scrub
  to grate, drag the noodles down, tap gold leaves, swipe the sparkler). The
  finale cuts to Grandma's face, then VIRAL.
- Little Chilli's bowl: night, Chilli behind the counter; frost on the bowl,
  a ladle that spills if you rush, one drop of oil with real temptations (a
  glowing jar, a chilli jar sliding in, the phone buzzing), chives, hands off,
  slurp, then her sepia memory of Grandpa Zhao on the opening's memory set.
