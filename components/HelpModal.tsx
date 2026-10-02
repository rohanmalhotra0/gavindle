"use client";
import React, { useEffect, useRef } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
};

function Example(props: { word: string; index: number; state: "correct" | "present" | "absent"; text: string }) {
  const { word, index, state, text } = props;
  return (
    <div className="help-example">
      <div className="help-row" role="img" aria-label={`${word}: ${word[index]} ${text}`}>
        {word.split("").map((ch, i) => (
          <div key={i} className={`tile filled${i === index ? ` ${state}` : ""}`} aria-hidden="true">
            {ch}
          </div>
        ))}
      </div>
      <p>
        <strong>{word[index]}</strong> {text}.
      </p>
    </div>
  );
}

export default function HelpModal(props: Props) {
  const { open, onClose } = props;
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCloseRef.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      if (previouslyFocused && previouslyFocused !== document.body) previouslyFocused.focus();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal help-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2 className="modal-title" id="help-title">How to play</h2>
          <button ref={closeRef} type="button" className="icon-btn" onClick={onClose} aria-label="Close how to play">
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <div className="modal-body help-body">
          <p>Guess the Gavindle in 6 tries.</p>
          <ul>
            <li>Each guess must be 5 letters. Press Enter to submit.</li>
            <li>After each guess, the tiles change color to show how close you were.</li>
            <li>Some answers are names and inside jokes, so think outside the dictionary.</li>
          </ul>
          <Example word="GAVIN" index={0} state="correct" text="is in the word and in the right spot" />
          <Example word="PIZZA" index={1} state="present" text="is in the word but in the wrong spot" />
          <Example word="CHESS" index={3} state="absent" text="is not in the word anywhere" />
          <p className="help-footnote">A new puzzle comes out every day at midnight (New York time). Gavin is watching.</p>
          <button type="button" className="btn help-play" onClick={onClose}>
            Let&apos;s play
          </button>
        </div>
      </div>
    </div>
  );
}
