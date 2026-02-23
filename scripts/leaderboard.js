/**
 * Leaderboard storage + update helpers (no auth).
 *
 * Data schema (JSON shape):
 * {
 *   "version": 1,
 *   "updatedAt": "2026-02-22T12:34:56.789Z",
 *   "players": {
 *     "normalized name key": {
 *       "key": "normalized name key",
 *       "displayName": "Most Recent Casing",
 *       "gamesPlayed": 0,
 *       "wins": 0,
 *       "losses": 0,
 *       "winPercentage": 0,
 *       "bestGuesses": null,
 *       "totalGuessesInWins": 0,
 *       "avgGuessesOnWins": null,
 *       "currentStreak": 0,
 *       "bestStreak": 0,
 *       "lastPlayedAt": null
 *     }
 *   }
 * }
 */

const fs = require("node:fs/promises");
const path = require("node:path");

/**
 * @typedef {"win" | "loss"} GameResult
 *
 * @typedef {Object} PlayerRecord
 * @property {string} key
 * @property {string} displayName
 * @property {number} gamesPlayed
 * @property {number} wins
 * @property {number} losses
 * @property {number} winPercentage
 * @property {number | null} bestGuesses
 * @property {number} totalGuessesInWins
 * @property {number | null} avgGuessesOnWins
 * @property {number} currentStreak
 * @property {number} bestStreak
 * @property {string | null} lastPlayedAt
 *
 * @typedef {Object} LeaderboardFile
 * @property {1} version
 * @property {string} updatedAt
 * @property {Record<string, PlayerRecord>} players
 */

/**
 * Trim, lowercase, and collapse internal whitespace into single spaces.
 * @param {string} name
 */
function normalizeName(name) {
  return String(name).trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * @param {unknown} maybe
 * @returns {maybe is LeaderboardFile}
 */
function isLeaderboardFile(maybe) {
  if (!maybe || typeof maybe !== "object") return false;
  const obj = /** @type {any} */ (maybe);
  if (obj.version !== 1) return false;
  if (!obj.players || typeof obj.players !== "object") return false;
  return true;
}

/**
 * Best-effort load; handles missing/corrupt JSON gracefully.
 * If corrupt, renames the bad file and returns a new empty leaderboard.
 *
 * @param {string} filePath
 * @returns {Promise<LeaderboardFile>}
 */
async function loadLeaderboard(filePath) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw);
    if (isLeaderboardFile(parsed)) return parsed;
    // Bad shape, treat like corrupt.
    throw new Error("Invalid leaderboard.json shape");
  } catch (err) {
    /** @type {any} */
    const e = err;
    const code = e && typeof e === "object" ? e.code : undefined;
    if (code !== "ENOENT") {
      // Preserve the corrupt file if it exists.
      const ts = new Date().toISOString().replace(/[:.]/g, "-");
      const dir = path.dirname(filePath);
      const base = path.basename(filePath, path.extname(filePath));
      const backup = path.join(dir, `${base}.corrupt.${ts}.json`);
      try {
        await fs.rename(filePath, backup);
      } catch {
        // Ignore rename failures (e.g., file didn't exist or permission issues).
      }
    }
    return {
      version: 1,
      updatedAt: new Date().toISOString(),
      players: {}
    };
  }
}

/**
 * Safe write pattern: write to temp file then atomic rename.
 * @param {string} filePath
 * @param {LeaderboardFile} data
 */
async function saveLeaderboard(filePath, data) {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });

  /** @type {LeaderboardFile} */
  const normalized = {
    version: 1,
    updatedAt: new Date().toISOString(),
    players: data.players || {}
  };

  // Recompute derived stats before persisting.
  for (const key of Object.keys(normalized.players)) {
    const p = normalized.players[key];
    const derived = computeDerivedStats(p);
    normalized.players[key] = { ...p, ...derived, key };
  }

  const tmpPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  const json = JSON.stringify(normalized, null, 2) + "\n";
  await fs.writeFile(tmpPath, json, "utf8");
  await fs.rename(tmpPath, filePath);
}

/**
 * Compute derived stats from stored counters.
 * @param {PlayerRecord} player
 * @returns {{ winPercentage: number, avgGuessesOnWins: number | null, bestGuesses: number | null }}
 */
function computeDerivedStats(player) {
  const gamesPlayed = Number.isFinite(player.gamesPlayed) ? player.gamesPlayed : 0;
  const wins = Number.isFinite(player.wins) ? player.wins : 0;
  const totalGuessesInWins = Number.isFinite(player.totalGuessesInWins)
    ? player.totalGuessesInWins
    : 0;

  const winPercentage = gamesPlayed > 0 ? (wins / gamesPlayed) * 100 : 0;
  const avgGuessesOnWins = wins > 0 ? totalGuessesInWins / wins : null;
  const bestGuesses =
    wins > 0 && Number.isFinite(player.bestGuesses) ? /** @type {number} */ (player.bestGuesses) : null;

  return { winPercentage, avgGuessesOnWins, bestGuesses };
}

/**
 * Create-or-update player record based on game result.
 *
 * @param {LeaderboardFile} leaderboard
 * @param {{ name: string, result: GameResult, guesses?: number | null }} input
 * @returns {LeaderboardFile}
 */
function upsertPlayerResult(leaderboard, input) {
  const rawName = String(input.name ?? "");
  const key = normalizeName(rawName);
  if (!key) throw new Error("Name is required.");

  const result = input.result;
  if (result !== "win" && result !== "loss") throw new Error('Result must be "win" or "loss".');

  const nowIso = new Date().toISOString();
  const players = leaderboard.players || (leaderboard.players = {});

  /** @type {PlayerRecord} */
  const existing = players[key] || {
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
    if (!Number.isInteger(guesses) || guesses < 1 || guesses > 6) {
      throw new Error("Guesses must be an integer from 1 to 6 for a win.");
    }
    existing.wins += 1;
    existing.totalGuessesInWins += guesses;
    existing.bestGuesses =
      existing.bestGuesses == null ? guesses : Math.min(existing.bestGuesses, guesses);

    existing.currentStreak += 1;
    existing.bestStreak = Math.max(existing.bestStreak, existing.currentStreak);
  } else {
    // Loss: guesses may be null or 6; we don't include it in win averages.
    const guesses = input.guesses;
    if (!(guesses == null || guesses === 6)) {
      throw new Error("For a loss, guesses must be 6 or omitted.");
    }
    existing.losses += 1;
    existing.currentStreak = 0;
  }

  const derived = computeDerivedStats(existing);
  players[key] = { ...existing, ...derived, key };

  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    players
  };
}

/**
 * @param {PlayerRecord[]} players
 */
function sortPlayersForLeaderboard(players) {
  const nullsLastAsc = (a, b) => {
    const aNull = a == null;
    const bNull = b == null;
    if (aNull && bNull) return 0;
    if (aNull) return 1;
    if (bNull) return -1;
    return a - b;
  };

  return players.sort((pa, pb) => {
    if (pb.winPercentage !== pa.winPercentage) return pb.winPercentage - pa.winPercentage;
    const bestCmp = nullsLastAsc(pa.bestGuesses, pb.bestGuesses);
    if (bestCmp !== 0) return bestCmp;
    const avgCmp = nullsLastAsc(pa.avgGuessesOnWins, pb.avgGuessesOnWins);
    if (avgCmp !== 0) return avgCmp;
    return pb.gamesPlayed - pa.gamesPlayed;
  });
}

module.exports = {
  normalizeName,
  loadLeaderboard,
  saveLeaderboard,
  upsertPlayerResult,
  computeDerivedStats,
  sortPlayersForLeaderboard
};

