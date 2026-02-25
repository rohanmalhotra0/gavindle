export type GameResult = "win" | "loss";

export type PlayerRecord = {
  key: string;
  displayName: string;
  gamesPlayed: number;
  wins: number;
  losses: number;
  winPercentage: number; // derived
  bestGuesses: number | null;
  totalGuessesInWins: number;
  avgGuessesOnWins: number | null; // derived
  currentStreak: number;
  bestStreak: number;
  lastPlayedAt: string | null;
};

export type LeaderboardFile = {
  version: 1;
  updatedAt: string;
  players: Record<string, PlayerRecord>;
};

const LEADERBOARD_KEY = "gavindle:leaderboard";
const CORRUPT_PREFIX = "gavindle:leaderboard:corrupt:";
export const LEADERBOARD_SUBMITTED_DATE_KEY = "gavindle:leaderboard:submittedDateKey";

export function normalizeName(name: string): string {
  return String(name).trim().toLowerCase().replace(/\s+/g, " ");
}

export function computeDerivedStats(player: PlayerRecord): Pick<
  PlayerRecord,
  "winPercentage" | "avgGuessesOnWins" | "bestGuesses"
> {
  const gamesPlayed = Number.isFinite(player.gamesPlayed) ? player.gamesPlayed : 0;
  const wins = Number.isFinite(player.wins) ? player.wins : 0;
  const totalGuessesInWins = Number.isFinite(player.totalGuessesInWins) ? player.totalGuessesInWins : 0;

  const winPercentage = gamesPlayed > 0 ? (wins / gamesPlayed) * 100 : 0;
  const avgGuessesOnWins = wins > 0 ? totalGuessesInWins / wins : null;
  const bestGuesses = wins > 0 && Number.isFinite(player.bestGuesses) ? (player.bestGuesses as number) : null;

  return { winPercentage, avgGuessesOnWins, bestGuesses };
}

function emptyLeaderboard(): LeaderboardFile {
  return { version: 1, updatedAt: new Date().toISOString(), players: {} };
}

function isLeaderboardFile(maybe: unknown): maybe is LeaderboardFile {
  if (!maybe || typeof maybe !== "object") return false;
  const obj = maybe as any;
  if (obj.version !== 1) return false;
  if (!obj.players || typeof obj.players !== "object") return false;
  return true;
}

export function loadLeaderboard(): LeaderboardFile {
  if (typeof window === "undefined") return emptyLeaderboard();
  try {
    const raw = window.localStorage.getItem(LEADERBOARD_KEY);
    if (!raw) return emptyLeaderboard();
    const parsed = JSON.parse(raw) as unknown;
    if (!isLeaderboardFile(parsed)) throw new Error("Invalid leaderboard shape");
    return parsed;
  } catch {
    try {
      const raw = window.localStorage.getItem(LEADERBOARD_KEY);
      if (raw) window.localStorage.setItem(`${CORRUPT_PREFIX}${new Date().toISOString()}`, raw);
    } catch {
      // ignore
    }
    try {
      window.localStorage.removeItem(LEADERBOARD_KEY);
    } catch {
      // ignore
    }
    return emptyLeaderboard();
  }
}

export function saveLeaderboard(lb: LeaderboardFile) {
  if (typeof window === "undefined") return;
  const next: LeaderboardFile = {
    version: 1,
    updatedAt: new Date().toISOString(),
    players: lb.players || {}
  };

  for (const key of Object.keys(next.players)) {
    const p = next.players[key];
    next.players[key] = { ...p, ...computeDerivedStats(p), key };
  }

  try {
    window.localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

export function upsertPlayerResult(
  leaderboard: LeaderboardFile,
  input: { name: string; result: GameResult; guesses?: number | null }
): LeaderboardFile {
  const rawName = String(input.name ?? "");
  const key = normalizeName(rawName);
  if (!key) throw new Error("Name is required.");

  const result = input.result;
  if (result !== "win" && result !== "loss") throw new Error('Result must be "win" or "loss".');

  const nowIso = new Date().toISOString();
  const players = leaderboard.players || {};

  const existing: PlayerRecord = players[key] || {
    key,
    displayName: rawName.trim() || key,
    gamesPlayed: 0,
    wins: 0,
    losses: 0,
    winPercentage: 0,
    bestGuesses: null,
    totalGuessesInWins: 0,
    avgGuessesOnWins: null,
    currentStreak: 0,
    bestStreak: 0,
    lastPlayedAt: null
  };

  existing.displayName = rawName.trim() || existing.displayName;
  existing.gamesPlayed += 1;
  existing.lastPlayedAt = nowIso;

  if (result === "win") {
    const guesses = input.guesses;
    if (typeof guesses !== "number" || !Number.isInteger(guesses) || guesses < 1 || guesses > 6) {
      throw new Error("Guesses must be an integer from 1 to 6 for a win.");
    }
    existing.wins += 1;
    existing.totalGuessesInWins += guesses;
    existing.bestGuesses = existing.bestGuesses == null ? guesses : Math.min(existing.bestGuesses, guesses);
    existing.currentStreak += 1;
    existing.bestStreak = Math.max(existing.bestStreak, existing.currentStreak);
  } else {
    const guesses = input.guesses;
    if (!(guesses == null || guesses === 6)) {
      throw new Error("For a loss, guesses must be 6 or omitted.");
    }
    existing.losses += 1;
    existing.currentStreak = 0;
  }

  const derived = computeDerivedStats(existing);
  const nextPlayers = { ...players, [key]: { ...existing, ...derived, key } };

  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    players: nextPlayers
  };
}

export function sortPlayersForLeaderboard(players: PlayerRecord[]): PlayerRecord[] {
  const nullsLastAsc = (a: number | null, b: number | null) => {
    const aNull = a == null;
    const bNull = b == null;
    if (aNull && bNull) return 0;
    if (aNull) return 1;
    if (bNull) return -1;
    return a - b;
  };

  return players.sort((pa, pb) => {
    if (pb.winPercentage !== pa.winPercentage) return pb.winPercentage - pa.winPercentage;
    if (pb.gamesPlayed !== pa.gamesPlayed) return pb.gamesPlayed - pa.gamesPlayed;
    const bestCmp = nullsLastAsc(pa.bestGuesses, pb.bestGuesses);
    if (bestCmp !== 0) return bestCmp;
    const avgCmp = nullsLastAsc(pa.avgGuessesOnWins, pb.avgGuessesOnWins);
    if (avgCmp !== 0) return avgCmp;
    return 0;
  });
}

