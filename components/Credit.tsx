/** Maker's credit, printed small at the foot of the off-table pages. */
export function Credit({ className = "" }: { className?: string }) {
  return (
    <p className={`text-xs text-card/35 ${className}`}>
      © 2026 Stack &amp; Deal · Created by{" "}
      <a
        href="https://github.com/satriaadi9"
        target="_blank"
        rel="noopener noreferrer"
        className="font-semibold text-card/55 underline-offset-4 hover:text-brass-hi hover:underline"
      >
        satriaadi9
      </a>
    </p>
  );
}
