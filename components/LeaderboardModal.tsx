import React, { useEffect, useRef, useState } from "react";
import { LEADERBOARD_SUBMITTED_DATE_KEY, normalizeName, type GameResult } from "@/lib/leaderboardClient";
import { submitResult, fetchLeaderboard, leaderboardRows } from "@/lib/leaderboardService";
import type { PlayerRecord } from "@/lib/leaderboardClient";
import { getDailyIndex } from "@/lib/words";

const ROHAN_QUOTES = [
  "Gavindle doesn't reward hope. It rewards process.",
  "Confidence is built in practice, not in guess three.",
  "If you want green, earn it.",
  "Lock in. Then let the tiles speak.",
  "You don't need luck. You need a plan.",
  "Every guess should do a job.",
  "Guessing random is donating attempts.",
  "Play calm. Play sharp.",
  "Execution beats emotion every time.",
  "Speed is cool. Precision is deadly.",
  "Your streak is your discipline in public.",
  "Today's puzzle is a mirror.",
  "No tilt. Just tactics.",
  "A great solve is just good habits stacked.",
  "You can't bluff the board.",
  "Intentional guesses win games.",
  "Don't chase the answer. Box it in.",
  "Control the letters. Control the outcome."
];

export default function LeaderboardModal(props: {
  open: boolean;
  onClose: () => void;
  onSubmitted?: () => void;
  dateKey: string;
  result: GameResult;
  guesses: number | null;
}) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [players, setPlayers] = useState<PlayerRecord[]>([]);
  const [showResults, setShowResults] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!props.open) return;
    setError("");
    setSaving(false);
    setShowResults(false);
    setPlayers([]);
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }, [props.open]);

  const canSubmit = Boolean(name.trim()) && !saving;

  const onSubmit = async () => {
    if (saving) return;
    try {
      setError("");
      setSaving(true);
      const result = await submitResult({
        dateKey: props.dateKey,
        name,
        result: props.result,
        guesses: props.guesses
      });
      setPlayers(leaderboardRows(result));
      setShowResults(true);
      try {
        window.localStorage.setItem(LEADERBOARD_SUBMITTED_DATE_KEY, props.dateKey);
      } catch {
        // ignore
      }
      props.onSubmitted?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save leaderboard.");
    } finally {
      setSaving(false);
    }
  };

  if (!props.open) return null;

  const dayIndex = getDailyIndex(new Date());
  const quote = ROHAN_QUOTES[dayIndex % ROHAN_QUOTES.length];
  const goat = players.length > 0 ? players[0].displayName : null;

  if (showResults) {
    return (
      <div className="modal-overlay" onClick={props.onClose}>
        <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 340, padding: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div style={{ fontWeight: 800, fontSize: 16 }}>LEADERBOARD</div>
            <button onClick={props.onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", padding: 4 }}>X</button>
          </div>
          {goat && (
            <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 8, color: "#1a1a1b" }}>
              Gavindler #1 GOAT: {goat}
            </div>
          )}
          {players.length === 0 ? (
            <div style={{ color: "#687387", textAlign: "center", padding: 20 }}>No entries yet</div>
          ) : (
            <table style={{ width: "100%", fontSize: 11, borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #d3d6da" }}>
                  <th style={{ padding: 6, textAlign: "left", fontWeight: 800 }}>#</th>
                  <th style={{ padding: 6, textAlign: "left", fontWeight: 800 }}>Player</th>
                  <th style={{ padding: 6, textAlign: "left", fontWeight: 800 }}>Win %</th>
                  <th style={{ padding: 6, textAlign: "left", fontWeight: 800 }}>Best</th>
                  <th style={{ padding: 6, textAlign: "left", fontWeight: 800 }}>Streak</th>
                </tr>
              </thead>
              <tbody>
                {players.slice(0, 30).map((p, idx) => {
                  const isYou = p.key === normalizeName(name);
                  return (
                  <tr key={p.key} style={{ borderBottom: "1px solid #f0f0f0", background: isYou ? "#e8f5e9" : undefined }}>
                    <td style={{ padding: 6 }}>{idx + 1}</td>
                    <td style={{ padding: 6, fontWeight: isYou ? 700 : 400 }}>{p.displayName} {isYou && "(You)"}</td>
                    <td style={{ padding: 6 }}>{Math.round(p.winPercentage)}%</td>
                    <td style={{ padding: 6 }}>{p.bestGuesses ?? "-"}</td>
                    <td style={{ padding: 6 }}>{p.currentStreak}/{p.bestStreak}</td>
                  </tr>
                );
                })}
              </tbody>
            </table>
          )}
          <div style={{ marginTop: 16, textAlign: "center" }}>
            <button className="btn secondary" onClick={props.onClose}>Close</button>
          </div>
          <div style={{ marginTop: 12, fontStyle: "italic", fontSize: 11, color: "#687387", textAlign: "center" }}>
            Rohan Quote of the day: {quote}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={props.onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 340 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 14, borderBottom: "1px solid #d3d6da" }}>
          <div style={{ fontWeight: 800, fontSize: 16 }}>Submit to leaderboard</div>
          <button onClick={props.onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", padding: 4 }}>X</button>
        </div>

        <div style={{ padding: 16 }}>
          <p style={{ margin: "0 0 12px", color: "#687387", fontSize: 13 }}>
            Enter your name for the leaderboard.
          </p>
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Display name</label>
            <input
              ref={inputRef}
              style={{ width: "100%", padding: "10px 8px", fontSize: 16, border: "1px solid #d3d6da", borderRadius: 0 }}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Rohan"
              maxLength={40}
            />
          </div>
          <button className="btn" onClick={onSubmit} disabled={!canSubmit} style={{ width: "100%" }}>
            {saving ? "Saving..." : "Submit"}
          </button>

          {error && <div style={{ color: "#d32f2f", marginTop: 8 }}>{error}</div>}
        </div>
      </div>
    </div>
  );
}
