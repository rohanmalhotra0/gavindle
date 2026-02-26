import {
  sortPlayersForLeaderboard,
  type GameResult,
  type LeaderboardFile,
  type PlayerRecord
} from "@/lib/leaderboardClient";
import { supabase } from "@/lib/supabase";

type SubmitInput = {
  dateKey: string;
  name: string;
  result: GameResult;
  guesses: number | null;
};

function normalizeName(name: string): string {
  return String(name).trim().toLowerCase().replace(/\s+/g, " ");
}

type GameRow = { result: string; guesses: number | null; created_at: string };

function computePlayerStats(rows: GameRow[]): Omit<PlayerRecord, "key" | "displayName"> {
  let gamesPlayed = 0;
  let wins = 0;
  let losses = 0;
  let totalGuessesInWins = 0;
  let bestGuesses: number | null = null;
  let currentStreak = 0;
  let bestStreak = 0;

  const sorted = [...rows].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  const sortedDesc = [...sorted].reverse();

  let run = 0;
  for (const row of sorted) {
    gamesPlayed += 1;
    if (row.result === "win") {
      wins += 1;
      const g = row.guesses ?? 0;
      totalGuessesInWins += g;
      bestGuesses = bestGuesses == null ? g : Math.min(bestGuesses, g);
      run += 1;
      bestStreak = Math.max(bestStreak, run);
    } else {
      losses += 1;
      run = 0;
    }
  }

  for (const row of sortedDesc) {
    if (row.result === "win") currentStreak += 1;
    else break;
  }

  const winPercentage = gamesPlayed > 0 ? (wins / gamesPlayed) * 100 : 0;
  const avgGuessesOnWins = wins > 0 ? totalGuessesInWins / wins : null;

  return {
    gamesPlayed,
    wins,
    losses,
    winPercentage,
    bestGuesses,
    totalGuessesInWins,
    avgGuessesOnWins,
    currentStreak,
    bestStreak,
    lastPlayedAt: sorted.length > 0 ? sorted[sorted.length - 1].created_at : null
  };
}

function aggregateResults(
  rows: { player_key: string; display_name: string; result: string; guesses: number | null; created_at: string }[]
): Record<string, PlayerRecord> {
  const byPlayer: Record<string, GameRow[]> = {};
  const displayNames: Record<string, string> = {};

  for (const r of rows) {
    const k = r.player_key;
    if (!byPlayer[k]) byPlayer[k] = [];
    byPlayer[k].push({ result: r.result, guesses: r.guesses, created_at: r.created_at });
    displayNames[k] = r.display_name;
  }

  const players: Record<string, PlayerRecord> = {};
  for (const [key, gameRows] of Object.entries(byPlayer)) {
    const base = computePlayerStats(gameRows);
    players[key] = {
      ...base,
      key,
      displayName: displayNames[key] ?? key
    };
  }
  return players;
}

export async function fetchLeaderboard(): Promise<LeaderboardFile> {
  if (!supabase) {
    return { version: 1, updatedAt: new Date().toISOString(), players: {} };
  }

  const { data, error } = await supabase
    .from("game_results")
    .select("player_key, display_name, result, guesses, created_at")
    .order("created_at", { ascending: true });

  if (error) throw new Error(`Leaderboard fetch failed: ${error.message}`);

  const rows = (data ?? []) as {
    player_key: string;
    display_name: string;
    result: string;
    guesses: number | null;
    created_at: string;
  }[];
  const players = aggregateResults(rows);

  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    players
  };
}

export async function submitResult(input: SubmitInput): Promise<LeaderboardFile> {
  const rawName = String(input.name ?? "").trim();
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

  if (!supabase) throw new Error("Supabase is not configured.");

  const { error } = await supabase.from("game_results").upsert(
    {
      date_key: input.dateKey,
      player_key: key,
      display_name: rawName || key,
      result: input.result,
      guesses: input.result === "win" ? input.guesses : null
    },
    { onConflict: "date_key,player_key" }
  );

  if (error) throw new Error(`Leaderboard submit failed: ${error.message}`);

  return fetchLeaderboard();
}

export function leaderboardRows(lb: LeaderboardFile): PlayerRecord[] {
  return sortPlayersForLeaderboard(Object.values(lb.players || {}));
}
