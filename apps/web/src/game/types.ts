export type AttackKind =
  | "punch"
  | "slap"
  | "tomato"
  | "egg"
  | "mallet"
  | "fish"
  | "pie"
  | "chili"
  | "noodles";

/** Normalized face landmark; z is relative depth, negative toward the viewer. */
export interface Landmark3 {
  x: number;
  y: number;
  z: number;
}
