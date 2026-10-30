# Writes the art render pages (design/art/*.html) with the monogram path inlined.
# Render each with: node scripts/shoot.mjs http://127.0.0.1:4399/design/art/<page>.html <out> --widths W --height H --out <file>
import re, pathlib
root = pathlib.Path(__file__).resolve().parents[2]
d = re.search(r' d="([^"]+)"', (root / 'src/assets/brand/monogram.svg').read_text()).group(1)
MONO = f'<path transform="translate(0,849) scale(0.1,-0.1)" d="{d}"/>'

def relieve(size=1800, mono_h=1380, cx=0.5, top=210):
    k = mono_h / 849; w = 581 * k; x = size * cx - w / 2
    place = f'translate({x:.1f},{top}) scale({k:.4f})'
    return f'''<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>html,body{{margin:0;width:{size}px;height:{size}px;overflow:hidden;background:#262624}}
svg{{position:absolute;inset:0;width:{size}px;height:{size}px}}.light{{mix-blend-mode:overlay}}</style></head><body>
<!-- 1. stone: base tone, slow mottling, vignette -->
<svg viewBox="0 0 {size} {size}">
  <defs>
    <filter id="mottle" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
      <feTurbulence type="fractalNoise" baseFrequency="0.0018 0.0026" numOctaves="4" seed="11"/>
      <feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0.9 0 0 0 -0.3"/>
    </filter>
    <radialGradient id="vig" cx="0.42" cy="0.38" r="0.85">
      <stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.55"/>
    </radialGradient>
  </defs>
  <rect width="100%" height="100%" fill="#333331"/>
  <rect width="100%" height="100%" filter="url(#mottle)" opacity="0.10"/>
  <rect width="100%" height="100%" fill="url(#vig)"/>
</svg>
<!-- 2. relief: the monogram pressed in, lit from the upper left. Flat = 50 % grey, so overlay leaves it untouched -->
<svg class="light" viewBox="0 0 {size} {size}">
  <defs>
    <filter id="relief" x="0" y="0" width="{size}" height="{size}" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
      <feGaussianBlur in="SourceAlpha" stdDeviation="4" result="soft"/>
      <feComponentTransfer in="soft" result="pressed"><feFuncA type="linear" slope="-1" intercept="1"/></feComponentTransfer>
      <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="4" result="bumps"/>
      <feComposite in="pressed" in2="bumps" operator="arithmetic" k1="0" k2="0.9" k3="0.06" k4="0" result="height"/>
      <feDiffuseLighting in="height" surfaceScale="10" diffuseConstant="1" lighting-color="#fff">
        <feDistantLight azimuth="215" elevation="27"/>
      </feDiffuseLighting>
    </filter>
  </defs>
  <g filter="url(#relief)"><rect width="100%" height="100%" fill="none"/><g transform="{place}">{MONO}</g></g>
</svg>
<!-- 3. the floor of the cut is a touch darker -->
<svg viewBox="0 0 {size} {size}" style="opacity:.18"><g transform="{place}" fill="#000">{MONO}</g></svg>
</body></html>'''

(root / 'design/art/relieve.html').write_text(relieve())
print('ok')

def luz(w=1400, h=1800, mono_h=1500):
    k = mono_h / 849
    place = f'translate(250,200) scale({k:.4f})'
    return f'''<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>html,body{{margin:0;width:{w}px;height:{h}px;overflow:hidden;background:#1e211b}}
svg{{position:absolute;inset:0;width:{w}px;height:{h}px}}
.beam{{transform:perspective(2400px) rotateY(-16deg) rotateZ(-5deg) scale(1.08);transform-origin:30% 40%;mix-blend-mode:screen}}
.texture{{mix-blend-mode:overlay;opacity:.75}}</style></head><body>
<!-- 1. wall: dark, uneven -->
<svg viewBox="0 0 {w} {h}">
  <defs><filter id="m" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.003 0.002" numOctaves="4" seed="21"/>
  <feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0.8 0 0 0 -0.25"/></filter></defs>
  <rect width="100%" height="100%" fill="#1e211b"/><rect width="100%" height="100%" filter="url(#m)" opacity=".08"/>
</svg>
<!-- 2. the beam: a soft halo, then the sharp-ish monogram, fading toward the lower right -->
<svg class="beam" viewBox="0 0 {w} {h}">
  <defs>
    <filter id="halo" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="60"/></filter>
    <filter id="focus" x="-5%" y="-5%" width="110%" height="110%"><feGaussianBlur stdDeviation="1.6"/></filter>
    <radialGradient id="fall" cx="0.3" cy="0.25" r="0.95"><stop offset="0" stop-color="#fff"/><stop offset="0.55" stop-color="#fff" stop-opacity=".75"/><stop offset="1" stop-color="#fff" stop-opacity=".12"/></radialGradient>
    <mask id="fade"><rect width="100%" height="100%" fill="url(#fall)"/></mask>
  </defs>
  <g mask="url(#fade)">
    <g transform="{place}" fill="#d9d6c8" opacity=".34" filter="url(#halo)">{MONO}</g>
    <g transform="{place}" fill="#ece9de" filter="url(#focus)">{MONO}</g>
  </g>
</svg>
<!-- 3. wall texture lit by the beam: overlay shows it most where the light is -->
<svg class="texture" viewBox="0 0 {w} {h}">
  <defs><filter id="t" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
    <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="3" seed="8" result="n"/>
    <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0.6 0 0 0 0.2" result="hm"/>
    <feDiffuseLighting in="hm" surfaceScale="1.6" diffuseConstant="1"><feDistantLight azimuth="20" elevation="30"/></feDiffuseLighting>
  </filter></defs>
  <rect width="100%" height="100%" filter="url(#t)"/>
</svg>
</body></html>'''

(root / 'design/art/luz.html').write_text(luz())
print('luz ok')
