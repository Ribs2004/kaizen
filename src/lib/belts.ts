export type Belt = {
  id: string;
  name: string;
  threshold: number;
  color: string;
  /** Tailwind-safe gradient for progress bars and badges. */
  gradient: string;
};

export const BELTS: Belt[] = [
  { id: "white",  name: "White",  threshold: 0,      color: "#f5f5f7", gradient: "from-zinc-200 to-zinc-50" },
  { id: "yellow", name: "Yellow", threshold: 500,    color: "#facc15", gradient: "from-yellow-400 to-amber-300" },
  { id: "orange", name: "Orange", threshold: 1500,   color: "#fb923c", gradient: "from-orange-500 to-amber-400" },
  { id: "green",  name: "Green",  threshold: 3500,   color: "#22c55e", gradient: "from-emerald-500 to-lime-400" },
  { id: "blue",   name: "Blue",   threshold: 7000,   color: "#3b82f6", gradient: "from-blue-500 to-cyan-400" },
  { id: "purple", name: "Purple", threshold: 12000,  color: "#a855f7", gradient: "from-purple-500 to-fuchsia-400" },
  { id: "brown",  name: "Brown",  threshold: 20000,  color: "#92400e", gradient: "from-amber-800 to-orange-700" },
  { id: "black",  name: "Black",  threshold: 35000,  color: "#18181b", gradient: "from-zinc-800 to-zinc-950" },
  { id: "dan1",   name: "1st Dan", threshold: 60000, color: "#ffd700", gradient: "from-yellow-500 via-amber-400 to-yellow-600" },
  { id: "dan2",   name: "2nd Dan", threshold: 100000, color: "#ffd700", gradient: "from-yellow-500 via-amber-400 to-yellow-600" },
  { id: "dan3",   name: "3rd Dan", threshold: 160000, color: "#ffd700", gradient: "from-yellow-500 via-amber-400 to-yellow-600" },
  { id: "dan4",   name: "4th Dan", threshold: 240000, color: "#ffd700", gradient: "from-yellow-500 via-amber-400 to-yellow-600" },
];

export type BeltProgress = {
  current: Belt;
  next: Belt | null;
  totalPoints: number;
  pointsIntoBelt: number;
  pointsToNext: number;
  percent: number;
};

export function beltProgressFor(totalPoints: number): BeltProgress {
  const pts = Math.max(0, Math.floor(totalPoints));
  let currentIdx = 0;
  for (let i = 0; i < BELTS.length; i++) {
    if (pts >= BELTS[i].threshold) currentIdx = i;
    else break;
  }
  const current = BELTS[currentIdx];
  const next = BELTS[currentIdx + 1] ?? null;
  const pointsIntoBelt = pts - current.threshold;
  const pointsToNext = next ? next.threshold - pts : 0;
  const span = next ? next.threshold - current.threshold : 1;
  const percent = next ? Math.min(100, Math.max(0, (pointsIntoBelt / span) * 100)) : 100;
  return { current, next, totalPoints: pts, pointsIntoBelt, pointsToNext, percent };
}
