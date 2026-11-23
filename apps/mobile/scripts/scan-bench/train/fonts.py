"""Lists the fonts to train on from a google/fonts checkout: `fonts.py <checkout>`.

Prints "H <file>" for handwriting and "P <file>" for print, one per line. Run
it on the commit in README.md for the same list.
"""
import glob
import os
import random
import re
import sys

root = sys.argv[1]
random.seed(1)
handwriting, printed = [], []
for path in sorted(glob.glob(os.path.join(root, "ofl/*/METADATA.pb"))):
    meta = os.path.relpath(path, root)
    text = open(path).read()
    if 'subsets: "latin"' not in text:
        continue
    categories = re.findall(r'category: "(\w+)"', text)
    files = re.findall(r'filename: "([^"]+)"', text)
    folder = os.path.dirname(meta)
    if not files:
        continue
    if "HANDWRITING" in categories:
        handwriting.append((folder, files[0]))
    elif categories and categories[0] in ("SANS_SERIF", "SERIF", "MONOSPACE"):
        printed.append((folder, files))
random.shuffle(printed)
for folder, file in handwriting:
    print("H", f"{folder}/{file}")
for folder, files in printed[:260]:
    upright = [f for f in files if "talic" not in f] or files
    for file in upright if len(upright) < 3 else random.sample(upright, 2):
        print("P", f"{folder}/{file}")
