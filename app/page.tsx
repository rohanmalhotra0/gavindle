"use client";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import Grid, { type RowData } from "@/components/Grid";
import Keyboard from "@/components/Keyboard";
import Celebration from "@/components/Celebration";
import { getDailyIndex, getDailySolution, isFiveLetters, normalizeGuess } from "@/lib/words";
import { evaluateGuess, mergeKeyStates, type LetterState } from "@/lib/evaluateGuess";
import { getDateKey, loadGame, loadStats, saveGame, saveStats, type Stats } from "@/lib/storage";

const MAX_GUESSES = 6;
const WORD_LENGTH = 5;

type GameStatus = "ongoing" | "won" | "lost";

export default function Page() {
  const today = useMemo(() => new Date(), []);
  const solution = useMemo(() => getDailySolution(today), [today]);
  const dayIndex = useMemo(() => getDailyIndex(today), [today]);
  const dateKey = useMemo(() => getDateKey(today), [today]);

  const [guesses, setGuesses] = useState<string[]>([]);
  const [current, setCurrent] = useState<string>("");
  const [rows, setRows] = useState<RowData[]>([]);
  const [keyStates, setKeyStates] = useState<Record<string, LetterState>>({});
  const [message, setMessage] = useState<string>("");
  const [status, setStatus] = useState<GameStatus>("ongoing");
  const [showCelebration, setShowCelebration] = useState<boolean>(false);
  const [stats, setStats] = useState<Stats>({
    gamesPlayed: 0,
    wins: 0,
    currentStreak: 0,
    maxStreak: 0,
    guessDistribution: [0, 0, 0, 0, 0, 0]
  });
  const [mounted, setMounted] = useState<boolean>(false);

  // Load stats after mount to avoid SSR/client mismatch from localStorage
  useEffect(() => {
    setStats(loadStats());
    setMounted(true);
  }, []);

  // Initialize from storage or fresh
  useEffect(() => {
    const persisted = loadGame();
    if (persisted && persisted.dateKey === dateKey && persisted.solution === solution) {
      setGuesses(persisted.guesses);
      setStatus(persisted.status);
    } else {
      setGuesses([]);
      setStatus("ongoing");
    }
  }, [dateKey, solution]);

  // Build rows whenever state changes
  useEffect(() => {
    const built: RowData[] = [];
    for (let r = 0; r < MAX_GUESSES; r++) {
      const g = guesses[r] ?? (r === guesses.length ? current : "");
      const letters = Array.from({ length: WORD_LENGTH }, (_, i) => g[i]?.toUpperCase() ?? "");
      const submitted = r < guesses.length;
      const states: LetterState[] = submitted ? evaluateGuess((guesses[r] ?? ""), solution) : Array.from<LetterState>({ length: WORD_LENGTH }).fill("empty");
      built.push({ letters, states, submitted });
    }
    setRows(built);
  }, [guesses, current, solution]);

  // Update key states after guesses
  useEffect(() => {
    let ks: Record<string, LetterState> = {};
    for (const g of guesses) {
      ks = mergeKeyStates(ks, g, evaluateGuess(g, solution));
    }
    setKeyStates(ks);
  }, [guesses, solution]);

  // Persist game
  useEffect(() => {
    saveGame({ dateKey, solution, guesses, status });
  }, [dateKey, solution, guesses, status]);

  const setTempMessage = useCallback((m: string) => {
    setMessage(m);
    if (m) {
      window.setTimeout(() => setMessage(""), 1500);
    }
  }, []);

  const onType = useCallback(
    (ch: string) => {
      if (status !== "ongoing") return;
      const next = normalizeGuess(current + ch.toLowerCase());
      if (next.length <= WORD_LENGTH) setCurrent(next);
    },
    [current, status]
  );

  const onBackspace = useCallback(() => {
    if (status !== "ongoing") return;
    setCurrent((c) => c.slice(0, -1));
  }, [status]);

  const onSubmit = useCallback(() => {
    if (status !== "ongoing") return;
    if (current.length !== WORD_LENGTH) {
      setTempMessage("Not enough letters");
      return;
    }
    if (!isFiveLetters(current)) {
      setTempMessage("Use letters A–Z");
      return;
    }
    const newGuesses = [...guesses, current];
    setGuesses(newGuesses);
    setCurrent("");
    if (current === solution) {
      setStatus("won");
      setShowCelebration(true);
      // update stats
      const nextStats = { ...stats };
      nextStats.gamesPlayed += 1;
      nextStats.wins += 1;
      nextStats.currentStreak += 1;
      if (nextStats.currentStreak > nextStats.maxStreak) nextStats.maxStreak = nextStats.currentStreak;
      const tries = newGuesses.length;
      if (tries >= 1 && tries <= 6) {
        nextStats.guessDistribution[tries - 1] += 1;
      }
      setStats(nextStats);
      saveStats(nextStats);
      setTempMessage("Nice! You got it");
    } else if (newGuesses.length >= MAX_GUESSES) {
      setStatus("lost");
      const nextStats = { ...stats };
      nextStats.gamesPlayed += 1;
      nextStats.currentStreak = 0;
      setStats(nextStats);
      saveStats(nextStats);
      setTempMessage(`The word was ${solution.toUpperCase()}`);
    }
  }, [current, guesses, solution, stats, status, setTempMessage]);

  // Physical keyboard
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        onSubmit();
        return;
      }
      if (e.key === "Backspace" || e.key === "Delete") {
        e.preventDefault();
        onBackspace();
        return;
      }
      const letter = e.key.toUpperCase();
      if (/^[A-Z]$/.test(letter)) {
        e.preventDefault();
        onType(letter);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onType, onBackspace, onSubmit]);

  const onKey = useCallback(
    (label: string) => {
      if (label === "ENTER") {
        onSubmit();
      } else if (label === "⌫") {
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
    const title = `Gavindle ${dayIndex} ${status === "won" ? guesses.length : "X"}/${MAX_GUESSES}`;
    const text = `${title}\n\n${lines.join("\n")}`;
    const play = "https://gavindle.com";
    try {
      await navigator.clipboard.writeText(text);
      setTempMessage("Result copied to clipboard");
    } catch {
      setTempMessage("Copy failed");
    }
  }, [guesses, solution, dayIndex, status, setTempMessage]);

  const resetIfNeeded = useCallback(() => {
    // If the stored game is from a previous day, user can refresh to new
    window.location.reload();
  }, []);

  return (
    <div className="game">
      <div className="hud">
        <div className="message" role="status" aria-live="polite">
          {message || (status === "won" ? "You win Gavin has been notified I am so proud of you!" : status === "lost" ? `The word was ${solution.toUpperCase()} Loser fake friend this result and email has been sent to gavin` : "")}
        </div>
        <div>
          <small>Day {dayIndex} • {today.toISOString().slice(0, 10)}</small>
        </div>
        {(status === "won" || status === "lost") && (
          <div className="actions">
            <button className="btn" onClick={share}>Share</button>
          </div>
        )}
      </div>

      <Grid rows={rows} />

      {status === "ongoing" && <Keyboard onKey={onKey} keyStates={keyStates} />}

      <Celebration show={showCelebration} onHide={() => setShowCelebration(false)} />

      <section aria-label="Stats">
        <div style={{ textAlign: "center", marginTop: 16 }}>
          <strong>Stats</strong>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 8, marginTop: 8 }}>
            <div>
              <div style={{ fontSize: 20, fontWeight: 800 }}>
                <span suppressHydrationWarning>{mounted ? stats.gamesPlayed : 0}</span>
              </div>
              <div>Played</div>
            </div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 800 }}>
                <span suppressHydrationWarning>{mounted ? stats.wins : 0}</span>
              </div>
              <div>Wins</div>
            </div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 800 }}>
                <span suppressHydrationWarning>{mounted ? stats.currentStreak : 0}</span>
              </div>
              <div>Streak</div>
            </div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 800 }}>
                <span suppressHydrationWarning>{mounted ? stats.maxStreak : 0}</span>
              </div>
              <div>Max</div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

