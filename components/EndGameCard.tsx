"use client";
import React, { useEffect, useRef, useState } from "react";
import type { LetterState } from "@/lib/evaluateGuess";
import { msUntilNextPuzzle } from "@/lib/storage";
import "./endgame.css";

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function formatHMS(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

/** Live HH:MM:SS until midnight America/New_York; calls onExpire (every second) once it hits zero. */
export function NextWordCountdown(props: { onExpire: () => void }) {
  const onExpireRef = useRef(props.onExpire);
  onExpireRef.current = props.onExpire;
  const [target] = useState<number>(() => Date.now() + msUntilNextPuzzle());
  const [left, setLeft] = useState<number>(() => target - Date.now());

  useEffect(() => {
    let timer = 0;
    const tick = () => {
      const remaining = target - Date.now();
      setLeft(remaining);
      if (remaining <= 0) onExpireRef.current();
      // Re-align to the next whole second so the display never skips
      timer = window.setTimeout(tick, ((remaining % 1000) + 1000) % 1000 + 5);
    };
    timer = window.setTimeout(tick, (((target - Date.now()) % 1000) + 1000) % 1000 + 5);
    return () => window.clearTimeout(timer);
  }, [target]);

  const text = formatHMS(left);
  return (
    <span className="eg-countdown">
      <span className="eg-countdown-label">Next word in</span>{" "}
      <time className="eg-countdown-time" aria-live="off">{text}</time>
    </span>
  );
}

type Props = {
  won: boolean;
  guessCount: number;
  solution: string;
  /** Tile colors for each guess row, used for the mini grid. */
  rowStates: LetterState[][];
  hintUsed: boolean;
  points: number;
  leaderboardLabel: string;
  onShare: () => void;
  onLeaderboard: () => void;
  onNextWord: () => void;
  /** Move focus to Share when the card appears (after the celebration). */
  autoFocus?: boolean;
};

/** The single results card shown in place of the keyboard once the game is over. */
export default function EndGameCard(props: Props) {
  const { won, guessCount, solution, rowStates, hintUsed, points, leaderboardLabel, onShare, onLeaderboard, onNextWord, autoFocus } = props;
  const shareRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (autoFocus) shareRef.current?.focus({ preventScroll: true });
  }, [autoFocus]);

  const summary = won ? `Solved in ${guessCount} of 6` : `Not solved. The word was ${solution.toUpperCase()}`;

  return (
    <section className="eg-card" aria-label="Today's result">
      <div className="eg-mini" role="img" aria-label={`${summary}${hintUsed ? ", hint used" : ""}`}>
        {Array.from({ length: 6 }, (_, r) => (
          <div className="eg-mini-row" key={r}>
            {Array.from({ length: 5 }, (_, c) => {
              const s = rowStates[r]?.[c];
              return <span key={c} className={`eg-mini-cell${s ? ` ${s}` : ""}`} />;
            })}
          </div>
        ))}
      </div>

      <div className="eg-info">
        <p className="eg-result">
          {won ? (
            <>Solved in <strong>{guessCount}/6</strong></>
          ) : (
            <><strong>X/6</strong> <span className="eg-result-word">· {solution.toUpperCase()}</span></>
          )}
          {hintUsed && <span className="eg-hint-mark" title="Hint used" aria-label="hint used"> 💡</span>}
        </p>
        <p className="eg-points">
          <strong>+{points}</strong> {points === 1 ? "point" : "points"} today
          {won && hintUsed && <span className="eg-points-note"> (−1 hint)</span>}
        </p>
        <p className="eg-next">
          <NextWordCountdown onExpire={onNextWord} />
        </p>
      </div>

      <div className="eg-actions">
        <button ref={shareRef} type="button" className="eg-btn eg-btn-primary" onClick={onShare}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7" />
            <polyline points="16 6 12 2 8 6" />
            <line x1="12" y1="2" x2="12" y2="15" />
          </svg>
          Share
        </button>
        <button type="button" className="eg-btn eg-btn-secondary" onClick={onLeaderboard} aria-haspopup="dialog">
          <span aria-hidden="true">🏆</span> {leaderboardLabel}
        </button>
      </div>
    </section>
  );
}
