"use client";
import React, { useEffect, useRef } from "react";
import type { PlayerRecord } from "@/lib/leaderboardClient";

function formatAvg(n: number | null) {
  if (n == null || !Number.isFinite(n)) return "-";
  return n.toFixed(1);
}

function formatWinPct(p: PlayerRecord) {
  if (!p.gamesPlayed) return "-";
  return `${Math.round(p.winPercentage)}%`;
}

/**
 * Leaderboard table. The wrapper is the scroll area: it grows to fill the modal and
 * scrolls vertically; the header row is sticky. The highlighted row is scrolled into
 * view (inside the table only, the page never moves).
 */
export default function LeaderboardTable(props: { players: PlayerRecord[]; highlightKey?: string | null }) {
  const { players, highlightKey } = props;
  const scrollRef = useRef<HTMLDivElement>(null);
  const highlightRef = useRef<HTMLTableRowElement>(null);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const row = highlightRef.current;
    if (!row) {
      container.scrollTop = 0;
      return;
    }
    const cRect = container.getBoundingClientRect();
    const rRect = row.getBoundingClientRect();
    container.scrollTop += rRect.top - cRect.top - (cRect.height - rRect.height) / 2;
  }, [highlightKey, players]);

  return (
    <div ref={scrollRef} className="lbv-scroll" tabIndex={0} aria-label="Leaderboard rankings">
      <table className="lbv-table">
        <thead>
          <tr>
            <th className="lbv-num" scope="col">#</th>
            <th className="lbv-name" scope="col">Player</th>
            <th className="lbv-num" scope="col" title="Points">Pts</th>
            <th className="lbv-num" scope="col">Played</th>
            <th className="lbv-num" scope="col">Win %</th>
            <th className="lbv-num" scope="col" title="Average guesses on wins">Avg</th>
          </tr>
        </thead>
        <tbody>
          {players.map((p, idx) => {
            const isYou = Boolean(highlightKey) && p.key === highlightKey;
            const streakTitle = `Current streak ${p.currentStreak} day${p.currentStreak === 1 ? "" : "s"} (best ${p.bestStreak})`;
            return (
              <tr key={p.key} ref={isYou ? highlightRef : undefined} className={isYou ? "lbv-you" : undefined} aria-current={isYou ? "true" : undefined}>
                <td className="lbv-num lbv-rank">{idx + 1}</td>
                <td className="lbv-name">
                  <span className="lbv-name-inner">
                    <span className="lbv-name-text" title={p.displayName}>{p.displayName}</span>
                    {isYou && <span className="lbv-you-tag">You</span>}
                    {p.currentStreak >= 2 && (
                      <span className="lbv-streak" title={streakTitle} aria-label={streakTitle}>
                        {"\u{1F525}"}{p.currentStreak}
                      </span>
                    )}
                  </span>
                </td>
                <td className="lbv-num lbv-pts">{p.points}</td>
                <td className="lbv-num">{p.gamesPlayed}</td>
                <td className="lbv-num">{formatWinPct(p)}</td>
                <td className="lbv-num">{formatAvg(p.avgGuessesOnWins)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
