"use client";

import { useEffect, useRef } from "react";

type Star = {
  x: number; // 0..1 normalized
  y: number;
  r: number;
  baseAlpha: number;
  twinkleAmp: number;
  twinkleFreq: number;
  phase: number;
  tinted: boolean;
  tintAlt: boolean; // fixed at creation so the tint doesn't flicker per frame
  layer: 0 | 1; // 0 = far/slow, 1 = near/faster
};

type ShootingStar = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number; // 0..1
};

const LAYERS = [
  { count: 110, drift: 1.6, parallax: 8, rMin: 0.4, rMax: 1.1 },
  { count: 55, drift: 3.4, parallax: 18, rMin: 0.8, rMax: 1.9 },
];

function readThemeColors() {
  const s = getComputedStyle(document.documentElement);
  return {
    core: s.getPropertyValue("--star-core").trim() || "#ffffff",
    glow: s.getPropertyValue("--star-glow").trim() || "#a78bfa",
    glowAlt: s.getPropertyValue("--star-glow-alt").trim() || "#67e8f9",
    intensity: parseFloat(s.getPropertyValue("--glow-intensity")) || 1,
  };
}

export default function Starfield({
  shootingStars = true,
  className = "",
}: {
  shootingStars?: boolean;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let colors = readThemeColors();
    let w = 0;
    let h = 0;
    let raf = 0;
    let running = true;

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    // --- stars ---
    const stars: Star[] = [];
    LAYERS.forEach((layer, li) => {
      for (let i = 0; i < layer.count; i++) {
        stars.push({
          x: Math.random(),
          y: Math.random(),
          r: layer.rMin + Math.random() * (layer.rMax - layer.rMin),
          baseAlpha: 0.25 + Math.random() * 0.5,
          twinkleAmp: 0.1 + Math.random() * 0.35,
          twinkleFreq: 0.4 + Math.random() * 1.4,
          phase: Math.random() * Math.PI * 2,
          tinted: Math.random() < 0.28,
          tintAlt: Math.random() < 0.5,
          layer: li as 0 | 1,
        });
      }
    });

    let shooters: ShootingStar[] = [];
    let nextShooterAt = performance.now() + 4000 + Math.random() * 6000;

    // --- mouse parallax (eased) ---
    const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
    const onPointerMove = (e: PointerEvent) => {
      mouse.tx = (e.clientX / w - 0.5) * 2;
      mouse.ty = (e.clientY / h - 0.5) * 2;
    };
    window.addEventListener("pointermove", onPointerMove, { passive: true });

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    // Re-read colors when the theme attribute changes.
    const observer = new MutationObserver(() => {
      colors = readThemeColors();
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });

    const start = performance.now();
    let last = start;

    const frame = (now: number) => {
      if (!running) return;
      const t = (now - start) / 1000;
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;

      mouse.x += (mouse.tx - mouse.x) * 0.03;
      mouse.y += (mouse.ty - mouse.y) * 0.03;

      ctx.clearRect(0, 0, w, h);

      for (const s of stars) {
        const layer = LAYERS[s.layer];
        if (!reduceMotion) {
          s.x += (layer.drift * dt) / w; // slow horizontal drift
          if (s.x > 1.02) s.x -= 1.04;
        }
        const px = s.x * w - mouse.x * layer.parallax;
        const py = s.y * h - mouse.y * layer.parallax;

        const twinkle = reduceMotion
          ? 0
          : Math.sin(t * s.twinkleFreq + s.phase) * s.twinkleAmp;
        const alpha = Math.max(0.05, Math.min(1, s.baseAlpha + twinkle));
        const color = s.tinted
          ? s.tintAlt
            ? colors.glowAlt
            : colors.glow
          : colors.core;

        ctx.globalAlpha = alpha;
        ctx.shadowBlur = s.r * 6 * colors.intensity;
        ctx.shadowColor = s.tinted ? colors.glow : colors.core;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(px, py, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;

      // --- shooting stars ---
      if (shootingStars && !reduceMotion) {
        if (now > nextShooterAt) {
          const fromLeft = Math.random() < 0.5;
          shooters.push({
            x: fromLeft ? -40 : Math.random() * w * 0.7,
            y: Math.random() * h * 0.35,
            vx: (fromLeft ? 1 : 0.8) * (600 + Math.random() * 400),
            vy: 180 + Math.random() * 160,
            life: 1,
          });
          nextShooterAt = now + 7000 + Math.random() * 9000;
        }
        shooters = shooters.filter((sh) => sh.life > 0);
        for (const sh of shooters) {
          sh.x += sh.vx * dt;
          sh.y += sh.vy * dt;
          sh.life -= dt * 0.9;
          const tail = 90;
          const nx = sh.vx / Math.hypot(sh.vx, sh.vy);
          const ny = sh.vy / Math.hypot(sh.vx, sh.vy);
          const grad = ctx.createLinearGradient(
            sh.x,
            sh.y,
            sh.x - nx * tail,
            sh.y - ny * tail
          );
          grad.addColorStop(0, colors.core);
          grad.addColorStop(0.3, colors.glow);
          grad.addColorStop(1, "transparent");
          ctx.globalAlpha = Math.max(0, Math.min(1, sh.life)) * 0.9;
          ctx.strokeStyle = grad;
          ctx.lineWidth = 1.6;
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.moveTo(sh.x, sh.y);
          ctx.lineTo(sh.x - nx * tail, sh.y - ny * tail);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }

      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onPointerMove);
      observer.disconnect();
    };
  }, [shootingStars]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={`pointer-events-none fixed inset-0 z-0 ${className}`}
    />
  );
}
