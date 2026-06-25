'use client';

/**
 * CinematicScene — scroll-scrubbed frame-sequence hero (Apple-style).
 *
 * The ENGINE (preload + decode-ahead, cover-fit draw, crossfade, scrub,
 * Lenis/ScrollTrigger wiring, reduced-motion, mobile adaptivity, cleanup)
 * is generic and reused across projects. For a new subject (plane, bathtub,
 * car…) you normally only touch the "EDIT FOR YOUR PROJECT" block below.
 *
 * Full theory + war stories: ../../SCROLLYTELLING_PLAYBOOK.md
 */

import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

/* ════════════════════════════════════════════════════════════════════════
 *  EDIT FOR YOUR PROJECT  — everything below the ENGINE line is data/config
 * ════════════════════════════════════════════════════════════════════════ */

/* ── Frames ─────────────────────────────────────────────────────────────
 * TOTAL_FRAMES must EXACTLY match the file count in public/frames.
 * Verify:  ls public/frames | wc -l
 * A wrong number = white flash / 404 on the last frame.                    */
const TOTAL_FRAMES = 551;
const FRAME_PATH = (i: number) =>
  `/frames/frame_${String(i).padStart(4, '0')}.webp`;

/* Optional lighter sequence for small / low-memory devices. Export a second
 * pass (e.g. 1152px / 36fps) into public/frames-mobile and flip enabled:true.
 * See README §"Mobile". Leave disabled to serve one sequence everywhere.    */
const MOBILE_FRAMES = {
  enabled: false,
  totalFrames: TOTAL_FRAMES,
  framePath: (i: number) =>
    `/frames-mobile/frame_${String(i).padStart(4, '0')}.webp`,
};

/* ── Feel / pacing ──────────────────────────────────────────────────────
 * SCROLL_VH  = wheel travel from first→last frame (pacing, NOT smoothness).
 *              800 ≈ ~15 notches (fast)   3000 ≈ ~55 notches (cinematic).
 * SCRUB      = ScrollTrigger catch-up easing, seconds.
 * REVEAL_AT  = preload fraction before the canvas is revealed.
 * LENIS_LERP = smooth-scroll inertia (lower = looser).                      */
const SCROLL_VH = 3000;
const SCRUB = 1;
const REVEAL_AT = 0.9;
const LENIS_LERP = 0.09;

/* ── Feature toggles ────────────────────────────────────────────────────
 * Turn any narrative layer off for a given project.                        */
const FEATURES = {
  hero: true,
  stages: true,
  reticle: true,
  hotspots: true,
  menu: true,
  progress: true,
};

/* ── Copy / brand ───────────────────────────────────────────────────────
 * All overlay copy is REAL DOM text (indexable + screen-reader friendly).
 * Stage / hotspot windows are [from,to] in 0..1 of scroll progress.        */
const BRAND = 'KEELSTONE';

const HERO = {
  eyebrow: 'CUSTOM HOMES & ADDITIONS',
  title: 'Built once. Built right.',
  subtitle: 'Architecture, structure, and finish — under one contract. Ground-up homes and considered additions across the United States.',
};

type Stage = {
  id: string;
  from: number;
  to: number;
  num: string;
  title: string;
  body: string;
};
const stages: Stage[] = [
  { id: 's1', from: 0.02, to: 0.16, num: '01', title: 'Vision', body: 'Every project starts above the tree line — sightlines, solar path, setbacks, the view from the kitchen window.' },
  { id: 's2', from: 0.20, to: 0.36, num: '02', title: 'Site read', body: 'Grade, drainage, prevailing wind. The site decides the house before the architect does.' },
  { id: 's3', from: 0.42, to: 0.56, num: '03', title: 'The home', body: 'Tight envelope, quiet HVAC, materials that age into the site rather than off of it.' },
  { id: 's4', from: 0.60, to: 0.74, num: '04', title: 'Engineered', body: 'Stamped structural drawings, a sealed envelope, mechanicals routed for service — not just for code.' },
  { id: 's5', from: 0.80, to: 0.94, num: '05', title: 'Build', body: 'One superintendent, one schedule, one point of contact. Foundation to keys.' },
];

const RETICLE = { from: 0.44, to: 0.56, label: 'RESIDENCE', tag: '3,800 sq ft · 4 bd · 3.5 ba' };

type Hotspot = {
  id: string;
  from: number;
  to: number;
  xPct: number;
  yPct: number;
  title: string;
  value: string;
};
const hotspots: Hotspot[] = [
  { id: 'h1', from: 0.61, to: 0.74, xPct: 50, yPct: 28, title: 'Engineered roof', value: 'TJI® rafters & ridge beam' },
  { id: 'h2', from: 0.63, to: 0.76, xPct: 70, yPct: 44, title: '2x6 advanced framing', value: '24" o.c. — more insulation room' },
  { id: 'h3', from: 0.66, to: 0.78, xPct: 32, yPct: 56, title: 'ZIP System sheathing', value: 'Integrated air & water barrier' },
  { id: 'h4', from: 0.69, to: 0.82, xPct: 64, yPct: 70, title: 'Heat-pump HVAC', value: 'High-efficiency, ENERGY STAR' },
  { id: 'h5', from: 0.72, to: 0.85, xPct: 42, yPct: 82, title: 'ICF foundation', value: 'Insulated concrete forms' },
];

type MenuItem = { id: string; label: string; at: number };
const menuItems: MenuItem[] = [
  { id: 'm1', label: 'Vision', at: 0.02 },
  { id: 'm2', label: 'Site', at: 0.26 },
  { id: 'm3', label: 'Home', at: 0.46 },
  { id: 'm4', label: 'Engineered', at: 0.66 },
  { id: 'm5', label: 'Build', at: 0.86 },
];

/* ════════════════════════════════════════════════════════════════════════
 *  ENGINE  — generally no need to edit below this line
 * ════════════════════════════════════════════════════════════════════════ */

function isSmallDevice(): boolean {
  if (typeof window === 'undefined') return false;
  const narrow = window.matchMedia('(max-width: 768px)').matches;
  const mem = (navigator as unknown as { deviceMemory?: number }).deviceMemory;
  const lowMem = typeof mem === 'number' ? mem <= 4 : false;
  return narrow || lowMem;
}

const rampOpacity = (p: number, from: number, to: number): number => {
  const fade = Math.min((to - from) * 0.35, 0.05) || 0.04;
  if (p < from || p > to) return 0;
  return Math.max(0, Math.min((p - from) / fade, (to - p) / fade));
};

export default function CinematicScene() {
  const outerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const imagesRef = useRef<HTMLImageElement[]>([]);
  const lastGoodRef = useRef<number>(0);
  const currentFloatRef = useRef<number>(-1);
  const lenisRef = useRef<Lenis | null>(null);

  // Overlay element refs (opacity driven imperatively — no per-frame React render)
  const heroRef = useRef<HTMLElement>(null);
  const stageRefs = useRef<(HTMLDivElement | null)[]>([]);
  const reticleRef = useRef<HTMLDivElement>(null);
  const hotspotRefs = useRef<(HTMLDivElement | null)[]>([]);
  const progressRef = useRef<HTMLDivElement>(null);

  const [pct, setPct] = useState(0);
  const [ready, setReady] = useState(false);

  // Smooth scroll to a scroll-progress position (menu nav)
  const jumpTo = (at: number) => {
    const outer = outerRef.current;
    if (!outer) return;
    const target = outer.offsetTop + at * (outer.offsetHeight - window.innerHeight);
    if (lenisRef.current) lenisRef.current.scrollTo(target, { duration: 1.2 });
    else window.scrollTo({ top: target, behavior: 'smooth' });
  };

  useEffect(() => {
    const outer = outerRef.current;
    const canvas = canvasRef.current;
    if (!outer || !canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    gsap.registerPlugin(ScrollTrigger);
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* ── Resolve which sequence to load (desktop vs lighter mobile) ── */
    const useMobile = MOBILE_FRAMES.enabled && isSmallDevice();
    const total = useMobile ? MOBILE_FRAMES.totalFrames : TOTAL_FRAMES;
    const pathFn = useMobile ? MOBILE_FRAMES.framePath : FRAME_PATH;

    const images: HTMLImageElement[] = new Array(total);
    imagesRef.current = images;

    /* ── Preload + DECODE-AHEAD ──
     * decode() forces the browser to decode upfront so drawImage() never
     * blocks mid-scrub. catch() advances the bar even on a 404/decode-fail. */
    let loaded = 0;
    let revealed = false;
    let cancelled = false;

    const markLoaded = () => {
      if (cancelled) return;
      loaded += 1;
      setPct(Math.round((loaded / total) * 100));
      if (!revealed && loaded / total >= REVEAL_AT) {
        revealed = true;
        setReady(true);
      }
    };

    for (let i = 0; i < total; i += 1) {
      const img = new Image();
      img.decoding = 'async';
      img.src = pathFn(i + 1);
      if (typeof img.decode === 'function') {
        img.decode().then(markLoaded).catch(markLoaded);
      } else {
        img.onload = markLoaded;
        img.onerror = markLoaded;
      }
      images[i] = img;
    }

    /* ── Drawing (cover-fit + crossfade) ── */
    const readyImage = (idx: number): HTMLImageElement | null => {
      const im = images[idx];
      return im && im.complete && im.naturalWidth > 0 ? im : null;
    };

    const blit = (img: HTMLImageElement, alpha: number) => {
      const cw = canvas.width;
      const ch = canvas.height;
      const iw = img.naturalWidth;
      const ih = img.naturalHeight;
      const scale = Math.max(cw / iw, ch / ih);
      const dw = iw * scale;
      const dh = ih * scale;
      ctx.globalAlpha = alpha;
      ctx.drawImage(img, (cw - dw) / 2, (ch - dh) / 2, dw, dh);
      ctx.globalAlpha = 1;
    };

    const draw = (f: number) => {
      const i0 = Math.max(0, Math.min(total - 1, Math.floor(f)));
      const i1 = Math.min(total - 1, i0 + 1);
      const frac = f - i0;

      const base = readyImage(i0) ?? readyImage(lastGoodRef.current);
      if (!base) return; // nothing decoded yet → keep last paint (no flash)
      lastGoodRef.current = i0;

      blit(base, 1); // opaque base fully covers canvas — no clearRect needed
      if (frac > 0.001) {
        const next = readyImage(i1);
        if (next) blit(next, frac);
      }
    };

    /* ── Overlay opacity by scroll windows ── */
    const updateOverlays = (p: number) => {
      if (FEATURES.hero && heroRef.current) {
        heroRef.current.style.opacity = String(Math.max(0, 1 - p / 0.1));
      }
      if (FEATURES.stages) {
        for (let s = 0; s < stages.length; s += 1) {
          const el = stageRefs.current[s];
          if (el) el.style.opacity = String(rampOpacity(p, stages[s].from, stages[s].to));
        }
      }
      if (FEATURES.reticle && reticleRef.current) {
        reticleRef.current.style.opacity = String(rampOpacity(p, RETICLE.from, RETICLE.to));
      }
      if (FEATURES.hotspots) {
        for (let h = 0; h < hotspots.length; h += 1) {
          const el = hotspotRefs.current[h];
          if (el) el.style.opacity = String(rampOpacity(p, hotspots[h].from, hotspots[h].to));
        }
      }
      if (FEATURES.progress && progressRef.current) {
        progressRef.current.style.transform = `scaleX(${p})`;
      }
    };

    /* ── Canvas sizing (cover-fit math lives in draw, DPR capped at 2) ── */
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(window.innerWidth * dpr);
      canvas.height = Math.round(window.innerHeight * dpr);
      // canvas resize resets ctx state → re-apply smoothing
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      draw(currentFloatRef.current < 0 ? 0 : currentFloatRef.current);
    };

    /* ── Lenis + ScrollTrigger wiring (copy EXACTLY — desync lives here) ── */
    let tick: ((t: number) => void) | null = null;
    if (!prefersReduced) {
      const lenis = new Lenis({ lerp: LENIS_LERP });
      lenisRef.current = lenis;
      lenis.on('scroll', ScrollTrigger.update);
      tick = (t: number) => lenis.raf(t * 1000);
      gsap.ticker.add(tick);
      gsap.ticker.lagSmoothing(0);
    }

    /* ── The one ScrollTrigger ──
     * IMPORTANT: scrubbing is created ALWAYS. Under reduced-motion we only
     * drop Lenis inertia and use scrub:true (instant) — we do NOT freeze a
     * static frame (that is the classic "page looks broken on Windows" bug). */
    const st = ScrollTrigger.create({
      trigger: outer,
      start: 'top top',
      end: 'bottom bottom',
      scrub: prefersReduced ? true : SCRUB,
      onUpdate: (self) => {
        const f = self.progress * (total - 1);
        if (Math.abs(f - currentFloatRef.current) > 0.02) {
          currentFloatRef.current = f;
          draw(f);
        }
        updateOverlays(self.progress);
      },
    });

    resize();
    updateOverlays(0);
    window.addEventListener('resize', resize);

    return () => {
      cancelled = true;
      window.removeEventListener('resize', resize);
      st.kill();
      ScrollTrigger.getAll().forEach((t) => t.kill());
      if (tick) gsap.ticker.remove(tick);
      if (lenisRef.current) {
        lenisRef.current.destroy();
        lenisRef.current = null;
      }
    };
  }, []);

  return (
    <div ref={outerRef} className="cin-outer" style={{ height: `${SCROLL_VH}vh` }}>
      <div className="cin-sticky">
        <canvas ref={canvasRef} className="cin-canvas" aria-hidden="true" />

        {!ready && (
          <div className="cin-loader" role="status" aria-live="polite">
            <div className="cin-loader__pct">{pct}%</div>
            <div className="cin-loader__bar">
              <span style={{ transform: `scaleX(${pct / 100})` }} />
            </div>
            <div className="cin-loader__label">Loading experience…</div>
          </div>
        )}

        {/* Narrative overlays — real DOM (indexable + accessible) */}
        <div className="cin-overlays" aria-hidden={!ready}>
          {FEATURES.hero && (
            <header ref={heroRef} className={`cin-hero${ready ? ' is-ready' : ''}`}>
              <p className="cin-hero__eyebrow">{HERO.eyebrow}</p>
              <h1 className="cin-hero__title">{HERO.title}</h1>
              <p className="cin-hero__subtitle">{HERO.subtitle}</p>
            </header>
          )}

          {FEATURES.stages &&
            stages.map((s, idx) => (
              <div
                key={s.id}
                ref={(el) => {
                  stageRefs.current[idx] = el;
                }}
                className="cin-stage"
              >
                <span className="cin-stage__num">{s.num}</span>
                <h2 className="cin-stage__title">{s.title}</h2>
                <p className="cin-stage__body">{s.body}</p>
              </div>
            ))}

          {FEATURES.reticle && (
            <div ref={reticleRef} className="cin-reticle">
              <span className="cin-reticle__br cin-reticle__br--tl" />
              <span className="cin-reticle__br cin-reticle__br--tr" />
              <span className="cin-reticle__br cin-reticle__br--bl" />
              <span className="cin-reticle__br cin-reticle__br--br" />
              <span className="cin-reticle__tag">
                {RETICLE.label} · {RETICLE.tag}
              </span>
            </div>
          )}

          {FEATURES.hotspots &&
            hotspots.map((h, idx) => (
              <div
                key={h.id}
                ref={(el) => {
                  hotspotRefs.current[idx] = el;
                }}
                className="cin-hotspot"
                style={{ left: `${h.xPct}%`, top: `${h.yPct}%` }}
              >
                <span className="cin-hotspot__dot" />
                <span className="cin-hotspot__line" />
                <span className="cin-hotspot__label">
                  <strong>{h.title}</strong>
                  {h.value}
                </span>
              </div>
            ))}
        </div>

        {(FEATURES.menu || FEATURES.progress) && (
          <nav className="cin-menu">
            <span className="cin-menu__brand">{BRAND}</span>
            {FEATURES.menu && (
              <ul className="cin-menu__items">
                {menuItems.map((m) => (
                  <li key={m.id}>
                    <button type="button" onClick={() => jumpTo(m.at)}>
                      {m.label}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {FEATURES.progress && (
              <div className="cin-menu__progress">
                <div ref={progressRef} className="cin-menu__progress-fill" />
              </div>
            )}
          </nav>
        )}
      </div>
    </div>
  );
}
