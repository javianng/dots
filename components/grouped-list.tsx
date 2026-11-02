import * as React from "react";

import { cn } from "@/lib/utils";

/** iOS "inset grouped" list section: small caps header, rounded card, footnote. */
export function Group({
  label,
  footer,
  className,
  children,
}: {
  label?: string;
  footer?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn("flex flex-col gap-1.5", className)}>
      {label && (
        <h2 className="px-4 font-sans text-[13px] font-medium tracking-wide text-muted-foreground uppercase">
          {label}
        </h2>
      )}
      <div className="shadow-card overflow-hidden rounded-2xl bg-card ring-1 ring-black/[0.03] dark:ring-white/[0.06]">
        {children}
      </div>
      {footer && (
        <div className="px-4 text-[13px] leading-snug text-muted-foreground">{footer}</div>
      )}
    </section>
  );
}

/** Hairline between rows, inset from the leading edge. */
export function Divider({ inset = 16 }: { inset?: number }) {
  return <div className="h-px bg-border" style={{ marginLeft: inset }} />;
}

/** A labelled row with a trailing accessory (switch, value, stepper…). */
export function Row({
  label,
  htmlFor,
  icon,
  children,
  className,
}: {
  label: React.ReactNode;
  htmlFor?: string;
  icon?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-h-12 items-center justify-between gap-3 px-4 py-1.5",
        className
      )}
    >
      <label htmlFor={htmlFor} className="flex min-w-0 items-center gap-3 text-[17px]">
        {icon}
        <span className="truncate">{label}</span>
      </label>
      {children}
    </div>
  );
}

/** Rounded-square colour tile used as a row's leading icon (Settings-app style). */
export function RowIcon({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "flex size-[29px] shrink-0 items-center justify-center rounded-[7px] text-white [&_svg]:size-[17px]",
        className
      )}
    >
      {children}
    </span>
  );
}
