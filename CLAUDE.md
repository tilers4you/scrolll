# CLAUDE.md — scroll-scrubbed cinematic site

You are building a single-page, scroll-driven cinematic website in **Next.js
(App Router) + React**. Scrolling does NOT move the page normally — it **scrubs a
pre-rendered cinematic clip frame by frame** on a `<canvas>`, creating an
Apple-style "scrollytelling" effect (like apple.com/airpods-pro). There is **no
real-time 3D and no WebGL**. The clip is a finished video exported to a numbered
image sequence; you draw the correct frame to a `<canvas>` based on scroll position.

The reference footage is one continuous camera move: it opens on sky and distant
mountains, descends onto the roof of a luxury house, pulls back to reveal the whole
house, the house lights up as a glowing neon engineering blueprint, then dissolves
into a construction site.

> ⚠️ **Source of truth.** The full engineering spec lives in
> **`SCROLLYTELLING_PLAYBOOK.md`** (theory + every bug we hit and fixed). A
> copy-ready implementation lives in **`templates/cinematic-scroll/`**. When this
> file and the playbook disagree, **the playbook wins.** Prefer copying the
> template over re-deriving the engine from scratch.

---

## Tech & constraints
- Next.js App Router, a single client component (`'use client'`).
- Smooth scroll: **Lenis** (`lenis`).
- Scroll-progress → frame scrubbing: **GSAP + ScrollTrigger** (`gsap`, `gsap/ScrollTrigger`).
- Rendering: plain **Canvas 2D** (no Three.js).
- TypeScript preferred.
- Do **NOT** use `localStorage` / `sessionStorage`.
- Must work on desktop and mobile (touch) and respect `prefers-reduced-motion`
  (see the rule below — it is the #1 source of a "broken-looking" page).

## Assets (provided)
- A numbered frame sequence at `public/frames/frame_0001.webp … frame_{NNNN}.webp`.
- Config to fill in:
  - `TOTAL_FRAMES` = exact file count in `public/frames` (`ls public/frames | wc -l`).
  - `FRAME_PATH = (i) => '/frames/frame_' + String(i).padStart(4,'0') + '.webp'`.
  - source aspect ratio = 16:9.

### Frame extraction — use MOTION INTERPOLATION (the smoothness lever)
Smoothness depends on how little the camera moves **between adjacent frames**.
Extracting more frames at a normal `fps=` only **duplicates** frames — it adds no
new motion. Synthesize true in-between frames instead:
```bash
ffmpeg -i clip.mp4 \
  -vf "scale=1280:-2,minterpolate=fps=48:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1" \
  -c:v libwebp -quality 82 public/frames/frame_%04d.webp
```
Format **webp** (good size + decode speed). Target roughly **~600–700 frames** at
**1280px / 48fps** for a ~14s clip. On non-rigid transitions (dissolve/morph)
`minterpolate` can warp — use **RIFE / FILM** for those sections if ugly.

## Required behavior (implement carefully)
1. **Layout / pinning:** an outer scroll container whose height is a tunable
   constant `SCROLL_VH` (**default 3000**). Inside it, a wrapper with
   `position: sticky; top: 0; height: 100vh` containing a full-viewport `<canvas>`
   (cover-fit done in draw math, not CSS).
2. **Preloading + decode-ahead:** preload all frames with `new Image()` and call
   **`img.decode()`** so `drawImage` never blocks mid-scrub. Count both success and
   error (a 404 must never stall the bar). Show a centered % loader; reveal the
   canvas at ~`REVEAL_AT` (**0.9**) and keep loading the rest. Store images in a ref
   — **never recreate them**.
3. **Scrub mapping:** one ScrollTrigger on the outer container, `start:'top top'`,
   `end:'bottom bottom'`, **`scrub: 1`**. Map progress (0→1) to a **continuous**
   frame position `f = progress*(TOTAL_FRAMES-1)`; redraw only when `f` changed
   meaningfully.
4. **Canvas draw (cover-fit + crossfade):** size the buffer to
   `innerWidth/Height * Math.min(devicePixelRatio, 2)`; CSS size = viewport. Draw the
   base frame opaque (cover: `scale = max(cw/iw, ch/ih)`, centered, cropped), then
   blend the **next** frame on top at fractional alpha for sub-frame smoothness.
   Fall back to the last good frame while the next decodes — **no white/black
   flashes** (opaque base means no `clearRect` needed). Redraw on resize.
5. **Lenis + ScrollTrigger integration (do EXACTLY this to avoid desync):**
   - `const lenis = new Lenis({ lerp: 0.09 })`
   - `lenis.on('scroll', ScrollTrigger.update)`
   - `gsap.ticker.add((t) => lenis.raf(t * 1000))`
   - `gsap.ticker.lagSmoothing(0)`
6. **Reduced motion — DO NOT freeze the scene (lesson learned):** scroll-scrubbing
   is user-driven, not an autoplaying animation, so **keep the scrubbing always.**
   The naive "draw one static frame and disable scroll" makes the page look broken —
   Windows users frequently have "reduce motion" ON system-wide, and that exact
   branch caused our worst bug. Under `prefers-reduced-motion`: **skip only Lenis's
   smooth inertia** and create the ScrollTrigger with **`scrub: true`** (instant).
   Never disable the ScrollTrigger and never replace it with a single static frame.
7. **Cleanup:** kill ScrollTrigger triggers, remove the gsap ticker fn, and destroy
   Lenis on unmount.
8. **Performance:** rAF-driven, never recreate images, cap DPR at 2, gate work to
   when the section is in view where practical, keep memory reasonable
   (RAM ≈ w × h × 4 × frame_count — ~2.3 GB at 1280×720 × 671, risky on phones).
9. **Mobile (optional but recommended):** ship a second lighter sequence
   (e.g. 1152px / 36fps) and select it on small / low-`deviceMemory` devices.

## Narrative overlays (DOM, not canvas)
All overlay copy is **real DOM text** (indexable + screen-reader friendly),
absolutely/fixed-positioned, `pointer-events:none` except interactive menus, with
**opacity driven by scroll-progress windows** `[from,to]`. Keep every piece of copy
in editable config arrays. Pieces (all optional via a `FEATURES` toggle map): hero,
numbered stage captions, reticle (corner brackets + tag), hotspots (dot + line +
label), progress bar, menu nav. Give text a dark blurred backing so it stays
readable over bright footage.

## Fallback
If an image sequence is not feasible, fall back to a single `<video>` with
`currentTime` driven by ScrollTrigger progress — noticeably less smooth on
iOS/Safari, so prefer frames.

## Deliverables
- Full Next.js page/component code + CSS (the template in
  `templates/cinematic-scroll/` is the canonical implementation).
- The exact `npm install` line for dependencies.
- Clear notes on where frames go (`public/frames/`) and which config values to set.
- Must run with `npm run dev` and scrub smoothly in **both** directions, with no
  flashes, overlays readable over bright frames, and still scrub under OS "reduce
  motion".

## Verify
- `npx tsc --noEmit` → clean (faster than a full build; won't fight a running dev
  server over `.next`).
- `npm run dev`: loader → reveal; scroll both ways scrubs smoothly; overlays fade at
  their beats; resize keeps cover-fit; toggle OS "reduce motion" → still scrubs.
- `curl` the page + first/last frame + (last+1) → expect `200,200,200,404`
  (confirms `TOTAL_FRAMES` is exact).
- One dev server per folder only. If stuck on "Loading" forever or a `.next` lock:
  kill ALL node dev/build processes, `rm -rf .next`, start exactly one.
