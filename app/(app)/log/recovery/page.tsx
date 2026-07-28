import { requireUser } from "@/platform/auth/session";
import { RecoveryLogForm } from "./RecoveryLogForm";

export default async function RecoveryLogPage() {
  const user = await requireUser();
  return <RecoveryLogForm userId={user.id} />;
}
