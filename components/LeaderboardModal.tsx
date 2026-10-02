"use client";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  GROUP_MAX_LENGTH,
  MAX_NAME_LENGTH,
  cleanName,
  clearSavedName,
  getSavedGroup,
  getSavedName,
  getSubmittedDateKey,
  markSubmitted,
  normalizeGroupCode,
  normalizeName,
  saveGroup,
  saveName,
  validateGroupCode,
  validateName,
  type GameResult
} from "@/lib/leaderboardClient";
import Modal from "@/components/Modal";
import { LeaderboardBody } from "@/components/LeaderboardView";
import { useLeaderboard } from "@/components/useLeaderboard";

type View = "prompt" | "board";

/**
 * Post-game leaderboard flow. When opened:
 * - already submitted today: show the leaderboard;
 * - a saved name exists: submit automatically (win or loss) and show the leaderboard;
 * - otherwise: ask for a name (and optional class code) first.
 * After a submission the board shows how the player's rank changed.
 */
export default function LeaderboardModal(props: {
  open: boolean;
  onClose: () => void;
  onSubmitted?: () => void;
  dateKey: string;
  result: GameResult;
  guesses: number | null;
  /** True when the player used today's hint (costs 1 point). */
  hintUsed?: boolean;
}) {
  const { open, dateKey, result, guesses } = props;
  const hintUsed = Boolean(props.hintUsed);
  const [view, setView] = useState<View>("prompt");
  const [name, setName] = useState("");
  const [classCode, setClassCode] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [highlightKey, setHighlightKey] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [canChangeName, setCanChangeName] = useState(false);
  const board = useLeaderboard();
  const { submit, load, reload } = board;
  const inputRef = useRef<HTMLInputElement | null>(null);
  const retryRef = useRef<() => void>(() => {});

  const onSubmittedRef = useRef(props.onSubmitted);
  onSubmittedRef.current = props.onSubmitted;

  const submitAs = useCallback(
    async (rawName: string) => {
      const playerName = cleanName(rawName);
      const group = getSavedGroup();
      setHighlightKey(normalizeName(playerName));
      setCanChangeName(true);
      const ok = await submit({ dateKey, name: playerName, result, guesses, hintUsed, groupCode: group }, group);
      if (ok) {
        markSubmitted(dateKey);
        saveName(playerName);
        setNotice(`Saved today${"’"}s ${result === "win" ? "win" : "result"} as ${playerName}.`);
        retryRef.current = () => void reload();
        onSubmittedRef.current?.();
      }
      return ok;
    },
    [submit, reload, dateKey, result, guesses, hintUsed]
  );

  const showBoard = useCallback(() => {
    const saved = getSavedName();
    setView("board");
    setHighlightKey(saved ? normalizeName(saved) : null);
    setCanChangeName(Boolean(saved));
    retryRef.current = () => void reload();
    void load(getSavedGroup());
  }, [load, reload]);

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
    setClassCode(getSavedGroup() ?? "");
    window.setTimeout(() => inputRef.current?.focus(), 0);
    // Only re-run when the modal opens or the day changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, dateKey]);

  const onPromptSubmit = async () => {
    if (saving) return;
    const err = validateName(name);
    if (err) {
      setFormError(err);
      inputRef.current?.focus();
      return;
    }
    const code = normalizeGroupCode(classCode);
    if (code) {
      const codeErr = validateGroupCode(code);
      if (codeErr) {
        setFormError(codeErr);
        return;
      }
    }
    // Never submit the same finished game twice.
    if (getSubmittedDateKey() === dateKey) {
      showBoard();
      return;
    }
    setFormError("");
    setSaving(true);
    if (code) saveGroup(code);
    const playerName = cleanName(name);
    setView("board");
    retryRef.current = () => void submitAs(playerName);
    const ok = await submitAs(playerName);
    setSaving(false);
    if (!ok) {
      setView("prompt");
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

  const trimmedLength = cleanName(name).length;
  const isBoard = view === "board";

  return (
    <Modal
      open={open}
      onClose={props.onClose}
      title={isBoard ? "LEADERBOARD" : "Submit to leaderboard"}
      size={isBoard ? "md" : "sm"}
      className={isBoard ? "lbv-panel" : undefined}
    >
      {isBoard ? (
        <LeaderboardBody
          board={board}
          onRetry={() => retryRef.current()}
          highlightKey={highlightKey}
          notice={notice}
          onChangeName={canChangeName ? onChangeName : undefined}
        />
      ) : (
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
          <label className="lbv-label" htmlFor="lbv-prompt-class">
            Class code <span className="lbv-optional">(optional)</span>
          </label>
          <input
            id="lbv-prompt-class"
            className="lbv-input"
            value={classCode}
            onChange={(e) => {
              setClassCode(normalizeGroupCode(e.target.value).slice(0, GROUP_MAX_LENGTH));
              if (formError) setFormError("");
            }}
            placeholder="e.g. 5B"
            maxLength={GROUP_MAX_LENGTH}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
          />
          <button type="submit" className="lbv-btn lbv-btn-block" disabled={saving || trimmedLength === 0}>
            {saving ? "Saving..." : "Submit"}
          </button>
          {formError && <div className="lbv-form-error" role="alert">{formError}</div>}
        </form>
      )}
    </Modal>
  );
}
