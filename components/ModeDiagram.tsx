import type { Mode } from "@/lib/engine/deck-code";

/** Small line drawings printed on the felt: how cards move in each structure. */
export function ModeDiagram({ mode, className = "" }: { mode: Mode; className?: string }) {
  const stroke = "currentColor";
  if (mode === "stack") {
    return (
      <svg viewBox="0 0 120 90" className={className} fill="none" stroke={stroke} strokeWidth="1.5" aria-hidden>
        {[0, 1, 2].map((i) => (
          <rect key={i} x="35" y={34 + i * 16} width="50" height="12" rx="2.5" opacity={i === 0 ? 1 : 0.55} />
        ))}
        <path d="M48 6v20m-5-5 5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M72 26V6m-5 5 5-5 5 5" strokeLinecap="round" strokeLinejoin="round" />
        <text x="30" y="16" fontSize="8" fill={stroke} stroke="none" textAnchor="end">in</text>
        <text x="90" y="16" fontSize="8" fill={stroke} stroke="none">out</text>
      </svg>
    );
  }
  if (mode === "queue") {
    return (
      <svg viewBox="0 0 120 90" className={className} fill="none" stroke={stroke} strokeWidth="1.5" aria-hidden>
        {[0, 1, 2].map((i) => (
          <rect key={i} x={28 + i * 22} y="34" width="18" height="24" rx="2.5" opacity={i === 0 ? 1 : 0.55} />
        ))}
        <path d="M112 46H96m5-5-5 5 5 5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M24 46H6m5-5-5 5 5 5" strokeLinecap="round" strokeLinejoin="round" />
        <text x="104" y="72" fontSize="8" fill={stroke} stroke="none" textAnchor="middle">in</text>
        <text x="14" y="72" fontSize="8" fill={stroke} stroke="none" textAnchor="middle">out</text>
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 120 90" className={className} fill="none" stroke={stroke} strokeWidth="1.5" aria-hidden>
      <rect x="14" y="10" width="92" height="70" rx="4" opacity="0.4" />
      <rect x="26" y="22" width="68" height="46" rx="3.5" opacity="0.65" />
      <rect x="38" y="34" width="44" height="22" rx="3" />
      <path d="M8 18c-4 10-4 44 0 54" strokeLinecap="round" opacity="0.6" />
      <path d="M112 72c4-10 4-44 0-54m-4 4 4-4 4 4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
