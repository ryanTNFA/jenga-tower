# The MCC Tower

An interactive explainer of the Millennium Challenge Corporation model as a tower of blocks. Pull a block or add one from the bench, see who backs the result and what it costs, and run stress tests. There is no single right MCC, and one tool cannot carry every objective.

- `index.html`: the game, and the site's landing page. Open it in a browser. No build step.
- `play.html`: redirects to `index.html`, so old links and shared builds still work.
- `data.js`: every block and every score. Edit here to change the assumptions.
- `model.js`: the scoring rules.
- `test.js`: checks on the data and the scoring. Run `node test.js`.
- `mcc-tower-thought-piece.md` and `.pdf`: the accompanying note. The PDF is a placeholder until the article is published.

To point the game at the published article, change `ARTICLE` (url and title) near the top of the script in `index.html`. It is the only place the link lives.

All audience, rigor, leverage, weight and strain scores are the author's judgment, not polled positions. Economic rigor is scored as a property of the instrument, not as a group of people.

Jenga is a registered trademark of its owner. This project is an independent policy explainer and is not affiliated with, sponsored by, or endorsed by the owner of Jenga or by Hasbro. The name appears only as a familiar metaphor in the body copy of the note.
