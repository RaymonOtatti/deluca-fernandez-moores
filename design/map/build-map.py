# Builds src/assets/map/oficina.svg (7.8): the streets, parks, lakes and railway around the office,
# drawn from OpenStreetMap data in the site's palette. No tiles, no embed, no request from the page.
# The data comes from one Overpass query (QUERY below), cached in design/map/osm/ (gitignored, 1.7 MB):
#   design/font/.venv/bin/python design/map/build-map.py          (fetches the extract if it's missing)
#   design/font/.venv/bin/python design/map/build-map.py labels   (only the avenue names, 8.4c)
# Map data © OpenStreetMap contributors, ODbL; the page credits it under the map.
import json, math, pathlib, re, urllib.parse, urllib.request
from shapely.geometry import LineString, Point, Polygon, box
from shapely.ops import linemerge, polygonize, unary_union

ROOT = pathlib.Path(__file__).resolve().parents[2]
CACHE = ROOT / 'design/map/osm/palermo.json'
OUT = ROOT / 'src/assets/map/oficina.svg'

# The pin on the firm's current site (svya.com.ar's Google Map), on the Freyre loop in OSM
PIN = (-34.5690162, -58.4215254)
W, H = 2400, 1000          # metres across and down, 1 unit = 1 m; the page crops around the centre
BBOX = (-34.5790, -58.4375, -34.5590, -58.4055)
QUERY = f'''[out:json][timeout:120];
(
  way["highway"]({BBOX[0]},{BBOX[1]},{BBOX[2]},{BBOX[3]});
  way["railway"~"^(rail|light_rail|subway)$"]({BBOX[0]},{BBOX[1]},{BBOX[2]},{BBOX[3]});
  nwr["leisure"~"^(park|garden|golf_course|pitch|track|nature_reserve)$"]({BBOX[0]},{BBOX[1]},{BBOX[2]},{BBOX[3]});
  nwr["landuse"~"^(grass|recreation_ground|forest|village_green)$"]({BBOX[0]},{BBOX[1]},{BBOX[2]},{BBOX[3]});
  nwr["natural"~"^(water|wood)$"]({BBOX[0]},{BBOX[1]},{BBOX[2]},{BBOX[3]});
);
out tags geom;'''


def fetch():
    if not CACHE.exists():
        CACHE.parent.mkdir(parents=True, exist_ok=True)
        body = urllib.parse.urlencode({'data': QUERY}).encode()
        req = urllib.request.Request('https://overpass-api.de/api/interpreter', body,
                                     {'User-Agent': 'svya-mvp-map-build/1.0'})
        CACHE.write_bytes(urllib.request.urlopen(req, timeout=180).read())
    return json.loads(CACHE.read_text())['elements']


# --- palette: the site's tokens, mixed in OKLab like CSS color-mix() ------------------------------

def token(name):
    css = (ROOT / 'src/styles/tokens.css').read_text()
    return re.search(rf'--{name}:\s*(#[0-9a-fA-F]{{6}})', css).group(1).lower()


def _lin(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def _gam(c):
    c = min(1.0, max(0.0, c))
    return 12.92 * c if c <= 0.0031308 else 1.055 * c ** (1 / 2.4) - 0.055


def _oklab(hex_):
    r, g, b = (_lin(int(hex_[i:i + 2], 16) / 255) for i in (1, 3, 5))
    l = (0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b) ** (1 / 3)
    m = (0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b) ** (1 / 3)
    s = (0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b) ** (1 / 3)
    return (0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
            1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
            0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s)


def _hex(lab):
    L, a, b = lab
    l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
    m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
    s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
    rgb = (4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
           -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
           -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s)
    return '#' + ''.join(f'{round(_gam(c) * 255):02x}' for c in rgb)


def mix(base, other, t):
    """color-mix(in oklab, base, other t)"""
    a, b = _oklab(base), _oklab(other)
    return _hex(tuple(x + (y - x) * t for x, y in zip(a, b)))


# --- geometry -------------------------------------------------------------------------------------

K = 111_320.0
COS = math.cos(math.radians(PIN[0]))


def xy(lat, lon):
    """Metres from the pin, x right, y down, the pin at the frame's centre"""
    return ((lon - PIN[1]) * K * COS + W / 2, (PIN[0] - lat) * K + H / 2)


FRAME = box(-20, -20, W + 20, H + 20)


def line(geom):
    return LineString([xy(p['lat'], p['lon']) for p in geom])


def area(el):
    """A way or multipolygon relation as a (clipped) shapely area, or None"""
    if el['type'] == 'way':
        pts = [xy(p['lat'], p['lon']) for p in el.get('geometry', [])]
        if len(pts) < 4 or pts[0] != pts[-1]:
            return None
        poly = Polygon(pts).buffer(0)
    elif el['type'] == 'relation':
        rings = {'outer': [], 'inner': []}
        for m in el.get('members', []):
            if m.get('type') == 'way' and m.get('geometry') and m.get('role') in rings:
                rings[m['role']].append(line(m['geometry']))
        outer = unary_union(list(polygonize(linemerge(rings['outer'])))) if rings['outer'] else None
        if outer is None or outer.is_empty:
            return None
        inner = unary_union(list(polygonize(linemerge(rings['inner'])))) if rings['inner'] else None
        poly = outer.difference(inner) if inner is not None and not inner.is_empty else outer
    else:
        return None
    poly = poly.intersection(FRAME)
    return None if poly.is_empty else poly


def d_lines(geoms, tol=0.8):
    """Clipped lines as one path's data: absolute moves, relative integer draws"""
    out = []
    for g in geoms:
        g = g.intersection(FRAME).simplify(tol)
        for part in getattr(g, 'geoms', [g]):
            if part.geom_type != 'LineString' or part.length < 2:
                continue
            pts = [(round(x), round(y)) for x, y in part.coords]
            seg = [f'M{pts[0][0]} {pts[0][1]}']
            for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
                if (x1, y1) != (x0, y0):
                    seg.append(f'l{x1 - x0} {y1 - y0}')
            if len(seg) > 1:
                out.append(''.join(seg))
    return ''.join(out)


def d_areas(geoms, tol=1.5):
    out = []
    for g in geoms:
        g = g.simplify(tol)
        for poly in getattr(g, 'geoms', [g]):
            if poly.geom_type != 'Polygon' or poly.area < 40:
                continue
            for ring in [poly.exterior, *poly.interiors]:
                pts = [(round(x), round(y)) for x, y in ring.coords[:-1]]
                if len(pts) < 3:
                    continue
                seg = [f'M{pts[0][0]} {pts[0][1]}']
                for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
                    seg.append(f'l{x1 - x0} {y1 - y0}')
                out.append(''.join(seg) + 'z')
    return ''.join(out)


# --- classes --------------------------------------------------------------------------------------

AVENUES = {'motorway', 'trunk', 'primary', 'secondary', 'motorway_link', 'trunk_link', 'primary_link', 'secondary_link'}
STREETS = {'tertiary', 'tertiary_link', 'residential', 'unclassified', 'living_street', 'pedestrian'}
LANES = {'service'}
GREEN = {('leisure', v) for v in ('park', 'garden', 'golf_course', 'nature_reserve')} | \
        {('landuse', v) for v in ('grass', 'recreation_ground', 'forest', 'village_green')} | {('natural', 'wood')}
GROUNDS = {('leisure', v) for v in ('pitch', 'track')}


def build():
    els = fetch()
    paper, ink, olive, sage, forest = (token(n) for n in ('paper', 'ink', 'olive', 'sage', 'forest'))
    colours = {
        'green': mix(paper, sage, 0.30),
        'grounds': mix(paper, sage, 0.45),
        'water': mix(mix(paper, sage, 0.55), forest, 0.10),
        'lanes': mix(paper, olive, 0.20),
        'streets': mix(paper, olive, 0.42),
        'avenues': mix(paper, ink, 0.50),
        'rail': mix(paper, olive, 0.55),
    }
    green, grounds, water, avenues, streets, lanes, rail, home = [], [], [], [], [], [], [], []
    for el in els:
        t = el.get('tags', {})
        hw, rw = t.get('highway'), t.get('railway')
        if el['type'] == 'way' and hw and 'Freyre' in t.get('name', ''):
            home.append(line(el['geometry']))   # the office's street, in the avenues' tone
        elif el['type'] == 'way' and hw in AVENUES | STREETS | LANES and 'area' not in t:
            (avenues if hw in AVENUES else streets if hw in STREETS else lanes).append(line(el['geometry']))
        elif el['type'] == 'way' and rw == 'rail' and 'service' not in t and t.get('tunnel') != 'yes':
            rail.append(line(el['geometry']))
        elif t.get('natural') == 'water':
            a = area(el)
            if a is not None:
                water.append(a)
        else:
            key = next(((k, t[k]) for k in ('leisure', 'landuse', 'natural') if k in t), None)
            if key in GREEN or key in GROUNDS:
                a = area(el)
                if a is not None:
                    (green if key in GREEN else grounds).append(a)

    ns = 'vector-effect="non-scaling-stroke" fill="none" stroke-linecap="round" stroke-linejoin="round"'
    svg = (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" '
        f'data-center="{PIN[0]},{PIN[1]}">'
        f'<rect width="{W}" height="{H}" fill="{paper}"/>'
        f'<path fill="{colours["green"]}" fill-rule="evenodd" d="{d_areas([unary_union(green)])}"/>'
        f'<path fill="{colours["grounds"]}" fill-rule="evenodd" d="{d_areas([unary_union(grounds)])}"/>'
        f'<path fill="{colours["water"]}" fill-rule="evenodd" d="{d_areas([unary_union(water)])}"/>'
        f'<path {ns} stroke="{colours["lanes"]}" stroke-width=".6" d="{d_lines(lanes)}"/>'
        f'<path {ns} stroke="{colours["streets"]}" stroke-width=".9" d="{d_lines(streets)}"/>'
        f'<path {ns} stroke="{colours["rail"]}" stroke-width=".8" stroke-dasharray="5 3" d="{d_lines(rail)}"/>'
        f'<path {ns} stroke="{colours["avenues"]}" stroke-width="1.5" d="{d_lines(avenues)}"/>'
        f'<path {ns} stroke="{colours["avenues"]}" stroke-width="1.3" d="{d_lines(home)}"/>'
        '</svg>\n'
    )
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(svg)
    print(f'{OUT.relative_to(ROOT)}: {len(svg.encode())} B; '
          f'{len(home)} Freyre, {len(avenues)} avenues, {len(streets)} streets, {len(lanes)} lanes, {len(rail)} rail, '
          f'{len(green)} green, {len(grounds)} grounds, {len(water)} water')


# --- avenue names (8.4c, Franco, 2026-10-23: "only important avenue names: Dorrego, Av. del Libertador and
# Av. Pres. Figueroa Alcorta") ---------------------------------------------------------------------
# HTML over the image, like the pin's tag (SVG text shrank to about 5 px on phones), so their positions go
# into a generated stylesheet (the CSP allows no inline styles). Each label is near a straight stretch of
# its avenue that fits inside the phone's square crop (x 700 to 1700) and clears the pin's tag; `near` only
# picks the stretch: the anchor is the nearest point of the avenue's own line, and the angle is the line's
# there, over 60 m either side, turned to read left to right. Searched with straight windows of 200 to 500 m
# and under 12 m of curve: Dorrego's south stretch, Libertador's south-east one, Figueroa Alcorta's north one.
# The side is the label's side of its avenue: Dorrego's and Figueroa Alcorta's sit below theirs, or the
# phone's crop cuts them (Dorrego's upper side points left, Figueroa Alcorta's up).
LABELS = [
    ('dorrego', 'Av. Dorrego', 'Avenida Dorrego', (843, 812), 'below'),
    ('libertador', 'Av. del Libertador', 'Avenida Del Libertador', (1300, 860), 'above'),
    # two lines: on a phone one line would run past the straight stretch (about 650 m at 12 px)
    ('alcorta', 'Av. Pres.\nFigueroa Alcorta', 'Avenida Presidente Figueroa Alcorta', (1430, 160), 'below'),
]
LABELS_JSON = ROOT / 'src/assets/map/oficina-labels.json'
LABELS_CSS = ROOT / 'src/assets/map/oficina-labels.css'


def labels(els=None):
    els = els or fetch()
    out = []
    for slug, text, name, near, side in LABELS:
        ways = [line(e['geometry']) for e in els
                if e['type'] == 'way' and e.get('tags', {}).get('name') == name and e['tags'].get('highway') in AVENUES]
        road = linemerge(unary_union(ways))
        part = min(getattr(road, 'geoms', [road]), key=lambda p: p.distance(Point(near)))
        at = part.project(Point(near))
        p, a, b = part.interpolate(at), part.interpolate(max(0, at - 60)), part.interpolate(min(part.length, at + 60))
        angle = (math.degrees(math.atan2(b.y - a.y, b.x - a.x)) + 90) % 180 - 90
        assert p.distance(road) < 0.5, f'{slug} is on its avenue'
        out.append({'slug': slug, 'text': text, 'x': round(p.x, 1), 'y': round(p.y, 1), 'angle': round(angle, 1), 'side': side})
    LABELS_JSON.write_text(json.dumps(out, ensure_ascii=False, indent=2) + '\n')
    css = ['/* Generated by design/map/build-map.py (8.4c): where each avenue\'s name sits, in % of the map\n'
           '   (2400 x 1000 m), turned to its avenue. Do not edit by hand. */']
    css += [f'.map__road--{l["slug"]} {{ left: {l["x"] / 24:.2f}%; top: {l["y"] / 10:.2f}%; --angle: {l["angle"]:g}deg;{" --side: 1;" if l["side"] == "below" else ""} }}' for l in out]
    LABELS_CSS.write_text('\n'.join(css) + '\n')
    for l in out:
        print(f'{l["slug"]}: {l["x"]}, {l["y"]}, {l["angle"]}°')


if __name__ == '__main__':
    import sys
    labels() if sys.argv[1:] == ['labels'] else (build(), labels())
