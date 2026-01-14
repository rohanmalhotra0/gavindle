"use client";
import React from "react";
import type { LetterState } from "@/lib/evaluateGuess";

export type RowData = {
  letters: string[];
  states: LetterState[];
  submitted: boolean;
};

type Props = {
  rows: RowData[];
};

export default function Grid(props: Props) {
  const { rows } = props;
  return (
    <div className="grid" role="group" aria-label="Guess grid">
      {rows.map((row, r) => (
        <div className="row" key={r}>
          {row.letters.map((ch, c) => {
            const cls = [
              "tile",
              ch ? "filled" : "",
              row.submitted && row.states[c] !== "empty" ? row.states[c] : ""
            ]
              .filter(Boolean)
              .join(" ");
            return (
              <div className={cls} key={c} aria-label={`Row ${r + 1} Col ${c + 1}`}>
                {ch}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}



