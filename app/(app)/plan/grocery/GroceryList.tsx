"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toggleGroceryItem, type GroceryItemView } from "@/domains/grocery/service";

const SECTION_LABELS: Record<string, string> = {
  produce: "Produce",
  protein: "Protein",
  dairy: "Dairy",
  bakery: "Bakery",
  frozen: "Frozen",
  pantry: "Pantry",
  other: "Other",
};

export function GroceryList({ userId, items }: { userId: string; items: GroceryItemView[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [checked, setChecked] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(items.map((i) => [i.id, i.isChecked]))
  );

  const bySection = new Map<string, GroceryItemView[]>();
  for (const item of items) {
    const arr = bySection.get(item.section) ?? [];
    arr.push(item);
    bySection.set(item.section, arr);
  }

  const onToggle = (itemId: string, value: boolean) => {
    setChecked((c) => ({ ...c, [itemId]: value }));
    startTransition(async () => {
      await toggleGroceryItem(userId, itemId, value);
      router.refresh();
    });
  };

  return (
    <div className="space-y-6">
      {Array.from(bySection.entries()).map(([section, sectionItems]) => (
        <div key={section}>
          <h2 className="text-sm font-medium text-neutral-500">
            {SECTION_LABELS[section] ?? section}
          </h2>
          <ul className="mt-2 space-y-1">
            {sectionItems.map((item) => (
              <li key={item.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={checked[item.id] ?? false}
                  onChange={(e) => onToggle(item.id, e.target.checked)}
                />
                <span className={checked[item.id] ? "text-neutral-400 line-through" : ""}>
                  {item.quantity ? `${item.quantity} ${item.unit ?? ""} ` : ""}
                  {item.name}
                </span>
                <span className="text-xs text-neutral-400">
                  ({item.neededFor.join(", ")})
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
