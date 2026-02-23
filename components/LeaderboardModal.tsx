import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  loadLeaderboard,
  saveLeaderboard,
  sortPlayersForLeaderboard,
  upsertPlayerResult,
  type GameResult,
  type PlayerRecord
} from "@/lib/leaderboardClient";

function formatPercent(n: number) {
  if (!Number.isFinite(n)) return "";
  return `${n.toFixed(1)}%`;
}

function formatAvg(n: number | null) {
  if (n == null) return "";
  if (!Number.isFinite(n)) return "";
  return n.toFixed(2);
}

export default function LeaderboardModal(props: {
  open: boolean;
  onClose: () => void;
  onSubmitted?: () => void;
  result: GameResult;
  guesses: number | null;
}) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [players, setPlayers] = useState<PlayerRecord[]>([]);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!props.open) return;
    setError("");
    setSaving(false);
    const lb = loadLeaderboard();
    const list = sortPlayersForLeaderboard(Object.values(lb.players || {}));
    setPlayers([...list]);
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }, [props.open]);

  const canSubmit = useMemo(() => {
    return Boolean(name.trim()) && !saving;
  }, [name, saving]);

  const onSubmit = async () => {
    try {
      setError("");
      setSaving(true);
      const lb = loadLeaderboard();
      const next = upsertPlayerResult(lb, {
        name,
        result: props.result,
        guesses: props.result === "win" ? props.guesses : props.guesses ?? null
      });
      saveLeaderboard(next);
      const list = sortPlayersForLeaderboard(Object.values(next.players || {}));
      setPlayers([...list]);
      props.onSubmitted?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save leaderboard.");
    } finally {
      setSaving(false);
    }
  };

  if (!props.open) return null;

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Leaderboard">
      <div className="modal">
        <div className="modal-header">
          <div className="modal-title">Leaderboard</div>
          <button className="btn secondary" onClick={props.onClose} type="button">
            Close
          </button>
        </div>

        <div className="modal-body">
          <div className="modal-row">
            <label className="modal-label" htmlFor="leaderboard-name">
              Display name
            </label>
            <input
              id="leaderboard-name"
              ref={inputRef}
              className="modal-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Rohan"
              maxLength={40}
              autoComplete="nickname"
            />
            <button className="btn" onClick={onSubmit} disabled={!canSubmit} type="button">
              {saving ? "Saving..." : "Submit"}
            </button>
          </div>

          {error && <div className="modal-error">{error}</div>}

          <div className="table-wrap" aria-label="Leaderboard table">
            <table className="table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Player</th>
                  <th>Win %</th>
                  <th>Played</th>
                  <th>Wins</th>
                  <th>Losses</th>
                  <th>Best</th>
                  <th>Avg (wins)</th>
                  <th>Streak</th>
                  <th>Last played</th>
                </tr>
              </thead>
              <tbody>
                {players.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="table-empty">
                      No entries yet — submit your result.
                    </td>
                  </tr>
                ) : (
                  players.map((p, idx) => (
                    <tr key={p.key}>
                      <td>{idx + 1}</td>
                      <td>{p.displayName}</td>
                      <td>{formatPercent(p.winPercentage)}</td>
                      <td>{p.gamesPlayed}</td>
                      <td>{p.wins}</td>
                      <td>{p.losses}</td>
                      <td>{p.bestGuesses ?? ""}</td>
                      <td>{formatAvg(p.avgGuessesOnWins)}</td>
                      <td>
                        {p.currentStreak}/{p.bestStreak}
                      </td>
                      <td>{p.lastPlayedAt ? p.lastPlayedAt.slice(0, 10) : ""}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

