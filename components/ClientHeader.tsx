"use client";
import React, { useEffect, useState } from "react";
import type { Stats } from "@/lib/storage";
import { clearSavedName, getSavedName, normalizeName } from "@/lib/leaderboardClient";
import { getDailyIndex } from "@/lib/words";
import LeaderboardView from "@/components/LeaderboardView";
import { useLeaderboard } from "@/components/useLeaderboard";

function Bar({ count, max, label }: { count: number; max: number; label: string }) {
  const pct = max > 0 ? (count / max) * 100 : 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
      <span style={{ width: 12, textAlign: "right", fontWeight: 600, fontSize: 11 }}>{label}</span>
      <div style={{ flex: 1, height: 14, background: "#d3d6da", overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: "#6aaa64" }} />
      </div>
      <span style={{ width: 18, textAlign: "left", fontSize: 11 }}>{count}</span>
    </div>
  );
}

function StatsModal({ stats, onClose }: { stats: Stats; onClose: () => void }) {
  const maxDist = Math.max(...stats.guessDistribution, 1);
  const winPct = stats.gamesPlayed > 0 ? Math.round((stats.wins / stats.gamesPlayed) * 100) : 0;

  return (
    <div className="modal-overlay" onClick={onClose} style={{ alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "white", width: "100%", maxWidth: 340, maxHeight: "80vh", overflow: "auto", padding: 16, border: "1px solid #d3d6da" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ fontWeight: 800, fontSize: 16 }}>STATISTICS</div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", padding: 4 }}>X</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 16, textAlign: "center" }}>
          <div><div style={{ fontSize: 20, fontWeight: 800 }}>{stats.gamesPlayed}</div><div style={{ fontSize: 10 }}>Played</div></div>
          <div><div style={{ fontSize: 20, fontWeight: 800 }}>{winPct}</div><div style={{ fontSize: 10 }}>Win %</div></div>
          <div><div style={{ fontSize: 20, fontWeight: 800 }}>{stats.currentStreak}</div><div style={{ fontSize: 10 }}>Streak</div></div>
          <div><div style={{ fontSize: 20, fontWeight: 800 }}>{stats.maxStreak}</div><div style={{ fontSize: 10 }}>Max</div></div>
        </div>
        <div style={{ fontWeight: 700, marginBottom: 6, fontSize: 12 }}>GUESS DISTRIBUTION</div>
        <div>{[1, 2, 3, 4, 5, 6].map((n) => (
          <Bar key={n} count={stats.guessDistribution[n - 1] || 0} max={maxDist} label={String(n)} />
        ))}</div>
      </div>
    </div>
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

  const loadStats = () => {
    setStats({
      gamesPlayed: 0,
      wins: 0,
      currentStreak: 0,
      maxStreak: 0,
      guessDistribution: [0, 0, 0, 0, 0, 0]
    });
    try {
      const stored = window.localStorage.getItem("gavindle:stats");
      if (stored) {
        setStats(JSON.parse(stored));
      }
    } catch {}
  };

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
    void leaderboard.reload();
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
          <div style={{ fontSize: 11, fontWeight: 600, color: "#787c7e", textAlign: "left" }}>
            Day {dayIndex}
          </div>
          <h1 className="brand">Gavindle</h1>
          <div style={{ display: "flex", gap: 4 }}>
            <button className="icon-btn" onClick={openStats} aria-label="Statistics">
              <StatsIcon />
            </button>
            <button className="icon-btn" onClick={openLeaderboard} aria-label="Leaderboard">
              <LeaderboardIcon />
            </button>
          </div>
        </div>
      </header>
      {showStats && <StatsModal stats={stats} onClose={() => setShowStats(false)} />}
      {showLeaderboard && (
        <LeaderboardView
          players={leaderboard.players}
          loading={leaderboard.loading}
          error={leaderboard.error}
          onRetry={() => void leaderboard.reload()}
          highlightKey={highlightKey}
          notice={leaderboardNotice}
          onChangeName={highlightKey ? changeName : undefined}
          onClose={() => setShowLeaderboard(false)}
        />
      )}
    </>
  );
}
