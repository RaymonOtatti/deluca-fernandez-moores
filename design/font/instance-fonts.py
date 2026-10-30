# Cuts the self-hosted text fonts to the weights the pages use (7.10): Jost 300–400 and
# Geist Mono 400. 8.5c: subset to what the site shows. The originals stay in node_modules.
#   design/font/.venv/bin/python design/font/instance-fonts.py
import pathlib

from fontTools.subset import Options, Subsetter
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont


ROOT = pathlib.Path(__file__).resolve().parents[2]
JOST_UNICODES = (
    set(range(0x0020, 0x007F))
    | set(range(0x00A0, 0x0100))
    | {0x2013, 0x2014, 0x2018, 0x2019, 0x201C, 0x201D, 0x2026, 0x20AC}
)
MONO_UNICODES = (
    set(range(0x0020, 0x0061))
    | set(range(0x007B, 0x007F))
    | {0x00A0, 0x00A1, 0x00A9, 0x00AA, 0x00AE, 0x00B0, 0x00B7, 0x00BA, 0x00BF}  # ¡ and ¿ have no capital form, so they stay
    | {ord('o')}  # not shown, but without it Chrome on macOS draws every label about 0.05 px off (measured)
    | set(range(0x00C0, 0x00DF))
    | {0x2013, 0x2014, 0x2018, 0x2019, 0x201C, 0x201D, 0x2026}
)
FONTS = (
    ('@fontsource-variable/jost/files/jost-latin-wght-normal.woff2',
     'jost-latin-wght-normal.woff2', {'wght': (300, 400)}, JOST_UNICODES),
    ('@fontsource-variable/geist-mono/files/geist-mono-latin-wght-normal.woff2',
     'geist-mono-latin-wght-normal.woff2', {'wght': 400}, MONO_UNICODES),
)


def build():
    for source, name, axes, unicodes in FONTS:
        original = ROOT / 'node_modules' / source
        output = ROOT / 'src/assets/fonts' / name
        before = original.stat().st_size
        font = TTFont(original, recalcTimestamp=False)
        instantiateVariableFont(font, axes, inplace=True, updateFontNames=False)
        if 'gvar' in font:
            # 8.5c: instancing drops empty variations; the subsetter expects an entry per glyph.
            for glyph in font.getGlyphOrder():
                font['gvar'].variations.setdefault(glyph, [])
        options = Options()
        options.layout_features = ['*']
        options.name_IDs = ['*']
        options.notdef_outline = True
        # Without glyph names Chrome on macOS draws the same outlines differently (measured): keep them
        options.glyph_names = True
        options.flavor = 'woff2'
        subsetter = Subsetter(options=options)
        subsetter.populate(unicodes=unicodes)
        subsetter.subset(font)
        font.flavor = 'woff2'
        font.save(output)
        print(f'{name}: {before} B -> {output.stat().st_size} B')


if __name__ == '__main__':
    build()
