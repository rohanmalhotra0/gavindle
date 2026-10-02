"use client";
import { useCallback, useRef, useState } from "react";
import type { LeaderboardFile, PlayerRecord } from "@/lib/leaderboardClient";
import { fetchLeaderboard, leaderboardRows } from "@/lib/leaderboardService";

const FALLBACK_ERROR = "The leaderboard is having trouble right now. Please try again in a minute.";

/** Loading / error / data state for the leaderboard, shared by every leaderboard view. */
export function useLeaderboard() {
  const [players, setPlayers] = useState<PlayerRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  /** Track any request that resolves to leaderboard data. Resolves true on success. */
  const run = useCallback(async (request: Promise<LeaderboardFile>): Promise<boolean> => {
    const id = ++requestId.current;
    setLoading(true);
    setError(null);
    try {
      const lb = await request;
      if (id !== requestId.current) return true;
      setPlayers(leaderboardRows(lb));
      return true;
    } catch (e) {
      if (id !== requestId.current) return false;
      setError(e instanceof Error && e.message ? e.message : FALLBACK_ERROR);
      return false;
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, []);

  const reload = useCallback(() => run(fetchLeaderboard()), [run]);

  return { players, loading, error, run, reload };
}
