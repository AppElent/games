# Digit network training

Makes `src/features/sudoku/scan/digit-net-weights.ts`, the weights of the network in
`digit-net.ts` that reads handwriting. No sudoku photos go into it.

| Data                                                                                                        | Source                               | Licence            |
| ----------------------------------------------------------------------------------------------------------- | ------------------------------------ | ------------------ |
| [Pen-Based Recognition of Handwritten Digits](https://archive.ics.uci.edu/dataset/81) (`pendigits-orig`)    | E. Alpaydin, F. Alimoglu             | CC BY 4.0          |
| [Optical Recognition of Handwritten Digits](https://archive.ics.uci.edu/dataset/80) (`optdigits-orig`)      | E. Alpaydin, C. Kaynak               | CC BY 4.0          |
| [Semeion Handwritten Digit](https://archive.ics.uci.edu/dataset/178)                                        | Semeion Research Center, Tactile Srl | CC BY 4.0          |
| [EMNIST Digits](https://www.nist.gov/itl/products-and-services/emnist-dataset) (60,000 of the training set) | NIST                                 | US government work |
| [Google Fonts](https://github.com/google/fonts) at `06bfe0d` (`ofl/`, the fonts `fonts.py` lists)           | their designers                      | SIL OFL 1.1        |

Unpack the datasets into `<data>/pen`, `<data>/optical`, `<data>/semeion` and
`<data>/emnist` (its `.Z` files with `uncompress`), outside the repository. Then, with
Python 3.9 and `requirements.txt` installed:

```bash
python -I fonts.py <google/fonts> > fonts.txt
python -I glyphs.py <data> <google/fonts> fonts.txt glyphs.npz
python -I train.py glyphs.npz net.pt
python -I export.py net.pt ../../../src/features/sudoku/scan/digit-net-weights.ts
```

Training takes about three minutes on a Mac Studio and is not repeatable to the bit.
Run `pnpm exec biome check --write` on the weights and the bench on the result before
you keep it.
