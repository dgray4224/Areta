import { requireUser } from "@/platform/auth/session";
import { ExerciseLogForm } from "./ExerciseLogForm";

export default async function ExerciseLogPage() {
  const user = await requireUser();
  return <ExerciseLogForm userId={user.id} />;
}
