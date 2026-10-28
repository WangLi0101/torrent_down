import type { AccentId } from "../api/types";

export interface AccentPreset {
  id: AccentId;
  name: string;
  swatch: string;
}

export const ACCENTS: AccentPreset[] = [
  { id: "violet", name: "紫罗兰", swatch: "#5B57E8" },
  { id: "ocean", name: "深海", swatch: "#0B6BCB" },
  { id: "forest", name: "森野", swatch: "#0E7C5A" },
  { id: "amber", name: "琥珀", swatch: "#A9570A" },
];

export function getAccent(id: AccentId): AccentPreset {
  return ACCENTS.find((accent) => accent.id === id) ?? ACCENTS[0];
}