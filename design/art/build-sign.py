# 7.12 (Franco, 2026-10-22): "a raw old pen signed logo, hand-written style, in the background paper", in
# place of the pressed monogram (7.9). The signature is written in iron-gall ink on the hero's paper
# ("Velo", build-light.py): dark, multiplied into the paper, so it reads where the light falls and sinks
# into the shade, with raw edges, uneven density and a slight bleed. Four takes, two texts in two hands:
#   A. "Sáenz Valiente", a quick signature (Herr Von Muellerhoff)
#   B. "SVA", the same hand
#   C. "Sáenz Valiente", an 18th-century quill hand (Meddon)
#   D. "SVA", the quill hand
# Franco chose D (7.12), then their own logo instead (7.12b, take M), then no mark at all (7.12c): the hero
# is the plain Velo light again. Kept for the record.
# The hands are OFL fonts in design/art/fonts/ (with their licences); they only draw this image, nothing
# ships to visitors. Writes design/art/sign-{a,b,c,d}.html; render each at 2400 x 1500:
#   node scripts/shoot.mjs file://$PWD/design/art/sign-a.html <out> --widths 2400 --height 1500 --out <file>.png
import importlib.util, pathlib, re

root = pathlib.Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('build_light', root / 'design/art/build-light.py')
light = importlib.util.module_from_spec(spec)
spec.loader.exec_module(light)
W, H, page, velo = light.W, light.H, light.page, light.velo

HANDS = {
    'quick': ('Quick', 'fonts/herrvonmuellerhoff/HerrVonMuellerhoff-Regular.ttf'),
    'quill': ('Quill', 'fonts/meddon/Meddon.ttf'),
}
INK = '#140f0a'          # iron-gall, brown-black
CX, CY = 1665, 470       # upper right, in the light; a take stays inside the phone crop (x ≈ 1290–2035)


def ink(text, hand, size, rotate=-7, paraph=None, start=None):
    """The signature in ink. paraph: (dx0, dy0, dx1, dy1, sag) of a tapered sweep under it, relative to the
    centre; start: (dx, dy) where the pen first touched, for a few spatter droplets"""
    family, src = HANDS[hand]
    extra = ''
    if paraph:
        x0, y0, x1, y1, sag = paraph
        mx, my = (x0 + x1) / 2, max(y0, y1) + sag
        # a closed sliver: thick in the middle, a hairline at both ends, like a quick nib stroke
        extra += (f'<path d="M{CX + x0} {CY + y0} Q{CX + mx} {CY + my + 9} {CX + x1} {CY + y1} '
                  f'Q{CX + mx} {CY + my - 9} {CX + x0} {CY + y0}z" fill="{INK}"/>')
    if start:
        sx, sy = start
        for dx, dy, r in [(-34, -18, 5), (-52, 6, 3), (-18, 24, 2.5), (-70, -10, 2), (-41, 30, 1.8)]:
            extra += f'<circle cx="{CX + sx + dx}" cy="{CY + sy + dy}" r="{r}" fill="{INK}"/>'
    drawing = (f'<text x="{CX}" y="{CY}" text-anchor="middle" dominant-baseline="middle" font-family="{family}" '
               f'font-size="{size}" fill="{INK}">{text}</text>{extra}')
    return inked(drawing, rotate, f'<style>@font-face{{font-family:{family};src:url({src})}}</style>')


def inked(drawing, rotate=-7, head=''):
    """Any drawing, in iron-gall ink on the paper: wobble, frayed fibres, dry-nib streaks, pooling, bleed"""
    return f'''<svg viewBox="0 0 {W} {H}" style="mix-blend-mode:multiply">
  {head}
  <defs>
    <filter id="ink" filterUnits="userSpaceOnUse" x="0" y="0" width="{W}" height="{H}" color-interpolation-filters="sRGB">
      <!-- a slow wobble of the hand, then fibres fraying the edge -->
      <feTurbulence type="fractalNoise" baseFrequency="0.011" numOctaves="2" seed="5" result="wob"/>
      <feDisplacementMap in="SourceGraphic" in2="wob" scale="10" xChannelSelector="R" yChannelSelector="G" result="w"/>
      <feTurbulence type="fractalNoise" baseFrequency="0.32" numOctaves="3" seed="9" result="fibre"/>
      <feDisplacementMap in="w" in2="fibre" scale="6" xChannelSelector="R" yChannelSelector="G" result="frayed"/>
      <!-- the nib running dry: streaks along the paper's grain take ink away -->
      <feTurbulence type="fractalNoise" baseFrequency="0.9 0.035" numOctaves="2" seed="21" result="grain"/>
      <feColorMatrix in="grain" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -3.2 2.35" result="dry"/>
      <!-- density: where the pen pooled or thinned -->
      <feTurbulence type="fractalNoise" baseFrequency="0.005 0.018" numOctaves="3" seed="13" result="flow"/>
      <feColorMatrix in="flow" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 2.2 -0.55" result="flowA"/>
      <feComposite in="frayed" in2="flowA" operator="arithmetic" k1="0.9" k2="0.35" k3="0" k4="0" result="dense"/>
      <feComposite in="dense" in2="dry" operator="in" result="inked"/>
      <!-- a little bleed into the paper -->
      <feGaussianBlur in="inked" stdDeviation="1.8" result="bleed"/>
      <feMerge><feMergeNode in="bleed"/><feMergeNode in="inked"/></feMerge>
    </filter>
  </defs>
  <g transform="rotate({rotate} {CX} {CY})" filter="url(#ink)" opacity=".9">{drawing}</g>
</svg>'''


# 7.12b (Franco): "none of those, it needs to be the same as their logo". Their SVA monogram, exact
# (src/assets/brand/monogram.svg), put on the paper in the same ink: filled as with a broad nib (E), or
# traced in a fine pen line, twice, the way a hand copies a drawing (F)
MONO_D = re.search(r' d="([^"]+)"', (root / 'src/assets/brand/monogram.svg').read_text()).group(1)
MW, MH = 581, 849


def logo(height=600, filled=True, rotate=-3):
    k = height / MH
    place = f'translate({CX - MW * k / 2:.1f} {CY - height / 2:.1f}) scale({k:.4f})'
    path = f'<path transform="translate(0,{MH}) scale(0.1,-0.1)" d="{MONO_D}" '
    if filled:
        body = path + f'fill="{INK}"/>'
    else:   # a fine pen line (in the logo's own units, 10× the canvas), traced twice, a hair apart
        w = 2.4 / k * 10
        body = (path + f'fill="none" stroke="{INK}" stroke-width="{w:.0f}" stroke-linejoin="round"/>'
                + f'<g transform="translate(24 -16)" opacity=".55">' + path
                + f'fill="none" stroke="{INK}" stroke-width="{w * 0.7:.0f}" stroke-linejoin="round"/></g>')
    drops = ''.join(f'<circle cx="{CX - 230 + dx}" cy="{CY + 120 + dy}" r="{r}" fill="{INK}"/>'
                    for dx, dy, r in [(-20, -10, 4.5), (-38, 8, 2.6), (-8, 20, 2), (-52, -4, 1.8)])
    return inked(f'<g transform="{place}">{body}</g>{drops}', rotate)


# 7.12b, second round (Franco: "F but bigger with more detailed realistic look"): their logo larger, hand-inked
# like an engraver's copy: a traced outline, a partial reinforcing pass a hair off, fine hatching in the thick
# strokes with the breaks of a real hand; optionally over faint pencil guides (H)
def logo_inked(height=860, guides=False, rotate=-3, seed=7, spacing=8.5, hatch_w=1.9, pen=3.6, drops=None):
    import random
    rnd = random.Random(seed)
    k = height / MH
    left, top = CX - MW * k / 2, CY - height / 2
    place = f'translate({left:.1f} {top:.1f}) scale({k:.4f})'
    # clipPath takes shapes only (no <g>), so the placement goes on the path itself
    shape = f'<path transform="{place} translate(0,{MH}) scale(0.1,-0.1)" d="{MONO_D}"/>'
    w = pen / k * 10                      # pen width in the path's own units (10x the canvas, then k)
    outline = (f'<g transform="{place}"><path transform="translate(0,{MH}) scale(0.1,-0.1)" d="{MONO_D}" '
               f'fill="none" stroke="{INK}" stroke-width="{w:.0f}" stroke-linejoin="round"/></g>')
    # a second pass over parts of the outline only, a hair off, as a hand reinforces a line
    dash = ' '.join(str(rnd.choice([900, 1400, 2200, 3000])) + ' ' + str(rnd.choice([700, 1500, 2600])) for _ in range(12))
    second = (f'<g transform="translate(5 -4) {place}" opacity=".6"><path transform="translate(0,{MH}) scale(0.1,-0.1)" '
              f'd="{MONO_D}" fill="none" stroke="{INK}" stroke-width="{w * 0.75:.0f}" stroke-dasharray="{dash}"/></g>')
    # hatching inside the strokes: parallel lines at the nib's angle, each broken where the hand lifted
    hatch, angle = [], -58
    import math
    dx, dy = math.cos(math.radians(angle)), math.sin(math.radians(angle))
    nx, ny = -dy, dx
    span = height * 1.4
    for i in range(int(span * 2 / spacing)):
        off = -span + i * spacing + rnd.uniform(-1.2, 1.2)
        cx, cy = CX + nx * off, CY + ny * off
        x0, y0, x1, y1 = cx - dx * span, cy - dy * span, cx + dx * span, cy + dy * span
        gaps = ' '.join(f'{rnd.randint(60, 260)} {rnd.randint(4, 22)}' for _ in range(10))
        hatch.append(f'<path d="M{x0:.0f} {y0:.0f}L{x1:.0f} {y1:.0f}" stroke-dasharray="{gaps}" '
                     f'stroke-dashoffset="{rnd.randint(0, 200)}"/>')
    hatching = (f'<clipPath id="mono">{shape}</clipPath>'
                f'<g clip-path="url(#mono)" stroke="{INK}" stroke-width="{hatch_w}" fill="none" opacity=".95">{"".join(hatch)}</g>')
    if drops is None:
        drops = ''.join(f'<circle cx="{CX - 300 + dx_}" cy="{CY + 210 + dy_}" r="{r}" fill="{INK}"/>'
                        for dx_, dy_, r in [(-20, -10, 4.5), (-38, 8, 2.6), (-8, 20, 2), (-52, -4, 1.8)])
    layers = inked(hatching + outline + second + drops, rotate)
    if guides:
        # faint pencil: a cap line, a baseline and the slant axis, ruled and partly rubbed out
        gx0, gx1 = CX - 420, CX + 420
        pencil = (f'<svg viewBox="0 0 {W} {H}" style="mix-blend-mode:multiply" opacity=".32">'
                  f'<g transform="rotate({rotate} {CX} {CY})" stroke="#5b5d55" stroke-width="1.4" fill="none" stroke-dasharray="340 18 120 30 520 12">'
                  f'<path d="M{gx0} {top + 6}H{gx1}"/><path d="M{gx0} {top + height - 6}H{gx1}"/>'
                  f'<path d="M{CX - 150} {top - 40}L{CX + 140} {top + height + 40}"/></g></svg>')
        layers = pencil + layers
    return layers


# 7.12b, third round (Franco: "I do not see changes from G to H. And ink?"). Measured: even in the light the
# paper is #353d2d, so black ink reaches 2:1 at best and the hatched strokes 1.3:1; ink can't read there.
# So the mark gets a pool of light on the paper, as if the sun fell on the page, and the ink is dense:
#   J. their logo filled in iron-gall ink: pooled darker edges, dry streaks, bleed, blots
#   K. their logo as a pen engraving: outline, dense hatching, a reinforcing pass
#   L. J in a faded brown, the colour old iron-gall ink turns
SEPIA = '#3a2412'


def lamp():
    """A soft pool of light on the paper behind the mark (screen blend, in the bands' green)"""
    return f'''<svg viewBox="0 0 {W} {H}" style="mix-blend-mode:screen">
  <defs><radialGradient id="pool" cx="{CX}" cy="{CY}" r="560" gradientUnits="userSpaceOnUse"
      gradientTransform="translate({CX} {CY}) scale(1 1.15) rotate(-12) translate({-CX} {-CY})">
    <stop offset="0" stop-color="#8e9a74" stop-opacity=".95"/><stop offset=".45" stop-color="#6f7b58" stop-opacity=".6"/>
    <stop offset="1" stop-color="#2a3220" stop-opacity="0"/></radialGradient></defs>
  <rect width="100%" height="100%" fill="url(#pool)"/>
</svg>'''


def logo_filled_ink(color=INK, height=860, rotate=-3):
    k = height / MH
    place = f'translate({CX - MW * k / 2:.1f} {CY - height / 2:.1f}) scale({k:.4f})'
    blots = ''.join(f'<circle cx="{CX + x}" cy="{CY + y}" r="{r}" fill="{color}"/>'
                    for x, y, r in [(-318, 215, 7), (-340, 232, 3.5), (-300, 240, 2.5), (-355, 205, 2.2), (232, 410, 5), (250, 424, 2.4)])
    return f'''<svg viewBox="0 0 {W} {H}" style="mix-blend-mode:multiply">
  <defs>
    <filter id="wet" filterUnits="userSpaceOnUse" x="0" y="0" width="{W}" height="{H}" color-interpolation-filters="sRGB">
      <feTurbulence type="fractalNoise" baseFrequency="0.011" numOctaves="2" seed="5" result="wob"/>
      <feDisplacementMap in="SourceGraphic" in2="wob" scale="9" xChannelSelector="R" yChannelSelector="G" result="w"/>
      <feTurbulence type="fractalNoise" baseFrequency="0.3" numOctaves="3" seed="9" result="fibre"/>
      <feDisplacementMap in="w" in2="fibre" scale="5" xChannelSelector="R" yChannelSelector="G" result="frayed"/>
      <!-- ink dries darker at its edges: the rim at full strength, the body lighter and uneven -->
      <feMorphology in="frayed" operator="erode" radius="3" result="inner"/>
      <feComposite in="frayed" in2="inner" operator="out" result="rim"/>
      <feTurbulence type="fractalNoise" baseFrequency="0.004 0.02" numOctaves="3" seed="13" result="flow"/>
      <feColorMatrix in="flow" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1.4 0.05" result="flowA"/>
      <feComposite in="inner" in2="flowA" operator="arithmetic" k1="0.85" k2="0" k3="0" k4="0" result="body"/>
      <feTurbulence type="fractalNoise" baseFrequency="0.9 0.04" numOctaves="2" seed="21" result="grain"/>
      <feColorMatrix in="grain" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -2.6 2.2" result="dry"/>
      <feComposite in="body" in2="dry" operator="in" result="bodyDry"/>
      <feGaussianBlur in="frayed" stdDeviation="2.2" result="bleed"/>
      <feComponentTransfer in="bleed" result="halo"><feFuncA type="linear" slope=".45"/></feComponentTransfer>
      <feMerge><feMergeNode in="halo"/><feMergeNode in="bodyDry"/><feMergeNode in="rim"/><feMergeNode in="rim"/></feMerge>
    </filter>
  </defs>
  <g transform="rotate({rotate} {CX} {CY})" filter="url(#wet)">
    <g transform="{place}"><path transform="translate(0,{MH}) scale(0.1,-0.1)" d="{MONO_D}" fill="{color}"/></g>{blots}
  </g>
</svg>'''


# 7.12b, fourth round (Franco: "I prefer K but we need to add more rough pencil lines like if it was drawn in
# a draft and later on ink like old quill pen with some raw drops"). M: K over a pencil draft (loose
# outline passes, construction lines overshooting the strokes, sketched bowls), inked with the quill, with
# raw drops and splatter. Franco, on seeing it: the pencil black, with the ink drawing on top of it.
GRAPHITE = '#262624'   # black pencil (Franco), multiplied into the paper: thin, grainy, under the ink


def pencil_draft(height=860, rotate=-3, seed=11):
    import random
    rnd = random.Random(seed)
    k = height / MH
    left, top = CX - MW * k / 2, CY - height / 2
    place = f'translate({left:.1f} {top:.1f}) scale({k:.4f})'
    w = 1.9 / k * 10
    passes = ''
    for _ in range(6):   # the outline sketched several times, never quite on the same line
        dx, dy, rot, sc = rnd.uniform(-11, 11), rnd.uniform(-11, 11), rnd.uniform(-1.6, 1.6), rnd.uniform(0.978, 1.025)
        dash = ' '.join(f'{rnd.randint(400, 2600)} {rnd.randint(80, 700)}' for _ in range(10))
        passes += (f'<g transform="translate({dx:.1f} {dy:.1f}) rotate({rot:.2f} {CX} {CY}) translate({CX} {CY}) scale({sc:.3f}) '
                   f'translate({-CX} {-CY}) {place}"><path transform="translate(0,{MH}) scale(0.1,-0.1)" d="{MONO_D}" '
                   f'fill="none" stroke="{GRAPHITE}" stroke-width="{w:.0f}" stroke-dasharray="{dash}"/></g>')
    # construction lines, in the drawing's own frame (measured on the inked render, then unrotated),
    # each overshooting its stroke the way a draftsman rules a line
    lines = [((1440, 300), (1700, 820)),    # V, heavy stroke
             ((1860, 290), (1660, 800)),    # V, hairline
             ((1820, 300), (1990, 920)),    # A, right leg
             ((1650, 705), (1880, 696)),    # A, bar
             ((1300, 62), (2010, 62)),      # cap line
             ((1300, 878), (2010, 878))]    # baseline
    ruled = ''.join(f'<path d="M{x0 + rnd.uniform(-3, 3):.0f} {y0 + rnd.uniform(-3, 3):.0f}L{x1 + rnd.uniform(-3, 3):.0f} {y1 + rnd.uniform(-3, 3):.0f}"/>'
                    for (x0, y0), (x1, y1) in lines for _ in range(2))
    # the S's two bowls, sketched as loose ovals first
    bowls = ''.join(f'<ellipse cx="{cx + rnd.uniform(-6, 6):.0f}" cy="{cy + rnd.uniform(-6, 6):.0f}" rx="{rx}" ry="{ry}" '
                    f'transform="rotate({rnd.uniform(-14, -4):.1f} {cx} {cy})" stroke-dasharray="{rnd.randint(300, 600)} {rnd.randint(40, 160)}"/>'
                    for cx, cy, rx, ry in [(1510, 165, 128, 98), (1515, 168, 120, 104), (1545, 400, 118, 92), (1540, 395, 126, 86)])
    return f'''<svg viewBox="0 0 {W} {H}" style="mix-blend-mode:multiply" opacity=".8">
  <defs><filter id="graphite" filterUnits="userSpaceOnUse" x="0" y="0" width="{W}" height="{H}">
    <feTurbulence type="fractalNoise" baseFrequency="0.02" numOctaves="2" seed="3" result="wob"/>
    <feDisplacementMap in="SourceGraphic" in2="wob" scale="6" xChannelSelector="R" yChannelSelector="G" result="w"/>
    <feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves="2" seed="17" result="tooth"/>
    <feColorMatrix in="tooth" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -2.2 1.7" result="grain"/>
    <feComposite in="w" in2="grain" operator="in"/>
  </filter></defs>
  <g filter="url(#graphite)" fill="none">
    <g transform="rotate({rotate} {CX} {CY})">{passes}</g>
    <g stroke="{GRAPHITE}" stroke-width="2" stroke-linecap="round">{ruled}{bowls}</g>
  </g>
</svg>'''


def raw_drops(color=INK, seed=4):
    """Raw quill drops: a few irregular blots, each with satellites and a splatter tail"""
    import random, math
    rnd = random.Random(seed)
    out = ''
    for bx, by, big in [(1395, 640, 13), (2015, 905, 9), (1905, 140, 6)]:
        out += f'<ellipse cx="{bx}" cy="{by}" rx="{big}" ry="{big * rnd.uniform(0.7, 0.95):.1f}" transform="rotate({rnd.randint(0, 180)} {bx} {by})" fill="{color}"/>'
        ang = rnd.uniform(0, 2 * math.pi)
        for i in range(rnd.randint(5, 8)):
            a = ang + rnd.uniform(-0.6, 0.6)
            d = big * rnd.uniform(1.4, 4.2)
            r = max(1.1, big * rnd.uniform(0.08, 0.32))
            out += f'<circle cx="{bx + math.cos(a) * d:.1f}" cy="{by + math.sin(a) * d:.1f}" r="{r:.1f}" fill="{color}"/>'
        tx, ty = bx + math.cos(ang) * big * 2.2, by + math.sin(ang) * big * 2.2
        out += f'<ellipse cx="{tx:.1f}" cy="{ty:.1f}" rx="{big * 0.9:.1f}" ry="{big * 0.22:.1f}" transform="rotate({math.degrees(ang):.0f} {tx:.1f} {ty:.1f})" fill="{color}"/>'
    return out


def wet_drops(color=INK):
    """The raw drops in wet ink: solid, with darker rims and a slight bleed (no dry-nib streaks)"""
    return f'''<svg viewBox="0 0 {W} {H}" style="mix-blend-mode:multiply">
  <defs><filter id="drops" filterUnits="userSpaceOnUse" x="0" y="0" width="{W}" height="{H}" color-interpolation-filters="sRGB">
    <feTurbulence type="fractalNoise" baseFrequency="0.09" numOctaves="2" seed="31" result="edge"/>
    <feDisplacementMap in="SourceGraphic" in2="edge" scale="5" xChannelSelector="R" yChannelSelector="G" result="raw"/>
    <feGaussianBlur in="raw" stdDeviation="1.4" result="bleed"/>
    <feMerge><feMergeNode in="bleed"/><feMergeNode in="raw"/></feMerge>
  </filter></defs>
  <g filter="url(#drops)" opacity=".92">{raw_drops(color)}</g>
</svg>'''


def draft_then_ink():
    return pencil_draft() + logo_inked(spacing=5.5, hatch_w=2.8, pen=5, drops='') + wet_drops()


TAKES = {
    # the full name is set to fit about 640 wide, so phones show all of it
    'a': dict(text='Sáenz Valiente', hand='quick', size=146, paraph=(-215, 78, 315, 50, 20), start=(-282, 22)),
    'b': dict(text='SVA', hand='quick', size=320, paraph=(-190, 150, 300, 110, 30), start=(-250, 50)),
    'c': dict(text='Sáenz Valiente', hand='quill', size=72, start=(-310, 15)),
    'd': dict(text='SVA', hand='quill', size=170, start=(-300, 30)),
}

if __name__ == '__main__':
    for name, take in TAKES.items():
        (root / f'design/art/sign-{name}.html').write_text(page(velo() + ink(**take)))
    (root / 'design/art/sign-e.html').write_text(page(velo() + logo(filled=True)))
    (root / 'design/art/sign-f.html').write_text(page(velo() + logo(filled=False)))
    (root / 'design/art/sign-g.html').write_text(page(velo() + logo_inked()))
    (root / 'design/art/sign-h.html').write_text(page(velo() + logo_inked(guides=True)))
    (root / 'design/art/sign-j.html').write_text(page(velo() + lamp() + logo_filled_ink()))
    (root / 'design/art/sign-k.html').write_text(page(velo() + lamp() + logo_inked(spacing=5.5, hatch_w=2.8, pen=5)))
    (root / 'design/art/sign-l.html').write_text(page(velo() + lamp() + logo_filled_ink(SEPIA)))
    (root / 'design/art/sign-m.html').write_text(page(velo() + lamp() + draft_then_ink()))
    print('ok')
