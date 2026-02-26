"use client";
import React from "react";
import Key from "./Key";
import type { LetterState } from "@/lib/evaluateGuess";

const ROWS = [
  ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
  ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
  ["ENTER", "Z", "X", "C", "V", "B", "N", "M", "BACK"]
];

type Props = {
  onKey: (label: string) => void;
  keyStates: Record<string, LetterState>;
};

export default function Keyboard(props: Props) {
  const { onKey, keyStates } = props;
  return (
    <div className="keyboard" role="group" aria-label="Keyboard">
      {ROWS.map((row, i) => (
        <div className="kb-row" key={i}>
          {row.map((label) => {
            const upper = label.toUpperCase();
            const state = keyStates[upper.toLowerCase()];
            const isAction = label === "ENTER" || label === "BACK";
            const displayLabel = label === "BACK" ? "⌫" : label;
            const handlePress = (l: string) => onKey(l === "⌫" ? "BACKSPACE" : l);
            return (
              <Key
                key={label}
                label={displayLabel}
                onPress={handlePress}
                state={state}
                action={isAction}
                wide={label === "ENTER"}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}



