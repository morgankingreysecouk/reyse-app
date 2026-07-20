export function Logo({ className }: { className?: string }) {
  return (
    <div className={className}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M4 20V4h9a5 5 0 0 1 0 10h-5l7 6"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}
