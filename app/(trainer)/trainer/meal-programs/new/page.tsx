import Link from "next/link";
import { NewMealProgramForm } from "./NewMealProgramForm";

export default function NewTrainerMealProgramPage() {
  return (
    <div className="space-y-6">
      <Link href="/trainer/meal-programs" className="text-sm text-neutral-500 hover:underline">
        ← Your nutrition programs
      </Link>
      <h2 className="text-lg font-semibold">New nutrition program</h2>
      <NewMealProgramForm />
    </div>
  );
}
