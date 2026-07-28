import { requireUser } from "@/platform/auth/session";
import { SleepLogForm } from "./SleepLogForm";

export default async function SleepLogPage() {
  const user = await requireUser();
  return <SleepLogForm userId={user.id} />;
}
