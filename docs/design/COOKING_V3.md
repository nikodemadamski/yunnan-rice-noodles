# Cooking v3: read the guest, cook with your hands

Player feedback on v1 (step-by-step bowl) and v2 (Papa's tabs + ticket recipes):
"now you do this, now you do this… no freedom, no thinking, no reason. No fun."
v2 gave freedom of *when*, but the tickets were still a recipe to copy, and every
action was a tap. So v3 changes *what* you think about and *how it feels*.

## What we learned from the games people love

| Game | What makes it good | What we take |
|---|---|---|
| Good Pizza, Great Pizza | Customers say what they want in their own words ("something that looks like a sunny day"). You interpret, build freely, and their reaction teaches you. | **Orders are people, not recipes.** Tickets show the guest's words, not a parts list. |
| Cooking Mama | Every action is the real motion (pour, stir, drag), with instant feedback. | **Hands do the work.** Hold to pour broth to the line; drag toppings into the bowl. |
| Papa's series | Overlapping orders, timers that keep running, per-station scores. | Kept: tabs, two baskets, patience, tips, stars. |
| Venba / Unpacking | The mechanic *is* the story (memory, family, food). | **The legend is the rule.** Broth cools from the pour; the chicken-fat layer (the Day 2 finding from Mr Li) keeps it hot. Raw slices go in before the noodles so the broth cooks them. |

## The loop

1. ORDER: tap a guest; they *say* what they need ("Exam in an hour. WAKE ME UP!").
2. STOVE: drop noodles, lift them in the green.
3. BUILD: hold a jug to pour to the line, tap the fat jar to seal the heat, drag
   toppings in (raw first, noodles after), serve.
4. The guest reacts to each thing they noticed (✓ two eggs · ✗ green stuff!).
   That is how you learn what "light", "home" or "wake me up" means.

Score = wait 15% · noodles 15% · heat 15% · what they asked for 40% · craft
(fill line, raw-before-noodles) 15%.

## v4: drawn, like Good Pizza, Great Pizza (shop2d.js)

The player shared Good Pizza, Great Pizza and Papa's screenshots: "that's how
communication and cooking is meant to look". So the shop is now a fully drawn
2D scene on the same rules:

- **Look:** flat top-down kitchen, rose/cream checker floor, soft maroon ink,
  paper grain, Patrick Hand lettering with a maroon outline, a cartoon glove.
- **Talk:** the customer walks up to the counter, speaks in a bubble, and you
  answer **Okay** or **What?** (they rephrase with a hint). Their reaction comes
  back to the counter after you serve.
- **Panels:** Order / Stove / Build, slide between them with tabs or a swipe.
- **Hands:** drag noodle coils into baskets (segmented timer bars), hold the
  broth pot to ladle to the gold line, tap the chicken oil, drag saucers from a
  tray grid and drop them where you like; raw slices visibly cook on scalding
  broth (pink → pale), but not on cold. Steam shows only without the oil seal.
- **Caption bar:** a cream strip at the bottom that always says what's next,
  or the selected customer's words.
