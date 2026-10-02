"use client";
import React, { useEffect, useState } from "react";
import { getDateKey, loadStats as readStats, normalizeStreak, type Stats } from "@/lib/storage";
import { clearSavedName, getSavedGroup, getSavedName, normalizeName } from "@/lib/leaderboardClient";
import { getDailyIndex } from "@/lib/words";
import LeaderboardView from "@/components/LeaderboardView";
import Modal from "@/components/Modal";
import { useLeaderboard } from "@/components/useLeaderboard";
import "./leaderboard.css";

function Bar({ count, max, label, highlight }: { count: number; max: number; label: string; highlight?: boolean }) {
  const pct = max > 0 ? Math.max((count / max) * 100, count > 0 ? 8 : 0) : 0;
  return (
    <div className="sm-bar-row">
      <span className="sm-bar-label">{label}</span>
      <div className="sm-bar-track">
        <div className={`sm-bar-fill${highlight ? " is-best" : ""}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="sm-bar-count">{count}</span>
    </div>
  );
}

function StatsModal({ open, stats, onClose }: { open: boolean; stats: Stats; onClose: () => void }) {
  const maxDist = Math.max(...stats.guessDistribution, 1);
  const winPct = stats.gamesPlayed > 0 ? Math.round((stats.wins / stats.gamesPlayed) * 100) : 0;
  const tiles: [number, string][] = [
    [stats.gamesPlayed, "Played"],
    [winPct, "Win %"],
    [stats.currentStreak, "Streak"],
    [stats.maxStreak, "Max"]
  ];

  return (
    <Modal open={open} onClose={onClose} title="STATISTICS" size="sm" closeLabel="Close statistics">
      <div className="sm-body">
        <dl className="sm-grid">
          {tiles.map(([value, label]) => (
            <div key={label} className="sm-tile">
              <dt className="sm-label">{label}</dt>
              <dd className="sm-number">{value}</dd>
            </div>
          ))}
        </dl>
        <h3 className="sm-heading">GUESS DISTRIBUTION</h3>
        <div>
          {[1, 2, 3, 4, 5, 6].map((n) => {
            const count = stats.guessDistribution[n - 1] || 0;
            return <Bar key={n} count={count} max={maxDist} label={String(n)} highlight={count > 0 && count === maxDist} />;
          })}
        </div>
      </div>
    </Modal>
  );
}

const StatsIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="20" x2="18" y2="10"></line>
    <line x1="12" y1="20" x2="12" y2="4"></line>
    <line x1="6" y1="20" x2="6" y2="14"></line>
  </svg>
);

const LeaderboardIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="8" y1="6" x2="21" y2="6"></line>
    <line x1="8" y1="12" x2="21" y2="12"></line>
    <line x1="8" y1="18" x2="21" y2="18"></line>
    <line x1="3" y1="6" x2="3.01" y2="6"></line>
    <line x1="3" y1="12" x2="3.01" y2="12"></line>
    <line x1="3" y1="18" x2="3.01" y2="18"></line>
  </svg>
);

export default function ClientHeader() {
  const [showStats, setShowStats] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [stats, setStats] = useState<Stats>({ gamesPlayed: 0, wins: 0, currentStreak: 0, maxStreak: 0, guessDistribution: [0,0,0,0,0,0] });
  const leaderboard = useLeaderboard();
  const [highlightKey, setHighlightKey] = useState<string | null>(null);
  const [leaderboardNotice, setLeaderboardNotice] = useState<string | null>(null);

  // Sanitized read (a malformed saved value can't crash the stats dialog).
  const loadStats = () => setStats(normalizeStreak(readStats(), getDateKey()));

  useEffect(() => {
    loadStats();
  }, []);

  const openStats = () => {
    loadStats();
    setShowStats(true);
  };

  const openLeaderboard = () => {
    const saved = getSavedName();
    setHighlightKey(saved ? normalizeName(saved) : null);
    setLeaderboardNotice(null);
    void leaderboard.load(getSavedGroup());
    setShowLeaderboard(true);
  };

  const changeName = () => {
    clearSavedName();
    setHighlightKey(null);
    setLeaderboardNotice("Name cleared. You\u2019ll be asked for your name after your next game.");
  };

  const today = new Date();
  const dayIndex = getDailyIndex(today);

  return (
    <>
      <header className="app-header">
        <div className="app-header-inner">
          <div className="sm-day">
            Day {dayIndex}
          </div>
          <h1 className="brand">Gavindle</h1>
          <div style={{ display: "flex", gap: 4 }}>
            <button className="icon-btn" onClick={openStats} aria-label="Statistics" aria-haspopup="dialog">
              <StatsIcon />
            </button>
            <button className="icon-btn" onClick={openLeaderboard} aria-label="Leaderboard" aria-haspopup="dialog">
              <LeaderboardIcon />
            </button>
          </div>
        </div>
      </header>
      <StatsModal open={showStats} stats={stats} onClose={() => setShowStats(false)} />
      <LeaderboardView
        open={showLeaderboard}
        board={leaderboard}
        highlightKey={highlightKey}
        notice={leaderboardNotice}
        onChangeName={highlightKey ? changeName : undefined}
        onClose={() => setShowLeaderboard(false)}
      />
    </>
  );
}
