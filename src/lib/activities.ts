export type ActivityCategory = "cardio" | "strength" | "martial" | "sport" | "wellness";

export type DetailField = {
  key: string;
  label: string;
  kind: "number" | "text" | "duration";
  unit?: string;
  placeholder?: string;
};

export type Activity = {
  id: string;
  name: string;
  emoji: string;
  category: ActivityCategory;
  basePoints: number;
  /** Bonus points per 10 minutes of logged duration. 0 means no duration bonus. */
  durationBonusPer10Min: number;
  details: DetailField[];
  /** A wellness habit is a yes/no check; exercise-style activities can optionally log details. */
  kind: "exercise" | "habit";
};

const durationField: DetailField = {
  key: "duration_min",
  label: "Duration",
  kind: "duration",
  unit: "min",
  placeholder: "e.g. 45",
};

export const ACTIVITIES: Activity[] = [
  {
    id: "run",
    name: "Run",
    emoji: "🏃",
    category: "cardio",
    basePoints: 10,
    durationBonusPer10Min: 1,
    kind: "exercise",
    details: [
      durationField,
      { key: "distance_km", label: "Distance", kind: "number", unit: "km", placeholder: "e.g. 5" },
      { key: "pace", label: "Pace", kind: "text", placeholder: "e.g. 5:30/km" },
    ],
  },
  {
    id: "swim",
    name: "Swim",
    emoji: "🏊",
    category: "cardio",
    basePoints: 10,
    durationBonusPer10Min: 1,
    kind: "exercise",
    details: [
      durationField,
      { key: "distance_m", label: "Distance", kind: "number", unit: "m", placeholder: "e.g. 1500" },
    ],
  },
  {
    id: "bike",
    name: "Bike",
    emoji: "🚴",
    category: "cardio",
    basePoints: 10,
    durationBonusPer10Min: 1,
    kind: "exercise",
    details: [
      durationField,
      { key: "distance_km", label: "Distance", kind: "number", unit: "km", placeholder: "e.g. 20" },
    ],
  },
  {
    id: "strength",
    name: "Strength",
    emoji: "🏋️",
    category: "strength",
    basePoints: 10,
    durationBonusPer10Min: 1,
    kind: "exercise",
    details: [
      durationField,
      { key: "sets", label: "Sets", kind: "number", placeholder: "e.g. 20" },
      { key: "focus", label: "Focus", kind: "text", placeholder: "e.g. push / pull / legs" },
    ],
  },
  {
    id: "martial",
    name: "Martial Arts",
    emoji: "🥋",
    category: "martial",
    basePoints: 10,
    durationBonusPer10Min: 1,
    kind: "exercise",
    details: [
      durationField,
      { key: "style", label: "Style", kind: "text", placeholder: "e.g. BJJ, Muay Thai" },
    ],
  },
  {
    id: "soccer",
    name: "Soccer",
    emoji: "⚽",
    category: "sport",
    basePoints: 10,
    durationBonusPer10Min: 1,
    kind: "exercise",
    details: [durationField],
  },
  {
    id: "tennis",
    name: "Tennis",
    emoji: "🎾",
    category: "sport",
    basePoints: 10,
    durationBonusPer10Min: 1,
    kind: "exercise",
    details: [durationField],
  },
  {
    id: "other_sport",
    name: "Other Sport",
    emoji: "🏅",
    category: "sport",
    basePoints: 10,
    durationBonusPer10Min: 1,
    kind: "exercise",
    details: [
      durationField,
      { key: "sport", label: "Sport", kind: "text", placeholder: "e.g. climbing, volleyball" },
    ],
  },
  {
    id: "stretch",
    name: "Stretching",
    emoji: "🧘",
    category: "wellness",
    basePoints: 5,
    durationBonusPer10Min: 0,
    kind: "habit",
    details: [],
  },
  {
    id: "reading",
    name: "Reading",
    emoji: "📖",
    category: "wellness",
    basePoints: 5,
    durationBonusPer10Min: 0,
    kind: "habit",
    details: [
      { key: "pages", label: "Pages", kind: "number", unit: "pages", placeholder: "e.g. 20" },
    ],
  },
  {
    id: "water",
    name: "Water (8+ glasses)",
    emoji: "💧",
    category: "wellness",
    basePoints: 5,
    durationBonusPer10Min: 0,
    kind: "habit",
    details: [],
  },
  {
    id: "sleep",
    name: "Sleep 7h+",
    emoji: "😴",
    category: "wellness",
    basePoints: 5,
    durationBonusPer10Min: 0,
    kind: "habit",
    details: [],
  },
  {
    id: "no_alcohol",
    name: "No Alcohol",
    emoji: "🚫",
    category: "wellness",
    basePoints: 5,
    durationBonusPer10Min: 0,
    kind: "habit",
    details: [],
  },
  {
    id: "healthy_meals",
    name: "Healthy Meals",
    emoji: "🥗",
    category: "wellness",
    basePoints: 5,
    durationBonusPer10Min: 0,
    kind: "habit",
    details: [],
  },
  {
    id: "work_hours",
    name: "Work Hours Hit",
    emoji: "💼",
    category: "wellness",
    basePoints: 5,
    durationBonusPer10Min: 0,
    kind: "habit",
    details: [],
  },
];

export const ACTIVITY_BY_ID: Record<string, Activity> = Object.fromEntries(
  ACTIVITIES.map((a) => [a.id, a]),
);

export const CATEGORY_LABELS: Record<ActivityCategory, string> = {
  cardio: "Cardio",
  strength: "Strength",
  martial: "Martial Arts",
  sport: "Sports",
  wellness: "Wellness",
};
