import { redirect } from "next/navigation";

// Experts/Sources/Claims/Limitation-rules merged into one Evidence tab,
// 2026-08-06 (see AdminNav.tsx comment). Kept as a redirect rather than
// deleted so old bookmarks/links still land somewhere useful.
export default function LimitationRulesRedirectPage() {
  redirect("/admin/evidence");
}
