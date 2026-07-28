export type IngredientNeed = {
  name: string;
  quantity: number;
  unit: string;
  section: string;
  recipeName: string;
};

export type InventoryEntry = {
  name: string;
  quantity: number;
  unit: string | null;
};

export type GroceryItemDraft = {
  name: string;
  quantity: number;
  unit: string;
  section: string;
  neededFor: string[];
};

/** Store-aisle ordering for a sensible walkthrough (CLAUDE.md "Group by
 * store section"). Anything unrecognized falls to the end. */
const SECTION_ORDER = ["produce", "protein", "dairy", "bakery", "frozen", "pantry", "other"];

function sectionRank(section: string): number {
  const idx = SECTION_ORDER.indexOf(section);
  return idx === -1 ? SECTION_ORDER.length : idx;
}

/**
 * Deterministic grocery-list builder (CLAUDE.md "Grocery-list rules"):
 * combines duplicate ingredients, subtracts on-hand inventory, and groups
 * by store section. Pure — no I/O, fully unit-testable.
 */
export function generateGroceryList(
  needs: IngredientNeed[],
  inventory: InventoryEntry[] = []
): GroceryItemDraft[] {
  const groups = new Map<string, GroceryItemDraft>();

  for (const need of needs) {
    const key = `${need.name.trim().toLowerCase()}|${need.unit.trim().toLowerCase()}`;
    const existing = groups.get(key);
    if (existing) {
      existing.quantity += need.quantity;
      if (!existing.neededFor.includes(need.recipeName)) {
        existing.neededFor.push(need.recipeName);
      }
    } else {
      groups.set(key, {
        name: need.name,
        quantity: need.quantity,
        unit: need.unit,
        section: need.section,
        neededFor: [need.recipeName],
      });
    }
  }

  const inventoryByKey = new Map<string, number>();
  for (const item of inventory) {
    const key = `${item.name.trim().toLowerCase()}|${(item.unit ?? "").trim().toLowerCase()}`;
    inventoryByKey.set(key, (inventoryByKey.get(key) ?? 0) + item.quantity);
  }

  const result: GroceryItemDraft[] = [];
  for (const [key, item] of groups) {
    const onHand = inventoryByKey.get(key) ?? 0;
    const remaining = Math.max(item.quantity - onHand, 0);
    if (remaining <= 0) continue;
    result.push({ ...item, quantity: Math.round(remaining * 100) / 100 });
  }

  return result.sort(
    (a, b) => sectionRank(a.section) - sectionRank(b.section) || a.name.localeCompare(b.name)
  );
}
