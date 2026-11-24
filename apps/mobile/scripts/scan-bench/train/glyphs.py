"""Makes the training glyphs: `glyphs.py <data folder> <google/fonts checkout> <fonts.txt> <out.npz>`.

Writes 64 x 64 ink images with their label (0 is junk, 1-9 a digit), their
source, and whether they are printed (1), handwritten (0) or neither (-1).
"""
import glob
import gzip
import random
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFont

DATA, FONTS, FONT_LIST, OUT = sys.argv[1:5]
rng = random.Random(7)
SIZE = 64
BODY = 52
PEN, OPTICAL, SEMEION, EMNIST, PRINT, SCRIPT, LETTER, SCRIBBLE = range(8)

images, labels, sources, printed = [], [], [], []


def fit(image):
    """White ink on black, its box scaled to BODY in the middle of SIZE."""
    ys, xs = np.where(np.asarray(image) > 90)
    if len(ys) < 8:
        return None
    image = image.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
    scale = BODY / max(image.size)
    w, h = max(1, round(image.width * scale)), max(1, round(image.height * scale))
    image = image.resize((w, h), Image.LANCZOS if scale < 1 else Image.BICUBIC)
    out = Image.new("L", (SIZE, SIZE))
    out.paste(image, ((SIZE - w) // 2, (SIZE - h) // 2))
    return np.asarray(out)


def add(image, label, source, is_printed):
    if image is None:
        return
    images.append(image)
    labels.append(label)
    sources.append(source)
    printed.append(is_printed)


def draw_strokes(strokes, label, copies=4):
    """Pen strokes at several widths."""
    points = [p for stroke in strokes for p in stroke]
    if not points:
        return
    x0, x1 = min(p[0] for p in points), max(p[0] for p in points)
    y0, y1 = min(p[1] for p in points), max(p[1] for p in points)
    k = 200 / max(x1 - x0, y1 - y0, 1)
    for _ in range(copies):
        w = rng.choice([9, 12, 15, 18, 22, 27, 33])
        image = Image.new("L", (260, 260))
        draw = ImageDraw.Draw(image)
        for stroke in strokes:
            q = [(30 + (x - x0) * k, 30 + (y1 - y) * k) for x, y in stroke]
            if len(q) > 1:
                draw.line(q, fill=255, width=w, joint="curve")
            for x, y in q:
                draw.ellipse([x - w / 2, y - w / 2, x + w / 2, y + w / 2], fill=255)
        add(fit(image), label, PEN, 0)


def pendigits(path):
    strokes, label, stroke = None, None, None
    for line in open(path, errors="ignore"):
        line = line.strip()
        if line.startswith(".SEGMENT DIGIT"):
            if strokes:
                draw_strokes(strokes, label)
            strokes, label = [], int(line.split('"')[1])
        elif line.startswith(".PEN_DOWN"):
            stroke = []
        elif line.startswith(".PEN_UP"):
            if strokes is not None and stroke:
                strokes.append(stroke)
            stroke = None
        elif stroke is not None and line and line[0] in "-0123456789":
            point = line.split()
            if len(point) >= 2:
                stroke.append((int(point[0]), int(point[1])))
    if strokes:
        draw_strokes(strokes, label)


for name in ("tra", "tes"):
    pendigits(f"{DATA}/pen/pendigits-orig.{name}")
print("pendigits", len(images))

for name in ("tra", "cv", "wdep", "windep"):
    rows = []
    for line in open(f"{DATA}/optical/optdigits-orig.{name}").read().split("\n"):
        line = line.strip()
        if len(line) == 32 and set(line) <= {"0", "1"}:
            rows.append(line)
        elif len(rows) == 32 and line.isdigit():
            bitmap = np.array([[255 * int(c) for c in row] for row in rows], np.uint8)
            image = Image.fromarray(bitmap).resize((128, 128), Image.BICUBIC)
            add(fit(image), int(line), OPTICAL, 0)
            rows = []
        else:
            rows = []
print("optdigits", len(images))

for line in open(f"{DATA}/semeion/semeion.data"):
    values = [float(x) for x in line.split()]
    bitmap = (np.array(values[:256]).reshape(16, 16) * 255).astype(np.uint8)
    image = Image.fromarray(bitmap).resize((128, 128), Image.BICUBIC)
    add(fit(image), int(np.argmax(values[256:266])), SEMEION, 0)
print("semeion", len(images))

emnist = f"{DATA}/emnist/gzip/emnist-digits-train"
pixels = gzip.open(f"{emnist}-images-idx3-ubyte.gz").read()
pixels = np.frombuffer(pixels, np.uint8, offset=16).reshape(-1, 28, 28).transpose(0, 2, 1)
digits = np.frombuffer(gzip.open(f"{emnist}-labels-idx1-ubyte.gz").read(), np.uint8, offset=8)
for i in np.random.RandomState(0).permutation(len(digits))[:60000]:
    image = Image.fromarray(pixels[i]).resize((112, 112), Image.BICUBIC)
    add(fit(image), int(digits[i]), EMNIST, 0)
print("emnist", len(images))

for line in open(FONT_LIST):
    kind, path = line.strip().split(" ", 1)
    try:
        font = ImageFont.truetype(f"{FONTS}/{path}", 150)
    except OSError:
        continue
    seen = set()
    for digit in range(10):
        image = Image.new("L", (320, 320))
        try:
            ImageDraw.Draw(image).text((80, 60), str(digit), font=font, fill=255)
        except (OSError, ValueError):
            continue
        glyph = fit(image)
        if glyph is None:
            continue
        if glyph.tobytes() in seen:  # The same box for every missing glyph.
            break
        seen.add(glyph.tobytes())
        for _ in range(3):
            add(glyph, digit, *((PRINT, 1) if kind == "P" else (SCRIPT, -1)))
    if kind == "P":  # Letters that look like no digit.
        for letter in rng.sample("ACDEFHJKMNPQRTUVWXYabdefhkmnprtuwxy&?#%+=*", 3):
            image = Image.new("L", (320, 320))
            ImageDraw.Draw(image).text((80, 60), letter, font=font, fill=255)
            add(fit(image), 0, LETTER, -1)
print("fonts", len(images))

for _ in range(9000):  # Scribbles, lines, crossings, bars, blobs and pairs.
    image = Image.new("L", (260, 260))
    draw = ImageDraw.Draw(image)
    kind = rng.random()
    if kind < 0.35:
        for _ in range(rng.randint(1, 3)):
            q = [(rng.randint(10, 250), rng.randint(10, 250)) for _ in range(rng.randint(3, 6))]
            draw.line(q, fill=255, width=rng.randint(6, 30), joint="curve")
    elif kind < 0.55:
        w, x, y = rng.randint(6, 40), rng.randint(40, 200), rng.randint(40, 200)
        draw.line([(x, 0), (x + rng.randint(-15, 15), 260)], fill=255, width=w)
        draw.line([(0, y), (260, y + rng.randint(-15, 15))], fill=255, width=rng.randint(6, 40))
    elif kind < 0.7:
        draw.rectangle([20, 20, 240, 20 + rng.randint(10, 120)], fill=255)
    elif kind < 0.85:
        for _ in range(rng.randint(4, 14)):
            x, y, r = rng.randint(20, 230), rng.randint(20, 230), rng.randint(4, 40)
            draw.ellipse([x, y, x + r, y + r * rng.uniform(0.4, 1.6)], fill=255)
    else:
        a, b = (Image.fromarray(images[rng.randrange(len(images))]).resize((130, 130)) for _ in range(2))
        image.paste(a, (0, 65))
        image.paste(b, (rng.randint(95, 130), 65 + rng.randint(-40, 40)))
    add(fit(image), 0, SCRIBBLE, -1)

np.savez(
    OUT,
    x=np.stack(images),
    y=np.array(labels, np.int64),
    src=np.array(sources),
    pr=np.array(printed, np.int64),
)
print(len(images), np.bincount(labels))
