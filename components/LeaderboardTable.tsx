import React, { useEffect, useRef } from "react";
import type { PlayerRecord } from "@/lib/leaderboardClient";

function formatPercent(n: number) {
  if (!Number.isFinite(n)) return "";
  return `${n.toFixed(1)}%`;
}

function formatAvg(n: number | null) {
  if (n == null) return "";
  if (!Number.isFinite(n)) return "";
  return n.toFixed(2);
}

export default function LeaderboardTable(props: { players: PlayerRecord[]; compact?: boolean }) {
  const { players, compact } = props;
  const cls = compact ? "leaderboard-top" : "";
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo(0, 0);
  }, []);

  return (
    <section aria-label="Leaderboard" className={cls}>
      <div ref={scrollRef} className="table-wrap table-wrap-scroll">
        <table className="table leaderboard-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Player</th>
              <th>Win %</th>
              <th className="lb-hide-mobile">Played</th>
              <th className="lb-hide-mobile">Wins</th>
              <th className="lb-hide-mobile">Losses</th>
              <th>Best</th>
              <th className="lb-hide-mobile">Avg</th>
              <th>Streak</th>
              <th className="lb-hide-mobile">Last</th>
            </tr>
          </thead>
          <tbody>
            {players.length === 0 ? (
              <tr>
                <td colSpan={10} className="table-empty">
                  No entries yet — finish a game to submit.
                </td>
              </tr>
            ) : (
              players.map((p, idx) => (
                <tr key={p.key}>
                  <td>{idx + 1}</td>
                  <td>{p.displayName}</td>
                  <td>{formatPercent(p.winPercentage)}</td>
                  <td className="lb-hide-mobile">{p.gamesPlayed}</td>
                  <td className="lb-hide-mobile">{p.wins}</td>
                  <td className="lb-hide-mobile">{p.losses}</td>
                  <td>{p.bestGuesses ?? ""}</td>
                  <td className="lb-hide-mobile">{formatAvg(p.avgGuessesOnWins)}</td>
                  <td>
                    {p.currentStreak}/{p.bestStreak}
                  </td>
                  <td className="lb-hide-mobile">{p.lastPlayedAt ? p.lastPlayedAt.slice(0, 10) : ""}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
