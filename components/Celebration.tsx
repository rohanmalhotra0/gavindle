"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";

type Props = {
  show: boolean;
  onHide?: () => void;
  durationMs?: number;
};

export default function Celebration(props: Props) {
  const { show, onHide, durationMs = 3000 } = props;
  const [visible, setVisible] = useState<boolean>(false);
  const [renderConfetti, setRenderConfetti] = useState<boolean>(false);

  // Keep the latest onHide in a ref so a new callback identity on every parent
  // render doesn't restart the hide timer (which used to extend the overlay).
  const onHideRef = useRef(onHide);
  useEffect(() => {
    onHideRef.current = onHide;
  }, [onHide]);

  const hide = useRef(() => {
    setVisible(false);
    setRenderConfetti(false);
    onHideRef.current?.();
  }).current;

  // Only render confetti on client after becoming visible to avoid SSR mismatch
  useEffect(() => {
    if (show) {
      setVisible(true);
      const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
      const t1 = window.setTimeout(() => setRenderConfetti(!reduced), 0);
      const t2 = window.setTimeout(hide, durationMs);
      const onKey = (e: KeyboardEvent) => {
        if (e.key === "Escape") hide();
      };
      window.addEventListener("keydown", onKey);
      return () => {
        window.clearTimeout(t1);
        window.clearTimeout(t2);
        window.removeEventListener("keydown", onKey);
      };
    } else {
      setVisible(false);
      setRenderConfetti(false);
    }
  }, [show, durationMs, hide]);

  const pieces = useMemo(() => {
    return Array.from({ length: 120 }).map((_, i) => {
      const left = Math.random() * 100;
      const size = 6 + Math.random() * 8;
      const delay = Math.random() * 0.6;
      const duration = 2.4 + Math.random() * 1.6;
      const rotation = Math.random() * 360;
      const hue = Math.floor(Math.random() * 360);
      return { id: i, left, size, delay, duration, rotation, hue };
    });
  }, [renderConfetti]); // recompute when we re-trigger

  if (!visible) return null;

  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  const photoSrc = `${basePath}/GavinPhoto.PNG`;

  return (
    <div className="celebration-overlay" role="dialog" aria-label="Celebration" onClick={hide}>
      <div className="celebration-inner">
        <div className="celebration-photo">
          <img
            src={photoSrc}
            alt="Gavin celebrates"
            width={220}
            height={220}
            style={{ borderRadius: 12, objectFit: "cover" }}
          />
        </div>
        <div className="celebration-text">Gavin is so proud!</div>
      </div>
      {renderConfetti && (
        <div className="confetti" aria-hidden="true">
          {pieces.map((p) => (
            <span
              key={p.id}
              className="confetti-piece"
              style={{
                left: `${p.left}%`,
                width: p.size,
                height: p.size * 0.6,
                animationDelay: `${p.delay}s`,
                animationDuration: `${p.duration}s`,
                transform: `rotate(${p.rotation}deg)`,
                backgroundColor: `hsl(${p.hue}deg 90% 55%)`
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
