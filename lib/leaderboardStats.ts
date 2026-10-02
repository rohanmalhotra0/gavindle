/**
 * Pure leaderboard math (no network, no DOM): per-player stats, streaks, points,
 * badges and rank changes, computed from raw `game_results` rows.
 */
import { pointsForGame, sortPlayersForLeaderboard, type PlayerRecord } from "@/lib/leaderboardClient";
import { earnedBadgeIds, type BadgeFacts } from "@/lib/badges";

/** One `game_results` row as selected by the leaderboard. */
export type ResultRow = {
  date_key: string;
  player_key: string;
  display_name: string;
  result: string;
  guesses: number | null;
  created_at: string;
  hint_used?: boolean | null;
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** Converts a YYYY-MM-DD date key to a whole day number (null when malformed). */
export function dayNumber(dateKey: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateKey ?? ""));
  if (!m) return null;
  return Math.round(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / DAY_MS);
}

/** Sorted unique day numbers plus the longest run of consecutive days. */
function longestRun(days: Set<number>): { sorted: number[]; best: number; lastRun: number } {
  const sorted = Array.from(days).sort((a, b) => a - b);
  let best = 0;
  let run = 0;
  let prev: number | null = null;
  for (const d of sorted) {
    run = prev != null && d - prev === 1 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  return { sorted, best, lastRun: run };
}

/**
 * Streaks are measured in calendar days (date_key, America/New_York): consecutive
 * days with a win. A missed day or a loss breaks the streak. The current streak is
 * only alive when the most recent win was today or yesterday and nothing after it
 * was a loss.
 */
export function computeStreaks(
  rows: Pick<ResultRow, "date_key" | "result">[],
  todayDay: number | null
): { currentStreak: number; bestStreak: number } {
  const winDays = new Set<number>();
  let lastLossDay: number | null = null;
  for (const row of rows) {
    const d = dayNumber(row.date_key);
    if (d == null) continue;
    if (row.result === "win") winDays.add(d);
    else if (lastLossDay == null || d > lastLossDay) lastLossDay = d;
  }
  if (winDays.size === 0) return { currentStreak: 0, bestStreak: 0 };

  const { sorted, best, lastRun } = longestRun(winDays);
  const lastWin = sorted[sorted.length - 1];
  const alive =
    todayDay != null &&
    todayDay - lastWin <= 1 &&
    todayDay - lastWin >= 0 &&
    (lastLossDay == null || lastLossDay < lastWin);
  return { currentStreak: alive ? lastRun : 0, bestStreak: best };
}

/** Numbers the badge rules need, from one player's rows. */
export function computeBadgeFacts(rows: ResultRow[]): BadgeFacts {
  const playDays = new Set<number>();
  const winDays = new Set<number>();
  let wins = 0;
  let winsWithoutHint = 0;
  let bestGuesses: number | null = null;
  for (const row of rows) {
    const d = dayNumber(row.date_key);
    if (d != null) playDays.add(d);
    if (row.result === "win") {
      wins += 1;
      if (!row.hint_used) winsWithoutHint += 1;
      if (d != null) winDays.add(d);
      const g = row.guesses ?? 6;
      bestGuesses = bestGuesses == null ? g : Math.min(bestGuesses, g);
    }
  }
  return {
    gamesPlayed: rows.length,
    daysPlayed: playDays.size,
    wins,
    winsWithoutHint,
    bestGuesses,
    bestWinStreak: longestRun(winDays).best,
    bestPlayStreak: longestRun(playDays).best
  };
}

export function computePlayerStats(
  rows: ResultRow[],
  todayDay: number | null
): Omit<PlayerRecord, "key" | "displayName"> {
  let gamesPlayed = 0;
  let wins = 0;
  let losses = 0;
  let points = 0;
  let hintsUsed = 0;
  let totalGuessesInWins = 0;
  let bestGuesses: number | null = null;
  let lastPlayedAt: string | null = null;

  for (const row of rows) {
    gamesPlayed += 1;
    if (row.hint_used) hintsUsed += 1;
    if (row.result === "win") {
      wins += 1;
      const g = row.guesses ?? 6;
      totalGuessesInWins += g;
      bestGuesses = bestGuesses == null ? g : Math.min(bestGuesses, g);
      points += pointsForGame("win", row.guesses, Boolean(row.hint_used));
    } else {
      losses += 1;
    }
    if (!lastPlayedAt || new Date(row.created_at).getTime() > new Date(lastPlayedAt).getTime()) {
      lastPlayedAt = row.created_at;
    }
  }

  const { currentStreak, bestStreak } = computeStreaks(rows, todayDay);
  return {
    gamesPlayed,
    wins,
    losses,
    winPercentage: gamesPlayed > 0 ? (wins / gamesPlayed) * 100 : 0,
    points,
    bestGuesses,
    totalGuessesInWins,
    avgGuessesOnWins: wins > 0 ? totalGuessesInWins / wins : null,
    currentStreak,
    bestStreak,
    lastPlayedAt,
    hintsUsed,
    badges: earnedBadgeIds(computeBadgeFacts(rows))
  };
}

/** Group rows by player and compute everyone's stats. Rows should be ordered by created_at. */
export function aggregateResults(rows: ResultRow[], todayKey: string): Record<string, PlayerRecord> {
  const byPlayer: Record<string, ResultRow[]> = {};
  const displayNames: Record<string, string> = {};

  // Rows arrive ordered by created_at, so the latest display name wins.
  for (const r of rows) {
    const k = r.player_key;
    if (!byPlayer[k]) byPlayer[k] = [];
    byPlayer[k].push(r);
    displayNames[k] = r.display_name;
  }

  const todayDay = dayNumber(todayKey);
  const players: Record<string, PlayerRecord> = {};
  for (const [key, gameRows] of Object.entries(byPlayer)) {
    players[key] = {
      ...computePlayerStats(gameRows, todayDay),
      key,
      displayName: displayNames[key] ?? key
    };
  }
  return players;
}

/** Ranked list (best first). */
export function rankPlayers(players: Record<string, PlayerRecord>): PlayerRecord[] {
  return sortPlayersForLeaderboard(Object.values(players));
}

export type RankChange =
  | { kind: "new"; rank: number }
  | { kind: "up"; rank: number; by: number }
  | { kind: "down"; rank: number; by: number }
  | { kind: "same"; rank: number };

/**
 * Compare a player's position before and after a submission. `before` is null when
 * the pre-submit board couldn't be loaded (then nothing is claimed about movement
 * unless they're clearly new). Returns null when the player isn't on the new board.
 */
export function computeRankChange(
  before: PlayerRecord[] | null,
  after: PlayerRecord[],
  playerKey: string
): RankChange | null {
  const afterIdx = after.findIndex((p) => p.key === playerKey);
  if (afterIdx < 0) return null;
  const rank = afterIdx + 1;
  if (!before) return { kind: "same", rank };
  const beforeIdx = before.findIndex((p) => p.key === playerKey);
  if (beforeIdx < 0) return { kind: "new", rank };
  const prevRank = beforeIdx + 1;
  if (rank < prevRank) return { kind: "up", rank, by: prevRank - rank };
  if (rank > prevRank) return { kind: "down", rank, by: rank - prevRank };
  return { kind: "same", rank };
}

export function rankChangeMessage(change: RankChange): string {
  const spots = (n: number) => `${n} spot${n === 1 ? "" : "s"}`;
  switch (change.kind) {
    case "new":
      return `New on the board! You’re #${change.rank}`;
    case "up":
      return `⬆ You moved up ${spots(change.by)}! Now #${change.rank}`;
    case "down":
      return `Now at #${change.rank}`;
    case "same":
      return `Holding at #${change.rank}`;
  }
}
