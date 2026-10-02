"use client";
import React, { useEffect, useId, useRef } from "react";
import type { PlayerRecord } from "@/lib/leaderboardClient";
import { getRohanQuote } from "@/lib/rohanQuotes";
import LeaderboardTable from "@/components/LeaderboardTable";
import "./leaderboard.css";

// Shared between every open overlay so nested/overlapping modals behave.
const overlayStack: number[] = [];
let overlaySeq = 0;
let lockedBodyOverflow: string | null = null;

function isTypingTarget(t: EventTarget | null) {
  const el = t as HTMLElement | null;
  if (!el) return false;
  return el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable;
}

/**
 * Modal shell used by every leaderboard dialog: fits the viewport, closes on Escape
 * and overlay click, locks page scroll while open, and keeps game keys from
 * reaching the board behind it.
 */
export function LeaderboardOverlay(props: { title: string; onClose: () => void; children: React.ReactNode; narrow?: boolean }) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(props.onClose);
  onCloseRef.current = props.onClose;

  useEffect(() => {
    const id = ++overlaySeq;
    overlayStack.push(id);
    if (overlayStack.length === 1) {
      lockedBodyOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (overlayStack[overlayStack.length - 1] !== id) return;
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      // Don't let letters / Enter / Backspace type into the game behind the modal.
      if (!isTypingTarget(e.target)) e.stopPropagation();
    };
    window.addEventListener("keydown", onKeyDown, true);

    const prevFocus = document.activeElement as HTMLElement | null;
    panelRef.current?.focus({ preventScroll: true });

    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      const idx = overlayStack.indexOf(id);
      if (idx >= 0) overlayStack.splice(idx, 1);
      if (overlayStack.length === 0) {
        document.body.style.overflow = lockedBodyOverflow ?? "";
        lockedBodyOverflow = null;
      }
      try {
        prevFocus?.focus({ preventScroll: true });
      } catch {
        // ignore
      }
    };
  }, []);

  return (
    <div
      className="lbv-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) props.onClose();
      }}
    >
      <div
        ref={panelRef}
        className={`lbv-panel${props.narrow ? " lbv-panel-narrow" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <div className="lbv-header">
          <h2 id={titleId} className="lbv-title">{props.title}</h2>
          <button type="button" className="lbv-close" onClick={props.onClose} aria-label="Close">
            {"×"}
          </button>
        </div>
        {props.children}
      </div>
    </div>
  );
}

/** Leaderboard contents: points explainer, GOAT, your rank, scrollable table, quote. */
export function LeaderboardBody(props: {
  players: PlayerRecord[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  highlightKey?: string | null;
  notice?: string | null;
  onChangeName?: () => void;
}) {
  const { players, loading, error, highlightKey } = props;
  const goat = players.length > 0 ? players[0].displayName : null;
  const myIndex = highlightKey ? players.findIndex((p) => p.key === highlightKey) : -1;
  const me = myIndex >= 0 ? players[myIndex] : null;
  const quote = getRohanQuote();
  const showTable = players.length > 0 && !error;

  let status: React.ReactNode = null;
  if (error) {
    status = (
      <div className="lbv-status lbv-error" role="alert">
        <div>{error}</div>
        <button type="button" className="lbv-btn" onClick={props.onRetry} disabled={loading}>
          {loading ? "Trying..." : "Try again"}
        </button>
      </div>
    );
  } else if (loading && players.length === 0) {
    status = (
      <div className="lbv-status" role="status">
        <span className="lbv-spinner" aria-hidden="true" />
        <span>Loading leaderboard...</span>
      </div>
    );
  } else if (!loading && players.length === 0) {
    status = <div className="lbv-status">No entries yet. Finish a game to get on the board!</div>;
  }

  return (
    <>
      <div className="lbv-intro">
        <p className="lbv-explain">
          Win in fewer guesses = more points. 1 guess = 6 pts {"…"} 6 guesses = 1 pt.
        </p>
        {goat && showTable && <div className="lbv-goat">Gavindler #1 GOAT: {goat}</div>}
        {me && showTable && (
          <div className="lbv-me">
            You{"’"}re <strong>#{myIndex + 1}</strong> of {players.length} with <strong>{me.points} pts</strong>
            {me.currentStreak > 0 ? ` · ${me.currentStreak}-day streak` : ""}
            {me.bestStreak > 0 ? ` (best ${me.bestStreak})` : ""}
          </div>
        )}
        {props.notice && <div className="lbv-notice">{props.notice}</div>}
        {loading && players.length > 0 && !error && (
          <div className="lbv-refreshing" role="status">
            <span className="lbv-spinner lbv-spinner-sm" aria-hidden="true" /> Updating...
          </div>
        )}
      </div>

      {status ?? <LeaderboardTable players={players} highlightKey={highlightKey} />}

      <div className="lbv-footer">
        {props.onChangeName && (
          <button type="button" className="lbv-link" onClick={props.onChangeName}>
            Not you? Change name
          </button>
        )}
        <div className="lbv-quote">Rohan Quote of the day: {quote}</div>
      </div>
    </>
  );
}

/** The full leaderboard dialog (shell + contents), used by the header button and after a game. */
export default function LeaderboardView(
  props: React.ComponentProps<typeof LeaderboardBody> & { onClose: () => void }
) {
  const { onClose, ...body } = props;
  return (
    <LeaderboardOverlay title="LEADERBOARD" onClose={onClose}>
      <LeaderboardBody {...body} />
    </LeaderboardOverlay>
  );
}
