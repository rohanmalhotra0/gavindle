"use client";
import React, { useEffect, useRef, useState } from "react";
import { lossLine, winReaction } from "@/lib/gavinLines";
import "./endgame.css";

type Props = {
  show: boolean;
  mode: "win" | "loss";
  /** Number of guesses used (win). */
  guesses: number;
  /** Current day streak after this game (win); the flames show when >= 2. */
  streak: number;
  /** Today's answer (revealed letter by letter on a loss). */
  solution: string;
  dayIndex: number;
  /** Called when the moment is over (auto or skipped). */
  onDone: () => void;
};

const LOSS_TILE_START_MS = 450;
const LOSS_TILE_STEP_MS = 300;
const LOSS_LINE_DELAY_MS = LOSS_TILE_START_MS + 5 * LOSS_TILE_STEP_MS + 250;

function reducedMotion(): boolean {
  return typeof window !== "undefined" && (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false);
}

/** How long the moment stays before moving on to the results card. */
function durationFor(mode: "win" | "loss", guesses: number, streak: number): number {
  if (mode === "loss") return LOSS_LINE_DELAY_MS + 1900;
  const base = guesses <= 2 ? 3200 : 2600;
  return base + (streak >= 2 ? 500 : 0);
}

/** Counts up from 1 to `to` with an ease-out, starting after `delayMs`. */
function useCountUp(to: number, delayMs: number, active: boolean): number {
  const [value, setValue] = useState<number>(() => (reducedMotion() ? to : 0));
  useEffect(() => {
    if (!active) return;
    if (reducedMotion()) {
      setValue(to);
      return;
    }
    setValue(0);
    let raf = 0;
    const duration = Math.min(1100, 350 + to * 60);
    const timer = window.setTimeout(() => {
      const start = performance.now();
      const step = (now: number) => {
        const t = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - t, 3);
        setValue(Math.max(1, Math.round(eased * to)));
        if (t < 1) raf = window.requestAnimationFrame(step);
      };
      raf = window.requestAnimationFrame(step);
    }, delayMs);
    return () => {
      window.clearTimeout(timer);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, [to, delayMs, active]);
  return value;
}

/**
 * The moment right after the last tile flips.
 * - win: Gavin pops in with a line for the guess count, plus streak flames.
 * - loss: the screen dims, the answer flips in letter by letter, then a sad Gavin line.
 * Tap / Enter / Space / Escape skips it; otherwise it moves on by itself.
 */
export default function Celebration(props: Props) {
  const { show, mode, guesses, streak, solution, dayIndex, onDone } = props;
  const [leaving, setLeaving] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  const doneRef = useRef(false);

  const finish = useRef(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    if (reducedMotion()) {
      onDoneRef.current();
      return;
    }
    setLeaving(true);
    window.setTimeout(() => onDoneRef.current(), 220);
  }).current;

  useEffect(() => {
    if (!show) return;
    doneRef.current = false;
    setLeaving(false);
    const prevFocus = document.activeElement as HTMLElement | null;
    panelRef.current?.focus({ preventScroll: true });
    const timer = window.setTimeout(finish, durationFor(mode, guesses, streak));
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        e.stopPropagation();
        finish();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("keydown", onKey, true);
      if (prevFocus && prevFocus !== document.body && document.contains(prevFocus)) {
        try {
          prevFocus.focus({ preventScroll: true });
        } catch {
          // ignore
        }
      }
    };
  }, [show, mode, guesses, streak, finish]);

  const showStreak = mode === "win" && streak >= 2;
  const count = useCountUp(streak, 650, show && showStreak);

  if (!show) return null;

  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  const photoSrc = `${basePath}/GavinPhoto.PNG`;
  const isWin = mode === "win";
  const line = isWin ? winReaction(guesses) : lossLine(dayIndex);
  const letters = solution.toUpperCase().split("");

  return (
    <div
      className={`eg-overlay ${isWin ? "eg-overlay-win" : "eg-overlay-loss"}${leaving ? " eg-leaving" : ""}`}
      onClick={finish}
    >
      <div
        ref={panelRef}
        className="eg-moment"
        role="dialog"
        aria-modal="true"
        aria-label={isWin ? "You win" : "Out of guesses"}
        tabIndex={-1}
      >
        {isWin ? (
          <>
            <div className="eg-photo-wrap eg-pop-in">
              <img className="eg-photo" src={photoSrc} alt="Gavin celebrating" width={180} height={180} />
            </div>
            <p className="eg-reaction eg-rise" style={{ animationDelay: "180ms" }} aria-live="polite">
              {line}
            </p>
            {showStreak && (
              <div className="eg-streak eg-rise" style={{ animationDelay: "500ms" }} aria-label={`${streak} day streak`}>
                <span className="eg-flame" aria-hidden="true">🔥</span>
                <span className="eg-streak-num" aria-hidden="true">{count}</span>
                <span className="eg-streak-label" aria-hidden="true">day streak</span>
              </div>
            )}
          </>
        ) : (
          <>
            <p className="eg-answer-label eg-rise" style={{ animationDelay: "150ms" }}>The word was</p>
            <div className="eg-answer" role="img" aria-label={`The word was ${letters.join("")}`}>
              {letters.map((ch, i) => (
                <div
                  key={i}
                  className="eg-answer-tile"
                  style={{ animationDelay: `${LOSS_TILE_START_MS + i * LOSS_TILE_STEP_MS}ms` }}
                  aria-hidden="true"
                >
                  {ch}
                </div>
              ))}
            </div>
            <div className="eg-loss-row eg-rise" style={{ animationDelay: `${LOSS_LINE_DELAY_MS}ms` }}>
              <img className="eg-photo eg-photo-sad" src={photoSrc} alt="" width={64} height={64} />
              <p className="eg-reaction eg-reaction-sad" aria-live="polite">{line}</p>
            </div>
          </>
        )}
        <p className="eg-skip" aria-hidden="true">Tap to continue</p>
      </div>
    </div>
  );
}
