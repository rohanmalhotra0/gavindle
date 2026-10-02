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
  // Row currently flipping its tiles over (just submitted)
  revealRow?: number | null;
  // Row that bounces after a win
  winRow?: number | null;
  // Row that shakes after an invalid guess; shakeNonce re-triggers the shake
  shakeRow?: number | null;
  shakeNonce?: number;
  // Milliseconds between each tile's flip
  revealStepMs?: number;
  // Hint: a faint "ghost" letter shown in an empty tile of the row being typed
  ghost?: { row: number; index: number; letter: string } | null;
};

const STATE_LABEL: Record<LetterState, string> = {
  correct: "correct",
  present: "in the word, wrong spot",
  absent: "not in the word",
  empty: ""
};

export default function Grid(props: Props) {
  const { rows, revealRow = null, winRow = null, shakeRow = null, shakeNonce = 0, revealStepMs = 0, ghost = null } = props;
  return (
    <div className="board">
      <div className="grid" role="group" aria-label="Guess grid">
        {rows.map((row, r) => {
          const revealing = r === revealRow;
          const rowCls = ["row", r === shakeRow ? "shake" : ""].filter(Boolean).join(" ");
          return (
            <div
              className={rowCls}
              key={r === shakeRow ? `shake-${shakeNonce}` : r}
              role="group"
              aria-label={`Row ${r + 1}`}
            >
              {row.letters.map((ch, c) => {
                const state = row.states[c];
                const isGhost = !ch && !row.submitted && ghost !== null && ghost.row === r && ghost.index === c;
                const showState = row.submitted && state !== "empty";
                const cls = [
                  "tile",
                  ch ? "filled" : "",
                  ch && !row.submitted ? "pop" : "",
                  showState ? state : "",
                  showState && revealing ? "reveal" : "",
                  r === winRow ? "win" : "",
                  isGhost ? "ghost" : ""
                ]
                  .filter(Boolean)
                  .join(" ");
                const style: React.CSSProperties | undefined = revealing
                  ? { animationDelay: `${c * revealStepMs}ms` }
                  : r === winRow
                    ? { animationDelay: `${c * 100}ms` }
                    : undefined;
                const label = ch
                  ? `${ch}${showState && !revealing ? `, ${STATE_LABEL[state]}` : ""}`
                  : isGhost
                    ? `empty, hint: ${(ghost?.letter ?? "").toUpperCase()}`
                    : "empty";
                return (
                  <div className={cls} key={c} style={style} role="img" aria-label={label}>
                    {ch || (isGhost ? (ghost?.letter ?? "").toUpperCase() : "")}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
