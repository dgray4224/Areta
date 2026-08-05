export type BarcodeLookupResult =
  | {
      found: true;
      food: string;
      caloriesPer100g: number | null;
      proteinPer100g: number | null;
      carbohydratesPer100g: number | null;
      fatPer100g: number | null;
      fiberPer100g: number | null;
      servingSize: string | null;
    }
  | { found: false };

const OPEN_FOOD_FACTS_TIMEOUT_MS = 8000;

/**
 * Resolves a scanned UPC/EAN to per-100g nutrition facts via Open Food
 * Facts (free, no API key -- https://world.openfoodfacts.org). Returns
 * per-100g values rather than pre-scaling to a serving: a lookup can't
 * know the real portion eaten, so the mobile client scales by the
 * quantity the user actually confirms before logging.
 */
export async function lookupBarcode(upc: string): Promise<BarcodeLookupResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OPEN_FOOD_FACTS_TIMEOUT_MS);
  try {
    const response = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(upc)}.json`,
      {
        signal: controller.signal,
        headers: { "User-Agent": "Areta/1.0 (nutrition-barcode-lookup)" },
      }
    );
    if (!response.ok) return { found: false };

    const data = await response.json();
    if (data.status !== 1 || !data.product) return { found: false };

    const product = data.product;
    const nutriments = product.nutriments ?? {};
    const numberOrNull = (v: unknown): number | null => (typeof v === "number" ? v : null);

    return {
      found: true,
      food: product.product_name || product.generic_name || "Unknown product",
      caloriesPer100g: numberOrNull(nutriments["energy-kcal_100g"]),
      proteinPer100g: numberOrNull(nutriments["proteins_100g"]),
      carbohydratesPer100g: numberOrNull(nutriments["carbohydrates_100g"]),
      fatPer100g: numberOrNull(nutriments["fat_100g"]),
      fiberPer100g: numberOrNull(nutriments["fiber_100g"]),
      servingSize: typeof product.serving_size === "string" ? product.serving_size : null,
    };
  } catch {
    // Timeout, network error, or unexpected response shape -- treat all as
    // "not found" so the caller falls back to manual entry rather than
    // surfacing a scary error for what's an optional convenience feature.
    return { found: false };
  } finally {
    clearTimeout(timeout);
  }
}
