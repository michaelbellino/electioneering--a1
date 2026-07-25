#!/usr/bin/env python3
"""Bake REAL geography for the playable races into data/geo.json.

Sources (both public domain / open):
  * us-atlas TopoJSON (states-10m)            -> state outlines
  * US Census TIGER cartographic boundaries   -> congressional district outlines

Everything is decoded, simplified and normalised to a 0..1 box here at build time,
so the game just draws polygons — no runtime GIS, no dependencies. Pure stdlib.

Run:  python3 bake_geo.py
"""
import io, json, math, os, struct, sys, urllib.request, zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "..", "data")
CACHE = os.path.join(HERE, ".geocache")
os.makedirs(CACHE, exist_ok=True)
UA = {"User-Agent": "Mozilla/5.0"}

STATES_TOPO = "https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json"
CD_CANDIDATES = [
    "https://www2.census.gov/geo/tiger/GENZ2022/shp/cb_2022_us_cd118_20m.zip",
    "https://www2.census.gov/geo/tiger/GENZ2021/shp/cb_2021_us_cd116_20m.zip",
    "https://www2.census.gov/geo/tiger/GENZ2020/shp/cb_2020_us_cd116_20m.zip",
]

FIPS = {
    "AL":"01","AK":"02","AZ":"04","AR":"05","CA":"06","CO":"08","CT":"09","DE":"10","FL":"12","GA":"13",
    "HI":"15","ID":"16","IL":"17","IN":"18","IA":"19","KS":"20","KY":"21","LA":"22","ME":"23","MD":"24",
    "MA":"25","MI":"26","MN":"27","MS":"28","MO":"29","MT":"30","NE":"31","NV":"32","NH":"33","NJ":"34",
    "NM":"35","NY":"36","NC":"37","ND":"38","OH":"39","OK":"40","OR":"41","PA":"42","RI":"44","SC":"45",
    "SD":"46","TN":"47","TX":"48","UT":"49","VT":"50","VA":"51","WA":"53","WV":"54","WI":"55","WY":"56",
}
FIPS_TO_ABBR = {v: k for k, v in FIPS.items()}


def fetch(url, name):
    path = os.path.join(CACHE, name)
    if os.path.exists(path) and os.path.getsize(path) > 1000:
        return open(path, "rb").read()
    print("  downloading", name)
    data = urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=180).read()
    open(path, "wb").write(data)
    return data


# ── TopoJSON ────────────────────────────────────────────────────────────────
def topo_decode_arc(topo, i):
    """Return an arc as absolute lon/lat points (handles ~i for reversed)."""
    rev = i < 0
    if rev:
        i = ~i
    arc = topo["arcs"][i]
    tr = topo.get("transform")
    pts, x, y = [], 0, 0
    for p in arc:
        x += p[0]; y += p[1]
        if tr:
            pts.append((x * tr["scale"][0] + tr["translate"][0],
                        y * tr["scale"][1] + tr["translate"][1]))
        else:
            pts.append((p[0], p[1]))
    return pts[::-1] if rev else pts


def topo_rings(topo, geom):
    """All rings of a geometry as lists of lon/lat points."""
    def ring_of(arcs):
        out = []
        for a in arcs:
            seg = topo_decode_arc(topo, a)
            out.extend(seg if not out else seg[1:])
        return out
    t = geom["type"]
    if t == "Polygon":
        return [ring_of(r) for r in geom["arcs"]]
    if t == "MultiPolygon":
        rings = []
        for poly in geom["arcs"]:
            for r in poly:
                rings.append(ring_of(r))
        return rings
    return []


# ── Shapefile (.shp + .dbf) ─────────────────────────────────────────────────
def read_dbf(buf):
    n_rec, hdr_len, rec_len = struct.unpack("<IHH", buf[4:12])
    fields, pos = [], 32
    while buf[pos] != 0x0D:
        nm = buf[pos:pos + 11].split(b"\0")[0].decode("latin-1")
        ln = buf[pos + 16]
        fields.append((nm, ln))
        pos += 32
    rows = []
    for r in range(n_rec):
        off = hdr_len + r * rec_len + 1
        row, o = {}, off
        for nm, ln in fields:
            row[nm] = buf[o:o + ln].decode("latin-1").strip()
            o += ln
        rows.append(row)
    return rows


def read_shp_polygons(buf):
    """Yield (record_index, [rings]) for polygon records."""
    pos, out, idx = 100, [], 0
    while pos < len(buf):
        if pos + 8 > len(buf):
            break
        _num, clen = struct.unpack(">II", buf[pos:pos + 8])
        content = buf[pos + 8: pos + 8 + clen * 2]
        pos += 8 + clen * 2
        if len(content) < 4:
            idx += 1; continue
        shp_type = struct.unpack("<I", content[0:4])[0]
        if shp_type != 5:                      # 5 = Polygon
            out.append((idx, [])); idx += 1; continue
        n_parts, n_points = struct.unpack("<II", content[36:44])
        parts = struct.unpack("<%dI" % n_parts, content[44:44 + 4 * n_parts])
        pbase = 44 + 4 * n_parts
        pts = []
        for i in range(n_points):
            x, y = struct.unpack("<dd", content[pbase + i * 16: pbase + i * 16 + 16])
            pts.append((x, y))
        rings = []
        for i, start in enumerate(parts):
            end = parts[i + 1] if i + 1 < len(parts) else n_points
            rings.append(pts[start:end])
        out.append((idx, rings))
        idx += 1
    return out


# ── Geometry helpers ────────────────────────────────────────────────────────
def ring_area(r):
    a = 0.0
    for i in range(len(r)):
        x1, y1 = r[i]; x2, y2 = r[(i + 1) % len(r)]
        a += x1 * y2 - x2 * y1
    return abs(a) * 0.5


def _dp(points, tol):
    """Douglas–Peucker on an OPEN polyline."""
    if len(points) < 3:
        return points
    first, last = 0, len(points) - 1
    stack, keep = [(first, last)], {first, last}
    while stack:
        a, b = stack.pop()
        ax, ay = points[a]; bx, by = points[b]
        dx, dy = bx - ax, by - ay
        n = math.hypot(dx, dy) or 1e-12
        worst, wi = 0.0, -1
        for i in range(a + 1, b):
            px, py = points[i]
            d = abs(dy * px - dx * py + bx * ay - by * ax) / n
            if d > worst:
                worst, wi = d, i
        if wi > 0 and worst > tol:
            keep.add(wi)
            stack.append((a, wi)); stack.append((wi, b))
    return [points[i] for i in sorted(keep)]


def simplify(points, tol):
    """Simplify a CLOSED ring. Douglas-Peucker anchored on a ring's endpoints is
    degenerate (they are the same point), so split the ring at the vertex farthest
    from the start and simplify the two halves as open polylines."""
    if len(points) < 4:
        return points
    pts = points[:-1] if points[0] == points[-1] else points[:]
    if len(pts) < 4:
        return points
    ax, ay = pts[0]
    far, fi = -1.0, 0
    for i, (x, y) in enumerate(pts):
        d = (x - ax) ** 2 + (y - ay) ** 2
        if d > far:
            far, fi = d, i
    if fi == 0:
        return points
    a = _dp(pts[:fi + 1], tol)
    b = _dp(pts[fi:] + [pts[0]], tol)
    ring = a + b[1:]
    return ring if len(ring) >= 4 else pts


def normalise(rings, keep=3):
    """Keep the largest rings, project to a 0..1 box preserving aspect."""
    rings = sorted(rings, key=ring_area, reverse=True)[:keep]
    rings = [r for r in rings if len(r) >= 4 and ring_area(r) > 0]
    if not rings:
        return None
    xs = [p[0] for r in rings for p in r]
    ys = [p[1] for r in rings for p in r]
    minx, maxx, miny, maxy = min(xs), max(xs), min(ys), max(ys)
    # equirectangular correction so states don't look squashed
    midlat = math.radians((miny + maxy) * 0.5)
    w = (maxx - minx) * math.cos(midlat)
    h = (maxy - miny)
    scale = 1.0 / max(w, h) if max(w, h) > 0 else 1.0
    ox = (1.0 - w * scale) * 0.5
    oy = (1.0 - h * scale) * 0.5
    out = []
    for r in rings:
        pr = []
        for x, y in r:
            nx = ((x - minx) * math.cos(midlat)) * scale + ox
            ny = 1.0 - (((y - miny)) * scale + oy)      # flip: screen y grows down
            pr.append([round(nx, 4), round(ny, 4)])
        out.append(pr)
    return out


def prep(rings, tol=0.02, keep=3):
    simplified = [simplify(r, tol) for r in sorted(rings, key=ring_area, reverse=True)[:keep]]
    return normalise(simplified, keep)


# ── Bake ────────────────────────────────────────────────────────────────────
def main():
    out = {"note": "Real boundaries: us-atlas (states) + US Census TIGER cartographic "
                   "boundary files (congressional districts). Simplified and normalised "
                   "to a unit box at build time.",
           "states": {}, "districts": {}}

    print("states…")
    topo = json.loads(fetch(STATES_TOPO, "states-10m.json"))
    for geom in topo["objects"]["states"]["geometries"]:
        name = geom.get("properties", {}).get("name", "")
        fips = str(geom.get("id", "")).zfill(2)
        abbr = FIPS_TO_ABBR.get(fips)
        if not abbr:
            continue
        rings = topo_rings(topo, geom)
        poly = prep(rings, tol=0.06, keep=3)
        if poly:
            out["states"][abbr] = {"name": name, "rings": poly}
    print("  baked %d states" % len(out["states"]))

    print("congressional districts…")
    raw = None
    for url in CD_CANDIDATES:
        try:
            raw = fetch(url, os.path.basename(url))
            if raw and len(raw) > 100000:
                print("  using", os.path.basename(url))
                break
        except Exception as e:
            print("  skip", url, e)
            raw = None
    if raw:
        zf = zipfile.ZipFile(io.BytesIO(raw))
        shp_name = [n for n in zf.namelist() if n.endswith(".shp")][0]
        dbf_name = [n for n in zf.namelist() if n.endswith(".dbf")][0]
        recs = read_dbf(zf.read(dbf_name))
        polys = read_shp_polygons(zf.read(shp_name))
        cd_field = next((f for f in ("CD118FP", "CD116FP", "CD117FP") if f in recs[0]), None)
        for (idx, rings), row in zip(polys, recs):
            if not rings:
                continue
            st = FIPS_TO_ABBR.get(row.get("STATEFP", ""), None)
            cd = row.get(cd_field, "") if cd_field else ""
            if not st or not cd:
                continue
            poly = prep(rings, tol=0.03, keep=2)
            if poly:
                out["districts"]["%s-%s" % (st, cd)] = {"rings": poly}
        print("  baked %d districts" % len(out["districts"]))
    else:
        print("  !! no district source reachable — states only")

    path = os.path.join(DATA, "geo.json")
    json.dump(out, open(path, "w"), separators=(",", ":"))
    print("wrote %s (%d KB)" % (path, os.path.getsize(path) // 1024))


if __name__ == "__main__":
    main()
