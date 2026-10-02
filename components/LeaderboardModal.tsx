"use client";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  MAX_NAME_LENGTH,
  cleanName,
  clearSavedName,
  getSavedName,
  getSubmittedDateKey,
  markSubmitted,
  normalizeName,
  saveName,
  validateName,
  type GameResult
} from "@/lib/leaderboardClient";
import { submitResultOnce } from "@/lib/leaderboardService";
import { LeaderboardBody, LeaderboardOverlay } from "@/components/LeaderboardView";
import { useLeaderboard } from "@/components/useLeaderboard";

type View = "prompt" | "board";

/**
 * Post-game leaderboard flow. When opened:
 * - already submitted today: show the leaderboard;
 * - a saved name exists: submit automatically (win or loss) and show the leaderboard;
 * - otherwise: ask for a name first.
 */
export default function LeaderboardModal(props: {
  open: boolean;
  onClose: () => void;
  onSubmitted?: () => void;
  dateKey: string;
  result: GameResult;
  guesses: number | null;
  hintUsed?: boolean;
}) {
  const { open, dateKey, result, guesses } = props;
  const [view, setView] = useState<View>("prompt");
  const [name, setName] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [highlightKey, setHighlightKey] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [canChangeName, setCanChangeName] = useState(false);
  const board = useLeaderboard();
  const { run, reload } = board;
  const inputRef = useRef<HTMLInputElement | null>(null);
  const retryRef = useRef<() => void>(() => {});

  const onSubmittedRef = useRef(props.onSubmitted);
  onSubmittedRef.current = props.onSubmitted;

  const submitAs = useCallback(
    async (rawName: string) => {
      const playerName = cleanName(rawName);
      setHighlightKey(normalizeName(playerName));
      setCanChangeName(true);
      const ok = await run(submitResultOnce({ dateKey, name: playerName, result, guesses }));
      if (ok) {
        markSubmitted(dateKey);
        saveName(playerName);
        setNotice(`Saved today${"’"}s ${result === "win" ? "win" : "result"} as ${playerName}.`);
        onSubmittedRef.current?.();
      }
      return ok;
    },
    [run, dateKey, result, guesses]
  );

  const showBoard = useCallback(() => {
    const saved = getSavedName();
    setView("board");
    setHighlightKey(saved ? normalizeName(saved) : null);
    setCanChangeName(Boolean(saved));
    retryRef.current = () => void reload();
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!open) return;
    setFormError("");
    setSaving(false);
    setNotice(null);

    if (getSubmittedDateKey() === dateKey) {
      showBoard();
      return;
    }

    const saved = getSavedName();
    if (saved) {
      setView("board");
      retryRef.current = () => void submitAs(saved);
      void submitAs(saved);
      return;
    }

    setView("prompt");
    setName("");
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }, [open, dateKey]);

  const onPromptSubmit = async () => {
    if (saving) return;
    const err = validateName(name);
    if (err) {
      setFormError(err);
      inputRef.current?.focus();
      return;
    }
    // Never submit the same finished game twice.
    if (getSubmittedDateKey() === dateKey) {
      showBoard();
      return;
    }
    setFormError("");
    setSaving(true);
    const playerName = cleanName(name);
    const ok = await submitAs(playerName);
    setSaving(false);
    if (ok) {
      setView("board");
      retryRef.current = () => void reload();
    } else {
      setFormError("The leaderboard is having trouble right now. Please try again in a minute.");
    }
  };

  const onChangeName = () => {
    clearSavedName();
    setHighlightKey(null);
    setCanChangeName(false);
    if (getSubmittedDateKey() === dateKey) {
      setNotice("Name cleared. You’ll be asked for your name after your next game.");
    } else {
      setNotice(null);
      setName("");
      setFormError("");
      setView("prompt");
      window.setTimeout(() => inputRef.current?.focus(), 0);
    }
  };

  if (!open) return null;

  if (view === "board") {
    return (
      <LeaderboardOverlay title="LEADERBOARD" onClose={props.onClose}>
        <LeaderboardBody
          players={board.players}
          loading={board.loading}
          error={board.error}
          onRetry={() => retryRef.current()}
          highlightKey={highlightKey}
          notice={notice}
          onChangeName={canChangeName ? onChangeName : undefined}
        />
      </LeaderboardOverlay>
    );
  }

  const trimmedLength = cleanName(name).length;

  return (
    <LeaderboardOverlay title="Submit to leaderboard" onClose={props.onClose} narrow>
      <form
        className="lbv-form"
        onSubmit={(e) => {
          e.preventDefault();
          void onPromptSubmit();
        }}
      >
        <p>
          Enter your name to put today{"’"}s {result === "win" ? "win" : "game"} on the leaderboard. We{"’"}ll
          remember it on this device so future games are saved automatically.
        </p>
        <label className="lbv-label" htmlFor="lbv-name-input">Display name</label>
        <input
          id="lbv-name-input"
          ref={inputRef}
          className="lbv-input"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (formError) setFormError("");
          }}
          placeholder="e.g. Rohan"
          maxLength={MAX_NAME_LENGTH}
          autoComplete="nickname"
          autoCapitalize="words"
          spellCheck={false}
          aria-invalid={Boolean(formError)}
        />
        <div className="lbv-hint">{trimmedLength}/{MAX_NAME_LENGTH}</div>
        <button type="submit" className="lbv-btn lbv-btn-block" disabled={saving || trimmedLength === 0}>
          {saving ? "Saving..." : "Submit"}
        </button>
        {formError && <div className="lbv-form-error" role="alert">{formError}</div>}
      </form>
    </LeaderboardOverlay>
  );
}
