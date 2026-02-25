import React, { useEffect, useMemo, useRef, useState } from "react";
import { LEADERBOARD_SUBMITTED_DATE_KEY, type GameResult } from "@/lib/leaderboardClient";
import { submitResult } from "@/lib/leaderboardService";

export default function LeaderboardModal(props: {
  open: boolean;
  onClose: () => void;
  onSubmitted?: () => void;
  dateKey: string;
  result: GameResult;
  guesses: number | null;
}) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!props.open) return;
    setError("");
    setSaving(false);
    setSubmitted(false);
    try {
      const already = window.localStorage.getItem(LEADERBOARD_SUBMITTED_DATE_KEY);
      if (already === props.dateKey) {
        setSubmitted(true);
        return;
      }
    } catch {
      // ignore
    }
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }, [props.open, props.dateKey]);

  const canSubmit = useMemo(() => {
    return Boolean(name.trim()) && !saving && !submitted;
  }, [name, saving, submitted]);

  const onSubmit = async () => {
    if (submitted) return;
    try {
      setError("");
      setSaving(true);
      await submitResult({
        dateKey: props.dateKey,
        name,
        result: props.result,
        guesses: props.guesses
      });
      setSubmitted(true);
      try {
        window.localStorage.setItem(LEADERBOARD_SUBMITTED_DATE_KEY, props.dateKey);
      } catch {
        // ignore
      }
      props.onSubmitted?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save leaderboard.");
    } finally {
      setSaving(false);
    }
  };

  if (!props.open) return null;

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Submit to leaderboard">
      <div className="modal">
        <div className="modal-header">
          <div className="modal-title">Submit to leaderboard</div>
          <button className="btn secondary" onClick={props.onClose} type="button">
            Close
          </button>
        </div>

        <div className="modal-body">
          <p style={{ margin: "0 0 12px", color: "#687387" }}>
            Enter your name to add your result to the leaderboard.
          </p>
          <div className="modal-row">
            <label className="modal-label" htmlFor="leaderboard-name">
              Display name
            </label>
            <input
              id="leaderboard-name"
              ref={inputRef}
              className="modal-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Rohan"
              maxLength={40}
              autoComplete="nickname"
              disabled={submitted}
            />
            <button className="btn" onClick={onSubmit} disabled={!canSubmit} type="button">
              {submitted ? "Submitted" : saving ? "Saving..." : "Submit"}
            </button>
          </div>

          {submitted && <div style={{ color: "#687387", fontWeight: 700 }}>Already submitted for today.</div>}
          {error && <div className="modal-error">{error}</div>}
        </div>
      </div>
    </div>
  );
}

