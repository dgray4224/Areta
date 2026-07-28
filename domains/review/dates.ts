/** Not a Server Action file ("use server" files may only export async
 * functions) — these plain date helpers are shared by service.ts and
 * approve-flow.ts. */
export function reviewWeekStart(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 6);
  return d.toISOString().slice(0, 10);
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}
