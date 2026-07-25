#!/usr/bin/env python3
"""Generate the press-room textures: paper stock grain, halftone dot screens and a
guilloche security tint. Pure stdlib (zlib + struct) so the build stays dependency-free.
Run:  python3 gen_textures.py   ->  ../assets/tex/*.png
"""
import math, os, random, struct, zlib

OUT = os.path.join(os.path.dirname(__file__), "..", "assets", "tex")
os.makedirs(OUT, exist_ok=True)


def write_png(name, w, h, rows_rgba):
    """rows_rgba: list of h rows, each a bytearray of w*4 (RGBA)."""
    raw = b"".join(b"\x00" + bytes(r) for r in rows_rgba)
    def chunk(tag, data):
        c = struct.pack(">I", len(data)) + tag + data
        return c + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
    png = (b"\x89PNG\r\n\x1a\n"
           + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0))
           + chunk(b"IDAT", zlib.compress(raw, 9))
           + chunk(b"IEND", b""))
    path = os.path.join(OUT, name)
    open(path, "wb").write(png)
    print("  %-22s %5dx%-5d %7d bytes" % (name, w, h, len(png)))


def clamp8(v):
    return max(0, min(255, int(v)))


# --- 1) Paper stock: fibrous grain, tileable ------------------------------
def paper(name="paper_grain.png", size=256, seed=11):
    rnd = random.Random(seed)
    # low-frequency blotch field (value noise, tileable via trig)
    rows = []
    fib = [[0.0] * size for _ in range(size)]
    # scatter short fibres
    for _ in range(size * 12):
        x0, y0 = rnd.randrange(size), rnd.randrange(size)
        ang = rnd.uniform(0, math.tau)
        ln = rnd.randint(3, 14)
        val = rnd.uniform(-1.0, 1.0)
        for t in range(ln):
            x = int(x0 + math.cos(ang) * t) % size
            y = int(y0 + math.sin(ang) * t) % size
            fib[y][x] += val
    for y in range(size):
        row = bytearray()
        for x in range(size):
            # tileable soft mottling
            u, v = x / size * math.tau, y / size * math.tau
            blotch = (math.sin(u * 2) * math.cos(v * 3)
                      + math.sin(u * 5 + 1.3) * math.cos(v * 2 - 0.7) * 0.6)
            n = blotch * 3.0 + fib[y][x] * 2.2 + rnd.uniform(-3.0, 3.0)
            # dark speckles = ink flecks in recycled stock
            a = clamp8(12 + abs(n) * 3.5)
            row += bytes((0, 0, 0, a if n < 0 else clamp8(a * 0.35)))
        rows.append(row)
    write_png(name, size, size, rows)


# --- 2) Halftone dot screen ----------------------------------------------
def halftone(name="halftone.png", size=64, pitch=8, angle=15.0, radius=2.05):
    rows = [bytearray() for _ in range(size)]
    ca, sa = math.cos(math.radians(angle)), math.sin(math.radians(angle))
    for y in range(size):
        for x in range(size):
            # rotated dot lattice
            rx = x * ca - y * sa
            ry = x * sa + y * ca
            dx = (rx % pitch) - pitch / 2
            dy = (ry % pitch) - pitch / 2
            d = math.hypot(dx, dy)
            a = 255 if d < radius else (140 if d < radius + 0.7 else 0)
            rows[y] += bytes((0, 0, 0, a))
    write_png(name, size, size, rows)


# --- 3) Guilloche security tint (the rosette on a ballot / certificate) ---
def guilloche(name="guilloche.png", size=256, seed=5):
    grid = [[0.0] * size for _ in range(size)]
    cx = cy = size / 2.0
    # spirograph family — several interfering rosettes
    for R, r, d, turns in ((88, 21, 46, 42), (74, 13, 58, 38), (96, 31, 30, 30)):
        steps = turns * 720
        for i in range(steps):
            t = i / 720.0 * math.tau
            k = (R - r) / r
            x = (R - r) * math.cos(t) + d * math.cos(k * t)
            y = (R - r) * math.sin(t) - d * math.sin(k * t)
            px, py = int(cx + x), int(cy + y)
            if 0 <= px < size and 0 <= py < size:
                grid[py][px] = min(1.0, grid[py][px] + 0.55)
    rows = []
    for y in range(size):
        row = bytearray()
        for x in range(size):
            row += bytes((0, 0, 0, clamp8(grid[y][x] * 90)))
        rows.append(row)
    write_png(name, size, size, rows)


# --- 4) Ink-bleed edge mask for rubber stamps ----------------------------
def stamp_noise(name="stamp_noise.png", size=128, seed=23):
    rnd = random.Random(seed)
    rows = []
    for y in range(size):
        row = bytearray()
        for x in range(size):
            u, v = x / size * math.tau, y / size * math.tau
            n = (math.sin(u * 7 + 0.4) * math.cos(v * 6 - 1.1)
                 + math.sin(u * 13 - 2.0) * math.cos(v * 11 + 0.3) * 0.7)
            # patchy holes where the stamp didn't take ink
            hole = 255 if (n + rnd.uniform(-0.9, 0.9)) > 0.35 else 0
            row += bytes((0, 0, 0, hole))
        rows.append(row)
    write_png(name, size, size, rows)


print("generating press textures…")
paper()
halftone()
halftone("halftone_coarse.png", size=64, pitch=12, angle=45.0, radius=3.2)
guilloche()
stamp_noise()
print("done.")
