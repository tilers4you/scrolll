# 🎬 Cinematic Scroll-Scrubbing Playbook

A portable, battle-tested guide for building an Apple-style ("apple.com/airpods-pro")
scroll-driven cinematic page where **scrolling scrubs a pre-rendered video frame by
frame on a `<canvas>`**. No WebGL, no real-time 3D — just a numbered image sequence
drawn to a 2D canvas, driven by scroll position.

> Drop this file into a new project and hand it (plus your clip) to the next chat.
> It encodes not just *what* to build, but every problem we hit and how we fixed it.

---

## 0. The effect, in one paragraph

A finished video clip is exported to a numbered frame sequence
(`frame_0001.webp …`). The page is a tall scroll container with a `position:sticky`
full-viewport `<canvas>` inside. Scroll progress (0→1) maps to a frame index; only
that frame is drawn (cover-fit). Smooth scroll (Lenis) + scrub easing (GSAP
ScrollTrigger) make the scrubbing feel buttery. A narrative overlay layer (hero
title, stage captions, call-outs) fades in/out at scroll ranges on top.

---

## 1. When to use it — and when NOT to

**Use it when:** you have one continuous "hero" camera move (10–20s) and want a
premium, controlled, story-driven landing experience.

**Avoid / reconsider when:**
- The clip is long (>25–30s) → too many frames → heavy memory/download.
- You need interactive 3D (then use Three.js/R3F, not this).
- Target is low-end mobile only → consider the `<video>` fallback (§9).

---

## 2. Stack & install

- **Next.js (App Router) + React**, single `'use client'` component.
- **Lenis** — smooth scroll.
- **GSAP + ScrollTrigger** — scroll progress → frame scrubbing.
- **Canvas 2D** — rendering (NO Three.js).
- **TypeScript** preferred.

```bash
npm install next react react-dom gsap lenis
npm install -D typescript @types/react @types/node @types/react-dom
```

Project shape:
```
app/
  layout.tsx          # root layout, imports globals.css
  page.tsx            # server component → renders <CinematicScene/>
  CinematicScene.tsx  # the ONE client component (all logic)
  globals.css         # reset + loader/overlay styles
public/frames/        # frame_0001.webp … frame_NNNN.webp
```

---

## 3. Asset pipeline (ffmpeg) — **the most important part**

> 90% of "it feels rough / janky" is an **asset** problem, not a code problem.
> Get the frames right first.

### 3.1 Basic extraction
```bash
ffmpeg -i clip.mp4 -vf "fps=24,scale=1600:-2" -c:v libwebp -quality 82 \
  public/frames/frame_%04d.webp
```
- `fps` controls count: `total ≈ duration_s × fps`.
- `scale=W:-2` keeps aspect, forces even height.

### 3.2 ⭐ The smoothness insight (motion interpolation)
**Why scrubbing feels "по-кадрово" (filmstrip):** smoothness depends on how little
the camera moves **between adjacent frames**. Apple renders sequences at high fps so
each step is tiny. A short clip with a fast camera move has *large* motion per real
frame — and **extracting more frames at normal `fps=` only duplicates existing
frames, it does NOT add new motion.**

**The fix — synthesize true in-between frames with motion-compensated interpolation:**
```bash
ffmpeg -i clip.mp4 \
  -vf "scale=1280:-2,minterpolate=fps=48:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1" \
  -c:v libwebp -quality 82 public/frames/frame_%04d.webp
```
- `minterpolate … mci` generates **real intermediate motion** (not dupes). 24→48fps
  roughly doubles frame density and halves per-frame motion → continuous feel.
- ⚠️ `minterpolate` is **slow** (minutes) and can **warp on non-rigid transitions**
  (e.g. a dissolve/morph). If a section warps ugly, either lower its weight, keep
  that section non-interpolated, or use **RIFE** (AI interpolation) for cleaner
  results.
- Scale **before** `minterpolate` → faster motion estimation.

### 3.3 Resolution / count / memory — do the math
Decoded frames live in RAM as raw pixels, regardless of file format:
```
RAM ≈ width × height × 4 bytes × frame_count
e.g. 1280×720 × 4 × 671 ≈ 2.5 GB  (fine on desktop, risky on mobile/8GB)
```
Levers when memory is tight: **lower resolution** (1600→1280→1152), **fewer frames**
(48→36fps), or accept it on desktop. Our shipped numbers: **1280px wide, 48fps,
671 frames, ~84 MB download.**

### 3.4 Format choice
- **webp (recommended):** great balance of size + decode speed.
- **AVIF:** smaller files BUT **slower to decode** → risky for rapid scrubbing (and
  it does **not** reduce decoded RAM). Skip it for frame sequences.
- **JPEG (`-qscale:v 4`):** fastest decode, larger files. Good fallback.
- Keep `FRAME_PATH`'s extension in sync with what you exported.

---

## 4. Component architecture (the 8 behaviors)

### 4.1 Config constants (top of file — make everything tunable)
```ts
const TOTAL_FRAMES = 671;                       // exact count in public/frames
const FRAME_PATH = (i:number) => "/frames/frame_" + String(i).padStart(4,"0") + ".webp";
const SCROLL_VH  = 3000;                         // pacing knob — see §5
const SCRUB      = 1;                            // ScrollTrigger scrub easing (s)
const REVEAL_AT  = 0.9;                          // reveal canvas at 90% preloaded
```

### 4.2 Layout / pinning
Outer div `height: SCROLL_VH vh` → inner wrapper `position:sticky; top:0;
height:100vh` → full-viewport `<canvas>` (cover-fit in draw math, not CSS).

### 4.3 Preloading + loader
Preload **all** frames with `new Image()`; count `onload` **and `onerror`** (so a
404 never stalls the bar); show a centered % loader; flip `ready` at `REVEAL_AT`.
Store images in a ref array — **never recreate them**.

### 4.4 Canvas draw — cover fit + DPR cap
```ts
const dpr = Math.min(window.devicePixelRatio || 1, 2);   // cap at 2
canvas.width  = innerWidth  * dpr;
canvas.height = innerHeight * dpr;
// after sizing, re-apply (canvas resize resets ctx state):
ctx.imageSmoothingEnabled = true;
ctx.imageSmoothingQuality = "high";
// cover: scale = max(cw/iw, ch/ih), center, crop overflow
```

### 4.5 ⭐ Cross-fade interpolation (sub-frame smoothness)
Map progress to a **continuous** frame position and blend the two neighbours by the
fractional part. With dense (interpolated) frames this reads as motion, not a
dissolve:
```ts
const f = progress * (TOTAL_FRAMES - 1);
const i0 = Math.floor(f), i1 = Math.min(TOTAL_FRAMES-1, i0+1), frac = f - i0;
blit(images[i0], 1);            // base, opaque, fully covers canvas (no clear needed)
if (frac > 0.001) blit(images[i1], frac);   // overlay next at fractional alpha
```
Always fall back to the **last good frame** if `i0` isn't decoded yet → no black flash.

### 4.6 Scrub mapping
```ts
ScrollTrigger.create({
  trigger: outer, start: "top top", end: "bottom bottom",
  scrub: SCRUB,
  onUpdate: (self) => {
    const f = self.progress * (TOTAL_FRAMES - 1);
    if (Math.abs(f - currentFloat) > 0.02) { currentFloat = f; renderAt(f); }
    updateOverlays(self.progress);
  },
});
```

### 4.7 ⭐ Lenis + ScrollTrigger wiring (copy EXACTLY — desync lives here)
```ts
const lenis = new Lenis({ lerp: 0.09 });
lenis.on("scroll", ScrollTrigger.update);
const tick = (t:number) => lenis.raf(t * 1000);
gsap.ticker.add(tick);
gsap.ticker.lagSmoothing(0);
```

### 4.8 Reduced motion — **do NOT kill the experience** (lesson learned)
The spec says "respect `prefers-reduced-motion`". The naive reading — show one
static frame, disable scroll — makes the page look **broken** (Windows users often
have "reduce motion" ON system-wide). Scroll-scrubbing is **user-driven**, not an
autoplaying animation, so keep it:
```ts
if (!prefersReduced) { /* set up Lenis inertia */ }
// ALWAYS create the ScrollTrigger; under reduced motion use scrub:true (instant)
scrub: prefersReduced ? true : SCRUB
```
What reduced-motion turns off here is only Lenis's smooth **inertia**, not the
frame scrubbing.

### 4.9 Cleanup on unmount
```ts
trigger.kill();
ScrollTrigger.getAll().forEach(t => t.kill());
gsap.ticker.remove(tick);
lenis.destroy();
```

---

## 5. ⭐ `SCROLL_VH` — the pacing knob

This single constant controls how much wheel travel separates the first and last
frame. Too small → the whole clip blasts by in a few scrolls (we saw "all 671
frames in ~15 notches"). Rule of thumb:
- `800` ≈ ~15 wheel notches end-to-end (too fast for a story).
- `3000` ≈ ~55 notches (cinematic, deliberate — our shipped value).
Raise for slower/grander, lower if it drags. It does **not** change smoothness, only
pacing.

---

## 6. Narrative overlay system

All overlays are absolutely/fixed-positioned DOM (NOT drawn on canvas),
`pointer-events:none` except interactive menus, with **opacity driven by scroll
progress windows**. Keep every piece of copy in editable config arrays.

Reusable ramp (fade in → hold → fade out across `[from,to]`):
```ts
const rampOpacity = (p:number, from:number, to:number) => {
  const fade = Math.min((to - from) * 0.35, 0.05) || 0.04;
  if (p < from || p > to) return 0;
  return Math.max(0, Math.min((p - from)/fade, (to - p)/fade));
};
```

Pieces we shipped (all optional, mix to taste):
- **Hero** — big headline, visible at start, CSS entrance (`translateY + blur→0`),
  fades out by `progress ≈ 0.1`. (Gate render on `ready` so the entrance plays after
  the loader.)
- **Stages** — light numbered captions (`01 … 05`) each in its own `[from,to]`
  window; the client reads the build story while watching.
- **Reticle** — 4 corner brackets + size tag to "outline" the subject during its
  reveal window.
- **Hotspots / call-outs** — staggered neon markers (dot + line + label) during a
  "blueprint/engineering" window; position by viewport `%`.
- **Progress bar** — `transform: scaleX(progress)` in the menu.
- **Menu nav** — clicking jumps to a scene via
  `lenis.scrollTo(outer.offsetTop + p * (outer.offsetHeight - innerHeight), {duration})`.

---

## 7. Readability rules (overlays over bright footage)

White/neon text vanishes over sky, white walls, lawn. Always give text a backing:
```css
background: rgba(6,10,16,0.5);
backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
border: 1px solid rgba(255,255,255,0.1);
border-radius: 14px;
text-shadow: 0 2px 14px rgba(0,0,0,0.7);
```
Hug text with an inner `inline-block` pill so panels don't span the whole width.

---

## 8. 🔥 Pitfalls we hit (war stories) → fixes

1. **"Static house, scroll does nothing."** Cause: `prefers-reduced-motion` was ON
   (common on Windows), and the static-frame branch drew the middle frame and
   disabled scrubbing. → Keep scrubbing always; only drop Lenis inertia (§4.8).
2. **"Stuck on Loading forever."** Cause: **two `next dev` servers** running from the
   same project sharing one `.next/` → one wedged and stopped serving (even the HTML
   timed out). → Kill ALL dev servers, `rm -rf .next`, start exactly ONE. Never run
   two dev servers on the same folder.
3. **"Build hangs / `.next/trace` permission denied" (Windows).** Cause: orphaned
   `next build` processes holding the lock. → Find & kill stray node build PIDs, then
   rebuild. Don't run two builds at once.
4. **"Smooth but rough/filmstrip transitions."** Cause: source motion per real frame
   too large; crossfade between far-apart frames looks like a dissolve. → Motion
   interpolation (§3.2) + crossfade (§4.5). Not a code bug.
5. **"Whole clip scrubs by in ~15 scrolls."** → Raise `SCROLL_VH` (§5).
6. **"Can't see the captions / they flicker."** → Dark blurred backing (§7); longer
   `SCROLL_VH` makes each window last longer in scroll terms.
7. **White flash between frames.** → Base frame is opaque cover-fit (no `clearRect`
   needed); fall back to last good frame while the next decodes.

---

## 9. Windows & dev-server gotchas

- Use one dev server per project folder. Check before starting:
  `Get-CimInstance Win32_Process -Filter "name='node.exe'" | Select ProcessId,CommandLine`
- Kill strays: `Stop-Process -Id <pids> -Force`. Clear cache: `rm -rf .next`.
- Verify serving fast (a wedged server times out):
  `curl -s -m 10 -o /dev/null -w "%{http_code}\n" http://localhost:3000/frames/frame_0001.webp`
- **Fallback if image sequences aren't feasible:** a single `<video>` with
  `currentTime` driven by ScrollTrigger progress. Note: noticeably less smooth on
  iOS/Safari — prefer frames.

---

## 10. Reproduce from scratch — checklist

1. Scaffold Next.js App Router + TS (`package.json`, `tsconfig.json`,
   `next.config.mjs`, `next-env.d.ts`, `app/layout.tsx`, `app/page.tsx`,
   `app/globals.css`, `.gitignore`).
2. `npm install next react react-dom gsap lenis` (+ TS dev deps).
3. Probe the clip: `ffprobe -v error -select_streams v:0 -show_entries
   stream=width,height,r_frame_rate -show_entries format=duration in.mp4`.
4. Extract frames with **motion interpolation** (§3.2); pick resolution for memory
   (§3.3). Confirm count → set `TOTAL_FRAMES`.
5. Write `CinematicScene.tsx` implementing §4 (config, preload+loader, cover-fit
   draw, crossfade, scrub, exact Lenis wiring, reduced-motion, cleanup).
6. Add overlays (§6) + readability backing (§7). Keep all copy in config arrays.
7. Tune `SCROLL_VH` (§5) and overlay `[from,to]` windows to the footage beats.

---

## 11. Verification

- `npx tsc --noEmit` → clean. (Faster than a full build and won't fight a running
  dev server over `.next`.)
- `npm run dev`, open `http://localhost:3000`:
  - loader → reveal; scroll **both directions** scrubs smoothly, no flashes;
  - overlays fade at their beats and are readable over bright frames;
  - resize keeps cover-fit; toggle OS "reduce motion" → still scrubs (no Lenis
    inertia).
- `curl` the page + first/last frame + (last+1) → expect `200,200,200,404`
  (confirms `TOTAL_FRAMES` is exact).

---

## 12. Tunable constants cheat-sheet

| Constant            | Does what                                    | We shipped |
|---------------------|----------------------------------------------|------------|
| `TOTAL_FRAMES`      | exact frame count in `public/frames`         | `671`      |
| `SCROLL_VH`         | pacing — wheel travel start→end              | `3000`     |
| `SCRUB`             | ScrollTrigger catch-up easing (seconds)      | `1`        |
| Lenis `lerp`        | smooth-scroll inertia                        | `0.09`     |
| DPR cap             | canvas buffer ceiling                        | `2`        |
| `REVEAL_AT`         | preload fraction before revealing canvas     | `0.9`      |
| ffmpeg `fps` (mci)  | interpolated frame density (smoothness)      | `48`       |
| ffmpeg `scale`      | frame width (sharpness vs memory)            | `1280`     |

---

*Origin: built for a scroll-cinematic "house → blueprint → construction" landing.
Source clip 1920×1080, ~14s, 24fps → interpolated to 48fps → 671 webp frames @1280px.*
