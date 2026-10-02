"use client";
import React from "react";
import Key from "./Key";
import type { LetterState } from "@/lib/evaluateGuess";

const ROWS = [
  ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
  ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
  ["ENTER", "Z", "X", "C", "V", "B", "N", "M", "BACKSPACE"]
];

const BackspaceIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z"></path>
    <line x1="18" y1="9" x2="12" y2="15"></line>
    <line x1="12" y1="9" x2="18" y2="15"></line>
  </svg>
);

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
            const isAction = label === "ENTER" || label === "BACKSPACE";
            const state = isAction ? undefined : keyStates[label.toLowerCase()];
            return (
              <Key
                key={label}
                value={label}
                label={label === "BACKSPACE" ? <BackspaceIcon /> : label}
                ariaLabel={label === "ENTER" ? "Enter" : label === "BACKSPACE" ? "Backspace" : label}
                onPress={onKey}
                state={state}
                action={isAction}
                wide={isAction}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}
