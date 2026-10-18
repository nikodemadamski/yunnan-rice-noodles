# Look & feel plan (three.js r170 + Web Audio)

Why it looks flat today: no shadows, no tone mapping, flat Lambert shading, one green ground, instant start/stop movement, a frame-rate-dependent camera, single-layer sounds, emoji art.

Top 10, ranked by impact / effort:
1. **Light & colour:** Neutral/AgX tone mapping, warm low side sun, softer hemisphere fill, exponential fog matched to the sky.
2. **Real shadows following the player:** PCFSoft, 2048 map (1024 on phones), ortho camera ±30, bias −0.0005, normalBias 0.03, snapped to texels; keep a faint blob under feet.
3. **Toon materials + outlines:** `MeshToonMaterial` with a shared 3-step gradient (Nearest filtering); inverted-hull outlines on characters, bike and props (BackSide, ink #3a2a20, ×1.04).
4. **Curved-world "rolling log":** vertex bend `y -= d²·0.0016`.
5. **Movement feel (Swink: response < 100 ms):** exponential accel/decel; squash on start; lean into turns; bike tilt; footstep dust; frame-rate-independent smoothing `1 − e^(−λ·dt)`.
6. **Camera:** lead (1.5 on foot, 4–6 on bike), λ 6 / 4, FOV +4° at speed, trauma² shake, hit-stop 40–60 ms.
7. **Kitchen juice:** squash + particles + floating "+N" + rising-pitch combo sounds per success; PERFECT = flash + small shake + confetti; count-up scores; soft wobble on OOPS.
8. **Replace emoji with drawn art** in one ink colour and line width.
9. **UI springs:** one spring curve `cubic-bezier(.34,1.56,.64,1)`, press-squash buttons, staggered lists.
10. **Bloom on lanterns/neon (desktop), sprite halos on phones; layered sounds + small-room reverb.**

Suggested order: 1 → 2 → 5 → 7, then 3, 4, 6, 9, then 8 and 10.

Sources: [Game feel](https://en.wikipedia.org/wiki/Game_feel) · [Screenshake breakdown](https://dkliao.itch.io/the-art-of-screenshake-recreation/devlog/451576/quick-breakdown-of-all-the-effects) · [Juicing (GDQuest)](https://school.gdquest.com/glossary/juicing) · [A Short Hike](https://blog.playstation.com/2021/08/05/crafting-a-tiny-open-world-a-look-behind-the-scenes-at-the-creation-of-a-short-hike/) · [World bending](https://notslot.com/tutorials/2020/04/world-bending-effect) · [Toon material](https://sbcode.net/threejs/meshtoonmaterial/) · [Directional light shadows](https://sbcode.net/threejs/directional-light-shadow/)
