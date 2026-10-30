# Builds Valiente Display Light (design/font/build/ValienteDisplay-Light.ttf and .woff2), the display
# face for the wordmark and the big numbers (6.8). Capitals only, with the SVA monogram's stress: a
# broad nib held at 15°, so strokes running down to the right (\) and verticals are full, strokes
# running up to the right (/) are half and horizontals are hairlines. Joins are pointed, like the
# monogram's V and A. Lowercase maps to the capitals, so the face also works without text-transform.
# Every glyph is a few centre-line strokes swept with a width that follows their direction, merged
# with shapely and written as TrueType with fontTools.
#   design/font/.venv/bin/python design/font/build-font.py
import math, pathlib
from shapely.geometry import Polygon, MultiPoint, box
from shapely.geometry.polygon import orient
from shapely.ops import unary_union
from shapely import affinity
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.feaLib.builder import addOpenTypeFeaturesFromString

OUT = pathlib.Path(__file__).resolve().parent / 'build'
FAMILY, STYLE = 'Valiente Display', 'Light'

UPM, CAP = 1000, 700
OVS = 10                 # rounds overshoot the cap height and the baseline
PEAK = 22                # pointed joins overshoot more: a point reads short
HAIR, FULL = 18, 64      # stroke widths along and across the nib
NIB = math.radians(15)


def weight(theta):
    """Width of a stroke heading theta (radians): full across the nib, a hairline along it."""
    return HAIR + (FULL - HAIR) * abs(math.sin(theta - NIB)) ** 3


STEM = weight(math.pi / 2)   # verticals, ≈ 59
BAR = weight(0)              # horizontals, ≈ 19


# --- strokes ---------------------------------------------------------------------------------

def sweep(pts, w=None, closed=False):
    """A centre line swept with its direction's width (or a fixed w); flat ends, square to it."""
    n = len(pts)
    left, right = [], []
    for i, (x, y) in enumerate(pts):
        a = pts[i - 1] if closed else pts[max(i - 1, 0)]
        b = pts[(i + 1) % n] if closed else pts[min(i + 1, n - 1)]
        th = math.atan2(b[1] - a[1], b[0] - a[0])
        half = (w if w is not None else weight(th)) / 2
        nx, ny = -math.sin(th), math.cos(th)
        left.append((x + nx * half, y + ny * half))
        right.append((x - nx * half, y - ny * half))
    pairs = range(n) if closed else range(n - 1)
    return unary_union([MultiPoint([left[i], left[(i + 1) % n], right[(i + 1) % n], right[i]]).convex_hull
                        for i in pairs])


def bspline(ctrl, n=600):
    """Round a control polygon with a clamped cubic so curvature changes continuously."""
    c = [ctrl[0]] * 2 + list(ctrl) + [ctrl[-1]] * 2
    pts = []
    segs = len(c) - 3
    for i in range(segs):
        p0, p1, p2, p3 = c[i:i + 4]
        for k in range(n // segs):
            t = k / (n // segs)
            b0, b1, b2, b3 = ((1 - t) ** 3 / 6, (3 * t ** 3 - 6 * t ** 2 + 4) / 6,
                              (-3 * t ** 3 + 3 * t ** 2 + 3 * t + 1) / 6, t ** 3 / 6)
            pts.append((b0 * p0[0] + b1 * p1[0] + b2 * p2[0] + b3 * p3[0],
                        b0 * p0[1] + b1 * p1[1] + b2 * p2[1] + b3 * p3[1]))
    pts.append(ctrl[-1])
    return pts


def smooth_sweep(pts, win=9):
    """Average neighbouring nib widths so the outline has no contrast spikes."""
    n = len(pts)
    th = [math.atan2(pts[min(i + 1, n - 1)][1] - pts[max(i - 1, 0)][1],
                     pts[min(i + 1, n - 1)][0] - pts[max(i - 1, 0)][0]) for i in range(n)]
    widths = [weight(t) for t in th]
    smooth = [sum(widths[max(0, i - win):i + win + 1]) / len(widths[max(0, i - win):i + win + 1])
              for i in range(n)]
    left = [(x - math.sin(t) * h / 2, y + math.cos(t) * h / 2) for (x, y), t, h in zip(pts, th, smooth)]
    right = [(x + math.sin(t) * h / 2, y - math.cos(t) * h / 2) for (x, y), t, h in zip(pts, th, smooth)]
    return Polygon(left + right[::-1]).buffer(0)


def arc(cx, cy, rx, ry, a0, a1, step=1.0):
    """Points on an ellipse from angle a0 to a1 (degrees, either way round)."""
    n = max(2, int(abs(a1 - a0) / step))
    return [(cx + rx * math.cos(math.radians(a0 + (a1 - a0) * i / n)),
             cy + ry * math.sin(math.radians(a0 + (a1 - a0) * i / n))) for i in range(n + 1)]


def path(*nodes, step=4):
    """A centre line through nodes (x, y, heading in degrees[, tension]). Each segment is a cubic
    whose handles follow the headings, sized like an ellipse's: 0.5523 of the chord's projection."""
    pts = []
    for a, b in zip(nodes, nodes[1:]):
        (x0, y0, h0), k0 = a[:3], (a[3] if len(a) > 3 else 0.5523)
        (x1, y1, h1), k1 = b[:3], (b[3] if len(b) > 3 else 0.5523)
        t0 = (math.cos(math.radians(h0)), math.sin(math.radians(h0)))
        t1 = (math.cos(math.radians(h1)), math.sin(math.radians(h1)))
        dx, dy = x1 - x0, y1 - y0
        l0, l1 = k0 * abs(dx * t0[0] + dy * t0[1]), k1 * abs(dx * t1[0] + dy * t1[1])
        c0, c1 = (x0 + t0[0] * l0, y0 + t0[1] * l0), (x1 - t1[0] * l1, y1 - t1[1] * l1)
        n = max(12, int(math.hypot(dx, dy) / step))
        for i in range(n):
            t = i / n
            u = 1 - t
            pts.append((u ** 3 * x0 + 3 * u * u * t * c0[0] + 3 * u * t * t * c1[0] + t ** 3 * x1,
                        u ** 3 * y0 + 3 * u * u * t * c0[1] + 3 * u * t * t * c1[1] + t ** 3 * y1))
    pts.append(tuple(nodes[-1][:2]))
    return pts


def meet(l1, l2):
    """Where two lines (point, direction) cross."""
    (p, d), (q, e) = l1, l2
    t = ((q[0] - p[0]) * e[1] - (q[1] - p[1]) * e[0]) / (d[0] * e[1] - d[1] * e[0])
    return (p[0] + d[0] * t, p[1] + d[1] * t)


def edges(p, q, sp, sq, w=None):
    """The two edge lines of a straight stroke from p to q, as (left, right) of its travel.
    sp, sq say which edge each point sits on (+1 left, -1 right); the edges are w apart."""
    phi = math.atan2(q[1] - p[1], q[0] - p[0])
    length = math.hypot(q[0] - p[0], q[1] - p[1])
    th = phi
    for _ in range(30):
        ww = w or weight(th)
        th = phi if sp == sq else phi + sp * math.asin(min(1.0, ww / length))
    ww = w or weight(th)
    d = (math.cos(th), math.sin(th))
    if sp == sq:   # p and q share one edge; the other lies ww toward the other side
        on = (p, d)
        off = ((p[0] + sp * d[1] * ww, p[1] - sp * d[0] * ww), d)
        return (on, off) if sp == 1 else (off, on)
    return ((p, d), (q, d)) if sp == 1 else ((q, d), (p, d))


def band(p, q, sp, sq, w=None):
    """A straight stroke through p and q (see edges), long enough to be clipped to shape."""
    (a, d), (b, _) = edges(p, q, sp, sq, w)
    far = 3000
    return Polygon([(a[0] - d[0] * far, a[1] - d[1] * far), (a[0] + d[0] * far, a[1] + d[1] * far),
                    (b[0] + d[0] * far, b[1] + d[1] * far), (b[0] - d[0] * far, b[1] - d[1] * far)])


def zigzag(pts, widths=None):
    """Straight strokes with pointed joins (V, A, W, M, N, K). pts are the outline's outer points:
    the two ends sit on their horizontal cut lines, every point between is a pointed vertex."""
    n = len(pts) - 1
    side = [0] * (n + 1)
    for j in range(1, n):   # a turn to the left puts the outer point on the right, and back
        (ax, ay), (bx, by), (cx, cy) = pts[j - 1], pts[j], pts[j + 1]
        side[j] = -1 if (bx - ax) * (cy - by) - (by - ay) * (cx - bx) > 0 else 1
    side[0], side[n] = side[1], side[n - 1]
    strokes = [edges(pts[i], pts[i + 1], side[i], side[i + 1], widths[i] if widths else None)
               for i in range(n)]
    start, end = ((0, pts[0][1]), (1, 0)), ((0, pts[n][1]), (1, 0))
    rims = []
    for k in (0, 1):   # the left rim, then the right
        rim = [meet(strokes[0][k], start)]
        rim += [meet(strokes[j - 1][k], strokes[j][k]) for j in range(1, n)]
        rim.append(meet(strokes[n - 1][k], end))
        rims.append(rim)
    return Polygon(rims[0] + rims[1][::-1]).buffer(0)


def stem(x, y0=0, y1=CAP, w=None):
    return box(x, y0, x + (w or STEM), y1)


def bar(x0, x1, y, w=None):
    """A horizontal stroke whose bottom edge is at y."""
    return box(x0, y, x1, y + (w or BAR))


def clip(g, x0=-2000, y0=-2000, x1=4000, y1=4000):
    return g.intersection(box(x0, y0, x1, y1))


def ring(cx, cy, w, h):
    """An O-like closed ellipse, w by h on the outside (at its extremes)."""
    return sweep(arc(cx, cy, w / 2 - STEM / 2, h / 2 - BAR / 2, 0, 360)[:-1], closed=True)


def wedge(p, q, w0, w1):
    """A straight stroke that widens from w0 at p to w1 at q (the acute)."""
    th = math.atan2(q[1] - p[1], q[0] - p[0])
    nx, ny = -math.sin(th), math.cos(th)
    return Polygon([(p[0] + nx * w0 / 2, p[1] + ny * w0 / 2), (q[0] + nx * w1 / 2, q[1] + ny * w1 / 2),
                    (q[0] - nx * w1 / 2, q[1] - ny * w1 / 2), (p[0] - nx * w0 / 2, p[1] - ny * w0 / 2)])


# --- glyphs ----------------------------------------------------------------------------------
# Each draws its ink from x = 0 to its width; side bearings come from the class of each side.

ST, RO, DI, OP = 78, 44, 10, 24   # straight, round, diagonal and open sides
GLYPHS = {}


def glyph(name, chars, width, sb=(ST, ST)):
    def register(draw):
        GLYPHS[name] = (chars, width, sb, draw)
        return draw
    return register


@glyph('A', 'Aa', 640, (DI, DI))
def A():
    w = 640
    shape = zigzag([(0, 0), (w / 2, CAP + PEAK), (w, 0)])
    hull = Polygon([(0, 0), (w / 2, CAP + PEAK), (w, 0)])
    return shape | bar(0, w, 215).intersection(hull)


@glyph('B', 'Bb', 470, (ST, RO))
def B():
    xs, ym = 230, 372   # where the bowls leave the stem; the waist's centre line
    top = sweep([(STEM / 2, CAP - BAR / 2)] + arc(xs, (CAP - BAR / 2 + ym) / 2, 470 - 40 - STEM / 2 - xs,
                                                   (CAP - BAR / 2 - ym) / 2, 90, -90) + [(STEM / 2, ym)])
    low = sweep([(STEM / 2, ym)] + arc(xs + 10, (ym + BAR / 2) / 2, 470 - STEM / 2 - xs - 10,
                                       (ym - BAR / 2) / 2, 90, -90) + [(STEM / 2, BAR / 2)])
    return stem(0) | top | low


@glyph('C', 'Cc', 600, (RO, OP))
def C():
    return clip(sweep(arc(330, CAP / 2, 330 - STEM / 2, (CAP + 2 * OVS) / 2 - BAR / 2, 20, 340)), x1=600)


@glyph('D', 'Dd', 620, (ST, RO))
def D():
    xs = 270
    bowl = [(STEM / 2, CAP - BAR / 2)] + arc(xs, CAP / 2, 620 - STEM / 2 - xs, CAP / 2 - BAR / 2, 90, -90) \
        + [(STEM / 2, BAR / 2)]
    return stem(0) | sweep(bowl)


@glyph('E', 'Ee', 400, (ST, OP))
def E():
    return stem(0) | bar(0, 390, CAP - BAR) | bar(0, 355, 352 - BAR / 2) | bar(0, 400, 0)


@glyph('F', 'Ff', 380, (ST, OP - 6))
def F():
    return stem(0) | bar(0, 380, CAP - BAR) | bar(0, 340, 342 - BAR / 2)


@glyph('G', 'Gg', 650, (RO, ST - 20))
def G():
    cx, rx = 330, 330 - STEM / 2
    arcs = sweep(arc(cx, CAP / 2, rx, (CAP + 2 * OVS) / 2 - BAR / 2, 22, 360))
    arcs = arcs.difference(box(600, CAP / 2 + 60, 2000, 2000))   # the top terminal, cut upright
    return arcs | bar(355, cx + rx + STEM / 2, CAP / 2 - BAR)


@glyph('H', 'Hh', 560)
def H():
    return stem(0) | stem(560 - STEM) | bar(0, 560, 362 - BAR / 2)


@glyph('I', 'Ii', STEM)
def I():
    return stem(0)


@glyph('J', 'Jj', 340, (OP, ST))
def J():
    x = 340 - STEM / 2
    yc = 230
    return clip(sweep([(x, CAP)] + arc(x - 150, yc, 150, yc + OVS - BAR / 2, 0, -205)), x0=0)


@glyph('K', 'Kk', 500, (ST, DI))
def K():
    return stem(0) | zigzag([(495, CAP), (STEM * 0.4, 330), (500, 0)])


@glyph('L', 'Ll', 380, (ST, DI + 4))
def L():
    return stem(0) | bar(0, 380, 0)


@glyph('M', 'Mm', 720)
def M():
    w = 720
    return zigzag([(0, 0), (0, CAP + PEAK), (w / 2, -PEAK), (w, CAP + PEAK), (w, 0)],
                  widths=[weight(math.radians(60)), None, None, STEM])


@glyph('N', 'Nn', 570)
def N():
    w = 570
    thin = weight(math.radians(60))   # N's uprights are the half stroke; the diagonal is full
    return zigzag([(0, 0), (0, CAP + PEAK), (w, -PEAK), (w, CAP)], widths=[thin, None, thin])


@glyph('O', 'Oo', 700, (RO, RO))
def O():
    return ring(350, CAP / 2, 700, CAP + 2 * OVS)


@glyph('P', 'Pp', 460, (ST, RO))
def P():
    xs, yb = 245, 300
    bowl = [(STEM / 2, CAP - BAR / 2)] + arc(xs, (CAP - BAR / 2 + yb + BAR / 2) / 2, 460 - STEM / 2 - xs,
                                             (CAP - BAR - yb) / 2, 90, -90) + [(STEM / 2, yb + BAR / 2)]
    return stem(0) | sweep(bowl)


@glyph('Q', 'Qq', 700, (RO, RO))
def Q():
    tail = clip(sweep([(400, 120), (610, -150)]), y0=-150)
    return ring(350, CAP / 2, 700, CAP + 2 * OVS) | tail


@glyph('R', 'Rr', 490, (ST, DI + 4))
def R():
    xs, yb = 240, 322
    bowl = [(STEM / 2, CAP - BAR / 2)] + arc(xs, (CAP - BAR / 2 + yb + BAR / 2) / 2, 470 - STEM / 2 - xs,
                                             (CAP - BAR - yb) / 2, 90, -90) + [(STEM / 2, yb + BAR / 2)]
    leg = clip(band((185, yb + BAR), (490, 0), -1, 1), y0=0, y1=yb + BAR)
    return stem(0) | sweep(bowl) | leg


@glyph('S', 'Ss', 440, (RO - 6, RO - 6))
def S():
    w = 440
    # 8.5e: the old seven-node path kinked where the bowls met the spine.
    # The spline rounds the control polygon's corners into one smooth centre line.
    ctrl = [(394, 588), (400, 664), (330, 716), (200, 718), (70, 690), (30, 600), (52, 500), (170, 410), (300, 320),
            (400, 240), (420, 140), (380, 30), (240, -14), (100, -10), (24, 40), (16, 118)]
    return clip(smooth_sweep(bspline(ctrl, 600)), x0=0, x1=w)


@glyph('T', 'Tt', 500, (OP - 8, OP - 8))
def T():
    return bar(0, 500, CAP - BAR) | stem(250 - STEM / 2)


@glyph('U', 'Uu', 560)
def U():
    w, yc = 560, 250
    line = [(STEM / 2, CAP)] + arc(w / 2, yc, w / 2 - STEM / 2, yc + OVS - BAR / 2, 180, 360) + [(w - STEM / 2, CAP)]
    return sweep(line)


@glyph('V', 'Vv', 630, (DI, DI))
def V():
    return zigzag([(0, CAP), (315, -PEAK), (630, CAP)])


@glyph('W', 'Ww', 920, (DI, DI))
def W():
    return zigzag([(0, CAP), (235, -PEAK), (460, CAP), (685, -PEAK), (920, CAP)])


@glyph('X', 'Xx', 570, (DI, DI))
def X():
    w, t = 570, 22   # the top is a little narrower than the foot
    return clip(band((t, CAP), (w, 0), -1, 1) | band((0, 0), (w - t, CAP), 1, -1), 0, 0, w, CAP)


@glyph('Y', 'Yy', 580, (DI, DI))
def Y():
    w, yj = 580, 330
    yv = (yj * w - STEM * CAP) / (w - STEM)   # the arms are exactly a stem wide where it starts
    return zigzag([(0, CAP), (w / 2, yv), (w, CAP)]) | stem(w / 2 - STEM / 2, 0, yj)


@glyph('Z', 'Zz', 480, (OP + 6, OP + 6))
def Z():
    w = 480   # Z breaks the nib's rule, as in the classical capitals: a full diagonal
    return bar(0, w - 10, CAP - BAR) | bar(0, w, 0) | clip(band((w - 10, CAP), (0, 0), 1, -1, STEM), 0, 0, w, CAP)


# digits: lining, proportional

@glyph('zero', '0', 500, (RO, RO))
def zero():
    return ring(250, CAP / 2, 500, CAP + 2 * OVS)


@glyph('one', '1', 230, (60, ST))
def one():
    x = 230 - STEM
    flag = clip(band((x + 4, CAP), (0, CAP - 180), 1, 1), x0=0, y1=CAP)
    return stem(x) | flag


@glyph('two', '2', 470, (RO, RO))
def two():
    w = 470
    curve = path((STEM / 2 + 6, 520, 80), (w * 0.5, CAP + OVS - BAR / 2, 0), (w - STEM / 2 - 4, 500, 270),
                 (w * 0.55, 270, 225, 0.4), (8, BAR, 225))
    return clip(sweep(curve), x0=0, y0=0) | bar(0, w, 0)


@glyph('three', '3', 450, (RO, RO))
def three():
    w = 450
    upper = path((14, 575, 60), (w * 0.48, CAP + OVS - BAR / 2, 0), (w - STEM / 2 - 30, 548, 270),
                 (w * 0.42, 388, 180))
    lower = path((w * 0.42, 388, 0), (w - STEM / 2, 190, 270), (w * 0.48, -OVS + BAR / 2, 180), (6, 120, 120))
    return clip(sweep(upper) | sweep(lower) | bar(w * 0.36, w * 0.5, 388 - BAR / 2), x0=0)


@glyph('four', '4', 520, (OP, RO))
def four():
    w, xs, yb = 520, 340, 190
    diag = clip(band((xs, CAP), (0, yb + BAR), 1, 1), x0=0, y0=yb, y1=CAP)
    return stem(xs) | bar(0, w, yb) | diag


@glyph('five', '5', 460, (RO, RO))
def five():
    w, xv = 460, 30
    bowl = path((xv + STEM / 2, 372, 40), (w * 0.52, 455, 0), (w - STEM / 2, 225, 270),
                (w * 0.47, -OVS + BAR / 2, 180), (6, 110, 120))
    return clip(stem(xv, 360, CAP) | bar(xv, w - 10, CAP - BAR) | sweep(bowl), x0=0)


@glyph('six', '6', 480, (RO, RO))
def six():
    w = 480
    loop = ring(w / 2, 235, w, 470 + OVS)
    rise = path((STEM / 2, 240, 90), (w * 0.52, CAP + OVS - BAR / 2, 0, 0.62), (w - 26, 610, -60))
    return loop | clip(sweep(rise), x1=w - 24)


@glyph('seven', '7', 450, (OP, OP))
def seven():
    w = 450
    return bar(0, w, CAP - BAR) | clip(band((w, CAP), (110, 0), -1, -1), 0, 0, w, CAP)


@glyph('eight', '8', 470, (RO, RO))
def eight():
    w, waist = 470, 400
    return ring(w / 2, (CAP + OVS + waist - BAR) / 2, w - 70, CAP + OVS - waist + BAR) \
        | ring(w / 2, (waist - OVS) / 2, w, waist + OVS)


@glyph('nine', '9', 480, (RO, RO))
def nine():
    return affinity.rotate(six(), 180, origin=(240, CAP / 2))


# symbols: square dots, like the bar's folded squares

DOT = 62


@glyph('space', '  ', 250, (0, 0))
def space():
    return None


@glyph('period', '.', DOT, (60, 60))
def period():
    return box(0, 0, DOT, DOT)


@glyph('comma', ',', DOT, (60, 60))
def comma():
    return box(0, 0, DOT, DOT) | clip(band((DOT, DOT), (DOT - 50, -130), -1, -1, 30), y0=-130, y1=DOT)


@glyph('periodcentered', '·', DOT, (60, 60))
def periodcentered():
    return box(0, CAP / 2 - DOT / 2, DOT, CAP / 2 + DOT / 2)


@glyph('hyphen', '-', 260, (40, 40))
def hyphen():
    return box(0, 312, 260, 348)


@glyph('endash', '–', 500, (40, 40))
def endash():
    return box(0, 314, 500, 346)


@glyph('emdash', '—', 1000, (0, 0))
def emdash():
    return box(0, 314, 1000, 346)


@glyph('plus', '+', 440, (50, 50))
def plus():
    t = 38
    return box(220 - t / 2, CAP / 2 - 220, 220 + t / 2, CAP / 2 + 220) | box(0, CAP / 2 - t / 2, 440, CAP / 2 + t / 2)


# accented capitals

def acute(cx):
    return wedge((cx - 36, 772), (cx + 44, 898), 14, 44)


def tilde(cx):
    pts = [(cx - 130 + 260 * t / 80, 800 + 24 * math.sin(2 * math.pi * t / 80)) for t in range(81)]
    return sweep(pts)


for base, name, mark, chars in [('A', 'Aacute', acute, 'Áá'), ('E', 'Eacute', acute, 'Éé'),
                                ('I', 'Iacute', acute, 'Íí'), ('O', 'Oacute', acute, 'Óó'),
                                ('U', 'Uacute', acute, 'Úú'), ('N', 'Ntilde', tilde, 'Ññ')]:
    _, width, sb, draw = GLYPHS[base]
    centre = {'A': width / 2, 'I': STEM / 2, 'E': 190}.get(base, width / 2)
    glyph(name, chars, width, sb)(lambda draw=draw, mark=mark, centre=centre: draw() | mark(centre))


# --- font ------------------------------------------------------------------------------------

def contours(geom):
    geom = geom.buffer(0).simplify(0.3, preserve_topology=True)
    polys = [g for g in getattr(geom, 'geoms', [geom]) if g.geom_type == 'Polygon' and g.area > 1]
    for poly in polys:
        poly = orient(poly, sign=-1.0)   # TrueType: outer contours clockwise, counters anticlockwise
        for r in [poly.exterior, *poly.interiors]:
            pts = []
            for x, y in r.coords[:-1]:
                p = (round(x), round(y))
                if not pts or p != pts[-1]:
                    pts.append(p)
            if len(pts) > 2 and pts[0] == pts[-1]:
                pts.pop()
            if len(pts) > 2:
                yield pts


def draw(geom):
    pen = TTGlyphPen(None)
    if geom is not None:
        for c in contours(geom):
            pen.moveTo(c[0])
            for p in c[1:]:
                pen.lineTo(p)
            pen.closePath()
    return pen.glyph()


def notdef():
    return box(0, 0, 440, CAP).difference(box(40, 40, 400, CAP - 40))


KERN = '''
languagesystem DFLT dflt;
languagesystem latn dflt;
@A = [A Aacute];
@ROUND = [C G O Oacute Q];
feature kern {
  pos @A V -50;  pos V @A -50;
  pos @A W -36;  pos W @A -36;
  pos @A Y -50;  pos Y @A -50;
  pos @A T -36;  pos T @A -36;
  pos @A @ROUND -12;  pos @ROUND @A -12;
  pos L T -60;  pos L V -60;  pos L W -44;  pos L Y -60;
  pos F @A -30;  pos P @A -36;  pos T @ROUND -10;  pos @ROUND T -10;
  pos one one -24;  pos seven @A -30;
} kern;
'''


def build():
    OUT.mkdir(exist_ok=True)
    order = ['.notdef'] + list(GLYPHS)
    glyphs, metrics, cmap = {'.notdef': draw(notdef())}, {'.notdef': (520, 40)}, {}
    for name, (chars, width, (lsb, rsb), shape) in GLYPHS.items():
        geom = shape()
        if geom is not None:
            geom = affinity.translate(geom, lsb, 0)
        glyphs[name] = draw(geom)
        metrics[name] = (round(width + lsb + rsb), 0)
        for c in chars:
            cmap[ord(c)] = name

    fb = FontBuilder(UPM, isTTF=True)
    fb.setupGlyphOrder(order)
    fb.setupCharacterMap(cmap)
    fb.setupGlyf(glyphs)
    glyf = fb.font['glyf']
    for name in order:   # left side bearings are the drawn xMin
        g = glyf[name]
        g.recalcBounds(glyf)
        metrics[name] = (metrics[name][0], getattr(g, 'xMin', 0))
    fb.setupHorizontalMetrics(metrics)
    fb.setupHorizontalHeader(ascent=900, descent=-200)
    fb.setupNameTable({
        'familyName': FAMILY, 'styleName': STYLE,
        'uniqueFontIdentifier': f'{FAMILY.replace(" ", "")}-{STYLE};0.100',
        'fullName': f'{FAMILY} {STYLE}', 'psName': f'{FAMILY.replace(" ", "")}-{STYLE}',
        'version': 'Version 0.100',
        'description': 'Display capitals for Sáenz Valiente & Asociados, drawn from the SVA monogram.',
    })
    fb.setupOS2(sTypoAscender=900, sTypoDescender=-200, sTypoLineGap=0, usWinAscent=940, usWinDescent=220,
                sCapHeight=CAP, sxHeight=CAP, usWeightClass=300, fsSelection=0x40 | 0x80, achVendID='NONE', version=4)
    fb.setupPost()
    addOpenTypeFeaturesFromString(fb.font, KERN)
    ttf = OUT / f'{FAMILY.replace(" ", "")}-{STYLE}.ttf'
    fb.save(ttf)
    fb.font.flavor = 'woff2'
    fb.font.save(ttf.with_suffix('.woff2'))
    print(f'{ttf.name}: {ttf.stat().st_size} B, woff2: {ttf.with_suffix(".woff2").stat().st_size} B, '
          f'{len(order)} glyphs')


if __name__ == '__main__':
    build()
