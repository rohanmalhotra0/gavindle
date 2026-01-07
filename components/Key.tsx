"use client";
import React from "react";
import type { LetterState } from "@/lib/evaluateGuess";

type Props = {
  label: string;
  onPress: (label: string) => void;
  state?: LetterState;
  action?: boolean;
  wide?: boolean;
};

export default function Key(props: Props) {
  const { label, onPress, state, action, wide } = props;
  const className = [
    "key",
    action ? "action" : "",
    state === "correct" ? "correct" : "",
    state === "present" ? "present" : "",
    state === "absent" ? "absent" : ""
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type="button"
      className={className}
      style={{ gridColumn: wide ? "span 2" : undefined }}
      onClick={() => onPress(label)}
      aria-label={label}
    >
      {label}
    </button>
  );
}

