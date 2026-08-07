import Link from "next/link";
import { NewProgramTabs } from "./NewProgramTabs";

export default function NewTrainerProgramPage() {
  return (
    <div className="space-y-6">
      <Link href="/trainer/programs" className="text-sm text-neutral-500 hover:underline">
        ← Your workout programs
      </Link>
      <h2 className="text-lg font-semibold">New program</h2>
      <NewProgramTabs />
    </div>
  );
}
