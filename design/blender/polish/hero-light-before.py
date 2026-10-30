# 8.5k1: the hero's light, built as a room in Blender (Franco, 2026-10-23: "a super clean environment, with
# cinematic lighting"). A paper wall in shadow, a window off-frame to the upper right with sheer curtains, the
# sun through them. Same composition as the hero since 5.2: the light in the upper right, its folds leaning
# like today's, the middle dark for the lockup. Run headless, as Orbom does:
#   blender -b --factory-startup --python-exit-code 1 --python design/blender/hero-light.py -- \
#     --take a --out <file>.png [--width 2400 --height 1500 --samples 256] [--no-sun] [--set key=value ...]
# --no-sun renders the paper alone (8.5k2 subtracts it from the lit frames to get the light by itself).
# --time t (seconds) poses the curtain t seconds into its one gust (8.5k2); 0 and DURATION are the rest pose.
# Blender: 5.2.2 (the Homebrew wrapper points at a missing /Applications copy; forge-studio's runs).
import argparse
import math
import sys

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
    # b, "Ventana": the curtain drawn back over half the window, the frame's cross in soft shadow beside it
    'b': dict(curtain=(-1.5, -0.75), mullions=True, gather=0.5, sun_energy=0.8, sun_color=(0.82, 0.92, 0.74)),
    # c, "Follaje": as a, with a tree outside the window: its leaves dapple the light through the sheer
    'c': dict(leaves=900, sun_energy=1.8),
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
    p.add_argument('--set', nargs='*', default=[], help='key=value overrides, for tuning')
    return p.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])


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
    ramp.color_ramp.elements[0].color = (0.62, 0.62, 0.57, 1)
    ramp.color_ramp.elements[1].color = (0.74, 0.74, 0.68, 1)
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
    bump = node(t, 'ShaderNodeBump', Strength=take['tooth'], Distance=0.004)
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


def build(opt):
    take = {**BASE, **TAKES[opt.take]}
    for kv in opt.set:
        k, v = kv.split('=', 1)
        take[k] = eval(v)  # tuning only, from the command line
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene

    quad('paper', (-6, 0, -1), (6, 0, -1), (6, 0, 7), (-6, 0, 7), paper(take))
    dark = matte('room', (0.05, 0.055, 0.045))
    side_wall(take, dark)
    curtain(take, sheer(take), opt.time)
    quad('floor', (-6, -8, -1), (SIDE_X, -8, -1), (SIDE_X, 0, -1), (-6, 0, -1), dark)
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
    prefs.compute_device_type = 'METAL'
    prefs.get_devices()
    for d in prefs.devices:
        d.use = True
    scene.cycles.device = 'GPU'
    scene.cycles.samples = opt.samples
    scene.cycles.use_denoising = True
    scene.cycles.max_bounces = 6
    scene.cycles.transparent_max_bounces = 16
    scene.cycles.seed = 7
    scene.render.resolution_x, scene.render.resolution_y = opt.width, opt.height
    scene.render.resolution_percentage = 100
    scene.view_settings.view_transform = 'AgX'
    scene.view_settings.look = 'None'
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_depth = '16'
    scene.render.filepath = opt.out
    bpy.ops.render.render(write_still=True)


if __name__ == '__main__':
    build(args())
