"use client";
import React, { useEffect, useRef } from "react";
import "./endgame.css";

/** Small confirm dialog before using today's one hint. */
export default function HintConfirm(props: { open: boolean; onConfirm: () => void; onCancel: () => void }) {
  const { open } = props;
  const confirmRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const propsRef = useRef(props);
  propsRef.current = props;

  useEffect(() => {
    if (!open) return;
    const prevFocus = document.activeElement as HTMLElement | null;
    confirmRef.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        propsRef.current.onCancel();
        return;
      }
      if (e.key === "Tab") {
        // Two buttons: keep focus inside the dialog
        const els = [cancelRef.current, confirmRef.current].filter(Boolean) as HTMLElement[];
        const i = els.indexOf(document.activeElement as HTMLElement);
        e.preventDefault();
        const next = e.shiftKey ? (i <= 0 ? els.length - 1 : i - 1) : (i + 1) % els.length;
        els[next]?.focus();
        return;
      }
      // Keep letters / Enter from reaching the game behind the dialog
      if (e.key !== "Enter" && e.key !== " ") e.stopPropagation();
    };
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      if (prevFocus && prevFocus !== document.body && document.contains(prevFocus)) {
        try {
          prevFocus.focus({ preventScroll: true });
        } catch {
          // ignore
        }
      }
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="eg-confirm-overlay" onMouseDown={(e) => e.target === e.currentTarget && props.onCancel()}>
      <div className="eg-confirm" role="alertdialog" aria-modal="true" aria-labelledby="eg-confirm-title" aria-describedby="eg-confirm-desc">
        <h2 id="eg-confirm-title" className="eg-confirm-title">
          <span aria-hidden="true">💡</span> Use your hint?
        </h2>
        <p id="eg-confirm-desc" className="eg-confirm-desc">
          Reveals one letter. Costs 1 leaderboard point.
          <br />
          <span className="eg-confirm-sub">You get one hint per day.</span>
        </p>
        <div className="eg-confirm-actions">
          <button ref={cancelRef} type="button" className="eg-btn eg-btn-secondary" onClick={props.onCancel}>
            Cancel
          </button>
          <button ref={confirmRef} type="button" className="eg-btn eg-btn-primary" onClick={props.onConfirm}>
            Reveal a letter
          </button>
        </div>
      </div>
    </div>
  );
}
