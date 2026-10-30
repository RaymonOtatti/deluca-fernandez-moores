# 8.5k2b — Velo, real

## Render review through the GPU bridge

The original sandbox startup failure below is historical. The authorised file-request bridge now renders on the host GPU. Every candidate is measured and visually inspected.

| Candidate | Change | Shade | Centre | Top right | Bottom right | Gust MAD |
| --- | --- | --- | --- | --- | --- | --- |
| Initial V | First uncalibrated scene | 1.4,1.3,0.3 | 1.8,1.7,0.5 | 49.5,48.3,35.6 | 49.2,47.9,35.2 | — |
| r01 | Broader folds; limited grazing extinction; sage cloth; stronger window sky | 5.3,8.3,3.7 | 7.8,12.4,6.0 | 57.2,68.8,47.9 | 53.2,64.0,43.8 | — |

| r02 | Eight overlapping returns; rejected for stepped silhouettes | 7.9,12.3,6.0 | 11.9,17.9,9.8 | 64.1,77.7,56.3 | 44.7,58.3,37.5 | — |
| r03 | Continuous compressed folds; stronger neutral thread bounce; sky too bright | 19.7,24.6,17.5 | 25.8,32.3,24.1 | 70.4,82.9,64.8 | 61.3,72.2,54.5 | — |

| r04 | Wider gathering; sky reduced | 8.8,12.4,7.1 | 12.3,16.8,10.5 | 50.4,59.7,43.1 | 34.0,42.3,28.0 | — |
| r05 | Packing concentrated at jamb; rejected: fade too far right | 8.4,11.6,6.7 | 11.5,15.4,9.7 | 53.5,63.1,45.6 | 20.1,27.1,17.2 | — |
| r06 | Narrower gathering; 1.2 mm tooth | 11.0,14.5,8.7 | 15.2,19.5,13.1 | 64.2,74.4,55.4 | 41.9,50.6,35.1 | — |

## Previous implementation record (before bridge access)

**Incomplete: Blender 5.2.2 crashes before Python starts in this sandbox.** No new frame has rendered. `v-still.png`, `v-gust.png`, and `a-vs-v.png` could not be produced. The scene changes below are implemented but have not been visually calibrated or accepted. In particular, V's exposure, colour, centre darkness, streak inclination, lower-wall warmth, and penumbra need the requested small-render review. Do not treat the defaults as an approved look.

## Physical changes

- A's parameters, original curtain geometry, lighting and camera are preserved. Shared changes are argument validation, output-directory creation, an opt-in shutter path, timing output, and Metal/CPU selection. A's default shutter remains zero. Its paper bump remains 4 mm. A's output equivalence is **not render-verified**.
- V encloses the room on the left and behind the camera. The plaster is linear RGB `(0.66, 0.65, 0.61)`; the warm stone floor is `(0.33, 0.29, 0.24)`. Raising the floor to z=0 puts it 50 cm below the visible crop and lets the existing low window light it. Cycles gets six diffuse bounces, twelve total and thirty-two transparent intersections. The intended lower-wall warmth is reflected floor light, with no painted warm gradient.
- V replaces the green ambient and interior area fill with a small cool world term, accessible only through the window. The opening has 22 cm deep reveals. The warm daylight sun has a 0.53° disc. Its physical size and changing cloth-to-paper distance determine the direct penumbra; the cloth supplies diffuse transmission. The exposure is provisionally −1.2 stops, **not tuned by a render**.
- The cloth has irregularly spaced folds, pinched upper harmonics, larger folded depth near the jamb, and a 6 cm double-layer turn-up. Its gathered region is actual corrugated geometry; oblique light can cross more than one face. No gather/hem opacity ramp is used in V. A monotonic sheet coordinate prevents the folds from physically crossing themselves.
- A ray-dependent optical-depth term reduces the gaps' straight transmission at grazing incidence. Separate diffuse and translucent closures represent reflection and scattering by green threads. Gaps are more lightly tinted than the threads. This is a deterministic unresolved-weave approximation, not a yarn-level model or a cloth simulation.
- The gust is a travelling pressure pulse with a 0.72 s rise, delayed upwards by up to 0.65 s, displacement increasing toward the hem, a damped secondary ripple, and a smooth final 0.8 s return. The top is pinned. Endpoint branches use the rest coordinates exactly; no floating-point sine residue is relied upon. This is an analytic drape model, not a dynamics solve.
- V's paper has the original vertically stretched fibre noises and a 0.6 mm bump-distance scale. `tooth=0` still switches off all bump. The original diagonal paper-albedo falloff is neutralised with `fall=1`. The orthographic framing stays fixed; no vignette, haze, dust, flares, or window cross was added.
- `--shutter 0.5` uses five equally weighted midpoint samples over 1/48 s at 24 fps. Temporary 32-bit EXRs are averaged in scene-linear Rec.709 with NumPy, then AgX is applied once when saving the 16-bit PNG. A fixed seed is retained. Endpoints bypass subframes and remain still. V explicitly selects OpenImageDenoise; the CPU denoiser is selected when no Metal device is available.
- In V, `--no-sun` disables both daylight sources, so this enclosed room has no remaining illumination. The material and geometry still exist. A retains its original ambient-only shade render.

## Tones (sRGB, 0–255)

`measure.mjs` resizes to 600×375 and measures the four specified rectangles. It keeps 16-bit samples until reporting. `measurements.jsonl` contains the actual result from the supplied JPEG reference. The reference differs from the prompt's stated 600×375 A measurements; neither is silently substituted for a newly rendered A baseline.

| Region | A supplied in brief | A reference JPEG, measured | V |
| --- | --- | --- | --- |
| Shade (60,150,120,80) | 13,16,10 | 13.661,15.675,10.462 | unavailable |
| Centre (260,150,80,80) | 19,23,15 | 14.947,17.367,11.876 | unavailable |
| Top right (470,30,100,80) | 51,59,42 | 60.921,69.894,50.368 | unavailable |
| Bottom right (470,280,100,80) | 26,31,20 | 30.573,36.124,24.773 | unavailable |

There are no rendered V candidates to measure. The ±4 tone tolerance and centre ceiling have not been demonstrated.

## Verification and timing

`python3 design/blender/polish/check.py` checks identical endpoint coordinates, pinned top vertices, finite coordinates, bounded displacement, zero endpoint velocity, ordered non-crossing rows, fixed topology, shutter sampling, unchanged A/B/C parameter dictionaries, and A's unchanged curtain vertices at all six requested times. It runs without importing Blender. `check.log` records the result. Node and shell syntax checks also pass. These do not validate Blender shader APIs or rendered appearance.

- t=0 versus t=4.8 geometry: **exactly identical** (all vertices and faces).
- t=0 versus t=4.8 rendered max channel difference: **unavailable**; the ≤2 criterion remains untested.
- 600×375 render time: **unavailable**, no frame reached Cycles.
- 2400×1500 render time: **unavailable**, no full-size render started.
- Device: **not enumerated**, because Blender crashes before `prefs.get_devices()` or the new CPU fallback can execute.

Even this minimal startup command exits with SIGSEGV (139), before printing `STARTUP OK`:

```sh
/Users/francomichetti/dev/video/forge-studio/eval/skills/work/blender/Blender.app/Contents/MacOS/Blender \
  -b --factory-startup --python-expr "print('STARTUP OK', flush=True)"
```

The saved backtrace is `blender.crash.txt`: `GPU_backend_type_selection_detect` → `MTLBackend::metal_is_supported` → `supports_barycentric_whitelist` → `_platform_strstr`. Explicit Metal and GPU-workaround startup flags did not resolve it. OpenGL is not a supported backend in this binary. No binary patch, permission change, package installation, or external render was attempted.

## Completing the render review

`render-review.sh` renders the A check, six V poses (48 samples; moving poses have shutter 0.5), a no-sun plate, and a tooth=0 plate. It records every frame's tones and checks the two rest images. On a working host:

```sh
sh design/blender/polish/render-review.sh
```

Review and tune V at small size first. Once those tones and the look hold, `FULL_SIZE=1 sh design/blender/polish/render-review.sh` also renders one 2400×1500 still at 192 samples and assembles the labelled six-frame strip and 1200-pixel-per-take comparison. All output stays in this directory. Each Blender frame log includes elapsed rendering seconds and selected device. The local baseline snapshot is `hero-light-before.py`; it preserves the existing uncommitted scene as received, not Git HEAD.

Implementation references: Blender's [transparent light paths](https://docs.blender.org/manual/en/4.4/render/cycles/render_settings/light_paths.html), [Image.save_render API](https://docs.blender.org/api/4.2/bpy.types.Image.html), and [Metal support detection source](https://raw.githubusercontent.com/blender/blender/main/source/blender/gpu/metal/mtl_backend.mm). Installed Cycles properties and OCIO configuration were checked for the denoising settings and `Linear Rec.709` name. Runtime rendering remains blocked as described above.
