# Keelstone — scroll-scrubbed custom-home website

Marketing site for a US custom home & addition builder. The hero is a
scroll-driven cinematic: as you scroll, the camera descends from sky onto a
finished residence, the house lights up as a glowing engineering blueprint,
and dissolves into an active construction site. Below the cinematic: services,
process, trust signals, contact.

Apple-style scroll-scrubbing — no WebGL, no real-time 3D. A pre-rendered clip
is decoded as a numbered image sequence and drawn frame-by-frame on a `<canvas>`
driven by scroll position.

## Stack
- Next.js 14 (App Router)
- React 18 + TypeScript
- Lenis (smooth scroll) + GSAP/ScrollTrigger (scrub mapping)
- Plain Canvas 2D (no WebGL)

## Layout
```
CLAUDE.md                      brief for the next AI session
SCROLLYTELLING_PLAYBOOK.md     full engineering spec + war stories (EN)
РУКОВОДСТВО-RU.md              plain-language guide (RU)
source/clip.mp4                source video for the cinematic
app/                           Next.js page + below-fold sections
public/frames/                 551 pre-rendered webp frames
templates/cinematic-scroll/    reusable scrub engine
  ├─ CinematicScene.tsx        engine + EDIT-FOR-YOUR-PROJECT config block
  ├─ cinematic.css             styles (accent = one CSS variable)
  └─ README.md                 5-step quick start
```

## Run
```bash
npm install
npm run dev          # http://localhost:3000
```

## Regenerate frames (if you swap the source clip)
```bash
# Extract interpolated PNG at 1280px / 48fps
ffmpeg -y -i source/clip.mp4 \
  -vf "scale=1280:-2,minterpolate=fps=48:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1" \
  -q:v 2 /tmp/scrolll-frames/frame_%04d.png

# Encode to webp (requires `brew install webp`)
for f in /tmp/scrolll-frames/*.png; do
  cwebp -quiet -q 82 -m 4 "$f" -o "public/frames/$(basename "${f%.png}.webp")"
done

# Then set TOTAL_FRAMES in templates/cinematic-scroll/CinematicScene.tsx
# to:  ls public/frames | wc -l
```

## Verify
```bash
npx tsc --noEmit
npm run dev
```
Scroll both ways → cinematic scrubs smoothly. Resize → cover-fit holds.
Toggle OS "reduce motion" → still scrubs (only the smooth inertia drops).
