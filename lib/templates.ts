/**
 * Starter habits shown on the New Habit sheet. Picking one fills the form;
 * everything stays editable before saving.
 */
import type { HabitDraft } from "@/lib/types";

export interface HabitTemplate {
  id: string;
  draft: HabitDraft;
}

const base: Omit<HabitDraft, "name" | "icon" | "colorHex"> = {
  description: "",
  streakGoal: null,
  goalType: "count",
  completionsPerDay: 1,
  durationMinutes: 15,
  amountTarget: 1,
  amountUnit: "",
  amountStep: 1,
  schedule: { type: "daily" },
  parts: [],
};

function t(id: string, draft: Partial<HabitDraft> & Pick<HabitDraft, "name" | "icon" | "colorHex">): HabitTemplate {
  return { id, draft: { ...base, ...draft } };
}

export const HABIT_TEMPLATES: HabitTemplate[] = [
  t("water", {
    name: "Drink water",
    icon: "droplets",
    colorHex: "#2e6f9e",
    goalType: "amount",
    amountTarget: 2000,
    amountUnit: "ml",
    amountStep: 250,
  }),
  t("teeth", {
    name: "Brush teeth",
    icon: "smile",
    colorHex: "#2c7873",
    parts: ["morning", "evening"],
    completionsPerDay: 2,
  }),
  t("read", {
    name: "Read",
    icon: "book",
    colorHex: "#4a58a8",
    goalType: "time",
    durationMinutes: 20,
    parts: ["evening"],
  }),
  t("meditate", {
    name: "Meditate",
    icon: "brain",
    colorHex: "#7059ae",
    goalType: "time",
    durationMinutes: 10,
    parts: ["morning"],
  }),
  t("walk", {
    name: "Walk",
    icon: "footprints",
    colorHex: "#3b7a4b",
    goalType: "amount",
    amountTarget: 8000,
    amountUnit: "steps",
    amountStep: 1000,
  }),
  t("workout", {
    name: "Work out",
    icon: "dumbbell",
    colorHex: "#b8502f",
    schedule: { type: "period", period: "week", times: 3 },
  }),
  t("vitamins", {
    name: "Take vitamins",
    icon: "heart",
    colorHex: "#bc4560",
    parts: ["morning"],
  }),
  t("journal", {
    name: "Journal",
    icon: "pen",
    colorHex: "#9c6b12",
    parts: ["evening"],
  }),
  t("plants", {
    name: "Water plants",
    icon: "sprout",
    colorHex: "#69752a",
    schedule: { type: "interval", every: 3 },
  }),
  t("family", {
    name: "Call family",
    icon: "heart",
    colorHex: "#97497f",
    schedule: { type: "period", period: "week", times: 1 },
  }),
  t("coffee", {
    name: "Coffee",
    icon: "coffee",
    colorHex: "#4f5d70",
    goalType: "limit",
    amountTarget: 2,
    amountUnit: "cups",
  }),
  t("junk", {
    name: "No junk food",
    icon: "utensils",
    colorHex: "#22242e",
    goalType: "limit",
    amountTarget: 0,
    amountUnit: "snacks",
  }),
];
