"use client";
import { useCallback, useRef, useState } from "react";
import { normalizeName, type PlayerRecord } from "@/lib/leaderboardClient";
import { fetchLeaderboard, leaderboardRows, saveResultOnce, type SubmitInput } from "@/lib/leaderboardService";
import { computeRankChange, type RankChange } from "@/lib/leaderboardStats";

const FALLBACK_ERROR = "The leaderboard is having trouble right now. Please try again in a minute.";

/** Which board is shown: null = everyone, otherwise a class/group code. */
export type BoardScope = string | null;

export type RankChangeInfo = RankChange & { scope: BoardScope };

function errorMessage(e: unknown) {
  return e instanceof Error && e.message ? e.message : FALLBACK_ERROR;
}

/** Loading / error / data state for the leaderboard, shared by every leaderboard view. */
export function useLeaderboard() {
  const [players, setPlayers] = useState<PlayerRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scope, setScopeState] = useState<BoardScope>(null);
  const [rankChange, setRankChange] = useState<RankChangeInfo | null>(null);
  /** Bumped when the table should animate rows to their new positions. */
  const [moveToken, setMoveToken] = useState(0);
  const requestId = useRef(0);
  const scopeRef = useRef<BoardScope>(null);

  /** Load a board (defaults to the current one). Resolves true on success. */
  const load = useCallback(async (nextScope?: BoardScope): Promise<boolean> => {
    const s = nextScope === undefined ? scopeRef.current : nextScope;
    if (s !== scopeRef.current) {
      // Switching boards: don't show the old board's rows under the new tab.
      setPlayers([]);
      setRankChange(null);
    }
    scopeRef.current = s;
    setScopeState(s);
    const id = ++requestId.current;
    setLoading(true);
    setError(null);
    try {
      const lb = await fetchLeaderboard(s);
      if (id !== requestId.current) return true;
      setPlayers(leaderboardRows(lb));
      return true;
    } catch (e) {
      if (id !== requestId.current) return false;
      setError(errorMessage(e));
      return false;
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, []);

  const reload = useCallback(() => load(), [load]);

  /**
   * Submit a finished game and show where it put the player: loads the board
   * first (so the row can slide from its old spot), saves, reloads, and records
   * the rank change. Resolves true when the game was saved (even if the refresh
   * afterwards failed).
   */
  const submit = useCallback(async (input: SubmitInput, boardScope: BoardScope): Promise<boolean> => {
    scopeRef.current = boardScope;
    setScopeState(boardScope);
    const id = ++requestId.current;
    const playerKey = normalizeName(input.name);
    setLoading(true);
    setError(null);
    setRankChange(null);

    let before: PlayerRecord[] | null = null;
    try {
      before = leaderboardRows(await fetchLeaderboard(boardScope));
      if (id === requestId.current) setPlayers(before);
    } catch {
      before = null; // still try to save
    }

    let saved = false;
    try {
      await saveResultOnce(input);
      saved = true;
      const after = leaderboardRows(await fetchLeaderboard(boardScope));
      if (id !== requestId.current) return true;
      setPlayers(after);
      const change = computeRankChange(before, after, playerKey);
      setRankChange(change ? { ...change, scope: boardScope } : null);
      setMoveToken((t) => t + 1);
    } catch (e) {
      if (id === requestId.current) setError(errorMessage(e));
    } finally {
      if (id === requestId.current) setLoading(false);
    }
    return saved;
  }, []);

  return { players, loading, error, scope, rankChange, moveToken, load, reload, submit };
}

export type LeaderboardState = ReturnType<typeof useLeaderboard>;
