# scrolll

Scroll-scrubbed cinematic website (Apple-style). Scrolling scrubs a pre-rendered
clip **frame by frame** on a `<canvas>` — no WebGL, no real-time 3D.

## Layout
```
CLAUDE.md                      brief for the next AI session (defers to the playbook)
SCROLLYTELLING_PLAYBOOK.md     full engineering spec + war stories (EN)
РУКОВОДСТВО-RU.md              plain-language guide (RU)
app/                           runnable Next.js page that renders the scene
public/frames/                 your frame sequence goes here (git-ignored)
templates/cinematic-scroll/    ⭐ reusable template — copy this per project
  ├─ CinematicScene.tsx        engine + EDIT-FOR-YOUR-PROJECT config block
  ├─ cinematic.css             all styles (accent = one CSS variable)
  └─ README.md                 5-step quick start
```

## Run
```bash
npm install
# add frames to public/frames/ (see templates/cinematic-scroll/README.md step 3)
npm run dev      # http://localhost:3000
```

New subject (plane / bathtub / car): copy `templates/cinematic-scroll/`, drop in a
new clip, edit the config block. Details in that folder's README.
