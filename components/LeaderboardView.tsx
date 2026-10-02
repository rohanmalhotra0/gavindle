"use client";
import React, { useEffect, useRef, useState } from "react";
import {
  GROUP_MAX_LENGTH,
  clearSavedGroup,
  getSavedGroup,
  getSavedName,
  getSubmittedDateKey,
  normalizeGroupCode,
  saveGroup,
  validateGroupCode,
  type PlayerRecord
} from "@/lib/leaderboardClient";
import { BADGES, mergeBadgeIds } from "@/lib/badges";
import { rankChangeMessage } from "@/lib/leaderboardStats";
import { assignGroupToDay } from "@/lib/leaderboardService";
import { getDateKey } from "@/lib/storage";
import { getRohanQuote } from "@/lib/rohanQuotes";
import Modal from "@/components/Modal";
import LeaderboardTable, { formatAvg, formatWinPct } from "@/components/LeaderboardTable";
import type { BoardScope, LeaderboardState } from "@/components/useLeaderboard";
import "./leaderboard.css";

/** Everyone / class tabs. */
function BoardTabs(props: { group: string | null; scope: BoardScope; onPick: (scope: BoardScope) => void }) {
  const { group, scope, onPick } = props;
  if (!group) return null;
  const tabs: { scope: BoardScope; label: string }[] = [
    { scope: null, label: "Everyone" },
    { scope: group, label: group }
  ];
  const activeIdx = tabs.findIndex((t) => t.scope === scope);
  return (
    <div
      className="lbv-tabs"
      role="tablist"
      aria-label="Which leaderboard"
      onKeyDown={(e) => {
        if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
        e.preventDefault();
        const next = tabs[(Math.max(0, activeIdx) + 1) % tabs.length];
        onPick(next.scope);
        const btns = e.currentTarget.querySelectorAll<HTMLButtonElement>("[role=tab]");
        btns[tabs.indexOf(next)]?.focus();
      }}
    >
      {tabs.map((t, i) => {
        const active = i === activeIdx;
        return (
          <button
            key={t.label}
            type="button"
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            className={`lbv-tab${active ? " is-active" : ""}`}
            onClick={() => onPick(t.scope)}
          >
            {t.scope ? `Class ${t.label}` : t.label}
          </button>
        );
      })}
    </div>
  );
}

/** "Join a class" / "Change class": input + save + leave. */
function ClassControl(props: { group: string | null; onSave: (code: string) => void; onLeave: () => void }) {
  const { group } = props;
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [err, setErr] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  if (!editing) {
    return (
      <button
        type="button"
        className="lbv-link lbv-class-toggle"
        onClick={() => {
          setValue(group ?? "");
          setErr("");
          setEditing(true);
        }}
      >
        {group ? "Change class" : "Join a class"}
      </button>
    );
  }

  const save = () => {
    const code = normalizeGroupCode(value);
    const problem = validateGroupCode(code);
    if (problem) {
      setErr(problem);
      inputRef.current?.focus();
      return;
    }
    props.onSave(code);
    setEditing(false);
  };

  return (
    <form
      className="lbv-class-form"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <label className="lbv-label" htmlFor="lbv-class-input">Class code</label>
      <div className="lbv-class-row">
        <input
          id="lbv-class-input"
          ref={inputRef}
          className="lbv-input lbv-class-input"
          value={value}
          onChange={(e) => {
            setValue(normalizeGroupCode(e.target.value).slice(0, GROUP_MAX_LENGTH));
            if (err) setErr("");
          }}
          placeholder="e.g. 5B"
          maxLength={GROUP_MAX_LENGTH}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          aria-invalid={Boolean(err)}
          aria-describedby="lbv-class-help"
        />
        <button type="submit" className="lbv-btn lbv-btn-sm">Save</button>
      </div>
      <div id="lbv-class-help" className={err ? "lbv-form-error" : "lbv-hint lbv-hint-left"} role={err ? "alert" : undefined}>
        {err || "Ask your teacher for your class code (letters and numbers)."}
      </div>
      <div className="lbv-class-actions">
        {group && (
          <button
            type="button"
            className="lbv-link"
            onClick={() => {
              props.onLeave();
              setEditing(false);
            }}
          >
            Leave class {group}
          </button>
        )}
        <button type="button" className="lbv-link" onClick={() => setEditing(false)}>
          Cancel
        </button>
      </div>
    </form>
  );
}

/** Full stats + every badge for one player (opened by tapping a row). */
function PlayerDetails(props: { player: PlayerRecord; rank: number; boardLabel: string }) {
  const { player: p, rank, boardLabel } = props;
  const earned = new Set(mergeBadgeIds(p.badges));
  const stats: [string, React.ReactNode][] = [
    ["Rank", `#${rank}`],
    ["Points", p.points],
    ["Played", p.gamesPlayed],
    ["Wins", p.wins],
    ["Win %", formatWinPct(p)],
    ["Avg guesses", formatAvg(p.avgGuessesOnWins)],
    ["Best win", p.bestGuesses != null ? `${p.bestGuesses} guess${p.bestGuesses === 1 ? "" : "es"}` : "-"],
    ["Win streak", `${p.currentStreak} (best ${p.bestStreak})`],
    ["Hints used", p.hintsUsed ?? 0]
  ];
  return (
    <div className="lbv-detail">
      <p className="lbv-detail-board">{boardLabel}</p>
      <dl className="lbv-detail-stats">
        {stats.map(([label, value]) => (
          <div key={label} className="lbv-detail-stat">
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <h3 className="lbv-detail-heading">Badges ({earned.size}/{BADGES.length})</h3>
      <ul className="lbv-detail-badges">
        {BADGES.map((b) => {
          const has = earned.has(b.id);
          return (
            <li key={b.id} className={has ? "is-earned" : "is-locked"}>
              <span className="lbv-detail-badge-emoji" aria-hidden="true">{b.emoji}</span>
              <span className="lbv-detail-badge-text">
                <strong>{b.name}</strong>
                <span>{b.description}</span>
              </span>
              <span className="lbv-detail-badge-state">{has ? "Earned" : "Not yet"}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Leaderboard contents: tabs, points explainer, your rank, scrollable table, class control, quote. */
export function LeaderboardBody(props: {
  board: LeaderboardState;
  highlightKey?: string | null;
  notice?: string | null;
  onChangeName?: () => void;
  /** Retry handler; defaults to reloading the current board. */
  onRetry?: () => void;
}) {
  const { board, highlightKey } = props;
  const { players, loading, error, scope } = board;
  const [group, setGroup] = useState<string | null>(() => getSavedGroup());
  const [classNotice, setClassNotice] = useState<string | null>(null);
  const [selected, setSelected] = useState<{ player: PlayerRecord; rank: number } | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const goat = players.length > 0 ? players[0].displayName : null;
  const myIndex = highlightKey ? players.findIndex((p) => p.key === highlightKey) : -1;
  const me = myIndex >= 0 ? players[myIndex] : null;
  const quote = getRohanQuote();
  const showTable = players.length > 0 && !error;
  const boardLabel = scope ? `Class ${scope}` : "Everyone";
  const rankMsg = board.rankChange && board.rankChange.scope === scope ? rankChangeMessage(board.rankChange) : null;

  const joinClass = async (code: string) => {
    saveGroup(code);
    setGroup(code);
    setClassNotice(`You joined class ${code}. Your games will count on the ${code} board.`);
    // If today's game is already on the board, file it under the new class too.
    const name = getSavedName();
    const today = getDateKey();
    if (name && getSubmittedDateKey() === today) await assignGroupToDay(name, today, code);
    void board.load(code);
  };

  const leaveClass = () => {
    clearSavedGroup();
    setGroup(null);
    setClassNotice("You left your class. Your games will only count on the Everyone board.");
    if (scope) void board.load(null);
  };

  let status: React.ReactNode = null;
  if (error) {
    status = (
      <div className="lbv-status lbv-error" role="alert">
        <div>{error}</div>
        <button type="button" className="lbv-btn" onClick={props.onRetry ?? (() => void board.reload())} disabled={loading}>
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
    status = (
      <div className="lbv-status">
        {scope
          ? `No games for class ${scope} yet. Finish today’s game to put your class on the board!`
          : "No entries yet. Finish a game to get on the board!"}
      </div>
    );
  }

  return (
    <>
      <BoardTabs group={group} scope={scope} onPick={(s) => s !== scope && void board.load(s)} />
      <div className="lbv-intro">
        <p className="lbv-explain">
          Win in fewer guesses = more points. 1 guess = 6 pts {"…"} 6 guesses = 1 pt. Hint used = {"−"}1 pt.
        </p>
        {rankMsg && (
          <div className="lbv-rank-msg" role="status" key={board.moveToken}>
            {rankMsg}
            {scope ? ` in class ${scope}` : ""}
          </div>
        )}
        {goat && showTable && <div className="lbv-goat">Gavindler #1 GOAT: {goat}</div>}
        {me && showTable && (
          <div className="lbv-me">
            You{"’"}re <strong>#{myIndex + 1}</strong> of {players.length} with <strong>{me.points} pts</strong>
            {me.currentStreak > 0 ? ` · ${me.currentStreak}-day streak` : ""}
            {me.bestStreak > 0 ? ` (best ${me.bestStreak})` : ""}
          </div>
        )}
        {props.notice && <div className="lbv-notice">{props.notice}</div>}
        {classNotice && <div className="lbv-notice" role="status">{classNotice}</div>}
        {loading && players.length > 0 && !error && (
          <div className="lbv-refreshing" role="status">
            <span className="lbv-spinner lbv-spinner-sm" aria-hidden="true" /> Updating...
          </div>
        )}
      </div>

      {status ?? (
        <LeaderboardTable
          players={players}
          highlightKey={highlightKey}
          moveToken={board.moveToken}
          onSelect={(player, rank) => {
            setSelected({ player, rank });
            setDetailOpen(true);
          }}
        />
      )}

      <div className="lbv-footer">
        <div className="lbv-footer-links">
          <ClassControl group={group} onSave={(c) => void joinClass(c)} onLeave={leaveClass} />
          {props.onChangeName && (
            <button type="button" className="lbv-link" onClick={props.onChangeName}>
              Not you? Change name
            </button>
          )}
        </div>
        <div className="lbv-quote">Rohan Quote of the day: {quote}</div>
      </div>

      <Modal
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        title={selected?.player.displayName ?? ""}
        size="sm"
        closeLabel="Close player details"
      >
        {selected && <PlayerDetails player={selected.player} rank={selected.rank} boardLabel={boardLabel} />}
      </Modal>
    </>
  );
}

/** The full leaderboard dialog (shell + contents), used by the header button. */
export default function LeaderboardView(
  props: React.ComponentProps<typeof LeaderboardBody> & { open: boolean; onClose: () => void }
) {
  const { open, onClose, ...body } = props;
  return (
    <Modal open={open} onClose={onClose} title="LEADERBOARD" className="lbv-panel">
      <LeaderboardBody {...body} />
    </Modal>
  );
}
