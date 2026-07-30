import Link from "next/link";
import { requireUser } from "@/platform/auth/session";
import { EmptyState } from "@/platform/ui/EmptyState";
import { getGroceryListForWeek } from "@/domains/grocery/service";
import { GroceryList } from "./GroceryList";
import { GenerateGroceryListButton } from "./GenerateGroceryListButton";

export default async function GroceryPage() {
  const user = await requireUser();
  const items = await getGroceryListForWeek(user.id);

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-10">
      <Link href="/plan/setup" className="text-sm text-neutral-500 hover:underline">
        ← Back to plan
      </Link>
      <h1 className="text-2xl font-semibold">Grocery list</h1>

      {items.length === 0 ? (
        <EmptyState
          title="No grocery list yet"
          description="Approve a meal plan first — the grocery list is built from that week's recipes."
          action={<GenerateGroceryListButton userId={user.id} />}
        />
      ) : (
        <>
          <GroceryList userId={user.id} items={items} />
          <GenerateGroceryListButton userId={user.id} />
        </>
      )}
    </div>
  );
}
