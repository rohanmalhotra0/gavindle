"use client";
import React, { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import "./modal.css";

/*
 * Shared animated dialog.
 * - Overlay fades; the sheet slides up on phones and scales in on wider screens.
 * - Closing plays the exit animation before unmounting.
 * - Escape / overlay click / close button close it; focus is trapped inside and
 *   restored afterwards; page scroll is locked.
 * - Game keys (letters, Enter, Backspace) never reach the board behind it.
 * - prefers-reduced-motion: no animation, instant open/close.
 * Render it unconditionally and toggle `open` (unmounting it skips the exit animation).
 */

// Shared between every open dialog so nested/overlapping modals behave.
const overlayStack: number[] = [];
let overlaySeq = 0;
let lockedBodyOverflow: string | null = null;

const EXIT_FALLBACK_MS = 400;

function isTypingTarget(t: EventTarget | null) {
  const el = t as HTMLElement | null;
  if (!el || !el.tagName) return false;
  return el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable;
}

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export type ModalProps = {
  open: boolean;
  onClose: () => void;
  /** Visible heading; also the dialog's accessible name. */
  title: React.ReactNode;
  children: React.ReactNode;
  /** "sm" ~360px, "md" ~460px (default). */
  size?: "sm" | "md";
  /** Extra class for the panel. */
  className?: string;
  closeLabel?: string;
};

type Phase = "closed" | "open" | "closing";

export default function Modal(props: ModalProps) {
  const { open } = props;
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(props.onClose);
  onCloseRef.current = props.onClose;
  const [phase, setPhase] = useState<Phase>(open ? "open" : "closed");
  const [canPortal, setCanPortal] = useState(false);

  useEffect(() => setCanPortal(true), []);

  // open -> mount; !open -> play exit animation, then unmount.
  useEffect(() => {
    if (open) {
      setPhase("open");
      return;
    }
    setPhase((p) => {
      if (p === "closed") return p;
      return prefersReducedMotion() ? "closed" : "closing";
    });
  }, [open]);

  useEffect(() => {
    if (phase !== "closing") return;
    const t = window.setTimeout(() => setPhase("closed"), EXIT_FALLBACK_MS);
    return () => window.clearTimeout(t);
  }, [phase]);

  // While open: scroll lock, key isolation, focus management.
  useEffect(() => {
    if (!open || !canPortal) return;
    const id = ++overlaySeq;
    overlayStack.push(id);
    if (overlayStack.length === 1) {
      lockedBodyOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (overlayStack[overlayStack.length - 1] !== id) return;
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key === "Tab") {
        const panel = panelRef.current;
        if (panel) {
          const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
            (el) => el.offsetParent !== null || el === document.activeElement
          );
          const first = items[0];
          const last = items[items.length - 1];
          const active = document.activeElement;
          if (!first) {
            e.preventDefault();
            panel.focus();
          } else if (e.shiftKey && (active === first || active === panel || !panel.contains(active))) {
            e.preventDefault();
            last.focus();
          } else if (!e.shiftKey && (active === last || !panel.contains(active))) {
            e.preventDefault();
            first.focus();
          }
        }
        e.stopPropagation();
        return;
      }
      // Don't let letters / Enter / Backspace type into the game behind the modal.
      if (!isTypingTarget(e.target)) e.stopPropagation();
    };
    window.addEventListener("keydown", onKeyDown, true);

    const prevFocus = document.activeElement as HTMLElement | null;
    // Focus the panel unless something inside already grabbed focus (e.g. an input).
    const raf = window.requestAnimationFrame(() => {
      const panel = panelRef.current;
      if (panel && !panel.contains(document.activeElement)) panel.focus({ preventScroll: true });
    });

    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKeyDown, true);
      const idx = overlayStack.indexOf(id);
      if (idx >= 0) overlayStack.splice(idx, 1);
      if (overlayStack.length === 0) {
        document.body.style.overflow = lockedBodyOverflow ?? "";
        lockedBodyOverflow = null;
      }
      try {
        if (prevFocus && prevFocus !== document.body && document.contains(prevFocus)) {
          prevFocus.focus({ preventScroll: true });
        }
      } catch {
        // ignore
      }
    };
  }, [open, canPortal]);

  if (phase === "closed" || !canPortal) return null;

  const closing = phase === "closing";
  const sizeClass = props.size === "sm" ? " ui-modal-sm" : "";

  return createPortal(
    <div
      className={`ui-modal-overlay${closing ? " is-closing" : ""}`}
      onMouseDown={(e) => {
        if (!closing && e.target === e.currentTarget) props.onClose();
      }}
    >
      <div
        ref={panelRef}
        className={`ui-modal-panel${sizeClass}${props.className ? ` ${props.className}` : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onAnimationEnd={(e) => {
          if (closing && e.target === e.currentTarget) setPhase("closed");
        }}
      >
        <div className="ui-modal-header">
          <h2 id={titleId} className="ui-modal-title">{props.title}</h2>
          <button
            type="button"
            className="ui-modal-close"
            onClick={props.onClose}
            aria-label={props.closeLabel ?? "Close"}
            disabled={closing}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        {props.children}
      </div>
    </div>,
    document.body
  );
}
