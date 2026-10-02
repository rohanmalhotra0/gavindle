import {
  cleanName,
  isValidGroupCode,
  normalizeGroupCode,
  normalizeName,
  sortPlayersForLeaderboard,
  type GameResult,
  type LeaderboardFile,
  type PlayerRecord
} from "@/lib/leaderboardClient";
import { mergeBadgeIds } from "@/lib/badges";
import { aggregateResults, type ResultRow } from "@/lib/leaderboardStats";
import { getDateKey } from "@/lib/storage";
import { supabase } from "@/lib/supabase";

export type SubmitInput = {
  dateKey: string;
  name: string;
  result: GameResult;
  guesses: number | null;
  hintUsed?: boolean;
  /** Class/group code to file this game under (null/omitted = no group). */
  groupCode?: string | null;
};

const PAGE_SIZE = 1000;
const OFFLINE_MESSAGE = "The leaderboard is having trouble right now. Please try again in a minute.";
const SELECT_COLUMNS = "date_key, player_key, display_name, result, guesses, created_at, hint_used";
const SELECT_COLUMNS_LEGACY = "date_key, player_key, display_name, result, guesses, created_at";

// Badges are earned over a player's whole history. A class board only loads that
// class's rows, so remember the badges from the last "Everyone" load and merge them in.
const allTimeBadges = new Map<string, string[]>();

/** True when the error says a column doesn't exist yet (migration not applied). */
function isMissingColumnError(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  return error.code === "42703" || error.code === "PGRST204" || /column/i.test(error.message ?? "");
}

function cleanGroup(code: string | null | undefined): string | null {
  if (!code) return null;
  const c = normalizeGroupCode(code);
  return isValidGroupCode(c) ? c : null;
}

async function fetchRows(group: string | null): Promise<ResultRow[]> {
  if (!supabase) throw new Error(OFFLINE_MESSAGE);
  const client = supabase;
  let columns = SELECT_COLUMNS;

  // Supabase caps each response at 1000 rows, so page through everything.
  const rows: ResultRow[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    let res;
    try {
      let q = client.from("game_results").select(columns);
      if (group) q = q.eq("group_code", group);
      res = await q
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
        .range(from, from + PAGE_SIZE - 1);
    } catch {
      throw new Error(OFFLINE_MESSAGE);
    }
    if (res.error) {
      // Older database without hint_used: still show the "Everyone" board.
      if (!group && columns === SELECT_COLUMNS && from === 0 && isMissingColumnError(res.error)) {
        columns = SELECT_COLUMNS_LEGACY;
        from -= PAGE_SIZE;
        continue;
      }
      throw new Error(OFFLINE_MESSAGE);
    }
    const page = (res.data ?? []) as unknown as ResultRow[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return rows;
}

/**
 * Load the leaderboard. With a group code, only games submitted with that code
 * count (filtered server-side); without one, everyone's games count.
 */
export async function fetchLeaderboard(group?: string | null): Promise<LeaderboardFile> {
  const code = cleanGroup(group);
  const rows = await fetchRows(code);
  const players = aggregateResults(rows, getDateKey());

  for (const p of Object.values(players)) {
    if (code) {
      p.badges = mergeBadgeIds(p.badges, allTimeBadges.get(p.key));
    } else {
      allTimeBadges.set(p.key, p.badges ?? []);
    }
  }

  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    players,
    group: code
  };
}

/** Validate and write one finished game (upsert on date_key + player_key). */
export async function saveResult(input: SubmitInput): Promise<void> {
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
  const client = supabase;

  const base = {
    date_key: input.dateKey,
    player_key: key,
    display_name: rawName || key,
    result: input.result,
    guesses: input.result === "win" ? input.guesses : null
  };
  const full = { ...base, hint_used: Boolean(input.hintUsed), group_code: cleanGroup(input.groupCode) };

  const upsert = async (row: object) => {
    try {
      return (await client.from("game_results").upsert(row, { onConflict: "date_key,player_key" })).error;
    } catch {
      throw new Error(OFFLINE_MESSAGE);
    }
  };

  let error = await upsert(full);
  // Older database without the new columns: still record the game.
  if (error && isMissingColumnError(error)) error = await upsert(base);
  if (error) throw new Error(OFFLINE_MESSAGE);
}

/** Save a game, then return the refreshed "Everyone" board. */
export async function submitResult(input: SubmitInput): Promise<LeaderboardFile> {
  await saveResult(input);
  return fetchLeaderboard();
}

// One submission per finished game (date key) per page load, even if several
// callers (auto-submit, button, React strict-mode double effects) race.
const inFlightSubmissions = new Map<string, Promise<void>>();

export function saveResultOnce(input: SubmitInput): Promise<void> {
  const existing = inFlightSubmissions.get(input.dateKey);
  if (existing) return existing;
  const p = saveResult(input).catch((e) => {
    // Allow a retry after a failure.
    inFlightSubmissions.delete(input.dateKey);
    throw e;
  });
  inFlightSubmissions.set(input.dateKey, p);
  return p;
}

export async function submitResultOnce(input: SubmitInput): Promise<LeaderboardFile> {
  await saveResultOnce(input);
  return fetchLeaderboard();
}

/**
 * After joining a class, file today's already-submitted game under it too, so the
 * class board isn't missing it. Only touches the player's own row for that day.
 */
export async function assignGroupToDay(name: string, dateKey: string, groupCode: string): Promise<void> {
  const key = normalizeName(cleanName(name));
  const code = cleanGroup(groupCode);
  if (!key || !code || !supabase) return;
  try {
    await supabase.from("game_results").update({ group_code: code }).eq("date_key", dateKey).eq("player_key", key);
  } catch {
    // Not critical: future games will carry the code.
  }
}

export function leaderboardRows(lb: LeaderboardFile): PlayerRecord[] {
  return sortPlayersForLeaderboard(Object.values(lb.players || {}));
}
