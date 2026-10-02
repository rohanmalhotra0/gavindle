"use client";
import React, { useEffect, useRef } from "react";

/**
 * Canvas confetti, no library. Each time `shot` changes (to a number > 0) a
 * sequence of bursts fires; how many and how big depends on `guesses`
 * (1-2 huge, 3 big, 4 medium, 5-6 small). Does nothing under
 * prefers-reduced-motion. The canvas never takes pointer events.
 */

type Burst = { at: number; kind: "cannons" | "center" | "rain"; count: number };

function plan(guesses: number): Burst[] {
  if (guesses <= 2) {
    return [
      { at: 0, kind: "cannons", count: 130 },
      { at: 350, kind: "center", count: 110 },
      { at: 800, kind: "cannons", count: 110 },
      { at: 1300, kind: "rain", count: 140 },
      { at: 1900, kind: "center", count: 100 },
      { at: 2500, kind: "cannons", count: 90 }
    ];
  }
  if (guesses === 3) {
    return [
      { at: 0, kind: "cannons", count: 110 },
      { at: 450, kind: "center", count: 90 },
      { at: 1000, kind: "rain", count: 80 }
    ];
  }
  if (guesses === 4) {
    return [
      { at: 0, kind: "cannons", count: 80 },
      { at: 500, kind: "center", count: 50 }
    ];
  }
  return [{ at: 0, kind: "center", count: 55 }];
}

const COLORS = ["#6aaa64", "#c9b458", "#4f8ef7", "#ff5d8f", "#ffb020", "#9b5de5", "#00c2a8", "#ff6b3d"];

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  w: number;
  h: number;
  color: string;
  wobble: number;
  vw: number;
  life: number; // seconds remaining
  round: boolean;
};

export default function Confetti(props: { shot: number; guesses: number }) {
  const { shot, guesses } = props;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const guessesRef = useRef(guesses);
  guessesRef.current = guesses;

  useEffect(() => {
    if (!shot) return;
    if (typeof window === "undefined") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    let width = 0;
    let height = 0;
    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const particles: Particle[] = [];
    const scale = Math.max(0.7, Math.min(1.3, width / 800));
    const make = (x: number, y: number, angle: number, spread: number, speed: number): Particle => {
      const a = angle + (Math.random() - 0.5) * spread;
      const v = speed * (0.55 + Math.random() * 0.6) * scale;
      const size = 6 + Math.random() * 7;
      return {
        x,
        y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        rot: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * 12,
        w: size,
        h: size * (0.45 + Math.random() * 0.35),
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        wobble: Math.random() * Math.PI * 2,
        vw: 4 + Math.random() * 6,
        life: 3.2 + Math.random() * 1.6,
        round: Math.random() < 0.2
      };
    };

    const fire = (b: Burst) => {
      // Fewer particles on small screens
      const count = Math.round(b.count * Math.max(0.55, Math.min(1, width / 900)));
      if (b.kind === "cannons") {
        const half = Math.round(count / 2);
        for (let i = 0; i < half; i++) particles.push(make(0, height * 0.85, -Math.PI / 3.2, 0.7, 1150));
        for (let i = 0; i < count - half; i++) particles.push(make(width, height * 0.85, -Math.PI + Math.PI / 3.2, 0.7, 1150));
      } else if (b.kind === "center") {
        for (let i = 0; i < count; i++) particles.push(make(width / 2, height * 0.38, -Math.PI / 2, Math.PI * 1.6, 760));
      } else {
        for (let i = 0; i < count; i++) {
          const p = make(Math.random() * width, -20 - Math.random() * height * 0.3, Math.PI / 2, 0.6, 140);
          particles.push(p);
        }
      }
    };

    const timers = plan(guessesRef.current).map((b) => window.setTimeout(() => fire(b), b.at));
    const lastBurstAt = Math.max(...plan(guessesRef.current).map((b) => b.at));
    const startedAt = performance.now();

    let raf = 0;
    let last = performance.now();
    const GRAVITY = 900;
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      ctx.clearRect(0, 0, width, height);
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life -= dt;
        // air drag, then gravity with a terminal velocity so pieces flutter
        const drag = Math.pow(0.18, dt);
        p.vx *= drag;
        p.vy = p.vy * drag + GRAVITY * dt;
        if (p.vy > 260) p.vy = 260;
        p.wobble += p.vw * dt;
        p.x += (p.vx + Math.sin(p.wobble) * 30) * dt;
        p.y += p.vy * dt;
        p.rot += p.vr * dt;
        if (p.life <= 0 || p.y > height + 40) {
          particles.splice(i, 1);
          continue;
        }
        const alpha = Math.min(1, p.life / 0.6);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        // fake 3D flip by squashing on one axis
        ctx.scale(1, Math.cos(p.wobble));
        if (p.round) {
          ctx.beginPath();
          ctx.arc(0, 0, p.w / 2.4, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        }
        ctx.restore();
      }
      ctx.globalAlpha = 1;
      if (particles.length > 0 || now - startedAt < lastBurstAt + 100) {
        raf = window.requestAnimationFrame(tick);
      } else {
        ctx.clearRect(0, 0, width, height);
        raf = 0;
      }
    };
    raf = window.requestAnimationFrame(tick);

    return () => {
      timers.forEach((t) => window.clearTimeout(t));
      if (raf) window.cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      ctx.clearRect(0, 0, width, height);
    };
  }, [shot]);

  return <canvas ref={canvasRef} className="eg-confetti" aria-hidden="true" />;
}
