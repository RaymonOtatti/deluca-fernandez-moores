# 7.9 (Franco, 2026-10-22): the SVA monogram embedded in the hero's light ("Velo", build-light.py).
# Four takes, all upper right, inside the light and inside the phone crop (x ≈ 1290–2040 of 2400),
# clear of the name along the bottom:
#   A. Relieve: pressed into the paper, raked by the same light, so it shows where the light falls
#   B. Sombra: a soft shadow inside the light, as if cast through an etched window
#   C. Luz: the monogram made of light, a soft core in a wide glow
#   D. Grabado: a fine engraved outline that catches the light
# Franco chose A, "Relieve": it ships as src/assets/art/fig-01-papel.jpg (mark-a.png → JPEG, sips quality 85).
# Writes design/art/mark-{a,b,c,d}.html; render each at 2400 x 1500 like the light takes:
#   node scripts/shoot.mjs file://$PWD/design/art/mark-a.html <out> --widths 2400 --height 1500 --out <file>.png
import importlib.util, pathlib, re

root = pathlib.Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('build_light', root / 'design/art/build-light.py')
light = importlib.util.module_from_spec(spec)
spec.loader.exec_module(light)
W, H, page, velo = light.W, light.H, light.page, light.velo

d = re.search(r' d="([^"]+)"', (root / 'src/assets/brand/monogram.svg').read_text()).group(1)
MW, MH = 581, 849
MONO_H = 720                      # on the 1500-high canvas
K = MONO_H / MH
CX, CY = 1700, 500                # centre of the monogram


def mono(attrs=''):
    """The monogram, placed upright (a projection's rotation and shear turned the V and A into
    near-verticals, so it read "SH": the letterforms stay true)"""
    place = f'translate({CX - MW * K / 2:.1f} {CY - MONO_H / 2:.1f}) scale({K:.4f})'
    return f'<g transform="{place}"><path transform="translate(0,{MH}) scale(0.1,-0.1)" d="{d}" {attrs}/></g>'


def region(name, sd):
    return f'<filter id="{name}" filterUnits="userSpaceOnUse" x="0" y="0" width="{W}" height="{H}"><feGaussianBlur stdDeviation="{sd}"/></filter>'


# A. Relieve: the monogram's alpha is a height map, lit from the upper right at 30°, so flat paper is
# exactly 50 % grey and the overlay blend leaves it untouched: only the pressed edges show
def relieve():
    return velo() + f'''<svg viewBox="0 0 {W} {H}" style="mix-blend-mode:overlay;opacity:.9">
  <defs><filter id="press" filterUnits="userSpaceOnUse" x="0" y="0" width="{W}" height="{H}" color-interpolation-filters="sRGB">
    <feGaussianBlur in="SourceAlpha" stdDeviation="3.5" result="soft"/>
    <feComponentTransfer in="soft" result="pressed"><feFuncA type="linear" slope="-1" intercept="1"/></feComponentTransfer>
    <feDiffuseLighting in="pressed" surfaceScale="9" diffuseConstant="1" lighting-color="#fff"><feDistantLight azimuth="315" elevation="30"/></feDiffuseLighting>
  </filter></defs>
  <g filter="url(#press)">{mono('fill="#000"')}</g>
</svg>'''


# B. Sombra: the light, with the monogram's shadow taken out of it
def sombra():
    shadow = mono('fill="#000" opacity=".72"')
    light_svg = velo().replace(
        '<mask id="m" maskUnits="userSpaceOnUse" x="0" y="0" width="2400" height="1500"><rect width="100%" height="100%" fill="url(#fade)"/></mask>',
        f'{region("sh", 7)}<mask id="m" maskUnits="userSpaceOnUse" x="0" y="0" width="2400" height="1500"><rect width="100%" height="100%" fill="url(#fade)"/><g filter="url(#sh)">{shadow}</g></mask>')
    assert light_svg != velo(), 'the mask was found'
    return light_svg


# C. Luz: the monogram as light, a soft core and a wide glow, in the bands' green
def luz():
    return velo() + f'''<svg viewBox="0 0 {W} {H}" style="mix-blend-mode:screen">
  <defs>{region("glow", 34)}{region("core", 5)}</defs>
  <g filter="url(#glow)" opacity=".35">{mono('fill="#76855f"')}</g>
  <g filter="url(#core)" opacity=".42">{mono('fill="#a8b590"')}</g>
</svg>'''


# D. Grabado: a hairline outline, catching the light where the bands cross it
def grabado():
    return velo() + f'''<svg viewBox="0 0 {W} {H}" style="mix-blend-mode:screen">
  {mono('fill="none" stroke="#b9c4a2" stroke-width="45" opacity=".5"')}
</svg>'''


if __name__ == '__main__':
    for name, fn in [('a', relieve), ('b', sombra), ('c', luz), ('d', grabado)]:
        (root / f'design/art/mark-{name}.html').write_text(page(fn()))
    print('ok')
