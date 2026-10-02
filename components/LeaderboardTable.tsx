"use client";
import React, { useLayoutEffect, useRef } from "react";
import type { PlayerRecord } from "@/lib/leaderboardClient";
import { badgesFromIds } from "@/lib/badges";
import { prefersReducedMotion } from "@/components/Modal";

const MAX_TABLE_BADGES = 3;
const MOVE_MS = 700;

export function formatAvg(n: number | null) {
  if (n == null || !Number.isFinite(n)) return "-";
  return n.toFixed(1);
}

export function formatWinPct(p: PlayerRecord) {
  if (!p.gamesPlayed) return "-";
  return `${Math.round(p.winPercentage)}%`;
}

/** Up to 3 badge emoji with the full list in the tooltip / accessible label. */
export function BadgeStrip({ ids }: { ids: readonly string[] | undefined }) {
  const badges = badgesFromIds(ids);
  if (badges.length === 0) return null;
  const shown = badges.slice(0, MAX_TABLE_BADGES);
  const extra = badges.length - shown.length;
  const label = `Badges: ${badges.map((b) => b.name).join(", ")}`;
  return (
    <span className="lbv-badges" title={label} role="img" aria-label={label}>
      {shown.map((b) => (
        <span key={b.id} aria-hidden="true">{b.emoji}</span>
      ))}
      {extra > 0 && <span className="lbv-badges-more" aria-hidden="true">+{extra}</span>}
    </span>
  );
}

/**
 * Leaderboard table. The wrapper is the scroll area: it grows to fill the modal and
 * scrolls vertically; the header row is sticky. The highlighted row is scrolled into
 * view (inside the table only, the page never moves).
 *
 * When `moveToken` changes (after a submission), rows that changed position slide
 * from where they were to where they are now (FLIP), and the highlighted row
 * animates in if it is new.
 */
export default function LeaderboardTable(props: {
  players: PlayerRecord[];
  highlightKey?: string | null;
  moveToken?: number;
  onSelect?: (player: PlayerRecord, rank: number) => void;
}) {
  const { players, highlightKey, moveToken = 0, onSelect } = props;
  const scrollRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLTableSectionElement>(null);
  const positions = useRef<Map<string, number>>(new Map());
  const lastToken = useRef(moveToken);

  useLayoutEffect(() => {
    const container = scrollRef.current;
    const tbody = bodyRef.current;
    if (!container || !tbody) return;

    const rows = Array.from(tbody.querySelectorAll<HTMLTableRowElement>("tr[data-key]"));
    const animate = moveToken !== lastToken.current && !prefersReducedMotion();
    lastToken.current = moveToken;

    const prev = positions.current;
    const next = new Map<string, number>();
    const bodyTop = tbody.getBoundingClientRect().top;
    for (const row of rows) {
      // Clear any in-flight animation so measurements are of the real layout.
      row.style.transition = "";
      row.style.transform = "";
      row.classList.remove("lbv-row-new");
      next.set(row.dataset.key as string, row.getBoundingClientRect().top - bodyTop);
    }
    positions.current = next;

    // Keep "you" in view: center the highlighted row in the visible rows area.
    const you = highlightKey ? rows.find((r) => r.dataset.key === highlightKey) : undefined;
    if (you) {
      const headH = tbody.getBoundingClientRect().top - (tbody.parentElement?.getBoundingClientRect().top ?? bodyTop);
      const rowTop = you.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop;
      const visible = container.clientHeight - headH;
      container.scrollTop = Math.max(0, rowTop - headH - (visible - you.offsetHeight) / 2);
    } else if (!animate) {
      container.scrollTop = 0;
    }

    if (!animate) return;

    const moved: HTMLTableRowElement[] = [];
    for (const row of rows) {
      const key = row.dataset.key as string;
      const before = prev.get(key);
      const after = next.get(key) as number;
      if (before == null) {
        if (key === highlightKey) row.classList.add("lbv-row-new");
        continue;
      }
      const delta = before - after;
      if (Math.abs(delta) < 1) continue;
      row.style.transform = `translateY(${delta}px)`;
      moved.push(row);
    }
    if (moved.length === 0) return;

    // Force the inverted positions to apply, then transition to the real ones.
    void tbody.offsetHeight;
    for (const row of moved) {
      row.style.transition = `transform ${MOVE_MS}ms cubic-bezier(0.2, 0.8, 0.2, 1)`;
      row.style.transform = "";
    }
    const t = window.setTimeout(() => {
      for (const row of moved) row.style.transition = "";
    }, MOVE_MS + 50);
    return () => window.clearTimeout(t);
  }, [players, highlightKey, moveToken]);

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
        <tbody ref={bodyRef}>
          {players.map((p, idx) => {
            const isYou = Boolean(highlightKey) && p.key === highlightKey;
            const streakTitle = `Current streak ${p.currentStreak} day${p.currentStreak === 1 ? "" : "s"} (best ${p.bestStreak})`;
            const select = onSelect ? () => onSelect(p, idx + 1) : undefined;
            return (
              <tr
                key={p.key}
                data-key={p.key}
                className={`${isYou ? "lbv-you" : ""}${select ? " lbv-clickable" : ""}`.trim() || undefined}
                aria-current={isYou ? "true" : undefined}
                onClick={select}
              >
                <td className="lbv-num lbv-rank">{idx + 1}</td>
                <td className="lbv-name">
                  <span className="lbv-name-inner">
                    {select ? (
                      <button
                        type="button"
                        className="lbv-name-text lbv-name-btn"
                        title={`${p.displayName}: see details`}
                        onClick={(e) => {
                          e.stopPropagation();
                          select();
                        }}
                      >
                        {p.displayName}
                      </button>
                    ) : (
                      <span className="lbv-name-text" title={p.displayName}>{p.displayName}</span>
                    )}
                    <span className="lbv-name-meta">
                      {isYou && <span className="lbv-you-tag">You</span>}
                      {p.currentStreak >= 2 && (
                        <span className="lbv-streak" title={streakTitle} aria-label={streakTitle}>
                          {"⚡"}{p.currentStreak}
                        </span>
                      )}
                      <BadgeStrip ids={p.badges} />
                    </span>
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
