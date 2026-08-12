export type RichTextSegment = { text: string; bold?: boolean; italic?: boolean };

/** Splits on **bold** and *italic* only — the exact markdown-lite subset
 * domains/review/brief-schema.ts's `narrative`/`highestLeverageAction`
 * fields are prompted to use, never nested, never any other marker. A
 * real markdown parser would be overkill for two flat markers with a
 * controlled producer (the LLM's forced tool-use schema). Mirrored (not
 * shared — no cross-repo package) in areta-mobile's lib/ui/RichText.tsx. */
export function parseRichText(input: string): RichTextSegment[] {
  const segments: RichTextSegment[] = [];
  const pattern = /\*\*(.+?)\*\*|\*(.+?)\*/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(input)) !== null) {
    if (match.index > lastIndex) segments.push({ text: input.slice(lastIndex, match.index) });
    if (match[1] !== undefined) segments.push({ text: match[1], bold: true });
    else if (match[2] !== undefined) segments.push({ text: match[2], italic: true });
    lastIndex = pattern.lastIndex;
  }
  if (lastIndex < input.length) segments.push({ text: input.slice(lastIndex) });
  return segments;
}

/** Renders one string of the AI weekly brief's markdown-lite prose as
 * <strong>/<em> spans. */
export function RichText({ text, className }: { text: string; className?: string }) {
  const segments = parseRichText(text);
  return (
    <span className={className}>
      {segments.map((seg, i) =>
        seg.bold ? (
          <strong key={i}>{seg.text}</strong>
        ) : seg.italic ? (
          <em key={i}>{seg.text}</em>
        ) : (
          <span key={i}>{seg.text}</span>
        )
      )}
    </span>
  );
}
