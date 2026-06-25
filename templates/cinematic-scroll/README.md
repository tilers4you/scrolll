# cinematic-scroll — reusable template

A drop-in, scroll-scrubbed cinematic hero (Apple-style). The engine is generic; for
a new subject you mostly edit one config block.

**Theory + war stories:** [`../../SCROLLYTELLING_PLAYBOOK.md`](../../SCROLLYTELLING_PLAYBOOK.md) ·
**Plain-language guide (RU):** [`../../РУКОВОДСТВО-RU.md`](../../РУКОВОДСТВО-RU.md)

## Quick start (5 steps)

1. **Scaffold + deps**
   ```bash
   npx create-next-app@latest my-site   # App Router + TypeScript
   cd my-site
   npm install gsap lenis
   ```

2. **Copy the template**
   - `CinematicScene.tsx` → `app/CinematicScene.tsx` (or import from here)
   - `cinematic.css` → import it from `app/globals.css`:
     `@import '../templates/cinematic-scroll/cinematic.css';`

3. **Make frames (this is what creates the smoothness)** — one continuous 12–20s
   camera move, with motion interpolation:
   ```bash
   ffmpeg -i clip.mp4 \
     -vf "scale=1280:-2,minterpolate=fps=48:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1" \
     -c:v libwebp -quality 82 public/frames/frame_%04d.webp
   ls public/frames | wc -l        # → set TOTAL_FRAMES to this exact number
   ```

4. **Edit only the `EDIT FOR YOUR PROJECT` block** in `CinematicScene.tsx`:
   `TOTAL_FRAMES`, `FEATURES` (toggle hero / stages / reticle / hotspots / menu),
   `BRAND`, `HERO`, `stages`, `RETICLE`, `hotspots`, `menuItems`, and tune
   `SCROLL_VH` for pace.

5. **Run**
   ```bash
   npm run dev        # http://localhost:3000
   npx tsc --noEmit   # type-check without fighting .next
   ```

## What to change per subject (plane / bathtub / car …)
| Need | Do this |
|------|---------|
| Different clip | re-run step 3, set `TOTAL_FRAMES` |
| No outline box | `FEATURES.reticle = false` |
| No spec call-outs | `FEATURES.hotspots = false` |
| Faster / slower feel | lower / raise `SCROLL_VH` |
| Rebrand color | change `--cin-accent` in `cinematic.css` |
| New copy | edit `HERO`, `stages`, `hotspots`, `menuItems` |

## Mobile (recommended for heavy clips)
A full sequence can hold ~2 GB of decoded frames in RAM — risky on phones. Export a
second, lighter pass and enable it for small / low-memory devices:
```bash
ffmpeg -i clip.mp4 \
  -vf "scale=1152:-2,minterpolate=fps=36:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1" \
  -c:v libwebp -quality 80 public/frames-mobile/frame_%04d.webp
```
Then in `CinematicScene.tsx` set `MOBILE_FRAMES.enabled = true` and its
`totalFrames` to the new count.

## SEO note
The canvas is invisible to crawlers — all narrative copy here is **real DOM text**
on purpose. Keep it that way, make sure your `<h1>` is a real heading, and consider
lazy-mounting or desktop-gating the heavy sequence so mobile Core Web Vitals don't
suffer.

## Files
```
CinematicScene.tsx   engine + EDIT-FOR-YOUR-PROJECT config block
cinematic.css        all styles (accent = one CSS variable)
README.md            this file
```
