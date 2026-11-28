# Scan photo set

Sudoku photos with every digit labelled by hand, in `labels.json`:

- `kind`: `clean` (flat print), `curled` (bent or folded page) or `handwritten`
  (a print with digits written in).
- `corners`: the grid's four corners in the photo, clockwise from the top-left.
- `printed` and `handwritten`: nine rows of nine cells; `.` is a cell without
  that kind of digit.
- `notes`: pencil marks, by `row,column`.
- `cutOff`: cells the photo's edge cuts through; not measured.
- `unreadable`: cells written over so often that no digit is certain; not
  measured.
- `cages` and `sums`, on a Killer: nine rows of nine letters, one letter per
  cage, and each cage's sum by its first cell (`row,column`). The cages of
  `handwritten-killer` are checked against its solved digits: each adds up to
  its sum.

Every photo is scaled to at most 1600 px (the size the app works on) and
recompressed. `curled-book-page`, `handwritten-2001`, `handwritten-2002`,
`handwritten-2005` and `handwritten-killer` are also turned a quarter.
`handwritten-newspaper` is cut off at three corners, so its corners lie outside
the photo.

| File                                                 | Photo                                                                                             | By                                | Licence                                                         |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------- | --------------------------------- | --------------------------------------------------------------- |
| `clean-print.jpg`                                    | [9x9 sudoku 2022032301](https://commons.wikimedia.org/wiki/File:9x9_sudoku_2022032301.jpg)        | Rosalina450280                    | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) |
| `angled-blue-print.jpg`                              | [SUDOKU (8381070829)](https://commons.wikimedia.org/wiki/File:SUDOKU_(8381070829).jpg)            | inazakira                         | [CC BY-SA 2.0](https://creativecommons.org/licenses/by-sa/2.0/) |
| `curled-book-page.jpg`                               | [Sudoku 22](https://commons.wikimedia.org/wiki/File:Sudoku_22.jpg)                                | Paul Downey                       | [CC BY 2.0](https://creativecommons.org/licenses/by/2.0/)       |
| `handwritten-newspaper.jpg`                          | [Sudoku en periódico](https://commons.wikimedia.org/wiki/File:Sudoku_en_peri%C3%B3dico.jpg)       | Héctor Rodríguez                  | [CC BY 2.0](https://creativecommons.org/licenses/by/2.0/)       |
| `flat-*.jpg`, `curled-1*.jpg`, `handwritten-20*.jpg` | [Sudoku Dataset](https://github.com/wichtounet/sudoku_dataset) (`imageN.jpg` at commit `0db6de0`) | Baptiste Wicht and Jean Hennebert | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)       |
| `handwritten-killer.jpg`                             | A filled-in Killer from a puzzle book, with notes and corrections                                 | The project owner                 | Shared for this bench with the owner's permission (25 Nov 2026) |

`clean-print`, `angled-blue-print` and `curled-book-page` are the three photos
games#96 measured. It reported 36 digits on the first; the print has 41.
