import {
  loadLeaderboard,
  saveLeaderboard,
  sortPlayersForLeaderboard,
  upsertPlayerResult,
  type GameResult,
  type LeaderboardFile,
  type PlayerRecord
} from "@/lib/leaderboardClient";

const ENDPOINT = (process.env.NEXT_PUBLIC_LEADERBOARD_ENDPOINT || "").replace(/\/+$/, "");

type SubmitInput = {
  dateKey: string;
  name: string;
  result: GameResult;
  guesses: number | null;
};

async function safeJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`Bad JSON from server (${res.status}).`);
  }
}

export async function fetchLeaderboard(): Promise<LeaderboardFile> {
  if (!ENDPOINT) return loadLeaderboard();
  const res = await fetch(`${ENDPOINT}/leaderboard`, { method: "GET" });
  if (!res.ok) throw new Error(`Leaderboard fetch failed (${res.status}).`);
  return safeJson<LeaderboardFile>(res);
}

export async function submitResult(input: SubmitInput): Promise<LeaderboardFile> {
  if (!ENDPOINT) {
    const lb = loadLeaderboard();
    const next = upsertPlayerResult(lb, {
      name: input.name,
      result: input.result,
      guesses: input.result === "win" ? input.guesses : input.guesses ?? null
    });
    saveLeaderboard(next);
    return next;
  }

  const res = await fetch(`${ENDPOINT}/leaderboard`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input)
  });
  if (!res.ok) throw new Error(`Leaderboard submit failed (${res.status}).`);
  return safeJson<LeaderboardFile>(res);
}

export function leaderboardRows(lb: LeaderboardFile): PlayerRecord[] {
  return sortPlayersForLeaderboard(Object.values(lb.players || {}));
}

