# Scan bench

Measures what the Sudoku scan reads, on photos with every digit labelled by hand
([photos](photos/README.md)). `bench.mjs` compiles the app's own scan engine for the
Mac and runs the app's `readGrid` on every photo, so it needs macOS with Xcode.

```bash
node apps/mobile/scripts/scan-bench/bench.mjs            # from the labelled corners
node apps/mobile/scripts/scan-bench/bench.mjs --detect   # from the corners the app finds
node apps/mobile/scripts/scan-bench/bench.mjs --cells    # and every wrong cell
node apps/mobile/scripts/scan-bench/bench.mjs --turns    # and each photo turned 90°, 180°, 270°
node apps/mobile/scripts/scan-bench/bench.mjs --killer   # a Killer's cages and sums
```

`--turns` turns each photo with Core Graphics, hands the scan its corners in the order
the turned photo shows them, and checks that `readGrid` and, on a Killer, `readKiller`
turn the grid back upright. The upright photo is redrawn the same way, so every turn
reads the same pixels.

`--killer` runs `readKiller` on every photo labelled with cages and counts the sums
missing or wrong, the cages split by a line read where there is none, the cages
merged by a line missed, and the lines marked unsure. With `--cells` it also lists
them and draws the cages read. It takes `--detect` too.

`--only id,…` limits the photos, `--photos folder` takes another set, `--json file`
writes the rows. A cell is right when its digit (or its notes) is. "Type right" also
asks for given or handwritten. "Wrong, unflagged" is a wrong digit the verify step
does not mark for a check; "Right, flagged" is a right one it does.

`web-bench.mjs` runs the web's `recognizeGrid` on the same photos, in Playwright's
Chromium, from the labelled corners. It runs on Linux too. Tesseract's files come
from `node_modules`, and its English data from the `@tesseract.js-data/eng` package:

```bash
npm pack @tesseract.js-data/eng && tar xzf tesseract.js-data-eng-*.tgz
node apps/mobile/scripts/scan-bench/web-bench.mjs --tessdata package [--cells]
```

Run it before and after a change to the scan. Clean prints stay at 100%, and no empty
cell may read as a digit.

## Results

Cells right of cells filled, from the labelled corners:

| Photos                | Before APP-555 | Target  | APP-555 |
| --------------------- | -------------- | ------- | ------- |
| Clean                 | 130/130        | 130/130 | 130/130 |
| Curled                | 141/148        | 145/148 | 146/148 |
| Handwritten           | 271/375        | 345/375 | 370/375 |
| Empty read as a digit | 0              | 0       | 0       |

From the corners the app finds (`--detect`), before → APP-555:

| Photos      | Right             | Wrong, unflagged | Right, flagged | Empty read as a digit | Empty read as notes |
| ----------- | ----------------- | ---------------- | -------------- | --------------------- | ------------------- |
| Clean       | 130/130 → 130/130 | 0 → 0            | 0 → 0          | 0 → 0                 | 0 → 0               |
| Curled      | 134/148 → 146/148 | 2 → 0            | 0 → 3          | 3 → 0                 | 0 → 1               |
| Handwritten | 111/296 → 137/296 | 22 → 0           | 3 → 5          | 0 → 0                 | 0 → 0               |
| Total       | 375/574 → 413/574 | 24 → 0           | 3 → 8          | 3 → 0                 | 0 → 1               |

The web, from the labelled corners, before → after APP-869. Before, the web read
with tesseract alone; after, it reads with the phone's core reader and the digit
network, and asks tesseract only for notes and for digits the network is unsure of.
This includes `handwritten-killer`, added in APP-869 (18/79 → 70/79); the phone
tables above were measured before it was added:

| Photos      | Right             | Wrong, unflagged | Right, flagged | Empty read as a digit | Empty read as notes |
| ----------- | ----------------- | ---------------- | -------------- | --------------------- | ------------------- |
| Clean       | 100/130 → 130/130 | 0 → 0            | 5 → 0          | 0 → 0                 | 0 → 0               |
| Curled      | 109/148 → 146/148 | 1 → 0            | 2 → 0          | 0 → 0                 | 1 → 1               |
| Handwritten | 170/454 → 437/454 | 11 → 1           | 33 → 36        | 0 → 0                 | 0 → 0               |
| Total       | 379/732 → 713/732 | 12 → 1           | 40 → 36        | 0 → 0                 | 1 → 1               |

From the corners the app finds, before → after APP-691, with `handwritten-killer`.
Before, `detectGrid` looked only at the photo with its edges stretched, and found a
wrong rectangle on `handwritten-2002` and `handwritten-2003`. Vision did find their
grid in the photo as it is, so it now looks at both and keeps the largest rectangle:

| Photos      | Right             | Type right | Wrong, unflagged | Right, flagged | Empty read as a digit | Empty read as notes |
| ----------- | ----------------- | ---------- | ---------------- | -------------- | --------------------- | ------------------- |
| Clean       | 130/130 → 130/130 | 130 → 130  | 0 → 0            | 0 → 0          | 0 → 0                 | 0 → 0               |
| Curled      | 146/148 → 146/148 | 146 → 144  | 0 → 0            | 3 → 2          | 0 → 0                 | 1 → 1               |
| Handwritten | 211/375 → 369/375 | 204 → 361  | 0 → 0            | 19 → 19        | 0 → 0                 | 0 → 0               |
| Total       | 487/653 → 645/653 | 480 → 635  | 0 → 0            | 22 → 21        | 0 → 0                 | 1 → 1               |

With `--turns` (APP-902), from the labelled corners: all 60 turned and upright photos
are read upright, and every turn reads the same number of cells right as the upright
photo (2868/2928 in all, 717/732 a turn). `readKiller` finds `handwritten-killer` a
Killer at every turn and reads the same cages and sums each time. From the corners the
app finds, all 60 are read upright too.

`--killer` on `handwritten-killer` (33 cages), before → after APP-958. Vision reads a
digit better or worse by what else is in its request: a sum digit it is unsure of
is now read a second time among digits it read surely. A cage without a printed
sum is joined to its neighbour across its weakest unsure line, ink much taller or
wider than a sum digit (a handwritten digit in the corner) no longer counts as a
sum, a small 0 is told by its ink before it is grown, and a sum its cells cannot
make (the 1 left of 16 when the 6 touches a pen stroke) is left for the player:

| Corners  | Sums missing | Sums wrong | Cages split | Cages merged | Lines unsure |
| -------- | ------------ | ---------- | ----------- | ------------ | ------------ |
| Labelled | 1 → 1        | 1 → 0      | 2 → 0       | 0 → 0        | 20 → 20      |
| Detected | 4 → 1        | 1 → 0      | 2 → 0       | 0 → 0        | 22 → 22      |

Vision finds no grid on `handwritten-newspaper` in either look; the player places
those corners. `sudoku-scan-doubt.ts` (core) flags every cell of a read from a wrong
rectangle. It sees a wrong rectangle only where a line between the boxes is
missing, only the box lines are there, or the corners move three cells; a rectangle
exactly one row off can pass it. A right grid with such a line missing is flagged too.

Its rules were chosen on this set and on the other 391 photos of the Sudoku Dataset
that its labels fit (`images` and `mixed`, with `--detect`; the dataset is not in this
repo). There, right cells went from 9515 to 18366 of 20804 and unflagged wrong digits
from 321 to 88, and the guard flagged no photo of which 60% or more was read right. On
the 197 prints among them unflagged wrong digits rose from 25 to 34, while right cells
rose from 1304 to 4526 of 5414.

The digit network ([train](train/README.md)) saw none of these photos. The line tracing
was debugged on some of them, so a photo from elsewhere is the better test of it.
