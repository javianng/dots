"use client";

import * as React from "react";
import { ViewTransition } from "react";

/**
 * Navigation transition types, passed to <Link transitionTypes> or
 * router.push(href, { transitionTypes }). Styles live in app/globals.css.
 *
 *   push / pop         drill into a habit and back (slide from the right)
 *   sheetUp / sheetDown open and dismiss modal screens (slide up from the bottom)
 *   fade               swap between sibling screens (login ⇄ signup)
 */
export const NAV = {
  push: ["push"],
  pop: ["pop"],
  sheetUp: ["sheet-up"],
  sheetDown: ["sheet-down"],
  fade: ["fade"],
} as const satisfies Record<string, readonly string[]>;

/** Mutable copy, since Next's APIs take string[]. */
export function nav(kind: keyof typeof NAV): string[] {
  return [...NAV[kind]];
}

/** Wrap each page so it slides/fades according to the navigation type. */
export function PageTransition({ children }: { children: React.ReactNode }) {
  return (
    <ViewTransition
      enter={{
        push: "push-in",
        pop: "pop-in",
        "sheet-up": "sheet-up-in",
        "sheet-down": "sheet-down-in",
        fade: "fade-in",
        default: "none",
      }}
      exit={{
        push: "push-out",
        pop: "pop-out",
        "sheet-up": "sheet-up-out",
        "sheet-down": "sheet-down-out",
        fade: "fade-out",
        default: "none",
      }}
      default="none"
    >
      <div className="flex w-full flex-1 flex-col bg-background">{children}</div>
    </ViewTransition>
  );
}

/**
 * Shared-element morph for a habit's icon between the list and its detail
 * page (and between list layouts when switching views).
 */
export function HabitIconTransition({
  habitId,
  children,
}: {
  habitId: string;
  children: React.ReactNode;
}) {
  return (
    <ViewTransition
      name={`habit-icon-${habitId}`}
      share={{ push: "morph", pop: "morph", "view-switch": "morph", default: "none" }}
      default="none"
    >
      {children}
    </ViewTransition>
  );
}
