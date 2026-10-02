"use client";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Grid, { type RowData } from "@/components/Grid";
import Keyboard from "@/components/Keyboard";
import Celebration from "@/components/Celebration";
import Confetti from "@/components/Confetti";
import EndGameCard from "@/components/EndGameCard";
import HintConfirm from "@/components/HintConfirm";
import HelpModal from "@/components/HelpModal";
import LeaderboardModal from "@/components/LeaderboardModal";
import { getDailyIndex, getDailySolution, isFiveLetters, normalizeGuess, pickHint } from "@/lib/words";
import { WIN_TEXT, lossLine, pointsToday } from "@/lib/gavinLines";
import { evaluateGuess, mergeKeyStates, type LetterState } from "@/lib/evaluateGuess";
import {
  getDateKey,
  hasSeenHelp,
  loadGame,
  loadStats,
  markHelpSeen,
  normalizeStreak,
  recordResult,
  saveGame,
  saveStats,
  type GameHint,
  type Stats
} from "@/lib/storage";
import { nativeShare, resultHaptic } from "@/lib/native";
import { getSavedGroup, getSavedName, getSubmittedDateKey, markSubmitted } from "@/lib/leaderboardClient";
import { submitResultOnce } from "@/lib/leaderboardService";

const MAX_GUESSES = 6;
const WORD_LENGTH = 5;

// Animation timings (keep in sync with globals.css)
const REVEAL_STEP_MS = 250; // delay between each tile flip
const REVEAL_FLIP_MS = 500; // duration of one tile flip
const BOUNCE_MS = 1000; // win row bounce before the celebration

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to legacy copy
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

type GameStatus = "ongoing" | "won" | "lost";
// After the game: "celebrate" = win/loss moment overlay, "card" = results card
type EndPhase = "none" | "celebrate" | "card";

export default function Page() {
  // `today` is state (not memoized once) so a tab left open past midnight
  // (America/New_York) rolls over to the new puzzle.
  const [today, setToday] = useState<Date>(() => new Date());
  const solution = useMemo(() => getDailySolution(today), [today]);
  const dayIndex = useMemo(() => getDailyIndex(today), [today]);
  const dateKey = useMemo(() => getDateKey(today), [today]);

  const [guesses, setGuesses] = useState<string[]>([]);
  const [current, setCurrent] = useState<string>("");
  const [message, setMessage] = useState<string>("");
  const [status, setStatus] = useState<GameStatus>("ongoing");
  const [endPhase, setEndPhase] = useState<EndPhase>("none");
  // True when the card appears right after a live celebration (moves focus to Share)
  const [cardAfterCelebration, setCardAfterCelebration] = useState<boolean>(false);
  const [confettiShot, setConfettiShot] = useState<number>(0);
  const [hint, setHint] = useState<GameHint | null>(null);
  const [hintConfirmOpen, setHintConfirmOpen] = useState<boolean>(false);
  const [leaderboardOpen, setLeaderboardOpen] = useState<boolean>(false);
  const [submittedToday, setSubmittedToday] = useState<boolean>(false);
  const [helpOpen, setHelpOpen] = useState<boolean>(false);
  const [stats, setStats] = useState<Stats>({
    gamesPlayed: 0,
    wins: 0,
    currentStreak: 0,
    maxStreak: 0,
    guessDistribution: [0, 0, 0, 0, 0, 0]
  });
  const [mounted, setMounted] = useState<boolean>(false);
  // dateKey whose saved game has been loaded into state; nothing is persisted until then
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  // Animation state
  const [revealRow, setRevealRow] = useState<number | null>(null);
  const [winRow, setWinRow] = useState<number | null>(null);
  const [shake, setShake] = useState<{ row: number | null; nonce: number }>({ row: null, nonce: 0 });

  // True while a submitted row is being revealed; blocks input synchronously
  const busyRef = useRef<boolean>(false);
  const messageTimerRef = useRef<number | null>(null);
  const timersRef = useRef<number[]>([]);
  const shakeNonceRef = useRef<number>(0);

  const later = useCallback((fn: () => void, ms: number) => {
    const id = window.setTimeout(() => {
      timersRef.current = timersRef.current.filter((t) => t !== id);
      fn();
    }, ms);
    timersRef.current.push(id);
  }, []);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((t) => window.clearTimeout(t));
    timersRef.current = [];
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  // Load stats after mount to avoid SSR/client mismatch from localStorage
  useEffect(() => {
    const loaded = loadStats();
    const normalized = normalizeStreak(loaded, getDateKey());
    if (normalized.currentStreak !== loaded.currentStreak) saveStats(normalized);
    setStats(normalized);
    setMounted(true);

    // Show "How to play" the first time someone ever visits
    if (!hasSeenHelp()) {
      if (!loadGame() && loaded.gamesPlayed === 0) setHelpOpen(true);
      markHelpSeen();
    }
  }, []);

  // Initialize from storage or fresh (re-runs when the day rolls over)
  useEffect(() => {
    const persisted = loadGame();
    if (persisted && persisted.dateKey === dateKey && persisted.solution === solution) {
      setGuesses(persisted.guesses.slice(0, MAX_GUESSES));
      setStatus(persisted.status);
      // A save with hintUsed but no letter (shouldn't happen) still counts the hint
      setHint(persisted.hint ?? (persisted.hintUsed ? { index: -1, letter: "" } : null));
      setEndPhase(persisted.status === "ongoing" ? "none" : "card");
    } else {
      setGuesses([]);
      setStatus("ongoing");
      setHint(null);
      setEndPhase("none");
    }
    setCardAfterCelebration(false);
    setHintConfirmOpen(false);
    setCurrent("");
    setRevealRow(null);
    setWinRow(null);
    setShake((s) => ({ row: null, nonce: s.nonce }));
    busyRef.current = false;
    setLoadedKey(dateKey);
  }, [dateKey, solution]);

  // Roll over to the new puzzle once the date (America/New_York) changes
  const checkRollover = useCallback(() => {
    if (document.visibilityState === "hidden") return;
    const now = new Date();
    if (getDateKey(now) !== dateKey) {
      clearTimers();
      if (messageTimerRef.current) window.clearTimeout(messageTimerRef.current);
      setMessage("");
      setEndPhase("none");
      setToday(now);
    }
  }, [dateKey, clearTimers]);

  // Detect a new day when the tab regains focus / becomes visible (and periodically)
  useEffect(() => {
    const check = checkRollover;
    check();
    document.addEventListener("visibilitychange", check);
    window.addEventListener("focus", check);
    const interval = window.setInterval(check, 30_000);
    return () => {
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("focus", check);
      window.clearInterval(interval);
    };
  }, [checkRollover]);

  // Build rows whenever state changes
  const rows = useMemo<RowData[]>(() => {
    const built: RowData[] = [];
    for (let r = 0; r < MAX_GUESSES; r++) {
      const g = guesses[r] ?? (r === guesses.length ? current : "");
      const letters = Array.from({ length: WORD_LENGTH }, (_, i) => g[i]?.toUpperCase() ?? "");
      const submitted = r < guesses.length;
      const states: LetterState[] = submitted ? evaluateGuess((guesses[r] ?? ""), solution) : Array.from<LetterState>({ length: WORD_LENGTH }).fill("empty");
      built.push({ letters, states, submitted });
    }
    return built;
  }, [guesses, current, solution]);

  // Key colors; the row being revealed only colors the keyboard once its flip finishes
  const keyStates = useMemo(() => {
    const shown = revealRow !== null ? guesses.slice(0, revealRow) : guesses;
    let ks: Record<string, LetterState> = {};
    for (const g of shown) {
      ks = mergeKeyStates(ks, g, evaluateGuess(g, solution));
    }
    return ks;
  }, [guesses, solution, revealRow]);

  // Persist game (only once today's saved game is loaded, and not mid-reveal:
  // the final result is saved immediately on submit, see onSubmit)
  useEffect(() => {
    if (loadedKey !== dateKey || revealRow !== null) return;
    saveGame({ dateKey, solution, guesses, status, ...hintFields(hint) });
  }, [dateKey, solution, guesses, status, loadedKey, revealRow, hint]);

  // Leaderboard: has today's result already been submitted from this device?
  useEffect(() => {
    setSubmittedToday(getSubmittedDateKey() === dateKey);
  }, [dateKey]);

  const hintUsed = hint !== null;

  // Leaderboard auto-submit: once the results card is showing (never during the
  // celebration), a player with a saved name has today's result submitted in the
  // background. The leaderboard itself only opens when they tap "Leaderboard";
  // without a saved name that button asks for one (LeaderboardModal's prompt).
  const autoSubmittedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!mounted || endPhase !== "card") return;
    if (status !== "won" && status !== "lost") return;
    if (loadedKey !== dateKey) return;
    if (getSubmittedDateKey() === dateKey) {
      setSubmittedToday(true);
      return;
    }
    const name = getSavedName();
    if (!name || autoSubmittedRef.current === dateKey) return;
    autoSubmittedRef.current = dateKey;
    const input = {
      dateKey,
      name,
      result: status === "won" ? ("win" as const) : ("loss" as const),
      guesses: status === "won" ? guesses.length : null,
      hintUsed,
      groupCode: getSavedGroup()
    };
    submitResultOnce(input)
      .then(() => {
        markSubmitted(dateKey);
        setSubmittedToday(true);
      })
      .catch(() => {
        // Opening the leaderboard retries (LeaderboardModal auto-submits with the saved name)
      });
  }, [mounted, endPhase, status, loadedKey, dateKey, guesses.length, hintUsed]);

  // A ref'd timer so an older message's timeout can't clear a newer message early
  const setTempMessage = useCallback((m: string, ms: number = 1500) => {
    if (messageTimerRef.current) {
      window.clearTimeout(messageTimerRef.current);
      messageTimerRef.current = null;
    }
    setMessage(m);
    if (m) {
      messageTimerRef.current = window.setTimeout(() => {
        messageTimerRef.current = null;
        setMessage("");
      }, ms);
    }
  }, []);

  useEffect(() => () => {
    if (messageTimerRef.current) window.clearTimeout(messageTimerRef.current);
  }, []);

  const shakeRow = useCallback((row: number) => {
    shakeNonceRef.current += 1;
    const nonce = shakeNonceRef.current;
    setShake({ row, nonce });
    later(() => setShake((s) => (s.nonce === nonce ? { row: null, nonce } : s)), 600);
  }, [later]);

  const onType = useCallback(
    (ch: string) => {
      if (status !== "ongoing" || busyRef.current) return;
      setCurrent((c) => (c.length >= WORD_LENGTH ? c : normalizeGuess(c + ch.toLowerCase())));
    },
    [status]
  );

  const onBackspace = useCallback(() => {
    if (status !== "ongoing" || busyRef.current) return;
    setCurrent((c) => c.slice(0, -1));
  }, [status]);

  const onSubmit = useCallback(() => {
    if (status !== "ongoing" || busyRef.current) return;
    const row = guesses.length;
    if (row >= MAX_GUESSES) return;
    if (current.length !== WORD_LENGTH) {
      shakeRow(row);
      setTempMessage("Not enough letters");
      resultHaptic("warning");
      return;
    }
    if (!isFiveLetters(current)) {
      shakeRow(row);
      setTempMessage("Use letters A–Z");
      resultHaptic("warning");
      return;
    }
    const guess = current;
    const newGuesses = [...guesses, guess];
    const won = guess === solution;
    const finalStatus: GameStatus = won ? "won" : newGuesses.length >= MAX_GUESSES ? "lost" : "ongoing";

    busyRef.current = true;
    setGuesses(newGuesses);
    setCurrent("");
    setRevealRow(row);

    if (finalStatus !== "ongoing") {
      // Save the result right away so closing the tab mid-animation can't lose it
      saveGame({ dateKey, solution, guesses: newGuesses, status: finalStatus, ...hintFields(hint) });
      const nextStats = recordResult(loadStats(), dateKey, won, newGuesses.length);
      setStats(nextStats);
      saveStats(nextStats);
      resultHaptic(won ? "success" : "error");
    }

    const reduced = prefersReducedMotion();
    const revealMs = reduced ? 0 : REVEAL_STEP_MS * (WORD_LENGTH - 1) + REVEAL_FLIP_MS;
    later(() => {
      setRevealRow(null);
      busyRef.current = false;
      if (finalStatus === "won") {
        setStatus("won");
        setHintConfirmOpen(false);
        const celebrate = () => {
          setEndPhase("celebrate");
          setConfettiShot((n) => n + 1);
        };
        if (reduced) {
          celebrate();
        } else {
          setTempMessage("Nice! You got it", BOUNCE_MS);
          setWinRow(row);
          later(celebrate, BOUNCE_MS);
        }
      } else if (finalStatus === "lost") {
        setStatus("lost");
        setHintConfirmOpen(false);
        later(() => setEndPhase("celebrate"), reduced ? 0 : 250);
      }
    }, revealMs);
  }, [current, guesses, solution, status, dateKey, hint, setTempMessage, shakeRow, later]);

  // Physical keyboard
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (leaderboardOpen || helpOpen || hintConfirmOpen || endPhase === "celebrate") return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.defaultPrevented) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          (target as HTMLElement).isContentEditable)
      ) {
        return;
      }
      // Let a focused button/link handle its own Enter/Space (keyboard navigation)
      const onControl = !!target?.closest?.("button, a");
      if (e.key === "Enter") {
        if (onControl) return;
        e.preventDefault();
        if (!e.repeat) onSubmit();
        return;
      }
      if (e.key === "Backspace" || e.key === "Delete") {
        e.preventDefault();
        onBackspace();
        return;
      }
      if (e.key.length !== 1) return;
      const letter = e.key.toUpperCase();
      if (/^[A-Z]$/.test(letter)) {
        e.preventDefault();
        onType(letter);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onType, onBackspace, onSubmit, leaderboardOpen, helpOpen, hintConfirmOpen, endPhase]);

  const onKey = useCallback(
    (label: string) => {
      if (label === "ENTER") {
        onSubmit();
      } else if (label === "⌫" || label === "BACKSPACE") {
        onBackspace();
      } else {
        onType(label);
      }
    },
    [onBackspace, onSubmit, onType]
  );

  const share = useCallback(async () => {
    const lines: string[] = [];
    for (const g of guesses) {
      const states = evaluateGuess(g, solution);
      const line = states
        .map((s) => (s === "correct" ? "🟩" : s === "present" ? "🟨" : "⬛"))
        .join("");
      lines.push(line);
    }
    const title = `Gavindle ${dayIndex} ${status === "won" ? guesses.length : "X"}/${MAX_GUESSES}${hintUsed ? "💡" : ""}`;
    const play = "https://gavindle.com";
    const text = `${title}\n\n${lines.join("\n")}\n\n${play}`;
    // iOS app share sheet first, then web share on phones/tablets, else clipboard
    if (await nativeShare(text)) return;
    const isTouch = window.matchMedia?.("(pointer: coarse)").matches ?? false;
    if (isTouch && typeof navigator.share === "function") {
      try {
        await navigator.share({ text });
        return;
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        // fall back to clipboard
      }
    }
    if (await copyText(text)) {
      setTempMessage("Result copied to clipboard");
    } else {
      setTempMessage("Copy failed");
    }
  }, [guesses, solution, dayIndex, status, hintUsed, setTempMessage]);

  const closeHelp = useCallback(() => setHelpOpen(false), []);
  const onCelebrationDone = useCallback(() => {
    setCardAfterCelebration(true);
    setEndPhase("card");
  }, []);

  // Hints: one per day, after at least one guess
  const canHint = mounted && status === "ongoing" && !hintUsed && guesses.length >= 1 && revealRow === null;
  const openHint = useCallback(() => {
    if (!canHint || busyRef.current) return;
    setHintConfirmOpen(true);
  }, [canHint]);
  const cancelHint = useCallback(() => setHintConfirmOpen(false), []);
  const confirmHint = useCallback(() => {
    setHintConfirmOpen(false);
    if (status !== "ongoing" || hint !== null || busyRef.current) return;
    const picked = pickHint(solution, guesses);
    if (!picked) return;
    setHint(picked);
    setTempMessage(`💡 Letter ${picked.index + 1} is ${picked.letter.toUpperCase()}`, 3500);
  }, [status, hint, solution, guesses, setTempMessage]);
  const hintLetter = hint !== null && hint.index >= 0 && hint.letter !== "" ? hint : null;
  const ghost =
    status === "ongoing" && hintLetter && guesses.length < MAX_GUESSES
      ? { row: guesses.length, index: hintLetter.index, letter: hintLetter.letter }
      : null;

  const rowStates = useMemo(() => guesses.map((g) => evaluateGuess(g, solution)), [guesses, solution]);
  const isOver = status === "won" || status === "lost";
  const points = pointsToday(status === "won", guesses.length, hintUsed);
  // The loss line waits for the loss moment so it doesn't spoil it
  const hudLine = status === "won" ? WIN_TEXT : status === "lost" && endPhase === "card" ? lossLine(dayIndex) : "";
  const leaderboardLabel = submittedToday || (mounted && getSavedName()) ? "Leaderboard" : "Join leaderboard";

  const leaderboardResult = status === "won" ? "win" : "loss";
  const leaderboardGuesses = status === "won" ? guesses.length : null;

  return (
    <div className="game">
      <div className="hud">
        {canHint && (
          <button
            type="button"
            className="eg-hint-btn"
            aria-haspopup="dialog"
            onClick={(e) => {
              if (e.detail > 0) e.currentTarget.blur();
              openHint();
            }}
          >
            <span aria-hidden="true">💡</span> Hint
          </button>
        )}
        {status === "ongoing" && hintLetter && (
          <div
            className="eg-hint-chip"
            role="note"
            aria-label={`Hint: letter ${hintLetter.index + 1} is ${hintLetter.letter.toUpperCase()}`}
          >
            <span aria-hidden="true">💡</span>
            <span aria-hidden="true">
              #{hintLetter.index + 1} <strong>{hintLetter.letter.toUpperCase()}</strong>
            </span>
          </div>
        )}
        <div className={`message eg-hud-line${message ? " eg-hidden" : ""}`}>{isOver ? hudLine : ""}</div>
        <div className="eg-toast-slot" role="status" aria-live="polite">
          {message && <div className="message toast">{message}</div>}
        </div>
        <button
          type="button"
          className="icon-btn help-btn"
          aria-label="How to play"
          aria-haspopup="dialog"
          onClick={(e) => {
            if (e.detail > 0) e.currentTarget.blur();
            setHelpOpen(true);
          }}
        >
          ?
        </button>
      </div>

      <Grid
        rows={rows}
        revealRow={revealRow}
        winRow={winRow}
        shakeRow={shake.row}
        shakeNonce={shake.nonce}
        revealStepMs={REVEAL_STEP_MS}
        ghost={ghost}
      />

      {isOver && endPhase === "card" ? (
        <EndGameCard
          won={status === "won"}
          guessCount={guesses.length}
          solution={solution}
          rowStates={rowStates}
          hintUsed={hintUsed}
          points={points}
          leaderboardLabel={leaderboardLabel}
          onShare={share}
          onLeaderboard={() => setLeaderboardOpen(true)}
          onNextWord={checkRollover}
          autoFocus={cardAfterCelebration}
        />
      ) : (
        <Keyboard onKey={onKey} keyStates={keyStates} />
      )}

      <Celebration
        show={isOver && endPhase === "celebrate"}
        mode={status === "won" ? "win" : "loss"}
        guesses={guesses.length}
        streak={stats.currentStreak}
        solution={solution}
        dayIndex={dayIndex}
        onDone={onCelebrationDone}
      />
      <Confetti shot={confettiShot} guesses={guesses.length} />
      <HintConfirm open={hintConfirmOpen && status === "ongoing"} onConfirm={confirmHint} onCancel={cancelHint} />
      <HelpModal open={helpOpen} onClose={closeHelp} />
      <LeaderboardModal
        open={leaderboardOpen && isOver}
        onClose={() => setLeaderboardOpen(false)}
        onSubmitted={() => setSubmittedToday(true)}
        dateKey={dateKey}
        result={leaderboardResult}
        guesses={leaderboardGuesses}
        hintUsed={hintUsed}
      />
    </div>
  );
}

function hintFields(hint: GameHint | null): { hintUsed?: boolean; hint?: GameHint } {
  if (!hint) return {};
  return hint.index >= 0 && hint.letter ? { hintUsed: true, hint } : { hintUsed: true };
}
