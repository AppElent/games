"""Trains the digit network: `train.py <glyphs.npz> <out.pt> [epochs]`.

Every glyph is bent, thickened, cut and blurred anew each time, then scaled
into 28 x 28 as `glyphImage` in `grid-ink.ts` does.
"""
import sys
import time

import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F

GLYPHS, OUT = sys.argv[1:3]
EPOCHS = int(sys.argv[3]) if len(sys.argv) > 3 else 40
BATCH = 512
DEVICE = "mps" if torch.backends.mps.is_available() else "cpu"
torch.manual_seed(1)

data = np.load(GLYPHS)
X, Y, PRINTED = (torch.from_numpy(data[k]).to(DEVICE) for k in ("x", "y", "pr"))
# How often a source is drawn from, in the order of glyphs.py.
WEIGHTS = torch.tensor([1.6, 1.0, 1.5, 0.6, 1.6, 2.0, 0.8, 1.2])[torch.from_numpy(data["src"]).long()]


def mesh(n):
    c = (torch.arange(n, device=DEVICE) + 0.5) / n * 2 - 1
    return torch.stack(torch.meshgrid(c, c, indexing="ij")[::-1], -1)


MESH64, MESH56 = mesh(64), mesh(56)


def blur(x, sigma):
    r = 4
    t = torch.arange(-r, r + 1, device=DEVICE).float()
    k = torch.exp(-(t**2) / (2 * sigma[:, None] ** 2 + 1e-6))
    k = k / k.sum(1, keepdim=True)
    b, _, h, w = x.shape
    x = x.reshape(1, b, h, w)
    x = F.conv2d(F.pad(x, (r, r, 0, 0)), k[:, None, None, :], groups=b)
    x = F.conv2d(F.pad(x, (0, 0, r, r)), k[:, None, :, None], groups=b)
    return x.reshape(b, 1, h, w)


def samples(index):
    n = len(index)
    x = X[index][:, None].float() / 255

    def u(low, high):
        return torch.rand(n, device=DEVICE) * (high - low) + low

    def wide(v):
        return v[:, None, None, None]

    # Turned, slanted, stretched and bent.
    turn = u(-0.17, 0.17) + (torch.rand(n, device=DEVICE) < 0.1) * u(-0.2, 0.2)
    slant, sx, sy = u(-0.22, 0.22), u(0.75, 1.3), u(0.8, 1.2)
    cos, sin = torch.cos(turn), torch.sin(turn)
    matrix = torch.stack(
        [
            torch.stack([cos * sx, (slant * cos - sin) * sy], -1),
            torch.stack([sin * sx, (slant * sin + cos) * sy], -1),
        ],
        1,
    )
    grid = torch.einsum("bij,hwj->bhwi", matrix, MESH64) * 1.25
    noise = F.interpolate(torch.randn(n, 2, 5, 5, device=DEVICE), 64, mode="bicubic", align_corners=True)
    grid = grid + noise.permute(0, 2, 3, 1) * wide(u(0, 0.05))
    x = F.grid_sample(x, grid, align_corners=False)
    # Thicker or thinner.
    m = torch.rand(n, device=DEVICE)
    thick, thicker = F.max_pool2d(x, 3, 1, 1), F.max_pool2d(x, 5, 1, 2)
    thin = -F.max_pool2d(-x, 3, 1, 1)
    x = torch.where(wide(m < 0.22), thick, x)
    x = torch.where(wide(m < 0.08), thicker, x)
    x = torch.where(wide((m > 0.85) & (thin.amax((1, 2, 3)) > 0.8)), thin, x)
    c = torch.arange(64, device=DEVICE).float()
    # Where a grid line through it was taken out.
    for axis in (2, 3):
        on = torch.rand(n, device=DEVICE) < 0.1
        place = torch.where(torch.rand(n, device=DEVICE) < 0.5, u(8, 20), u(44, 56))
        band = ((c[None] - place[:, None]).abs() < u(0.5, 2.5)[:, None]) & on[:, None]
        x = x * (1 - (band[:, None, :, None] if axis == 2 else band[:, None, None, :]).float())
    # Where a side was cut off.
    on, cut = torch.rand(n, device=DEVICE) < 0.06, u(8, 15)
    side = torch.randint(0, 4, (n,), device=DEVICE)
    for s in range(4):
        band = (c[None] < cut[:, None]) if s % 2 == 0 else (c[None] > 63 - cut[:, None])
        band = band & (on & (side == s))[:, None]
        x = x * (1 - (band[:, None, :, None] if s < 2 else band[:, None, None, :]).float())
    # Out of focus and noisy, then a threshold.
    x = blur(x, torch.where(torch.rand(n, device=DEVICE) < 0.3, u(2, 4.2), u(0.1, 2.2)))
    x = x + F.interpolate(torch.randn(n, 1, 32, 32, device=DEVICE), 64, mode="bilinear") * wide(u(0, 0.12))
    peak = x.amax((1, 2, 3), keepdim=True)
    x = ((x / peak.clamp(min=0.2) - wide(u(0.3, 0.55))) * 14).sigmoid()
    # The ink's box, scaled to 22 of 28 pixels.
    ink = x > 0.5
    ys, xs = ink.any(3)[:, 0], ink.any(2)[:, 0]
    i = torch.arange(64, device=DEVICE)

    def low(v):
        return torch.where(v, i, 99).amin(1).clamp(max=62).float()

    def high(v):
        return torch.where(v, i, -1).amax(1).clamp(min=1).float() + 1

    x0, x1, y0, y1 = low(xs), high(xs), low(ys), high(ys)
    side = torch.maximum(x1 - x0, y1 - y0).clamp(min=4) * 28 / 22
    middle = torch.stack([(x0 + x1) / 64 - 1, (y0 + y1) / 64 - 1], -1)
    grid = MESH56 * wide(side / 64) + middle[:, None, None]
    return F.avg_pool2d(F.grid_sample(x, grid, align_corners=False), 2).clamp(0, 1)


class Net(nn.Module):
    """The same layers as `digit-net.ts`."""

    def __init__(self):
        super().__init__()
        self.c1 = nn.Conv2d(1, 12, 5, padding=2)
        self.c2 = nn.Conv2d(12, 24, 3, padding=1)
        self.c3 = nn.Conv2d(24, 40, 3, padding=1)
        self.f1 = nn.Linear(40 * 9, 56)
        self.f2 = nn.Linear(56, 11)
        self.drop = nn.Dropout(0.25)

    def forward(self, x):
        x = F.max_pool2d(F.relu(self.c1(x)), 2)
        x = F.max_pool2d(F.relu(self.c2(x)), 2)
        x = F.max_pool2d(F.relu(self.c3(x)), 2)
        return self.f2(self.drop(F.relu(self.f1(self.drop(x.flatten(1))))))


net = Net().to(DEVICE)
steps = len(X) // BATCH
optimizer = torch.optim.AdamW(net.parameters(), lr=2e-3, weight_decay=1e-3)
schedule = torch.optim.lr_scheduler.OneCycleLR(optimizer, 3e-3, total_steps=steps * EPOCHS)
started = time.time()
for epoch in range(EPOCHS):
    order = torch.multinomial(WEIGHTS, steps * BATCH, replacement=True)
    total = 0.0
    for step in range(steps):
        index = order[step * BATCH : (step + 1) * BATCH].to(DEVICE)
        out, printed = net(samples(index)), PRINTED[index]
        loss = F.cross_entropy(out[:, :10], Y[index], label_smoothing=0.03)
        known = printed >= 0
        loss = loss + 0.15 * F.binary_cross_entropy_with_logits(out[:, 10][known], printed[known].float())
        optimizer.zero_grad()
        loss.backward()
        optimizer.step()
        schedule.step()
        total += loss.item() if step % 20 == 0 else 0
    print(epoch, round(total / (steps / 20), 4), f"{time.time() - started:.0f}s", flush=True)
torch.save(net.state_dict(), OUT)
