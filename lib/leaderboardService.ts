import {
  cleanName,
  normalizeName,
  pointsForGame,
  sortPlayersForLeaderboard,
  type GameResult,
  type LeaderboardFile,
  type PlayerRecord
} from "@/lib/leaderboardClient";
import { getDateKey } from "@/lib/storage";
import { supabase } from "@/lib/supabase";

type SubmitInput = {
  dateKey: string;
  name: string;
  result: GameResult;
  guesses: number | null;
};

type ResultRow = {
  date_key: string;
  player_key: string;
  display_name: string;
  result: string;
  guesses: number | null;
  created_at: string;
};

const PAGE_SIZE = 1000;
const OFFLINE_MESSAGE = "The leaderboard is having trouble right now. Please try again in a minute.";
const DAY_MS = 24 * 60 * 60 * 1000;

type GameRow = { dateKey: string; result: string; guesses: number | null; created_at: string };

/** Converts a YYYY-MM-DD date key to a whole day number (null when malformed). */
function dayNumber(dateKey: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateKey ?? ""));
  if (!m) return null;
  return Math.round(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / DAY_MS);
}

/**
 * Streaks are measured in calendar days (date_key, America/New_York): consecutive
 * days with a win. A missed day or a loss breaks the streak. The current streak is
 * only alive when the most recent win was today or yesterday and nothing after it
 * was a loss.
 */
function computeStreaks(rows: GameRow[], todayDay: number | null): { currentStreak: number; bestStreak: number } {
  const winDays = new Set<number>();
  let lastLossDay: number | null = null;
  for (const row of rows) {
    const d = dayNumber(row.dateKey);
    if (d == null) continue;
    if (row.result === "win") winDays.add(d);
    else if (lastLossDay == null || d > lastLossDay) lastLossDay = d;
  }
  if (winDays.size === 0) return { currentStreak: 0, bestStreak: 0 };

  const days = Array.from(winDays).sort((a, b) => a - b);
  let bestStreak = 0;
  let run = 0;
  let prev: number | null = null;
  for (const d of days) {
    run = prev != null && d - prev === 1 ? run + 1 : 1;
    bestStreak = Math.max(bestStreak, run);
    prev = d;
  }

  const lastWin = days[days.length - 1];
  const alive =
    todayDay != null &&
    todayDay - lastWin <= 1 &&
    todayDay - lastWin >= 0 &&
    (lastLossDay == null || lastLossDay < lastWin);
  return { currentStreak: alive ? run : 0, bestStreak };
}

function computePlayerStats(rows: GameRow[], todayDay: number | null): Omit<PlayerRecord, "key" | "displayName"> {
  let gamesPlayed = 0;
  let wins = 0;
  let losses = 0;
  let points = 0;
  let totalGuessesInWins = 0;
  let bestGuesses: number | null = null;
  let lastPlayedAt: string | null = null;

  for (const row of rows) {
    gamesPlayed += 1;
    if (row.result === "win") {
      wins += 1;
      const g = row.guesses ?? 6;
      totalGuessesInWins += g;
      bestGuesses = bestGuesses == null ? g : Math.min(bestGuesses, g);
      points += pointsForGame("win", row.guesses);
    } else {
      losses += 1;
    }
    if (!lastPlayedAt || new Date(row.created_at).getTime() > new Date(lastPlayedAt).getTime()) {
      lastPlayedAt = row.created_at;
    }
  }

  const { currentStreak, bestStreak } = computeStreaks(rows, todayDay);
  const winPercentage = gamesPlayed > 0 ? (wins / gamesPlayed) * 100 : 0;
  const avgGuessesOnWins = wins > 0 ? totalGuessesInWins / wins : null;

  return {
    gamesPlayed,
    wins,
    losses,
    winPercentage,
    points,
    bestGuesses,
    totalGuessesInWins,
    avgGuessesOnWins,
    currentStreak,
    bestStreak,
    lastPlayedAt
  };
}

function aggregateResults(rows: ResultRow[]): Record<string, PlayerRecord> {
  const byPlayer: Record<string, GameRow[]> = {};
  const displayNames: Record<string, string> = {};

  // Rows arrive ordered by created_at, so the latest display name wins.
  for (const r of rows) {
    const k = r.player_key;
    if (!byPlayer[k]) byPlayer[k] = [];
    byPlayer[k].push({ dateKey: r.date_key, result: r.result, guesses: r.guesses, created_at: r.created_at });
    displayNames[k] = r.display_name;
  }

  const todayDay = dayNumber(getDateKey());
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

export async function fetchLeaderboard(): Promise<LeaderboardFile> {
  if (!supabase) throw new Error(OFFLINE_MESSAGE);

  // Supabase caps each response at 1000 rows, so page through everything.
  const rows: ResultRow[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    let res;
    try {
      res = await supabase
        .from("game_results")
        .select("date_key, player_key, display_name, result, guesses, created_at")
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
        .range(from, from + PAGE_SIZE - 1);
    } catch {
      throw new Error(OFFLINE_MESSAGE);
    }
    if (res.error) throw new Error(OFFLINE_MESSAGE);
    const page = (res.data ?? []) as ResultRow[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  const players = aggregateResults(rows);

  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    players
  };
}

export async function submitResult(input: SubmitInput): Promise<LeaderboardFile> {
  const rawName = cleanName(input.name);
  const key = normalizeName(rawName);
  if (!key) throw new Error("Name is required.");
  if (input.result !== "win" && input.result !== "loss") throw new Error('Result must be "win" or "loss".');

  if (input.result === "win") {
    const g = input.guesses;
    if (typeof g !== "number" || !Number.isInteger(g) || g < 1 || g > 6) {
      throw new Error("Guesses must be an integer from 1 to 6 for a win.");
    }
  } else {
    const g = input.guesses;
    if (!(g == null || g === 6)) throw new Error("For a loss, guesses must be 6 or omitted.");
  }

  if (!supabase) throw new Error(OFFLINE_MESSAGE);

  let error;
  try {
    ({ error } = await supabase.from("game_results").upsert(
      {
        date_key: input.dateKey,
        player_key: key,
        display_name: rawName || key,
        result: input.result,
        guesses: input.result === "win" ? input.guesses : null
      },
      { onConflict: "date_key,player_key" }
    ));
  } catch {
    throw new Error(OFFLINE_MESSAGE);
  }

  if (error) throw new Error(OFFLINE_MESSAGE);

  return fetchLeaderboard();
}

// One submission per finished game (date key) per page load, even if several
// callers (auto-submit, button, React strict-mode double effects) race.
const inFlightSubmissions = new Map<string, Promise<LeaderboardFile>>();

export function submitResultOnce(input: SubmitInput): Promise<LeaderboardFile> {
  const existing = inFlightSubmissions.get(input.dateKey);
  if (existing) return existing;
  const p = submitResult(input).catch((e) => {
    // Allow a retry after a failure.
    inFlightSubmissions.delete(input.dateKey);
    throw e;
  });
  inFlightSubmissions.set(input.dateKey, p);
  return p;
}

export function leaderboardRows(lb: LeaderboardFile): PlayerRecord[] {
  return sortPlayersForLeaderboard(Object.values(lb.players || {}));
}
