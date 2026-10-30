# 5.2: abstract forest-green light on paper, for the hero (no symbol). Three takes; Franco chose C, "Velo",
# which ships as src/assets/art/fig-01-papel.jpg (light-c.png → JPEG q2).
# Writes design/art/light-{a,b,c}.html; render each at 2400 x 1500 with
#   node scripts/shoot.mjs http://127.0.0.1:<port>/design/art/light-a.html <out> --widths 2400 --height 1500 --out <file>.png
# The light lives in the upper right: the hero's text sits bottom left, with the name along the bottom.
import pathlib
root = pathlib.Path(__file__).resolve().parents[2]
W, H = 2400, 1500

def page(light_svg):
    return f'''<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>html,body{{margin:0;width:{W}px;height:{H}px;overflow:hidden;background:#121510}}
svg{{position:absolute;inset:0;width:{W}px;height:{H}px}}
.light{{mix-blend-mode:screen}}.tooth{{mix-blend-mode:overlay;opacity:.55}}.dither{{mix-blend-mode:soft-light;opacity:.5}}</style></head><body>
<!-- 1. paper in shadow: forest-black, slow mottling, darker toward the lower left where the text sits -->
<svg viewBox="0 0 {W} {H}">
  <defs>
    <filter id="mottle" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
      <feTurbulence type="fractalNoise" baseFrequency="0.0015 0.0022" numOctaves="4" seed="7"/>
      <feColorMatrix type="matrix" values="0 0 0 0 0.62  0 0 0 0 0.68  0 0 0 0 0.56  0.9 0 0 0 -0.32"/>
    </filter>
    <linearGradient id="fall" x1="1" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#1c2118"/><stop offset="0.55" stop-color="#141712"/><stop offset="1" stop-color="#0f110d"/>
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#fall)"/>
  <rect width="100%" height="100%" filter="url(#mottle)" opacity="0.08"/>
</svg>
<!-- 2. the light -->
{light_svg}
<!-- 3. paper tooth, raked from the upper right: 50 % grey on flat paper, so overlay only shows the fibres -->
<svg class="tooth" viewBox="0 0 {W} {H}">
  <defs>
    <filter id="tooth" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
      <feTurbulence type="fractalNoise" baseFrequency="0.22 0.07" numOctaves="3" seed="23" result="fibres"/>
      <feDiffuseLighting in="fibres" surfaceScale="1.6" diffuseConstant="1.1" lighting-color="#808080">
        <feDistantLight azimuth="40" elevation="38"/>
      </feDiffuseLighting>
    </filter>
  </defs>
  <rect width="100%" height="100%" filter="url(#tooth)"/>
</svg>
<!-- No dither layer: the page's own grain (body::after) already breaks up any banding, and fine
     noise baked in here cost 30 KB of AVIF at 1920 px -->
</body></html>'''

def blur(sd):
    # The region is in page units: a region relative to each shape clips a wide blur into a hard edge
    return f'<filter id="b{sd}" filterUnits="userSpaceOnUse" x="-600" y="-600" width="{W + 1200}" height="{H + 1200}"><feGaussianBlur stdDeviation="{sd}"/></filter>'

# A. Ventana: a window's four panes thrown across the paper from the upper right, softened to abstraction
def ventana():
    panes = ''
    # each pane is a sheared quad; the gap between them is the mullion's shadow
    for (x, y) in [(1430, 120), (1790, 90), (1480, 520), (1840, 490)]:
        panes += f'<path d="M{x} {y} l330 -30 l120 360 l-330 30 z"/>'
    return f'''<svg class="light" viewBox="0 0 {W} {H}">
  <defs>{blur(70)}{blur(30)}{blur(220)}
    <radialGradient id="glow" cx="0.74" cy="0.22" r="0.5"><stop offset="0" stop-color="#5d6a4c" stop-opacity=".55"/><stop offset="1" stop-color="#2a3220" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#glow)"/>
  <g fill="#7f8d68" opacity=".55" filter="url(#b70)" transform="rotate(-6 1800 400)">{panes}</g>
  <g fill="#c3ccae" opacity=".22" filter="url(#b30)" transform="rotate(-6 1800 400)">{panes}</g>
</svg>'''

# B. Halo: one wide glow, off centre, like a lamp on paper
def halo():
    return f'''<svg class="light" viewBox="0 0 {W} {H}">
  <defs>
    <radialGradient id="h1" cx="0.72" cy="0.26" r="0.62" gradientTransform="translate(0.72 0.26) scale(1 1.25) translate(-0.72 -0.26)">
      <stop offset="0" stop-color="#7b8a63" stop-opacity=".78"/><stop offset=".35" stop-color="#4b573c" stop-opacity=".55"/>
      <stop offset=".7" stop-color="#2a3220" stop-opacity=".25"/><stop offset="1" stop-color="#2a3220" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="h2" cx="0.78" cy="0.18" r="0.22"><stop offset="0" stop-color="#b9c4a2" stop-opacity=".28"/><stop offset="1" stop-color="#b9c4a2" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#h1)"/>
  <rect width="100%" height="100%" fill="url(#h2)"/>
</svg>'''

# C. Velo: long soft bands, like sun through a sheer curtain
def velo():
    bands = [(1250, 90, .30, 60), (1420, 160, .45, 45), (1640, 70, .35, 30), (1760, 210, .55, 70),
             (2010, 120, .40, 40), (2170, 260, .50, 90), (2380, 90, .30, 35)]
    rects = ''.join(f'<rect x="{x}" y="-300" width="{w}" height="{H + 600}" opacity="{o}" filter="url(#b{sd})"/>' for x, w, o, sd in bands)
    return f'''<svg class="light" viewBox="0 0 {W} {H}">
  <defs>{blur(30)}{blur(35)}{blur(40)}{blur(45)}{blur(60)}{blur(70)}{blur(90)}
    <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff"/><stop offset=".55" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
    <mask id="m" maskUnits="userSpaceOnUse" x="0" y="0" width="{W}" height="{H}"><rect width="100%" height="100%" fill="url(#fade)"/></mask>
  </defs>
  <g mask="url(#m)"><g fill="#76855f" transform="rotate(14 1900 700)">{rects}</g></g>
</svg>'''

if __name__ == '__main__':   # build-mark.py imports page() and velo() from here (7.9)
    for name, fn in [('a', ventana), ('b', halo), ('c', velo)]:
        (root / f'design/art/light-{name}.html').write_text(page(fn()))
    print('ok')
