#!/usr/bin/env python3
"""One-time generator for src/map-data.js — Pacific-centered coastlines.

Downloads Natural Earth 10m land polygons, normalizes longitudes into a
continuous Pacific-centered space (lon360 = (lon + 360) % 360), clips to the
Pacific bounding box, simplifies with Douglas-Peucker, drops tiny rings, and
emits a checked-in zero-dependency JS data file.

The outer-Caroline atolls the app sails (Satawal, Lamotrek, West Fayu, Elato,
Pikelot, Gaferut) have no geometry in any Natural Earth dataset (minor_islands
included — evaluated 2026-07), so their coastlines come from OpenStreetMap via
the Overpass API, cached in osm_atolls.json next to this script.

Pure stdlib (urllib, json, math) — no venv or pip needed.

    python3 tools/build_map.py
"""
import json
import math
import os
import sys
import urllib.parse
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(HERE, "ne_10m_land.geojson")  # checked-in source data (skips the download)
OUT = os.path.join(HERE, "..", "src", "map-data.js")

# Natural Earth 10m land, via the nvkelso/natural-earth-vector GitHub mirror.
URL = ("https://raw.githubusercontent.com/nvkelso/natural-earth-vector/"
       "master/geojson/ne_10m_land.geojson")

# Pacific-centered bounds in lon360 space (deg). Includes the Aleutians/Bering
# to close the basin north; down to sub-Antarctic latitudes south.
LON_MIN, LON_MAX = 110.0, 292.0      # 110°E eastward across the dateline to 68°W
LAT_MIN, LAT_MAX = -75.0, 66.0
SIMPLIFY_TOL = 0.08                  # degrees; Douglas-Peucker tolerance
MIN_RING_AREA = 0.05                 # deg^2; drop rings smaller than this

# Fine-detail region: the Caroline–Mariana seaways the app actually sails.
# Rings whose centroid falls in this box keep near-full 10m detail so the
# tiny atolls (Puluwat, Pisaras, Chuuk lagoon, the Marianas…) survive both
# the simplifier and the area filter.
FINE_LON_MIN, FINE_LON_MAX = 135.0, 153.5
FINE_LAT_MIN, FINE_LAT_MAX = 4.0, 16.5
FINE_TOL = 0.002                     # ~220 m — keeps 1 km islets like Pisaras alive
FINE_MIN_RING_AREA = 0.000005

# Mid-detail boxes: the settlement-story landfalls (ETAK_PLACES in
# src/passages.js — keep in sync) whose islands are real but smaller than the
# coarse MIN_RING_AREA, so the settlement map has land under its labels.
# (lon360 min, lon360 max, lat min, lat max)
MID_BOXES = [
    (157.0, 159.5, 5.8, 7.5),        # Pohnpei
    (165.0, 168.0, -12.5, -9.5),     # Santa Cruz group (Nendö)
    (183.0, 187.0, -22.5, -18.0),    # Tonga (Tongatapu, Haʻapai, Vavaʻu)
    (218.5, 222.5, -11.0, -7.5),     # Marquesas
    (250.0, 251.5, -27.6, -26.8),    # Rapa Nui
]
MID_TOL = 0.01                       # ~1.1 km — island shapes, not atoll islets
MID_MIN_RING_AREA = 0.0005          # deg^2; ~6 km² — keeps the main islands only

# Atolls absent from Natural Earth, fetched from OSM instead: (name, s, w, n, e).
# Boxes are generous enough to catch every islet on each reef rim.
OSM_CACHE = os.path.join(HERE, "osm_atolls.json")
OVERPASS = "https://overpass-api.de/api/interpreter"
OSM_ATOLLS = [
    ("satawal",   7.30, 146.95, 7.42, 147.12),
    ("lamotrek",  7.42, 146.25, 7.58, 146.45),
    ("elato",     7.38, 146.10, 7.58, 146.25),
    ("west fayu", 8.02, 146.60, 8.14, 146.80),
    ("pikelot",   8.04, 147.55, 8.14, 147.70),
    ("gaferut",   9.18, 145.30, 9.28, 145.45),
]


def fetch():
    if not os.path.exists(CACHE):
        print(f"downloading {URL} ...", file=sys.stderr)
        with urllib.request.urlopen(URL) as r:
            data = r.read()
        with open(CACHE, "wb") as f:
            f.write(data)
    with open(CACHE) as f:
        return json.load(f)


def fetch_osm():
    if not os.path.exists(OSM_CACHE):
        q = "[out:json][timeout:90];(" + "".join(
            f'way["natural"="coastline"]({s},{w},{n},{e});'
            for _, s, w, n, e in OSM_ATOLLS) + ");out geom;"
        print(f"querying Overpass for {len(OSM_ATOLLS)} atolls ...", file=sys.stderr)
        req = urllib.request.Request(
            OVERPASS, data=urllib.parse.urlencode({"data": q}).encode(),
            headers={"User-Agent": "etak-build-map/1.0"})
        with urllib.request.urlopen(req) as r:
            data = r.read()
        with open(OSM_CACHE, "wb") as f:
            f.write(data)
    with open(OSM_CACHE) as f:
        return json.load(f)


def osm_rings(osm):
    """Stitch OSM coastline ways into closed lon/lat rings by matching
    endpoints (endpoint nodes are shared, so float equality is exact)."""
    pool = [[(nd["lon"], nd["lat"]) for nd in el["geometry"]]
            for el in osm["elements"] if el["type"] == "way"]
    rings = []
    while pool:
        ring = pool.pop()
        while ring[0] != ring[-1]:
            for i, w in enumerate(pool):
                if w[0] == ring[-1]:
                    ring += w[1:]
                elif w[-1] == ring[-1]:
                    ring += w[-2::-1]
                else:
                    continue
                pool.pop(i)
                break
            else:
                break                            # open chain — drop it
        if ring[0] == ring[-1] and len(ring) >= 4:
            rings.append(ring)
    return rings


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
                cx = sum(p[0] for p in clipped) / len(clipped)
                cy = sum(p[1] for p in clipped) / len(clipped)
                if (FINE_LON_MIN <= cx <= FINE_LON_MAX and
                        FINE_LAT_MIN <= cy <= FINE_LAT_MAX):
                    tol, min_area = FINE_TOL, FINE_MIN_RING_AREA
                elif any(x0 <= cx <= x1 and y0 <= cy <= y1
                         for x0, x1, y0, y1 in MID_BOXES):
                    tol, min_area = MID_TOL, MID_MIN_RING_AREA
                else:
                    tol, min_area = SIMPLIFY_TOL, MIN_RING_AREA
                simp = simplify(clipped, tol)
                if len(simp) < 3 or ring_area(simp) < min_area:
                    continue
                polys.append([[round(x, 3), round(y, 3)] for x, y in simp])
                break  # outer ring only — holes are invisible on a dark chart

    # OSM atolls: hand-picked, all inside the fine region — fine tolerance,
    # no area floor (some islets are smaller than anything NE carries)
    for ring in osm_rings(fetch_osm()):
        simp = simplify(clip_bbox(unwrap(ring)), FINE_TOL)
        if len(simp) >= 3:
            polys.append([[round(x, 4), round(y, 4)] for x, y in simp])

    header = ("// GENERATED by tools/build_map.py — do not edit by hand.\n"
              "// Natural Earth 10m land, clipped to the Pacific, lon in lon360 space;\n"
              "// full detail in the Caroline-Mariana fine region.\n")
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
