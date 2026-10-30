# 8.5k2b: geometry checks run without a GPU, so a broken render host cannot hide a bad pose.
import ast
import math
from pathlib import Path
import unittest
from types import SimpleNamespace

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'hero-light.py'


def namespace(path):
    tree = ast.parse(path.read_text())
    keep = [n for n in tree.body if isinstance(n, (ast.FunctionDef, ast.Assign))]
    ns = {'math': math}
    exec(compile(ast.Module(body=keep, type_ignores=[]), str(path), 'exec'), ns)
    return ns


class DrapeChecks(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.ns = namespace(SOURCE)
        cls.take = {**cls.ns['BASE'], **cls.ns['TAKES']['v']}

    def test_exact_rest_and_pinned_rod(self):
        drape = self.ns['drape']
        rest, faces = drape(self.take, 0)
        self.assertEqual(rest, drape(self.take, 4.8)[0])
        self.assertEqual(rest, drape(self.take, -1)[0])
        self.assertEqual(rest, drape(self.take, 6)[0])
        top = max(p[2] for p in rest)
        largest = 0
        for t in (0.6, 1.2, 2.0, 3.2, 4.7):
            posed, posed_faces = drape(self.take, t)
            self.assertEqual(faces, posed_faces)
            for a, b in zip(rest, posed):
                distance = math.dist(a, b)
                largest = max(largest, distance)
                if a[2] == top:
                    self.assertEqual(a, b)
                self.assertTrue(all(math.isfinite(v) for v in b))
        self.assertGreater(largest, 0.025)
        self.assertLessEqual(largest, 0.12)

    def test_settles_with_zero_speed(self):
        drape = self.ns['drape']
        rest = drape(self.take, 0)[0]
        for t in (0.0001, 4.7999):
            speed = max(math.dist(a, b) for a, b in zip(rest, drape(self.take, t)[0])) / 0.0001
            self.assertLess(speed, 0.001)

    def test_shutter_keeps_endpoints_at_rest(self):
        times = self.ns['shutter_times']
        self.assertEqual(times(0, 0.5), [0])
        self.assertEqual(times(4.8, 0.5), [4.8])
        self.assertEqual(times(1.2, 0), [1.2])
        moving = times(1.2, 0.5)
        self.assertEqual(len(moving), 5)
        self.assertAlmostEqual(sum(moving) / 5, 1.2)
        self.assertLessEqual(max(moving) - min(moving), 0.5 / 24)

    def test_sheet_does_not_cross_itself(self):
        for t in (0, 0.6, 1.2, 2.0, 3.2, 4.8):
            verts, _ = self.ns['drape'](self.take, t)
            for row in range(101):
                points = verts[row * 1601:(row + 1) * 1601]
                self.assertTrue(all(a[1] < b[1] for a, b in zip(points, points[1:])))
                self.assertTrue(all(p[0] < self.ns['SIDE_X'] for p in points))

    def test_approved_curtain_geometry_unchanged(self):
        before = namespace(ROOT / 'polish/hero-light-before.py')
        take = {**before['BASE'], **before['TAKES']['a']}
        def capture(ns, t):
            result = []
            def mesh(name, verts, faces, material):
                result.extend((verts, faces))
                return SimpleNamespace(data=SimpleNamespace(polygons=[]))
            ns['mesh'] = mesh
            ns['curtain'](take, None, t)
            return result
        for t in (0, 0.6, 1.2, 2.0, 3.2, 4.8):
            self.assertEqual(capture(before, t), capture(self.ns, t))

    def test_approved_take_functions_unchanged(self):
        before = ast.parse((ROOT / 'polish/hero-light-before.py').read_text())
        after = ast.parse(SOURCE.read_text())
        funcs = lambda tree: {n.name: n for n in tree.body if isinstance(n, ast.FunctionDef)}
        old, new = funcs(before), funcs(after)
        for name in ('sheer', 'gust', 'matte', 'mesh', 'quad', 'side_wall', 'foliage', 'haze'):
            self.assertEqual(ast.dump(old[name]), ast.dump(new[name]), name)
        self.assertEqual(namespace(ROOT / 'polish/hero-light-before.py')['BASE'], self.ns['BASE'])
        for take in ('a', 'b', 'c'):
            self.assertEqual(namespace(ROOT / 'polish/hero-light-before.py')['TAKES'][take], self.ns['TAKES'][take])


class BlindsChecks(unittest.TestCase):
    # 8.8 (Franco, 2026-10-24: "add some additional movement from start to the existing movement"): take w's blinds
    # sway gently from the clip's first frames for `lead` seconds and hand over to the gust approved in 8.5k2c, which
    # keeps its shape, only later by `lead`; rest exact at both ends
    @classmethod
    def setUpClass(cls):
        cls.ns = namespace(SOURCE)
        cls.before = namespace(ROOT / 'polish/hero-light-8.7.py')
        cls.take = {**cls.ns['BASE'], **cls.ns['TAKES']['w']}
        cls.lead = cls.take['lead']

    def pose(self, ns, take, t):
        result = []
        def mesh(name, verts, faces, material):
            result.extend((verts, faces))
        ns['mesh'] = mesh
        ns['slats'](take, None, t)
        return result

    def moved(self, t):
        rest = self.pose(self.ns, self.take, 0)[0]
        return max(math.dist(a, b) for a, b in zip(rest, self.pose(self.ns, self.take, t)[0]))

    def test_rest_exact_at_both_ends(self):
        rest = self.pose(self.before, {**self.before['BASE'], **self.before['TAKES']['w']}, 0)
        for t in (0, -1, self.lead + 4.8, self.lead + 6):
            self.assertEqual(self.pose(self.ns, self.take, t), rest, t)

    def test_gust_keeps_its_shape(self):
        approved = {**self.before['BASE'], **self.before['TAKES']['w']}
        for t in (1.0, 1.2, 2.0, 3.2, 4.7):
            (verts, faces), (old, old_faces) = self.pose(self.ns, self.take, self.lead + t), self.pose(self.before, approved, t)
            self.assertEqual(faces, old_faces)
            # (lead + t) - lead is t only to the last bit of a float: a nanometre, never a pixel
            self.assertLess(max(math.dist(a, b) for a, b in zip(verts, old)), 1e-9, t)

    def test_no_lead_is_the_approved_motion(self):
        approved = {**self.before['BASE'], **self.before['TAKES']['w']}
        for t in (0.2, 0.6, 1.2, 2.0, 3.2, 4.7):
            self.assertEqual(self.pose(self.ns, {**self.take, 'lead': 0}, t), self.pose(self.before, approved, t), t)

    def test_moves_from_the_start_without_a_lull(self):
        peak = max(self.moved(self.lead + t / 10) for t in range(2, 30))
        opening = [self.moved(i / 10) for i in range(3, int(self.lead * 10) + 1)]
        handoff = [self.moved(self.lead + i / 10) for i in range(7)]
        self.assertGreater(min(opening), 0.25 * peak, [round(m / peak, 2) for m in opening])
        self.assertGreater(min(handoff), 0.25 * peak, [round(m / peak, 2) for m in handoff])
        self.assertLess(max(opening), peak, 'the gust stays the strongest')
        self.assertLess(self.moved(1 / 24), 0.25 * peak, 'it starts from rest, gently')

    def test_shutter_keeps_the_longer_clip_s_end_at_rest(self):
        times = self.ns['shutter_times']
        end = self.lead + 4.8
        self.assertEqual(times(end, 0.5, end), [end])
        self.assertEqual(len(times(4.8, 0.5, end)), 5)


if __name__ == '__main__':
    unittest.main()
