/**
 * The dots MCP server: lets an AI agent read and edit the user's habits with
 * the same rules as the app. Served over Streamable HTTP by
 * app/api/mcp/[secret]/route.ts.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

import {
  buildDraft,
  COLOR_NAMES,
  dateKeyIn,
  describeDay,
  describeHabit,
  findHabit,
  habitSettings,
  habitSettingsForAgent,
  HabitInputError,
  ICON_NAMES,
  planLog,
  recentDays,
  rescalePlan,
  wallClock,
  WEEKDAY_NAMES,
} from "@/lib/server/habit-logic";
import {
  applyLog,
  createHabit,
  deleteHabit,
  loadHabits,
  rescaleCompletions,
  type StoreContext,
  updateHabit,
} from "@/lib/server/habit-store";
import { MAX_INTERVAL, MAX_TIMES } from "@/lib/schedule";

const DAY_PART = z.enum(["morning", "afternoon", "evening"]);

const scheduleSchema = z
  .discriminatedUnion("type", [
    z.object({ type: z.literal("daily") }),
    z.object({
      type: z.literal("days"),
      days: z.array(z.enum(WEEKDAY_NAMES)).min(1).describe("Weekdays it happens on"),
    }),
    z.object({
      type: z.literal("period"),
      period: z.enum(["week", "month"]),
      times: z
        .number()
        .int()
        .min(1)
        .max(MAX_TIMES.month)
        .describe(`Days per week (max ${MAX_TIMES.week}) or month (max ${MAX_TIMES.month})`),
    }),
    z.object({
      type: z.literal("interval"),
      every: z.number().int().min(2).max(MAX_INTERVAL).describe("Once every N days"),
    }),
  ])
  .describe(
    "How often: daily; fixed weekdays; any N days a week/month; or once every N days."
  );

const settingsShape = {
  name: z.string().min(1).max(80).describe("Habit name, e.g. \"Read\""),
  description: z.string().max(500).describe("Optional note shown on the habit page"),
  icon: z.enum(ICON_NAMES).describe("Icon name"),
  color: z.enum(COLOR_NAMES).describe("Colour from the dots palette"),
  streak_goal: z
    .number()
    .int()
    .positive()
    .nullable()
    .describe("Streak to aim for (in the schedule's unit), or null for none"),
  goal_type: z
    .enum(["count", "time", "amount", "limit"])
    .describe(
      "count: check off (times_per_day taps); time: minutes of focused time; amount: reach amount_target of amount_unit; limit: stay at or under amount_target"
    ),
  times_per_day: z.number().int().min(1).max(20).describe("count goals: taps to finish a day"),
  minutes: z.number().int().min(1).max(1440).describe("time goals: minutes to finish a day"),
  amount_target: z
    .number()
    .min(0)
    .describe("amount goals: daily target (> 0); limit goals: daily maximum (0 or more)"),
  amount_unit: z.string().max(12).describe("amount/limit goals: unit, e.g. \"ml\", \"pages\""),
  amount_step: z.number().positive().describe("amount/limit goals: how much one tap in the app adds"),
  schedule: scheduleSchema,
  times_of_day: z
    .array(DAY_PART)
    .max(3)
    .describe(
      "When in the day; empty = any time. Several are only allowed for count goals (one check each)."
    ),
};

const habitRef = z.string().min(1).describe("Habit id, or its name (a unique part of it works)");
const dateArg = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .optional()
  .describe("Day as YYYY-MM-DD in the user's time zone; defaults to today");

function json(value: unknown): CallToolResult {
  return { content: [{ type: "text", text: JSON.stringify(value, null, 2) }] };
}

function failure(message: string): CallToolResult {
  return { isError: true, content: [{ type: "text", text: message }] };
}

/** Runs a tool body, turning expected problems into readable tool errors. */
async function run(body: () => Promise<CallToolResult>): Promise<CallToolResult> {
  try {
    return await body();
  } catch (err) {
    if (err instanceof HabitInputError) return failure(err.message);
    console.error("[dots mcp]", err);
    return failure(`Something went wrong: ${err instanceof Error ? err.message : String(err)}`);
  }
}

export interface DotsMcpOptions {
  store: () => Promise<StoreContext>;
  /** Injected in tests. */
  now?: () => Date;
}

export function createDotsMcpServer({ store, now = () => new Date() }: DotsMcpOptions) {
  const server = new McpServer(
    { name: "dots", version: "1.0.0" },
    {
      instructions:
        "dots is the user's habit tracker. Each day of a habit is a dot that is done, part-done, skipped or empty. " +
        "Call list_habits first to see today's habits and their ids. Dates are YYYY-MM-DD in the user's time zone. " +
        "Use log_habit to tick off or log progress, and ask the user before delete_habit.",
    }
  );

  /** Loads habits and the clocks they're evaluated against. */
  async function load() {
    const ctx = await store();
    const instant = now();
    const habits = await loadHabits(ctx, instant);
    return { ctx, habits, nowMs: instant.getTime(), wallNow: wallClock(instant, ctx.timeZone) };
  }

  function checkDate(date: string | undefined, today: string) {
    const key = date ?? today;
    if (Number.isNaN(Date.parse(`${key}T00:00:00Z`))) throw new HabitInputError(`"${key}" isn't a date.`);
    if (key > today) throw new HabitInputError(`${key} is in the future; today is ${today}.`);
    return key;
  }

  server.registerTool(
    "list_habits",
    {
      title: "List habits",
      description:
        "Every habit with today's status (done / due / rest / skipped), today's progress and current streak.",
      annotations: { readOnlyHint: true },
    },
    () =>
      run(async () => {
        const { ctx, habits, nowMs, wallNow } = await load();
        return json({
          today: dateKeyIn(new Date(nowMs), ctx.timeZone),
          time_zone: ctx.timeZone,
          habits: habits.map((h) => describeHabit(h, wallNow, nowMs)),
        });
      })
  );

  server.registerTool(
    "get_habit",
    {
      title: "Get a habit",
      description: "One habit's settings, streak and day-by-day log for recent days.",
      inputSchema: {
        habit: habitRef,
        days: z.number().int().min(1).max(366).default(14).describe("How many recent days to include"),
      },
      annotations: { readOnlyHint: true },
    },
    ({ habit, days }) =>
      run(async () => {
        const { habits, nowMs, wallNow } = await load();
        const h = findHabit(habits, habit);
        return json({
          ...describeHabit(h, wallNow, nowMs),
          settings: habitSettingsForAgent(h),
          days: recentDays(wallNow, days).map((key) => describeDay(h, key, nowMs)),
        });
      })
  );

  server.registerTool(
    "log_habit",
    {
      title: "Log a habit",
      description:
        "Logs one day of a habit, like tapping its dot in the app. Actions: complete (mark the day done; for habits " +
        "with several times of day, pass part to tick just one), add / set (log an amount: taps for count goals, minutes for " +
        "time goals, the habit's unit for amount and limit goals), clear (empty the day), skip (sick, travelling: " +
        "neither counts nor breaks the streak) and unskip.",
      inputSchema: {
        habit: habitRef,
        action: z.enum(["complete", "add", "set", "clear", "skip", "unskip"]),
        date: dateArg,
        amount: z.number().optional().describe("For add / set: taps, minutes, or the habit's unit"),
        part: DAY_PART.optional().describe("For complete: one time of day, on habits that have several"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    ({ habit, action, date, amount, part }) =>
      run(async () => {
        const first = await load();
        const h = findHabit(first.habits, habit);
        const dateKey = checkDate(date, dateKeyIn(new Date(first.nowMs), first.ctx.timeZone));
        const plan = planLog(h, dateKey, action, { amount, part, nowMs: first.nowMs });
        await applyLog(first.ctx, h.id, dateKey, plan);
        const after = await load();
        const updated = findHabit(after.habits, h.id);
        return json({
          habit: updated.name,
          day: describeDay(updated, dateKey, after.nowMs),
          today: describeHabit(updated, after.wallNow, after.nowMs).today.progress,
          ...(plan.stopTimer ? { note: "Stopped the countdown that was running for this day." } : {}),
        });
      })
  );

  server.registerTool(
    "create_habit",
    {
      title: "Create a habit",
      description:
        "Adds a habit. Only name is required: by default it's a daily check-off. Set goal_type and its fields " +
        "(times_per_day, minutes, or amount_target / amount_unit / amount_step) for other goals.",
      inputSchema: {
        ...settingsShape,
        description: settingsShape.description.optional(),
        icon: settingsShape.icon.optional(),
        color: settingsShape.color.optional(),
        streak_goal: settingsShape.streak_goal.optional(),
        goal_type: settingsShape.goal_type.optional(),
        times_per_day: settingsShape.times_per_day.optional(),
        minutes: settingsShape.minutes.optional(),
        amount_target: settingsShape.amount_target.optional(),
        amount_unit: settingsShape.amount_unit.optional(),
        amount_step: settingsShape.amount_step.optional(),
        schedule: settingsShape.schedule.optional(),
        times_of_day: settingsShape.times_of_day.optional(),
      },
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    (input) =>
      run(async () => {
        const ctx = await store();
        const draft = buildDraft(input);
        const id = await createHabit(ctx, draft);
        const { habits, nowMs, wallNow } = await load();
        const h = findHabit(habits, id);
        return json({ created: describeHabit(h, wallNow, nowMs), settings: habitSettingsForAgent(h) });
      })
  );

  server.registerTool(
    "update_habit",
    {
      title: "Edit a habit",
      description:
        "Changes a habit's settings; leave out anything that stays the same. Changing goal_type converts past days " +
        "like the app does: finished days stay finished, part-done days are cleared (to or from a limit, logged days are cleared).",
      inputSchema: {
        habit: habitRef,
        name: settingsShape.name.optional(),
        description: settingsShape.description.optional(),
        icon: settingsShape.icon.optional(),
        color: settingsShape.color.optional(),
        streak_goal: settingsShape.streak_goal.optional(),
        goal_type: settingsShape.goal_type.optional(),
        times_per_day: settingsShape.times_per_day.optional(),
        minutes: settingsShape.minutes.optional(),
        amount_target: settingsShape.amount_target.optional(),
        amount_unit: settingsShape.amount_unit.optional(),
        amount_step: settingsShape.amount_step.optional(),
        schedule: settingsShape.schedule.optional(),
        times_of_day: settingsShape.times_of_day.optional(),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    ({ habit, ...input }) =>
      run(async () => {
        const first = await load();
        const before = findHabit(first.habits, habit);
        const draft = buildDraft(input, habitSettings(before));
        await updateHabit(first.ctx, before.id, draft);
        const rescale = rescalePlan(before, draft);
        if (rescale) await rescaleCompletions(first.ctx, before.id, rescale, !!before.timer);
        const after = await load();
        const h = findHabit(after.habits, before.id);
        return json({
          updated: describeHabit(h, after.wallNow, after.nowMs),
          settings: habitSettingsForAgent(h),
          ...(rescale ? { note: "Goal type changed: past days were converted." } : {}),
        });
      })
  );

  server.registerTool(
    "delete_habit",
    {
      title: "Delete a habit",
      description: "Permanently deletes a habit and its whole history. Confirm with the user first.",
      inputSchema: { habit: habitRef },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
    },
    ({ habit }) =>
      run(async () => {
        const { ctx, habits } = await load();
        const h = findHabit(habits, habit);
        await deleteHabit(ctx, h.id);
        return json({ deleted: h.name, id: h.id });
      })
  );

  return server;
}
