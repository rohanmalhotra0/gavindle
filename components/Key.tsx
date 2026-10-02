"use client";
import React from "react";
import type { LetterState } from "@/lib/evaluateGuess";
import { tapHaptic } from "@/lib/native";

type Props = {
  label: React.ReactNode;
  value: string;
  onPress: (value: string) => void;
  state?: LetterState;
  action?: boolean;
  wide?: boolean;
  ariaLabel?: string;
};

const STATE_LABEL: Partial<Record<LetterState, string>> = {
  correct: "correct",
  present: "in the word, wrong spot",
  absent: "not in the word"
};

export default function Key(props: Props) {
  const { label, value, onPress, state, action, wide, ariaLabel } = props;
  const className = [
    "key",
    action ? "action" : "",
    wide ? "wide" : "",
    state === "correct" ? "correct" : "",
    state === "present" ? "present" : "",
    state === "absent" ? "absent" : ""
  ]
    .filter(Boolean)
    .join(" ");

  const stateText = state ? STATE_LABEL[state] : undefined;
  const name = ariaLabel ?? value;

  return (
    <button
      type="button"
      className={className}
      onClick={(e) => {
        // Mouse/touch clicks: drop focus so a later Space/Enter on the physical
        // keyboard doesn't re-press this key. Keyboard activation keeps focus.
        if (e.detail > 0) e.currentTarget.blur();
        onPress(value);
      }}
      aria-label={stateText ? `${name}, ${stateText}` : name}
      style={{ gridColumn: wide ? "span 2" : undefined }}
      onClick={() => {
        tapHaptic();
        onPress(label);
      }}
      aria-label={label}
    >
      {label}
    </button>
  );
}
