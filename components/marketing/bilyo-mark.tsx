/** The Bilyo mark: a document sheet with a peso glyph. Inherits currentColor. */
export function BilyoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M6 3h8l4 4v14H6z" />
      <path d="M14 3v4h4" />
      <path d="M9.5 17V10.5h2.4a2.1 2.1 0 0 1 0 4.2H9.5" />
      <path d="M8.4 12.9h5" />
      <path d="M8.4 14.9h5" />
    </svg>
  );
}
