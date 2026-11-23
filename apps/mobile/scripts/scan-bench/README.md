# Scan bench

Measures what the Sudoku scan reads, on photos with every digit labelled by hand
([photos](photos/README.md)). It compiles the app's own scan engine for the Mac and
runs the app's `readGrid` on every photo, so it needs macOS with Xcode.

```bash
node apps/mobile/scripts/scan-bench/bench.mjs            # from the labelled corners
node apps/mobile/scripts/scan-bench/bench.mjs --detect   # from the corners the app finds
node apps/mobile/scripts/scan-bench/bench.mjs --cells    # and every wrong cell
```

`--only id,…` limits the photos, `--photos folder` takes another set, `--json file`
writes the rows. A cell is right when its digit (or its notes) is. "Type right" also
asks for given or handwritten. "Wrong, unflagged" is a wrong digit the verify step
does not mark for a check.

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

With `--detect`: clean 130/130 before and after, curled 134/148 to 146/148, handwritten
111/296 to 137/296. Vision's grid detection finds the wrong rectangle on
`handwritten-2002` and `handwritten-2003`, and nothing on `handwritten-newspaper`; the
player places those corners.

The digit network ([train](train/README.md)) saw none of these photos. The line tracing
was debugged on some of them, so a photo from elsewhere is the better test of it.
