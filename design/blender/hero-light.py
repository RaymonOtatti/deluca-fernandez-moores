# 8.5k1: the hero's light, built as a room in Blender (Franco, 2026-10-23: "a super clean environment, with
# cinematic lighting"). A paper wall in shadow, a window off-frame to the upper right with sheer curtains, the
# sun through them. Same composition as the hero since 5.2: the light in the upper right, its folds leaning
# like today's, the middle dark for the lockup. Run headless, as Orbom does:
#   blender -b --factory-startup --python-exit-code 1 --python design/blender/hero-light.py -- \
#     --take a --out <file>.png [--width 2400 --height 1500 --samples 256] [--no-sun] [--set key=value ...]
# --no-sun renders the paper alone (8.5k2 subtracts it from the lit frames to get the light by itself).
# --time t (seconds) poses the curtain t seconds into its one gust (8.5k2); 0 and DURATION are the rest pose.
# 8.5k2b: --take v is the physical-room study; --shutter 0.5 integrates a 180-degree shutter at 24 fps.
# Blender: 5.2.2 (the Homebrew wrapper points at a missing /Applications copy; forge-studio's runs).
import argparse
import math
import sys
import tempfile
import time
from pathlib import Path

import bpy
from mathutils import Vector

# Blender units are metres; z is up, the camera looks along +y at the wall (y = 0).
FRAME_W = 4.8  # metres of wall across the frame (16:10)
CAM_Z = 2.0
CAM_X = -0.4  # the camera sits left of the window's light, so the light keeps to the right and clear of the lockup
SIDE_X = 3.4  # the room's right wall, off-frame, where the window is

BASE = dict(
    sun=(-0.883, 0.361, -0.301),  # from the right, in front of the wall and above it: it rakes the paper
    sun_angle=2.5,  # degrees; softer than this and the folds blur away over the 1 to 3.5 m to the wall
    sun_energy=1.5,
    window=(-1.45, -0.15, 0.4, 5.4),  # y from, y to, z from, z to: its light lands on x 0 to 3 m, top and bottom off-frame
    curtain=(-1.5, -0.1),  # the part of the window the curtain covers (y)
    gather_lean=0.15,  # the gathered part narrows toward the top: the fade runs diagonally, as the hero's
    gather=0.8,  # the curtain is gathered toward the jamb (y from): denser there, so the light fades toward the middle
    pleat=0.21, depth=0.06, lean=-0.13,  # fold spacing and depth (m); lean tilts the folds, so the bands lean as today's
    clear=0.55,  # how much light a single face-on layer lets through
    tint=(0.46, 0.64, 0.40),  # the cloth's green: the light comes out sage on the paper
    mullions=False,
    haze=0.0,
    leaves=0,
    tooth=1.0,
    sway=0.06,  # m: how far one gust pushes the folds sideways at the hem (the rod holds the top still)
    period=2.2,  # s: the folds swing about twice in the gust
    lag=0.6,  # rad per metre: the swing travels down the cloth
    sun_color=(1.0, 0.97, 0.90),
    fill=4.0,  # W: the sky through the glowing sheer, a soft area light at the window: the broad falloff under the bands
    ambient=0.03,  # the room's own light, a green-grey: the shadow reads forest-black, not black
    hem=(0.8, 3.4),  # z: the curtain is denser toward its hem, so the light fades downward as the hero's does
    fall=0.55,  # the paper darkens toward the lower left, where the lockup sits, as the hero's always has
)

TAKES = {
    # a, "Velo": the curtain over the whole window; today's hero, made physical
    'a': dict(clear=0.85, depth=0.07, fill=2.0, sun_energy=1.8, sun_angle=1.6, pleat=0.17),
    # 8.5k2b: Velo's framing, with daylight carried by the room rather than a green ambient.
    'v': dict(real=True, clear=0.70, depth=0.05, fill=0.0, sun_energy=1.7, sun_angle=0.53,
              pleat=0.24, gather=0.95, gather_lean=0.22, ambient=2.5, exposure=-0.8, fall=1.0,
              sun_color=(1.0, 0.96, 0.88), floor=(0.33, 0.29, 0.24),
              tint=(0.62, 0.82, 0.49), thread=(0.62, 0.64, 0.56), sway=0.11, bunch=0.06),
    # b, "Ventana": the curtain drawn back over half the window, the frame's cross in soft shadow beside it
    'b': dict(curtain=(-1.5, -0.75), mullions=True, gather=0.5, sun_energy=0.8, sun_color=(0.82, 0.92, 0.74)),
    # c, "Follaje": as a, with a tree outside the window: its leaves dapple the light through the sheer
    'c': dict(leaves=900, sun_energy=1.8),
    # w, "Persiana" (8.5k): a green office wall; vertical blinds in a window 10 m behind the camera; a low sun
    # Franco chose W3 of the tests: more columns, the light fading out softly on the left
    'w': dict(layout='behind', real=True, depth_room=10.0, window=(-3.0, 2.6, 0.05, 6.6), exposure=0.0,
              wall=((0.075, 0.115, 0.065), (0.090, 0.135, 0.078)), fall=1.0,
              sun=(0.25, 0.97, -0.05), sun_angle=2.0, sun_energy=2.2, sun_color=(1.0, 0.93, 0.82), sky=1.6,
              slat=0.127, pitch=0.115, open=0.95, jitter=0.18, group=0.5, twist=0.8, fade=1.2, glow=0.25, turn=0.22,
              swing=0.05, period=2.4,
              # 8.8 (Franco, 2026-10-24: "add some additional movement from start to the existing movement"): a gentle
              # breeze in the blinds from the clip's first frames, handing over to the gust as it rises. 58 steps of the
              # clip's grid (4.8 s over 115), so the gust's frames line up with the approved ones
              lead=58 * 4.8 / 115, breeze=0.6, breeze_period=3.2),
}


def args():
    p = argparse.ArgumentParser()
    p.add_argument('--take', default='a', choices=sorted(TAKES))
    p.add_argument('--out', required=True)
    p.add_argument('--width', type=int, default=2400)
    p.add_argument('--height', type=int, default=1500)
    p.add_argument('--samples', type=int, default=256)
    p.add_argument('--no-sun', action='store_true')
    p.add_argument('--time', type=float, default=0.0)
    p.add_argument('--shutter', type=float, default=0.0, help='exposure in frames at 24 fps; 0.5 is 180 degrees')
    p.add_argument('--set', nargs='*', default=[], help='key=value overrides, for tuning')
    opt = p.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
    if not math.isfinite(opt.shutter) or not 0.0 <= opt.shutter <= 1.0:
        p.error('--shutter must be between 0 and 1 frame')
    if not math.isfinite(opt.time):
        p.error('--time must be finite')
    if min(opt.width, opt.height, opt.samples) < 1:
        p.error('--width, --height and --samples must be positive')
    return opt


def node(tree, kind, **inputs):
    n = tree.nodes.new(kind)
    for k, v in inputs.items():
        n.inputs[k].default_value = v
    return n


def paper(take):
    # Off-white paper with a slow mottle and a tooth whose fibres run up and down, as in the hero since 5.2;
    # the raking sun is what shows it
    m = bpy.data.materials.new('paper')
    t = m.node_tree
    bsdf = t.nodes['Principled BSDF']
    bsdf.inputs['Roughness'].default_value = 0.92
    coord = t.nodes.new('ShaderNodeTexCoord')
    mottle = node(t, 'ShaderNodeTexNoise', Scale=0.35, Detail=3.0, Roughness=0.5)
    t.links.new(coord.outputs['Object'], mottle.inputs['Vector'])
    ramp = t.nodes.new('ShaderNodeValToRGB')
    lo, hi = take.get('wall', ((0.62, 0.62, 0.57), (0.74, 0.74, 0.68)))
    ramp.color_ramp.elements[0].color = (*lo, 1)
    ramp.color_ramp.elements[1].color = (*hi, 1)
    t.links.new(mottle.outputs['Fac'], ramp.inputs['Fac'])
    sep = t.nodes.new('ShaderNodeSeparateXYZ')
    t.links.new(coord.outputs['Object'], sep.inputs['Vector'])
    diag = node(t, 'ShaderNodeMath')
    diag.operation = 'MULTIPLY_ADD'  # x + 1.6 z: along the frame's diagonal
    diag.inputs[1].default_value = 1.6
    t.links.new(sep.outputs['Z'], diag.inputs[0])
    t.links.new(sep.outputs['X'], diag.inputs[2])
    fall = t.nodes.new('ShaderNodeMapRange')
    fall.inputs['From Min'].default_value = CAM_X - 2.4 + 1.6 * 0.5
    fall.inputs['From Max'].default_value = CAM_X + 2.4 + 1.6 * 3.5
    fall.inputs['To Min'].default_value = take['fall']
    fall.inputs['To Max'].default_value = 1.0
    fall.interpolation_type = 'SMOOTHSTEP'
    t.links.new(diag.outputs['Value'], fall.inputs['Value'])
    tone = t.nodes.new('ShaderNodeMix')
    tone.data_type = 'RGBA'
    tone.blend_type = 'MULTIPLY'
    tone.inputs['Factor'].default_value = 1.0
    t.links.new(ramp.outputs['Color'], tone.inputs[6])
    t.links.new(fall.outputs['Result'], tone.inputs[7])
    t.links.new(tone.outputs[2], bsdf.inputs['Base Color'])
    stretch = t.nodes.new('ShaderNodeMapping')
    stretch.inputs['Scale'].default_value = (1.0, 1.0, 0.3)
    t.links.new(coord.outputs['Object'], stretch.inputs['Vector'])
    fibres = node(t, 'ShaderNodeTexNoise', Scale=70.0, Detail=8.0, Roughness=0.66)
    t.links.new(stretch.outputs['Vector'], fibres.inputs['Vector'])
    fine = node(t, 'ShaderNodeTexNoise', Scale=380.0, Detail=2.0, Roughness=0.5)
    t.links.new(coord.outputs['Object'], fine.inputs['Vector'])
    mix = node(t, 'ShaderNodeMath')
    mix.operation = 'MULTIPLY_ADD'
    mix.inputs[1].default_value = 0.3
    t.links.new(fine.outputs['Fac'], mix.inputs[0])
    t.links.new(fibres.outputs['Fac'], mix.inputs[2])
    # 8.5k2b: fine paper relief is sub-millimetre; A retains its approved deeper tooth.
    relief = 0.0018 if take.get('real') else 0.004
    bump = node(t, 'ShaderNodeBump', Strength=take['tooth'], Distance=relief)
    t.links.new(mix.outputs['Value'], bump.inputs['Height'])
    t.links.new(bump.outputs['Normal'], bsdf.inputs['Normal'])
    return m


def sheer(take):
    # Sheer cloth: see-through face-on, denser where a fold turns edge-on to the sun (layer weight) and where it
    # is gathered toward the jamb; green, so what it lets through is sage
    m = bpy.data.materials.new('sheer')
    t = m.node_tree
    t.nodes.remove(t.nodes['Principled BSDF'])
    out = t.nodes['Material Output']
    clear = node(t, 'ShaderNodeBsdfTransparent', Color=(*take['tint'], 1))
    # where it is dense the cloth mostly holds the light back (a sheer's threads are dark against the sun); a
    # little glows through, diffused. All-translucent, it lit the whole wall like a softbox and flattened it
    glow = node(t, 'ShaderNodeBsdfTranslucent', Color=(*take['tint'], 1))
    thread = node(t, 'ShaderNodeBsdfDiffuse', Color=(0.03, 0.035, 0.028, 1))
    cloth = t.nodes.new('ShaderNodeMixShader')
    cloth.inputs['Fac'].default_value = 0.8
    t.links.new(glow.outputs['BSDF'], cloth.inputs[1])
    t.links.new(thread.outputs['BSDF'], cloth.inputs[2])
    weight = node(t, 'ShaderNodeLayerWeight', Blend=0.5)
    fold = t.nodes.new('ShaderNodeMapRange')
    fold.inputs['From Min'].default_value = 0.1
    fold.inputs['From Max'].default_value = 0.65
    fold.inputs['To Min'].default_value = 1 - take['clear']
    fold.inputs['To Max'].default_value = 0.97
    t.links.new(weight.outputs['Facing'], fold.inputs['Value'])
    # gathered: from fully dense at the jamb to as-hung over the first `gather` metres
    coord = t.nodes.new('ShaderNodeTexCoord')
    sep = t.nodes.new('ShaderNodeSeparateXYZ')
    t.links.new(coord.outputs['Object'], sep.inputs['Vector'])
    gather = t.nodes.new('ShaderNodeMapRange')
    gather.inputs['From Min'].default_value = take['curtain'][0]
    gather.inputs['From Max'].default_value = take['curtain'][0] + take['gather']
    # what gets through grows as the cube of the distance from the jamb: in a dark room the first light reads
    # as an edge, so it has to start very gently
    gather.inputs['To Min'].default_value = 0.0
    gather.inputs['To Max'].default_value = 1.0
    lean = node(t, 'ShaderNodeMath')
    lean.operation = 'MULTIPLY_ADD'  # y + gather_lean (z - CAM_Z)
    lean.inputs[1].default_value = take['gather_lean']
    zc = node(t, 'ShaderNodeMath')
    zc.operation = 'SUBTRACT'
    zc.inputs[1].default_value = CAM_Z
    t.links.new(sep.outputs['Z'], zc.inputs[0])
    t.links.new(zc.outputs['Value'], lean.inputs[0])
    t.links.new(sep.outputs['Y'], lean.inputs[2])
    t.links.new(lean.outputs['Value'], gather.inputs['Value'])
    cube = node(t, 'ShaderNodeMath')
    cube.operation = 'POWER'
    cube.inputs[1].default_value = 3.0
    t.links.new(gather.outputs['Result'], cube.inputs[0])
    gathered = node(t, 'ShaderNodeMath')
    gathered.operation = 'SUBTRACT'
    gathered.inputs[0].default_value = 1.0
    t.links.new(cube.outputs['Value'], gathered.inputs[1])
    hem = t.nodes.new('ShaderNodeMapRange')
    hem.inputs['From Min'].default_value = take['hem'][0]
    hem.inputs['From Max'].default_value = take['hem'][1]
    hem.inputs['To Min'].default_value = 0.95
    hem.inputs['To Max'].default_value = 0.0
    hem.interpolation_type = 'SMOOTHSTEP'
    t.links.new(sep.outputs['Z'], hem.inputs['Value'])
    dense = node(t, 'ShaderNodeMath')
    dense.operation = 'MAXIMUM'
    t.links.new(fold.outputs['Result'], dense.inputs[0])
    t.links.new(gathered.outputs['Value'], dense.inputs[1])
    denser = node(t, 'ShaderNodeMath')
    denser.operation = 'MAXIMUM'
    t.links.new(dense.outputs['Value'], denser.inputs[0])
    t.links.new(hem.outputs['Result'], denser.inputs[1])
    mix = t.nodes.new('ShaderNodeMixShader')
    t.links.new(denser.outputs['Value'], mix.inputs['Fac'])
    t.links.new(clear.outputs['BSDF'], mix.inputs[1])
    t.links.new(cloth.outputs['Shader'], mix.inputs[2])
    t.links.new(mix.outputs['Shader'], out.inputs['Surface'])
    return m


def matte(name, color):
    m = bpy.data.materials.new(name)
    m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (*color, 1)
    m.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value = 1.0
    return m


def mesh(name, verts, faces, material):
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    me.update()
    ob = bpy.data.objects.new(name, me)
    ob.data.materials.append(material)
    bpy.context.scene.collection.objects.link(ob)
    return ob


def quad(name, a, b, c, d, material):
    return mesh(name, [a, b, c, d], [(0, 1, 2, 3)], material)


def side_wall(take, material):
    # The room's right wall (x = SIDE_X), with the window cut out, from the back wall to behind the camera
    y0, y1, z0, z1 = take['window']
    Y_BACK, Y_FRONT, Z_FLOOR, Z_TOP = 0.0, -8.0, -1.0, 7.0
    pieces = [(Y_FRONT, Y_BACK, Z_FLOOR, z0), (Y_FRONT, Y_BACK, z1, Z_TOP), (Y_FRONT, y0, z0, z1), (y1, Y_BACK, z0, z1)]
    for i, (ya, yb, za, zb) in enumerate(pieces):
        quad(f'side{i}', (SIDE_X, ya, za), (SIDE_X, yb, za), (SIDE_X, yb, zb), (SIDE_X, ya, zb), material)
    if take['mullions']:
        # a slim cross, 5 cm, in the window's plane: one upright, one transom
        ym, zm, w = (y0 + y1) / 2, z0 + (z1 - z0) * 0.8, 0.025
        quad('mullion', (SIDE_X, ym - w, z0), (SIDE_X, ym + w, z0), (SIDE_X, ym + w, z1), (SIDE_X, ym - w, z1), material)
        quad('transom', (SIDE_X, y0, zm - w), (SIDE_X, y1, zm - w), (SIDE_X, y1, zm + w), (SIDE_X, y0, zm + w), material)


DURATION = 4.8  # s: the gust, from rest back to rest (8.5j's sway was 4.6 s)


def gust(t):
    # 0 at rest; rises early, settles slowly, and leaves (and arrives) with no speed, so the clip's first and last
    # frames are the still
    x = min(max(t / DURATION, 0.0), 1.0)
    return math.sin(math.pi * x ** 0.7) ** 2


def curtain(take, material, t=0.0):
    if take.get('real'):
        verts, faces = drape(take, t)
        ob = mesh('curtain', verts, faces, material)
        for polygon in ob.data.polygons:
            polygon.use_smooth = True
        return ob
    # A pleated sheet hanging just inside the window. Its folds lean a little (`lean`), so their bands on the
    # paper lean like the hero's; two sines, so the bands are not a barcode
    ya, yb = take['curtain']
    z0, z1 = take['window'][2] - 0.2, take['window'][3] + 0.2
    cols, rows = 320, 40
    verts, faces = [], []
    for j in range(rows + 1):
        z = z0 + (z1 - z0) * j / rows
        for i in range(cols + 1):
            y = ya + (yb - ya) * i / cols
            u = y + take['lean'] * (z - CAM_Z)
            # the gust: the folds slide sideways, most at the hem, the swing running down the cloth
            hang = (z1 - z) / (z1 - z0)
            u += take['sway'] * gust(t) * hang * math.sin(2 * math.pi * t / take['period'] - take['lag'] * (z1 - z))
            x = SIDE_X - 0.14 - take['depth'] * (math.sin(2 * math.pi * u / take['pleat'])
                                                + 0.5 * math.sin(2 * math.pi * u / (take['pleat'] * 2.6) + 1.3))
            verts.append((x, y, z))
    for j in range(rows):
        for i in range(cols):
            a = j * (cols + 1) + i
            faces.append((a, a + 1, a + cols + 2, a + cols + 1))
    ob = mesh('curtain', verts, faces, material)
    for p in ob.data.polygons:
        p.use_smooth = True
    return ob


def foliage(take, material):
    # Clumps of leaves outside the window, back along the sun's path: small dark ovals, so the light reaching the
    # window is broken into dapples, which the 1 to 3.5 m to the paper and the sheer soften
    import random
    rnd = random.Random(12)
    d = Vector(take['sun']).normalized()
    y0, y1, z0, z1 = take['window']
    verts, faces = [], []
    clumps = [(Vector((SIDE_X, rnd.uniform(y0, y1), rnd.uniform(z0 + 1.0, z1))) - d * rnd.uniform(1.2, 3.0),
               rnd.uniform(0.25, 0.6)) for _ in range(take['leaves'] // 30)]
    for c, r in clumps:
        for _ in range(30):
            centre = c + Vector((rnd.gauss(0, r), rnd.gauss(0, r), rnd.gauss(0, r * 0.7)))
            # an oval leaf, 5 to 9 cm, turned at random
            size = rnd.uniform(0.05, 0.09)
            axis_a = Vector((rnd.uniform(-1, 1), rnd.uniform(-1, 1), rnd.uniform(-1, 1))).normalized()
            axis_b = axis_a.cross(Vector((0.3, 0.5, 0.8))).normalized()
            base = len(verts)
            verts.append(tuple(centre))
            for k in range(8):
                a = 2 * math.pi * k / 8
                verts.append(tuple(centre + axis_a * math.cos(a) * size + axis_b * math.sin(a) * size * 0.5))
            for k in range(8):
                faces.append((base, base + 1 + k, base + 1 + (k + 1) % 8))
    mesh('leaves', verts, faces, material)


def haze(take):
    # A faint haze in the air between the window and the lit paper only (a world volume swallows the sun, and a
    # room-wide one greys the shadow)
    m = bpy.data.materials.new('haze')
    t = m.node_tree
    t.nodes.remove(t.nodes['Principled BSDF'])
    vol = node(t, 'ShaderNodeVolumeScatter', Density=take['haze'], Anisotropy=0.6)
    t.links.new(vol.outputs['Volume'], t.nodes['Material Output'].inputs['Volume'])
    x0, x1, y0, y1, z0, z1 = 0.3, SIDE_X - 0.3, -1.6, -0.02, -0.98, 6.9
    v = [(x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0), (x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)]
    f = [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)]
    mesh('haze', v, f, m)


def voile(take):
    # 8.5k2b: unresolved threads scatter; gaps transmit straight rays. Optical depth grows at grazing
    # incidence for every ray, including shadow rays. Gathering is geometry, not a painted opacity ramp.
    m = bpy.data.materials.new('voile')
    tree = m.node_tree
    tree.nodes.remove(tree.nodes['Principled BSDF'])
    gap = node(tree, 'ShaderNodeBsdfTransparent', Color=(*take['tint'], 1))
    glow = node(tree, 'ShaderNodeBsdfTranslucent', Color=(*take['thread'], 1))
    reflection = node(tree, 'ShaderNodeBsdfDiffuse', Color=(*take['thread'], 1), Roughness=0.8)
    thread = tree.nodes.new('ShaderNodeMixShader')
    thread.inputs[0].default_value = 0.25
    tree.links.new(glow.outputs[0], thread.inputs[1])
    tree.links.new(reflection.outputs[0], thread.inputs[2])
    geometry = tree.nodes.new('ShaderNodeNewGeometry')
    dot = tree.nodes.new('ShaderNodeVectorMath')
    dot.operation = 'DOT_PRODUCT'
    tree.links.new(geometry.outputs['Incoming'], dot.inputs[0])
    tree.links.new(geometry.outputs['Normal'], dot.inputs[1])
    absolute = node(tree, 'ShaderNodeMath')
    absolute.operation = 'ABSOLUTE'
    tree.links.new(dot.outputs['Value'], absolute.inputs[0])
    cosine = node(tree, 'ShaderNodeMath')
    cosine.operation = 'MAXIMUM'
    # 8.5k2b: unresolved fibre directions limit grazing extinction; a fold is not an opaque blade.
    cosine.inputs[1].default_value = 0.55
    tree.links.new(absolute.outputs[0], cosine.inputs[0])
    depth = node(tree, 'ShaderNodeMath')
    depth.operation = 'DIVIDE'
    depth.inputs[0].default_value = math.log(max(0.001, min(0.999, take['clear'])))
    tree.links.new(cosine.outputs[0], depth.inputs[1])
    transmission = node(tree, 'ShaderNodeMath')
    transmission.operation = 'EXPONENT'
    tree.links.new(depth.outputs[0], transmission.inputs[0])
    mix = tree.nodes.new('ShaderNodeMixShader')
    tree.links.new(transmission.outputs[0], mix.inputs[0])
    tree.links.new(thread.outputs[0], mix.inputs[1])
    tree.links.new(gap.outputs[0], mix.inputs[2])
    tree.links.new(mix.outputs[0], tree.nodes['Material Output'].inputs['Surface'])
    return m


def smoothstep(x):
    x = min(1.0, max(0.0, x))
    return x * x * (3.0 - 2.0 * x)


def drape(take, t):
    # 8.5k2b: one continuous sheet with compressed, returning folds at the jamb. Sun rays meet several
    # real faces there; no shader multiplies in the old gather or metre-high "hem" gradients.
    ya, yb = take['curtain']
    z0, z1 = take['window'][2] - 0.2, take['window'][3] + 0.2
    cols, rows = 1600, 100
    verts, faces = [], []
    moving = 0.0 < t < DURATION
    settle = 1.0 - smoothstep((t - (DURATION - 0.8)) / 0.8) if moving else 0.0
    for j in range(rows + 1):
        z = z0 + (z1 - z0) * j / rows
        hang = (z1 - z) / (z1 - z0)
        pinch = (1.0 - hang) ** 8
        hem = 1.0 - smoothstep((z - z0) / 0.16)
        for i in range(cols + 1):
            y = ya + (yb - ya) * i / cols
            u = y + take['lean'] * (z - CAM_Z)
            gathered = y + take['gather_lean'] * (z - CAM_Z) - ya
            crowd = 1.0 - smoothstep(gathered / max(0.04, take['gather']))
            start = take['gather'] - 0.55
            f = min(1.0, max(0.0, (gathered - start) / 0.55))
            phase = 2 * math.pi * u / take['pleat']
            phase += 0.5 * math.sin(5.7 * u + 0.4) + 0.18 * math.sin(13.1 * u)
            depth = take['depth'] * (1.0 + 0.3 * crowd) * (1.0 - 0.18 * pinch)
            # The top pinches; the heavier folded hem damps the small ripples without painting a shadow.
            fold = math.sin(phase) + (0.11 + 0.16 * pinch) * math.sin(2 * phase + 0.3)
            fold += 0.13 * (1.0 - hem) * hang * math.sin(0.43 * phase + 0.7 * z)
            # Fine accordion returns merge under the real sun disc; the broad folds keep their own lean.
            bunch = take['bunch'] * (1.0 - smoothstep(f)) * math.sin(2 * math.pi * y / 0.010 + 0.1 * math.sin(z))
            x = SIDE_X - 0.26 - depth * fold - bunch
            yy = y  # the sheet stays ordered; overlap is along the oblique sun rays, without self-crossing
            zz = z
            if moving:
                # The pressure pulse reaches the hem first, then travels upwards. Its decaying response
                # and delayed ripple avoid a repeated sine loop; the last 0.8 s blend exactly to rest.
                elapsed = t - 0.65 * (1.0 - hang)
                q = max(0.0, elapsed) / 0.72
                pulse = q * q * math.exp(2.0 * (1.0 - q)) * settle
                amplitude = take['sway'] * hang ** 0.85 * pulse
                # take v's motion: 'slide' (8.5k2b) moves the cloth; 'breathe' opens and closes its folds in place,
                # with breathe (fold depth swing, ×), ripple (phase, rad) and wave (its length across the cloth, m)
                if take.get('motion', 'slide') == 'slide':
                    x -= amplitude * (0.75 + 0.05 * math.sin(4.1 * elapsed - 0.35 * phase))
                    # 8.5k2b: these components reinforce the shadow shift instead of cancelling in projection.
                    yy -= amplitude * (0.60 + 0.08 * math.sin(3.0 * elapsed - 0.4)
                                       + 0.02 * math.sin(5.3 * elapsed - 0.6 * phase) * (1.0 - hem))
                    zz += amplitude * 0.07 * hang
                else:
                    # 8.5k (Franco, on the slide: "its not a light reflection, its an object moving"): nothing slides.
                    # The folds open and close, and their phase ripples, in a wave running across the cloth, so the
                    # light bands breathe and ripple where they are; a breath of billow, no travel
                    wave = 2 * math.pi * (y / take.get('wave', 0.9) - elapsed / take['period']) + 0.8 * z
                    swell = pulse * hang ** 0.6
                    moved = phase + take.get('ripple', 0.0) * swell * math.sin(0.7 * wave + 1.1)
                    fold_now = math.sin(moved) + (0.11 + 0.16 * pinch) * math.sin(2 * moved + 0.3)
                    fold_now += 0.13 * (1.0 - hem) * hang * math.sin(0.43 * moved + 0.7 * z)
                    depth_now = depth * (1.0 + take.get('breathe', 0.0) * swell * math.sin(wave))
                    x = SIDE_X - 0.26 - depth_now * fold_now - bunch - 0.15 * amplitude
            verts.append((x, yy, zz))
    for j in range(rows):
        for i in range(cols):
            a = j * (cols + 1) + i
            faces.append((a, a + 1, a + cols + 2, a + cols + 1))
    # A 6 cm turn-up is another layer of the same cloth. The close, non-coplanar return absorbs naturally.
    for j in range(2):
        for i in range(cols):
            a = j * (cols + 1) + i
            indices = (a, a + 1, a + cols + 2, a + cols + 1)
            base = len(verts)
            for index in indices:
                x, y, z = verts[index]
                verts.append((x - 0.0015, y, z0 + (z - z0) * 0.55))
            faces.append((base, base + 1, base + 2, base + 3))
    return verts, faces


def shutter_times(t, shutter, length=DURATION):
    # 8.5k2b: a 180-degree shutter integrates 1/48 s at 24 fps. Midpoint samples give five equal weights;
    # the still endpoints are deliberately held, so a shutter cannot disturb their exact rest geometry.
    # 8.8: length is the whole motion, the breeze's lead included
    if shutter <= 0.0 or t <= 0.0 or t >= length:
        return [t]
    return [min(length, max(0.0, t + ((i + 0.5) / 5 - 0.5) * shutter / 24)) for i in range(5)]


def render(scene, opt, take):
    times = shutter_times(opt.time, opt.shutter, take.get('lead', 0.0) + DURATION)
    started = time.perf_counter()
    if len(times) == 1:
        bpy.ops.render.render(write_still=True)
    else:
        import numpy as np
        # 8.5k2b: average scene-linear radiance, then apply AgX once. EXR avoids headless Render Result's
        # empty pixel buffer and prevents an average of display-encoded PNGs from darkening moving edges.
        total = np.zeros(opt.width * opt.height * 4, dtype=np.float32)
        pixels = np.empty_like(total)
        with tempfile.TemporaryDirectory(prefix='.shutter-', dir=Path(opt.out).resolve().parent) as tmp:
            for index, t in enumerate(times):
                # the moving object: the curtain, or take w's blinds
                name, rebuild = ('slats', slats) if take.get('layout') == 'behind' else ('curtain', curtain)
                ob = bpy.data.objects[name]
                material = ob.data.materials[0]
                old_mesh = ob.data
                bpy.data.objects.remove(ob, do_unlink=True)
                bpy.data.meshes.remove(old_mesh)
                rebuild(take, material, t)
                scene.render.image_settings.file_format = 'OPEN_EXR'
                scene.render.image_settings.color_depth = '32'
                scene.render.image_settings.color_mode = 'RGBA'
                scene.render.filepath = str(Path(tmp) / f'{index}.exr')
                bpy.ops.render.render(write_still=True)
                sample = bpy.data.images.load(scene.render.filepath, check_existing=False)
                sample.pixels.foreach_get(pixels)
                total += pixels / len(times)
                bpy.data.images.remove(sample)
        scene.render.image_settings.file_format = 'PNG'
        scene.render.image_settings.color_depth = '16'
        scene.render.image_settings.color_mode = 'RGBA'
        scene.render.filepath = opt.out
        result = bpy.data.images.new('shutter average', width=opt.width, height=opt.height, float_buffer=True)
        result.colorspace_settings.name = 'Linear Rec.709'
        result.pixels.foreach_set(total)
        result.update()
        result.save_render(str(Path(opt.out).resolve()), scene=scene)
        bpy.data.images.remove(result)
    print(f'8.5k2b render: {opt.out}; {scene.cycles.device}; {len(times)} exposure samples; '
          f'{time.perf_counter() - started:.3f} s', flush=True)


def room_side(take, opt, scene):
    # takes a, b, c, v: the window off-frame to the right, its curtain inside it
    quad('paper', (-6, 0, -1), (6, 0, -1), (6, 0, 7), (-6, 0, 7), paper(take))
    real = take.get('real', False)
    dark = matte('room', (0.66, 0.65, 0.61) if real else (0.05, 0.055, 0.045))
    side_wall(take, dark)
    curtain(take, voile(take) if real else sheer(take), opt.time)
    # 8.5k2b: the low sill lights a warm floor just below the crop; its bounce reaches the paper.
    floor_z = 0.0 if real else -1.0
    floor_mat = matte('warm stone', take['floor']) if real else dark
    quad('floor', (-6, -8, floor_z), (SIDE_X, -8, floor_z), (SIDE_X, 0, floor_z), (-6, 0, floor_z), floor_mat)
    if real:
        quad('left', (-6, -8, -1), (-6, 0, -1), (-6, 0, 7), (-6, -8, 7), dark)
        quad('back', (-6, -8, -1), (-6, -8, 7), (SIDE_X, -8, 7), (SIDE_X, -8, -1), dark)
        # Deep reveals make the sky a window source, occluded by the actual opening.
        y0, y1, z0, z1 = take['window']
        for y in (y0, y1):
            quad('jamb', (SIDE_X, y, z0), (SIDE_X + 0.22, y, z0),
                 (SIDE_X + 0.22, y, z1), (SIDE_X, y, z1), dark)
        for z in (z0, z1):
            quad('reveal', (SIDE_X, y0, z), (SIDE_X, y1, z),
                 (SIDE_X + 0.22, y1, z), (SIDE_X + 0.22, y0, z), dark)
    quad('ceiling', (-6, -8, 7), (-6, 0, 7), (SIDE_X, 0, 7), (SIDE_X, -8, 7), dark)
    if take['haze']:
        haze(take)
    if take['leaves']:
        foliage(take, matte('leaf', (0.02, 0.03, 0.015)))

    # the room's own light: almost none, a cool green-grey, so the shadow reads forest-black
    world = bpy.data.worlds.new('room')
    scene.world = world
    bg = world.node_tree.nodes['Background']
    bg.inputs['Color'].default_value = (0.010, 0.013, 0.009, 1)
    bg.inputs['Strength'].default_value = take['ambient'] / 0.010

    if real:
        bg.inputs['Color'].default_value = (0.72, 0.82, 1.0, 1)
        bg.inputs['Strength'].default_value = 0.0 if opt.no_sun else take['ambient']

    if not opt.no_sun:
        sun = bpy.data.lights.new('sun', 'SUN')
        sun.energy = take['sun_energy']
        sun.angle = math.radians(take['sun_angle'])
        sun.color = take['sun_color']
        ob = bpy.data.objects.new('sun', sun)
        ob.rotation_euler = Vector(take['sun']).normalized().to_track_quat('-Z', 'Y').to_euler()
        scene.collection.objects.link(ob)

    if take['fill'] and not opt.no_sun:
        y0, y1, z0, z1 = take['window']
        sky = bpy.data.lights.new('sky', 'AREA')
        sky.shape = 'RECTANGLE'
        sky.size, sky.size_y = y1 - y0, (z1 - z0) / 2
        sky.energy = take['fill']
        sky.color = take['tint']
        ob = bpy.data.objects.new('sky', sky)
        # the upper half of the window: the light fades downward, as the hero's does
        ob.location = (SIDE_X - 0.3, (y0 + y1) / 2, z1 - (z1 - z0) / 4)
        ob.rotation_euler = Vector((-1, 0, 0)).to_track_quat('-Z', 'Y').to_euler()
        scene.collection.objects.link(ob)


def slats(take, material, t):
    # Vertical blinds hung inside the window behind the camera, each slat turned open about its own axis. In the
    # gust each turns a little and its foot swings, out of step with its neighbours, so the light they let through
    # shifts in place on the wall; nothing travels across it. Rest pose exact at 0 and at the end. Since 8.8 a breeze
    # sways them first, for `lead` seconds, and the gust (its own time g) follows, unchanged
    x0, x1, z0, z1 = take['window']
    yb = -take['depth_room'] + 0.25
    lead = take.get('lead', 0.0)
    g = t - lead
    moving = 0.0 < g < DURATION
    settle = 1.0 - smoothstep((g - (DURATION - 0.8)) / 0.8) if moving else 0.0
    q = max(0.0, g) / 0.72
    pulse = q * q * math.exp(2.0 * (1.0 - q)) * settle if moving else 0.0
    # from rest with no speed, up in 0.6 s, then gone over the gust's first second as the gust rises
    breeze = take.get('breeze', 0.0) * smoothstep(t / 0.6) * (1.0 - smoothstep(g)) if lead > 0.0 else 0.0
    w, top, foot = take['slat'], z1 + 0.15, z0 - 0.1
    rows = 12
    verts, faces = [], []
    n = int((x1 - x0) / take['pitch'])
    for i in range(n):
        xc = x0 + (i + 0.5) * take['pitch']
        # real blinds never hang alike: small irregularities, and groups turned more or less open, which at this
        # distance blur into broad soft columns of light (single slats blur away)
        turn = take['open'] + take['jitter'] * math.sin(2.7 * i + 0.4) * math.sin(0.9 * i)
        turn += take['group'] * (0.6 * math.sin(2 * math.pi * i / 9 + 0.3) + 0.4 * math.sin(2 * math.pi * i / 4.3 + 1.2))
        turn += take['turn'] * pulse * math.sin(2 * math.pi * g / take['period'] - 0.55 * i)
        swing = take['swing'] * pulse * math.sin(2 * math.pi * g / (take['period'] * 1.3) - 0.4 * i + 1.0)
        if breeze:
            # slower, and in longer waves across the blinds than the gust's
            turn += take['turn'] * breeze * math.sin(2 * math.pi * t / take['breeze_period'] - 0.35 * i + 0.8)
            swing += take['swing'] * breeze * math.sin(2 * math.pi * t / (take['breeze_period'] * 1.3) - 0.3 * i + 2.0)
        # drawn closer toward the window's left side, so the light fades out there instead of ending on the jamb
        if take['fade']:
            turn *= smoothstep((i + 0.5) * take['pitch'] / take['fade'])
        # and each twists a little along its height, so the light it lets through warps from top to foot
        twist = take['twist'] * math.sin(1.7 * i + 0.2)
        base = len(verts)
        for r in range(rows + 1):
            z = foot + (top - foot) * r / rows
            a = turn + twist * ((z - foot) / (top - foot) - 0.5)
            c, sn = math.cos(a), math.sin(a)
            lean = (top - z) * math.sin(swing)
            for e in (-w / 2, w / 2):
                verts.append((xc + e * c, yb + e * sn + lean, z))
        for r in range(rows):
            k = base + 2 * r
            faces.append((k, k + 1, k + 3, k + 2))
    mesh('slats', verts, faces, material)


def room_behind(take, opt, scene):
    # take w (8.5k, Franco: "a green wall of an office, still; the camera pointing into the wall; behind the camera
    # the window with vertical blinds, opened, and a light behind it; I don't want to see the window frame; make the
    # blinds and the light far away behind, for a natural blur, not a sharp edge"). The wall is painted green; the
    # window is `depth_room` metres behind it, past the camera, never in frame; a low sun and the sky come through.
    D = take['depth_room']
    quad('paper', (-7, 0, -1), (7, 0, -1), (7, 0, 7), (-7, 0, 7), paper(take))
    plaster = matte('plaster', (0.55, 0.56, 0.52))
    quad('floor', (-7, -D, 0), (7, -D, 0), (7, 0, 0), (-7, 0, 0), matte('oak', (0.30, 0.22, 0.15)))
    quad('ceiling', (-7, -D, 7), (-7, 0, 7), (7, 0, 7), (7, -D, 7), plaster)
    quad('left', (-7, -D, 0), (-7, 0, 0), (-7, 0, 7), (-7, -D, 7), plaster)
    quad('right', (7, -D, 0), (7, -D, 7), (7, 0, 7), (7, 0, 0), plaster)
    x0, x1, z0, z1 = take['window']
    for i, (xa, xb, za, zb) in enumerate([(-7, 7, 0, z0), (-7, 7, z1, 7), (-7, x0, z0, z1), (x1, 7, z0, z1)]):
        quad(f'back{i}', (xa, -D, za), (xa, -D, zb), (xb, -D, zb), (xb, -D, za), plaster)
    # the blinds' vinyl: matte off-white, a little of the sun glowing through it
    m = bpy.data.materials.new('vinyl')
    t = m.node_tree
    t.nodes.remove(t.nodes['Principled BSDF'])
    mix = t.nodes.new('ShaderNodeMixShader')
    mix.inputs['Fac'].default_value = take['glow']
    t.links.new(node(t, 'ShaderNodeBsdfDiffuse', Color=(0.78, 0.77, 0.72, 1)).outputs['BSDF'], mix.inputs[1])
    t.links.new(node(t, 'ShaderNodeBsdfTranslucent', Color=(0.80, 0.78, 0.70, 1)).outputs['BSDF'], mix.inputs[2])
    t.links.new(mix.outputs['Shader'], t.nodes['Material Output'].inputs['Surface'])
    slats(take, m, opt.time)

    # the sky, seen only through the window (the room is closed); kept with --no-sun, so the paper layer is the
    # wall as the sky alone lights it, and only the sun's light is the layer that moves
    world = bpy.data.worlds.new('sky')
    scene.world = world
    bg = world.node_tree.nodes['Background']
    bg.inputs['Color'].default_value = (0.70, 0.80, 1.0, 1)
    bg.inputs['Strength'].default_value = take['sky']
    if not opt.no_sun:
        sun = bpy.data.lights.new('sun', 'SUN')
        sun.energy = take['sun_energy']
        sun.angle = math.radians(take['sun_angle'])
        sun.color = take['sun_color']
        ob = bpy.data.objects.new('sun', sun)
        ob.rotation_euler = Vector(take['sun']).normalized().to_track_quat('-Z', 'Y').to_euler()
        scene.collection.objects.link(ob)

def build(opt):
    take = {**BASE, **TAKES[opt.take]}
    for kv in opt.set:
        k, v = kv.split('=', 1)
        take[k] = eval(v)  # tuning only, from the command line
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene

    (room_behind if take.get('layout') == 'behind' else room_side)(take, opt, scene)

    cam = bpy.data.cameras.new('cam')
    cam.type = 'ORTHO'
    cam.ortho_scale = FRAME_W
    cob = bpy.data.objects.new('cam', cam)
    cob.location = (CAM_X, -7.5, CAM_Z)
    cob.rotation_euler = (math.radians(90), 0, 0)
    scene.collection.objects.link(cob)
    scene.camera = cob

    scene.render.engine = 'CYCLES'
    prefs = bpy.context.preferences.addons['cycles'].preferences
    # 8.5k2b: headless sandboxes can expose Metal's backend without an actual GPU.
    try:
        prefs.compute_device_type = 'METAL'
        prefs.get_devices()
    except (TypeError, RuntimeError):
        pass
    gpu = any(d.type == 'METAL' for d in prefs.devices)
    for d in prefs.devices:
        d.use = d.type == 'METAL' if gpu else d.type == 'CPU'
    scene.cycles.device = 'GPU' if gpu else 'CPU'
    print(f'8.5k2b device: {scene.cycles.device}', flush=True)
    scene.cycles.samples = opt.samples
    scene.cycles.use_denoising = True
    scene.cycles.max_bounces = 6
    scene.cycles.transparent_max_bounces = 16
    scene.cycles.seed = 7
    if take.get('real', False):
        scene.cycles.max_bounces = 12
        scene.cycles.diffuse_bounces = 6
        scene.cycles.transparent_max_bounces = 32
        scene.cycles.denoiser = 'OPENIMAGEDENOISE'
        scene.cycles.denoising_use_gpu = gpu
        scene.cycles.use_animated_seed = False
        scene.cycles.adaptive_threshold = 0.005
        scene.view_settings.exposure = take['exposure']
    scene.render.resolution_x, scene.render.resolution_y = opt.width, opt.height
    scene.render.resolution_percentage = 100
    scene.view_settings.view_transform = 'AgX'
    scene.view_settings.look = 'None'
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_depth = '16'
    scene.render.filepath = opt.out
    Path(opt.out).resolve().parent.mkdir(parents=True, exist_ok=True)
    render(scene, opt, take)


if __name__ == '__main__':
    build(args())
