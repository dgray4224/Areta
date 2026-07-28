import { requireUser } from "@/platform/auth/session";
import { StudySessionForm } from "./StudySessionForm";

export default async function LearningLogPage() {
  const user = await requireUser();
  return <StudySessionForm userId={user.id} />;
}
