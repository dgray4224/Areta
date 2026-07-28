import { requireUser } from "@/platform/auth/session";
import { NutritionLogForm } from "./NutritionLogForm";

export default async function NutritionLogPage() {
  const user = await requireUser();
  return <NutritionLogForm userId={user.id} />;
}
