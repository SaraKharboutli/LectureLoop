// LectureLoop mark: a listening dot inside an open loop (the lecture → quick check → back to listening).

export function LogoMark({ size = 32, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className={className} aria-hidden="true" focusable="false">
      <rect width="32" height="32" rx="9" fill="#5B5BD6" />
      <path d="M20.25 8.64 A8.5 8.5 0 1 0 24.21 13.8" fill="none" stroke="#FFFFFF" strokeWidth="2.6" strokeLinecap="round" />
      <circle cx="24.21" cy="13.8" r="2.3" fill="#22C55E" />
      <circle cx="16" cy="16" r="3.1" fill="#FFFFFF" />
    </svg>
  );
}

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`font-semibold tracking-tight ${className}`}>
      Lecture<span className="text-primary">Loop</span>
    </span>
  );
}
