import * as React from "react";

import { WEEKS_PER_YEAR, type LifeStats } from "@/lib/life";

const CELL = 10;
const RADIUS = 3.6;
const LEFT = 24;
const TOP = 16;

/**
 * Your life in weeks: one row per year of life, one dot per week. Weeks
 * lived are ink, this week is persimmon (the brand's "now"), the rest are
 * faint.
 */
export function LifeGrid({
  stats,
  years,
}: {
  stats: LifeStats;
  years: number;
}) {
  const width = LEFT + WEEKS_PER_YEAR * CELL;
  const height = TOP + years * CELL;

  // Two compound paths (lived / ahead) keep the DOM light: ~4,700 dots, 2 nodes.
  const { lived, ahead } = React.useMemo(() => {
    const dot = (cx: number, cy: number) =>
      `M${cx - RADIUS} ${cy}a${RADIUS} ${RADIUS} 0 1 0 ${RADIUS * 2} 0a${RADIUS} ${RADIUS} 0 1 0 ${-RADIUS * 2} 0`;
    let livedD = "";
    let aheadD = "";
    for (let year = 0; year < years; year++) {
      for (let week = 0; week < WEEKS_PER_YEAR; week++) {
        const index = year * WEEKS_PER_YEAR + week;
        if (index === stats.currentWeek) continue;
        const d = dot(
          LEFT + week * CELL + CELL / 2,
          TOP + year * CELL + CELL / 2,
        );
        if (index < stats.currentWeek) livedD += d;
        else aheadD += d;
      }
    }
    return { lived: livedD, ahead: aheadD };
  }, [years, stats.currentWeek]);

  const showNow = stats.currentWeek < years * WEEKS_PER_YEAR;
  const nowX = LEFT + stats.weekOfYear * CELL + CELL / 2;
  const nowY = TOP + stats.ageYears * CELL + CELL / 2;

  const weekTicks = [1, 10, 20, 30, 40, 52];
  const yearTicks = Array.from(
    { length: Math.floor((years - 1) / 5) + 1 },
    (_, i) => i * 5,
  );

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-auto w-full select-none"
      role="img"
      aria-label={`Your life in weeks: ${stats.weeksLived.toLocaleString()} of ${stats.totalWeeks.toLocaleString()} weeks lived.`}
    >
      <g
        className="fill-muted-foreground text-[7px] tabular-nums"
        aria-hidden="true"
      >
        {weekTicks.map((w) => (
          <text
            key={w}
            x={LEFT + (w - 1) * CELL + CELL / 2}
            y={TOP - 6}
            textAnchor="middle"
          >
            {w}
          </text>
        ))}
        {yearTicks.map((y) => (
          <text
            key={y}
            x={LEFT - 6}
            y={TOP + y * CELL + CELL / 2}
            textAnchor="end"
            dominantBaseline="central"
          >
            {y}
          </text>
        ))}
      </g>
      <path d={ahead} className="fill-foreground/[0.11]" />
      <path d={lived} className="fill-foreground" />
      {showNow && (
        <g>
          <circle
            cx={nowX}
            cy={nowY}
            r={RADIUS + 2.4}
            className="fill-accent/30 motion-safe:animate-ping"
            style={{
              transformOrigin: `${nowX}px ${nowY}px`,
              transformBox: "view-box",
            }}
          />
          <circle
            cx={nowX}
            cy={nowY}
            r={RADIUS + 0.6}
            className="fill-accent"
          />
        </g>
      )}
    </svg>
  );
}
