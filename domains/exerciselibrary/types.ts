export type Exercise = {
  id: string;
  name: string;
  movementPattern: string;
  equipmentRequired: string[];
  archetypeTags: string[];
  difficulty: "beginner" | "intermediate" | "advanced";
  primaryMuscleGroups: string[];
  instructions: string | null;
};
