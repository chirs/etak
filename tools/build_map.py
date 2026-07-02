#!/usr/bin/env python3
"""One-time generator for src/map-data.js — Pacific-centered coastlines.

Downloads Natural Earth 50m land polygons, normalizes longitudes into a
continuous Pacific-centered space (lon360 = (lon + 360) % 360), clips to the
Pacific bounding box, simplifies with Douglas-Peucker, drops tiny rings, and
emits a checked-in zero-dependency JS data file.

Pure stdlib (urllib, json, math) — no venv or pip needed.

    python3 tools/build_map.py
"""
import json
import math
import os
import sys
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(HERE, "ne_50m_land.geojson")  # gitignored download cache
OUT = os.path.join(HERE, "..", "src", "map-data.js")

# Natural Earth 50m land, via the nvkelso/natural-earth-vector GitHub mirror.
URL = ("https://raw.githubusercontent.com/nvkelso/natural-earth-vector/"
       "master/geojson/ne_50m_land.geojson")

# Pacific-centered bounds in lon360 space (deg). Includes the Aleutians/Bering
# to close the basin north; down to sub-Antarctic latitudes south.
LON_MIN, LON_MAX = 110.0, 292.0      # 110°E eastward across the dateline to 68°W
LAT_MIN, LAT_MAX = -75.0, 66.0
SIMPLIFY_TOL = 0.08                  # degrees; Douglas-Peucker tolerance
MIN_RING_AREA = 0.05                 # deg^2; drop rings smaller than this


def fetch():
    if not os.path.exists(CACHE):
        print(f"downloading {URL} ...", file=sys.stderr)
        with urllib.request.urlopen(URL) as r:
            data = r.read()
        with open(CACHE, "wb") as f:
            f.write(data)
    with open(CACHE) as f:
        return json.load(f)


def to_lon360(lon):
    return (lon + 360.0) % 360.0


def unwrap(ring):
    """Convert a lon/lat ring to lon360 space, unwrapping seams so a single
    ring doesn't jump 360° when it straddles the antimeridian."""
    out = []
    prev = None
    for lon, lat in ring:
        x = to_lon360(lon)
        if prev is not None and abs(x - prev) > 180:
            x += 360 if x < prev else -360   # keep continuity within the ring
        out.append((x, lat))
        prev = x
    return out


# --- Sutherland–Hodgman clipping against the (convex) bbox -------------------

def _clip_edge(poly, inside, intersect):
    out = []
    if not poly:
        return out
    prev = poly[-1]
    prev_in = inside(prev)
    for cur in poly:
        cur_in = inside(cur)
        if cur_in:
            if not prev_in:
                out.append(intersect(prev, cur))
            out.append(cur)
        elif prev_in:
            out.append(intersect(prev, cur))
        prev = cur
        prev_in = cur_in
    return out


def clip_bbox(poly):
    def ix(p, q, x):
        t = (x - p[0]) / (q[0] - p[0])
        return (x, p[1] + t * (q[1] - p[1]))

    def iy(p, q, y):
        t = (y - p[1]) / (q[1] - p[1])
        return (p[0] + t * (q[0] - p[0]), y)

    poly = _clip_edge(poly, lambda p: p[0] >= LON_MIN, lambda p, q: ix(p, q, LON_MIN))
    poly = _clip_edge(poly, lambda p: p[0] <= LON_MAX, lambda p, q: ix(p, q, LON_MAX))
    poly = _clip_edge(poly, lambda p: p[1] >= LAT_MIN, lambda p, q: iy(p, q, LAT_MIN))
    poly = _clip_edge(poly, lambda p: p[1] <= LAT_MAX, lambda p, q: iy(p, q, LAT_MAX))
    return poly


# --- Douglas-Peucker simplification -----------------------------------------

def _dp(pts, tol, lo, hi, keep):
    dmax, idx = 0.0, 0
    ax, ay = pts[lo]
    bx, by = pts[hi]
    dx, dy = bx - ax, by - ay
    norm = math.hypot(dx, dy) or 1e-12
    for i in range(lo + 1, hi):
        px, py = pts[i]
        d = abs((px - ax) * dy - (py - ay) * dx) / norm
        if d > dmax:
            dmax, idx = d, i
    if dmax > tol:
        _dp(pts, tol, lo, idx, keep)
        _dp(pts, tol, idx, hi, keep)
    else:
        keep.add(lo)
        keep.add(hi)


def simplify(pts, tol):
    if len(pts) < 4:
        return pts
    # Closed rings have pts[0] == pts[-1], which gives Douglas-Peucker a
    # zero-length baseline. Split the ring at the vertex farthest from the
    # start so each half is an open polyline with distinct endpoints.
    ax, ay = pts[0]
    far = max(range(1, len(pts)), key=lambda i: math.hypot(pts[i][0] - ax, pts[i][1] - ay))
    keep = set()
    _dp(pts, tol, 0, far, keep)
    _dp(pts, tol, far, len(pts) - 1, keep)
    return [pts[i] for i in sorted(keep)]


def ring_area(pts):
    a = 0.0
    n = len(pts)
    for i in range(n):
        x1, y1 = pts[i]
        x2, y2 = pts[(i + 1) % n]
        a += x1 * y2 - x2 * y1
    return abs(a) / 2.0


def rings_from_geometry(geom):
    t = geom["type"]
    if t == "Polygon":
        return [geom["coordinates"]]
    if t == "MultiPolygon":
        return geom["coordinates"]
    return []


def main():
    gj = fetch()
    polys = []
    for feat in gj["features"]:
        for poly in rings_from_geometry(feat["geometry"]):
            for ring in poly:                        # ring[0] outer; skip holes
                uw = unwrap(ring)
                clipped = clip_bbox(uw)
                if len(clipped) < 3:
                    continue
                simp = simplify(clipped, SIMPLIFY_TOL)
                if len(simp) < 3 or ring_area(simp) < MIN_RING_AREA:
                    continue
                polys.append([[round(x, 3), round(y, 3)] for x, y in simp])
                break  # outer ring only — holes are invisible on a dark chart

    header = ("// GENERATED by tools/build_map.py — do not edit by hand.\n"
              "// Natural Earth 50m land, clipped to the Pacific, lon in lon360 space.\n")
    bounds = {"lonMin": LON_MIN, "lonMax": LON_MAX,
              "latMin": LAT_MIN, "latMax": LAT_MAX}
    body = "const PACIFIC_MAP = " + json.dumps(
        {"bounds": bounds, "polys": polys}, separators=(",", ":")) + ";\n"
    body += ("if (typeof module !== 'undefined' && module.exports) "
             "module.exports = PACIFIC_MAP;\n")
    with open(OUT, "w") as f:
        f.write(header + body)

    size = os.path.getsize(OUT)
    print(f"wrote {OUT}: {len(polys)} rings, {size/1024:.0f} KB", file=sys.stderr)


if __name__ == "__main__":
    main()
