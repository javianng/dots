"use client";

import Link from "next/link";
import * as React from "react";
import { ViewTransition, addTransitionType, startTransition } from "react";

import { AppHeader } from "@/components/app-header";
import { HabitDayToggle } from "@/components/day-toggle";
import { HabitIcon } from "@/components/habit-icon";
import { HEATMAP_WEEKS, Heatmap } from "@/components/heatmap";
import { LifePanel } from "@/components/life-panel";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ViewSwitcher, tabIndex, type ViewTab } from "@/components/view-switcher";
import { useAuth } from "@/hooks/use-auth";
import { useHabits } from "@/hooks/use-habits";
import { useNow } from "@/hooks/use-timer";
import { checkIn, elapsedSeconds, formatClock, isTimerRunning, usesSlots } from "@/lib/check-in";
import { lastNDays, toDateKey, todayKey } from "@/lib/dates";
import {
  DAY_PARTS,
  currentPart,
  dayTarget,
  partLabel,
  progressLabel,
  todayStatus,
} from "@/lib/schedule";
import { habitHref } from "@/lib/routes";
import { HabitIconTransition, nav } from "@/lib/transitions";
import type { DayPart, Habit } from "@/lib/types";
import { cn } from "@/lib/utils";

type ToggleFn = (habit: Habit, dateKey: string, part?: DayPart) => void;

// Tab changes slide content toward the picked tab (keyframes in globals.css).
const SLIDE_ENTER = { "view-next": "view-from-right", "view-prev": "view-from-left", default: "none" };
const SLIDE_EXIT = { "view-next": "view-to-left", "view-prev": "view-to-right", default: "none" };

// Cards rise in on the first load of a session only, not on every return.
let hasPlayedEntrance = false;

export function MainScreen() {
  const { user } = useAuth();
  const { habits, loading } = useHabits();
  const [activeTab, setActiveTab] = React.useState<ViewTab>("grid");
  const [animateIn] = React.useState(() => !hasPlayedEntrance);

  React.useEffect(() => {
    if (habits) hasPlayedEntrance = true;
  }, [habits]);

  const toggle = React.useCallback<ToggleFn>(
    (habit, dateKey, part) => {
      if (!user) return;
      checkIn(user.uid, habit, dateKey, { part });
    },
    [user]
  );

  const switchTab = (tab: ViewTab) => {
    startTransition(() => {
      // Slide toward the picked tab, like paging between iOS tabs.
      addTransitionType(tabIndex(tab) > tabIndex(activeTab) ? "view-next" : "view-prev");
      setActiveTab(tab);
    });
  };

  const list = habits ?? [];
  const viewProps = { habits: list, onToggle: toggle, animateIn };

  return (
    <div className="mx-auto flex w-full max-w-xl flex-1 flex-col px-4 pb-32 md:max-w-3xl xl:max-w-6xl">
      <AppHeader />
      {loading ? (
        <>
          <Skeleton className="mt-2 mb-6 h-16 w-48 rounded-xl" />
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            <Skeleton className="h-40 w-full rounded-2xl" />
            <Skeleton className="h-40 w-full rounded-2xl" />
            <Skeleton className="h-40 w-full rounded-2xl" />
          </div>
        </>
      ) : (
        <>
          {activeTab !== "life" && list.length > 0 && (
            <ViewTransition enter={SLIDE_ENTER} exit={SLIDE_EXIT} default="none">
              <TodaySummary habits={list} />
            </ViewTransition>
          )}
          <ViewTransition key={activeTab} enter={SLIDE_ENTER} exit={SLIDE_EXIT} default="none">
            <div className="flex flex-1 flex-col">
              {activeTab === "life" ? (
                <LifePanel />
              ) : list.length === 0 ? (
                <EmptyState />
              ) : activeTab === "grid" ? (
                <GridView {...viewProps} />
              ) : activeTab === "list" ? (
                <ListView {...viewProps} />
              ) : (
                <CompactView {...viewProps} />
              )}
            </div>
          </ViewTransition>
        </>
      )}
      {!loading && <ViewSwitcher value={activeTab} onChange={switchTab} />}
    </div>
  );
}

/** Large-title header with today's progress ring, like Apple's Fitness/Reminders. */
function TodaySummary({ habits }: { habits: Habit[] }) {
  // Rest days (fixed-weekday habits not scheduled today) sit out of the count.
  const statuses = habits.map((h) => todayStatus(h));
  const done = statuses.filter((s) => s === "done").length;
  const total = statuses.filter((s) => s !== "rest").length;
  const allDone = done === total;

  return (
    <section className="flex items-end justify-between gap-4 pt-2 pb-5">
      <div className="flex min-w-0 flex-col">
        <span className="text-[13px] font-semibold tracking-wide text-muted-foreground uppercase">
          {new Date().toLocaleDateString(undefined, {
            weekday: "long",
            day: "numeric",
            month: "long",
          })}
        </span>
        <h1 className="text-[34px] leading-tight font-bold tracking-tight">Today</h1>
        <span className="text-sm text-muted-foreground" aria-live="polite">
          {total === 0
            ? "Rest day. Nothing due."
            : allDone
              ? "All done. Nice work."
              : `${done} of ${total} done`}
        </span>
      </div>
      <ProgressRing value={total ? done / total : 1} />
    </section>
  );
}

function ProgressRing({ value }: { value: number }) {
  const r = 22;
  const c = 2 * Math.PI * r;
  return (
    <svg
      viewBox="0 0 56 56"
      className="size-14 shrink-0 -rotate-90"
      role="img"
      aria-label={`${Math.round(value * 100)}% of today's habits done`}
    >
      <circle cx="28" cy="28" r={r} fill="none" strokeWidth="7" className="stroke-foreground/10" />
      <circle
        cx="28"
        cy="28"
        r={r}
        fill="none"
        strokeWidth="7"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - value)}
        className={cn(
          "transition-[stroke-dashoffset,stroke] duration-700 ease-(--ease-spring)",
          value >= 1 ? "stroke-accent" : "stroke-foreground"
        )}
        style={{ opacity: value === 0 ? 0 : 1 }}
      />
    </svg>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 py-16 text-center">
      <div className="grid grid-cols-2 gap-1.5" aria-hidden="true">
        <span className="size-7 rounded-squircle bg-foreground" />
        <span className="size-7 rounded-squircle bg-muted-foreground" />
        <span className="size-7 rounded-squircle bg-subtle-foreground" />
        <span className="size-7 rounded-squircle border-2 border-dashed border-accent" />
      </div>
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-bold tracking-tight">No habits yet</h1>
        <p className="max-w-64 text-sm text-muted-foreground">
          Start with one small thing you want to do every day.
        </p>
      </div>
      <Button
        size="lg"
        className="rounded-full px-6"
        nativeButton={false}
        render={<Link href="/habits/new" transitionTypes={nav("sheetUp")} />}
      >
        New Habit
      </Button>
    </div>
  );
}

/** Streak / schedule line, or the live countdown while a timer is running. */
function HabitSubtitle({ habit }: { habit: Habit }) {
  const running = isTimerRunning(habit);
  const now = useNow(running);
  if (running && habit.timer) {
    const left = dayTarget(habit) - elapsedSeconds(habit, habit.timer.dateKey, now);
    return (
      <span className="text-xs font-medium text-muted-foreground tabular-nums">
        {formatClock(left)} left
      </span>
    );
  }
  const today = todayKey();
  if (usesSlots(habit) && !habit.history[today] && !habit.skipped[today]) {
    const done = habit.slots[today] ?? [];
    return (
      <span className="truncate text-xs text-muted-foreground">
        {habit.parts.map((p) => `${partLabel(p)}${done.includes(p) ? " ✓" : ""}`).join(" · ")}
      </span>
    );
  }
  return <span className="truncate text-xs text-muted-foreground">{progressLabel(habit)}</span>;
}

interface Item {
  habit: Habit;
  /** For habits checked off once per time of day: which check this card shows. */
  part?: DayPart;
}

interface Section {
  key: string;
  label: string | null;
  isNow: boolean;
  items: Item[];
}

/**
 * Groups today's habits by time of day (Morning / Afternoon / Evening /
 * Any time). With no times of day set anywhere there's one unlabelled
 * section, so the screen looks exactly as before. A habit done several
 * times a day shows once, under the time of day it's waiting on next, and
 * moves along as each check is done.
 */
function sectionsFor(habits: Habit[]): Section[] {
  if (!habits.some((h) => h.parts.length > 0)) {
    return [{ key: "all", label: null, isNow: false, items: habits.map((habit) => ({ habit })) }];
  }
  const now = currentPart();
  const today = todayKey();
  const buckets = new Map<string, Item[]>();
  for (const habit of habits) {
    let part: DayPart | undefined = habit.parts[0];
    if (usesSlots(habit)) {
      const done = new Set(habit.slots[today] ?? []);
      part =
        habit.parts.includes(now) && !done.has(now)
          ? now
          : (habit.parts.find((p) => !done.has(p)) ?? habit.parts.at(-1));
    }
    const key = part ?? "any";
    buckets.set(key, [...(buckets.get(key) ?? []), { habit, part: usesSlots(habit) ? part : undefined }]);
  }
  return [...DAY_PARTS.map((p) => p.value), "any" as const]
    .filter((key) => buckets.has(key))
    .map((key) => ({
      key,
      label: key === "any" ? "Any time" : partLabel(key),
      isNow: key === now,
      items: buckets.get(key)!,
    }));
}

function SectionHeader({ section }: { section: Section }) {
  if (!section.label) return null;
  return (
    <h2 className="flex items-center gap-2 px-1 pt-2 pb-1 text-[13px] font-semibold tracking-wide text-muted-foreground uppercase">
      {section.label}
      {/* Persimmon marks "now". */}
      {section.isNow && <span className="size-1.5 rounded-full bg-accent" aria-label="now" />}
    </h2>
  );
}

function riseProps(animateIn: boolean, i: number) {
  return animateIn
    ? { className: "animate-rise", style: { "--i": i } as React.CSSProperties }
    : { className: "", style: undefined };
}

function HabitLink({
  habit,
  className,
  children,
}: {
  habit: Habit;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={habitHref(habit.id)}
      transitionTypes={nav("push")}
      className={cn("tappable outline-none focus-visible:rounded-lg focus-visible:ring-2 focus-visible:ring-ring/50", className)}
    >
      {children}
    </Link>
  );
}

function Icon({ habit, className }: { habit: Habit; className?: string }) {
  return (
    <HabitIconTransition habitId={habit.id}>
      <HabitIcon
        habitId={habit.id}
        icon={habit.icon}
        colorHex={habit.colorHex}
        className={className}
      />
    </HabitIconTransition>
  );
}

function GridView({
  habits,
  onToggle,
  animateIn,
}: {
  habits: Habit[];
  onToggle: ToggleFn;
  animateIn: boolean;
}) {
  const today = todayKey();
  let i = 0;
  return (
    <div className="flex flex-col gap-3">
      {sectionsFor(habits).map((section) => (
        <section key={section.key} className="flex flex-col gap-2">
          <SectionHeader section={section} />
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
      {section.items.map(({ habit, part }) => {
        const rise = riseProps(animateIn, i++);
        return (
          <Card key={habit.id} className={cn("py-4", rise.className)} style={rise.style}>
            <CardContent className="flex flex-col gap-3.5 px-4">
              <div className="flex items-center gap-3">
                <HabitLink habit={habit} className="flex min-w-0 flex-1 items-center gap-3">
                  <Icon habit={habit} />
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-[15px] font-semibold">{habit.name}</span>
                    <HabitSubtitle habit={habit} />
                  </span>
                </HabitLink>
                <HabitDayToggle
                  habit={habit}
                  dateKey={today}
                  part={part}
                  onToggle={() => onToggle(habit, today, part)}
                  label={toggleLabel(habit, part)}
                />
              </div>
              <Heatmap
                history={habit.history}
                skipped={habit.skipped}
                colorHex={habit.colorHex}
                weeks={HEATMAP_WEEKS}
                schedule={habit.schedule}
              />
            </CardContent>
          </Card>
        );
      })}
          </div>
        </section>
      ))}
    </div>
  );
}

function toggleLabel(habit: Habit, part?: DayPart) {
  return part
    ? `Mark ${habit.name} done this ${partLabel(part).toLowerCase()}`
    : `Mark ${habit.name} done today`;
}

function ListView({
  habits,
  onToggle,
  animateIn,
}: {
  habits: Habit[];
  onToggle: ToggleFn;
  animateIn: boolean;
}) {
  const days = lastNDays(5);
  const today = todayKey();
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-2">
      <div className="flex items-center gap-1.5 px-3 pb-1">
        <span className="min-w-0 flex-1 text-[13px] font-semibold tracking-wide text-muted-foreground uppercase">
          Last 5 days
        </span>
        {days.map((day) => {
          const key = toDateKey(day);
          const isToday = key === today;
          return (
            <span
              key={key}
              className={cn(
                "flex w-8 flex-col items-center text-[11px] leading-tight",
                isToday ? "font-bold text-foreground" : "text-muted-foreground"
              )}
            >
              <span>{day.toLocaleDateString(undefined, { weekday: "narrow" })}</span>
              <span
                className={cn(
                  "mt-0.5 flex size-5 items-center justify-center rounded-full",
                  isToday && "bg-accent text-accent-foreground"
                )}
              >
                {day.getDate()}
              </span>
            </span>
          );
        })}
      </div>
      {habits.map((habit, i) => {
        const rise = riseProps(animateIn, i);
        return (
          <Card key={habit.id} className={cn("py-3", rise.className)} style={rise.style}>
            <CardContent className="flex items-center gap-1.5 px-3">
              <HabitLink habit={habit} className="flex min-w-0 flex-1 items-center gap-3">
                <Icon habit={habit} className="size-9" />
                <span className="truncate text-sm font-semibold">{habit.name}</span>
              </HabitLink>
              {days.map((day) => {
                const key = toDateKey(day);
                return (
                  <HabitDayToggle
                    key={key}
                    habit={habit}
                    dateKey={key}
                    onToggle={() => onToggle(habit, key)}
                    label={`Mark ${habit.name} done on ${key}`}
                    className="size-8"
                  />
                );
              })}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function CompactView({
  habits,
  onToggle,
  animateIn,
}: {
  habits: Habit[];
  onToggle: ToggleFn;
  animateIn: boolean;
}) {
  const today = todayKey();
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-3">
    {sectionsFor(habits).map((section) => (
    <section key={section.key} className="flex flex-col gap-2">
    <SectionHeader section={section} />
    <Card
      className={cn("w-full gap-0 py-0", animateIn && "animate-rise")}
    >
      {section.items.map(({ habit, part }, i) => (
        <React.Fragment key={habit.id}>
          {i > 0 && <div className="ml-[60px] h-px bg-border" />}
          <div className="flex items-center gap-3 py-2.5 pr-3 pl-3">
            <HabitLink habit={habit} className="flex min-w-0 flex-1 items-center gap-3">
              <Icon habit={habit} className="size-9" />
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-[15px] font-medium">{habit.name}</span>
                <HabitSubtitle habit={habit} />
              </span>
            </HabitLink>
            <HabitDayToggle
              habit={habit}
              dateKey={today}
              part={part}
              onToggle={() => onToggle(habit, today, part)}
              label={toggleLabel(habit, part)}
            />
          </div>
        </React.Fragment>
      ))}
    </Card>
    </section>
    ))}
    </div>
  );
}
