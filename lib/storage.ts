export type PersistedGame = {
  dateKey: string;
  solution: string;
  guesses: string[];
  status: "ongoing" | "won" | "lost";
};

export type Stats = {
  gamesPlayed: number;
  wins: number;
  currentStreak: number;
  maxStreak: number;
  // distribution for 1..6
  guessDistribution: number[];
  // dateKey (YYYY-MM-DD, America/New_York) of the last finished game; guards against double counting
  lastPlayedDateKey?: string;
  // dateKey of the last win; used to break the streak when a day is skipped
  lastWinDateKey?: string;
};

const GAME_KEY = "gavindle:game";
const STATS_KEY = "gavindle:stats";
const HELP_SEEN_KEY = "gavindle:helpSeen";

export function getDateKey(d: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(d);
  const year = parts.find(p => p.type === "year")?.value ?? "";
  const month = parts.find(p => p.type === "month")?.value ?? "";
  const day = parts.find(p => p.type === "day")?.value ?? "";
  return `${year}-${month}-${day}`;
}

// Returns the dateKey of the calendar day before `dateKey` (both YYYY-MM-DD).
export function previousDateKey(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map((n) => parseInt(n, 10));
  const prev = new Date(Date.UTC(y, m - 1, d - 1));
  const mm = String(prev.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(prev.getUTCDate()).padStart(2, "0");
  return `${prev.getUTCFullYear()}-${mm}-${dd}`;
}

export function emptyStats(): Stats {
  return {
    gamesPlayed: 0,
    wins: 0,
    currentStreak: 0,
    maxStreak: 0,
    guessDistribution: [0, 0, 0, 0, 0, 0]
  };
}

function num(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0;
}

function sanitizeStats(raw: unknown): Stats {
  if (!raw || typeof raw !== "object") return emptyStats();
  const r = raw as Record<string, unknown>;
  const dist = Array.isArray(r.guessDistribution) ? r.guessDistribution : [];
  const stats: Stats = {
    gamesPlayed: num(r.gamesPlayed),
    wins: num(r.wins),
    currentStreak: num(r.currentStreak),
    maxStreak: num(r.maxStreak),
    guessDistribution: Array.from({ length: 6 }, (_, i) => num(dist[i]))
  };
  if (typeof r.lastPlayedDateKey === "string") stats.lastPlayedDateKey = r.lastPlayedDateKey;
  if (typeof r.lastWinDateKey === "string") stats.lastWinDateKey = r.lastWinDateKey;
  return stats;
}

export function loadGame(): PersistedGame | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(GAME_KEY);
    if (!raw) return null;
    const g = JSON.parse(raw) as Partial<PersistedGame> | null;
    if (!g || typeof g !== "object") return null;
    if (typeof g.dateKey !== "string" || typeof g.solution !== "string") return null;
    if (!Array.isArray(g.guesses) || !g.guesses.every((x) => typeof x === "string")) return null;
    const status = g.status === "won" || g.status === "lost" ? g.status : "ongoing";
    return { dateKey: g.dateKey, solution: g.solution, guesses: g.guesses, status };
  } catch {
    return null;
  }
}

export function saveGame(game: PersistedGame) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(GAME_KEY, JSON.stringify(game));
  } catch {
    // ignore
  }
}

export function loadStats(): Stats {
  if (typeof window === "undefined") return emptyStats();
  try {
    const raw = window.localStorage.getItem(STATS_KEY);
    if (!raw) return emptyStats();
    return sanitizeStats(JSON.parse(raw));
  } catch {
    return emptyStats();
  }
}

export function saveStats(stats: Stats) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  } catch {
    // ignore
  }
}

// If the last win was before yesterday, the streak is broken. Returns a new object.
export function normalizeStreak(stats: Stats, todayKey: string): Stats {
  const next: Stats = { ...stats, guessDistribution: [...stats.guessDistribution] };
  if (!next.lastWinDateKey || next.currentStreak === 0) return next;
  if (next.lastWinDateKey !== todayKey && next.lastWinDateKey !== previousDateKey(todayKey)) {
    next.currentStreak = 0;
  }
  return next;
}

// Pure: returns updated stats for a finished game. Never mutates `stats`.
// A second result for the same day is ignored (e.g. two tabs open).
export function recordResult(stats: Stats, dateKey: string, won: boolean, tries: number): Stats {
  if (stats.lastPlayedDateKey === dateKey) return stats;
  const next = normalizeStreak(stats, dateKey);
  next.gamesPlayed += 1;
  next.lastPlayedDateKey = dateKey;
  if (won) {
    next.wins += 1;
    next.currentStreak += 1;
    next.maxStreak = Math.max(next.maxStreak, next.currentStreak);
    next.lastWinDateKey = dateKey;
    if (tries >= 1 && tries <= 6) {
      next.guessDistribution[tries - 1] += 1;
    }
  } else {
    next.currentStreak = 0;
  }
  return next;
}

export function hasSeenHelp(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(HELP_SEEN_KEY) === "1";
  } catch {
    return true;
  }
}

export function markHelpSeen() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(HELP_SEEN_KEY, "1");
  } catch {
    // ignore
  }
}
