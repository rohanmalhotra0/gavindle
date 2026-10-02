export type GameResult = "win" | "loss";

export type PlayerRecord = {
  key: string;
  displayName: string;
  gamesPlayed: number;
  wins: number;
  losses: number;
  winPercentage: number; // derived
  points: number; // derived: each win earns (7 - guesses), minus 1 if a hint was used (min 0); a loss earns 0
  bestGuesses: number | null;
  totalGuessesInWins: number;
  avgGuessesOnWins: number | null; // derived
  currentStreak: number;
  bestStreak: number;
  lastPlayedAt: string | null;
  /** Games where the daily hint was used (server leaderboard only). */
  hintsUsed?: number;
  /** Earned badge ids, see lib/badges.ts (server leaderboard only). */
  badges?: string[];
};

export type LeaderboardFile = {
  version: 1;
  updatedAt: string;
  players: Record<string, PlayerRecord>;
  /** Group code this board is filtered to; null/undefined = everyone. */
  group?: string | null;
};

const LEADERBOARD_KEY = "gavindle:leaderboard";
const CORRUPT_PREFIX = "gavindle:leaderboard:corrupt:";
export const LEADERBOARD_SUBMITTED_DATE_KEY = "gavindle:leaderboard:submittedDateKey";

export const LEADERBOARD_NAME_KEY = "gavindle:leaderboard:name";
export const MAX_NAME_LENGTH = 20;

export function normalizeName(name: string): string {
  return String(name).trim().toLowerCase().replace(/\s+/g, " ");
}

/** Trim and collapse internal whitespace (keeps the player's casing). */
export function cleanName(name: string): string {
  return String(name ?? "").trim().replace(/\s+/g, " ");
}

/** Returns an error message for an invalid display name, or null when it is OK. */
export function validateName(name: string): string | null {
  const cleaned = cleanName(name);
  if (!cleaned) return "Please enter your name.";
  if (cleaned.length > MAX_NAME_LENGTH) return `Names can be at most ${MAX_NAME_LENGTH} characters.`;
  return null;
}

/**
 * Points for a single game: 1 guess = 6 pts ... 6 guesses = 1 pt, loss = 0.
 * Using the hint costs 1 point (never below 0).
 */
export function pointsForGame(result: string, guesses: number | null, hintUsed: boolean = false): number {
  if (result !== "win") return 0;
  const g = typeof guesses === "number" && Number.isFinite(guesses) ? Math.round(guesses) : 6;
  const base = 7 - Math.min(6, Math.max(1, g));
  return Math.max(0, base - (hintUsed ? 1 : 0));
}

// ---- Class / group code ----

export const GROUP_KEY = "gavindle:group";
export const GROUP_MIN_LENGTH = 2;
export const GROUP_MAX_LENGTH = 12;

/** Uppercase and drop anything that isn't A-Z or 0-9 ("5b " -> "5B"). */
export function normalizeGroupCode(code: string): string {
  return String(code ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** Error message for an invalid (already normalized) group code, or null when OK. */
export function validateGroupCode(code: string): string | null {
  if (code.length < GROUP_MIN_LENGTH) return `Class codes need at least ${GROUP_MIN_LENGTH} letters or numbers.`;
  if (code.length > GROUP_MAX_LENGTH) return `Class codes can be at most ${GROUP_MAX_LENGTH} characters.`;
  if (!/^[A-Z0-9]+$/.test(code)) return "Use only letters and numbers.";
  return null;
}

export function isValidGroupCode(code: unknown): code is string {
  return typeof code === "string" && /^[A-Z0-9]{2,12}$/.test(code);
}

export function getSavedGroup(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = normalizeGroupCode(window.localStorage.getItem(GROUP_KEY) ?? "");
    return isValidGroupCode(raw) ? raw : null;
  } catch {
    return null;
  }
}

export function saveGroup(code: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(GROUP_KEY, normalizeGroupCode(code));
  } catch {
    // ignore
  }
}

export function clearSavedGroup() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(GROUP_KEY);
  } catch {
    // ignore
  }
}

export function getSavedName(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const saved = cleanName(window.localStorage.getItem(LEADERBOARD_NAME_KEY) ?? "");
    return saved || null;
  } catch {
    return null;
  }
}

export function saveName(name: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LEADERBOARD_NAME_KEY, cleanName(name));
  } catch {
    // ignore
  }
}

export function clearSavedName() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(LEADERBOARD_NAME_KEY);
  } catch {
    // ignore
  }
}

export function getSubmittedDateKey(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(LEADERBOARD_SUBMITTED_DATE_KEY);
  } catch {
    return null;
  }
}

export function markSubmitted(dateKey: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LEADERBOARD_SUBMITTED_DATE_KEY, dateKey);
  } catch {
    // ignore
  }
}

export function computeDerivedStats(player: PlayerRecord): Pick<
  PlayerRecord,
  "winPercentage" | "avgGuessesOnWins" | "bestGuesses" | "points"
> {
  const gamesPlayed = Number.isFinite(player.gamesPlayed) ? player.gamesPlayed : 0;
  const wins = Number.isFinite(player.wins) ? player.wins : 0;
  const totalGuessesInWins = Number.isFinite(player.totalGuessesInWins) ? player.totalGuessesInWins : 0;

  const winPercentage = gamesPlayed > 0 ? (wins / gamesPlayed) * 100 : 0;
  const avgGuessesOnWins = wins > 0 ? totalGuessesInWins / wins : null;
  const bestGuesses = wins > 0 && Number.isFinite(player.bestGuesses) ? (player.bestGuesses as number) : null;

  const points = Number.isFinite(player.points) ? player.points : 0;

  return { winPercentage, avgGuessesOnWins, bestGuesses, points };
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
    points: 0,
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
    existing.points = (existing.points || 0) + pointsForGame("win", guesses);
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

/**
 * Rank by total points (desc), then wins (desc), then average guesses on wins
 * (asc, players with no wins last), then name (A-Z).
 */
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
    if (pb.points !== pa.points) return pb.points - pa.points;
    if (pb.wins !== pa.wins) return pb.wins - pa.wins;
    const avgCmp = nullsLastAsc(pa.avgGuessesOnWins, pb.avgGuessesOnWins);
    if (avgCmp !== 0) return avgCmp;
    return pa.displayName.localeCompare(pb.displayName, undefined, { sensitivity: "base" });
  });
}
