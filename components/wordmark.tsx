/** The list-it mark: a kilometre stone with a national-highway cap. */
export function MarkStone({ size = 22, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={(size * 18) / 22} height={size} viewBox="0 0 18 22" aria-hidden className={`shrink-0 ${className}`}>
      <path d="M0 9a9 9 0 0 1 18 0v13H0z" fill="var(--stone)" />
      <path d="M0 9a9 9 0 0 1 18 0v1H0z" fill="var(--accent)" />
      <path d="M0 9a9 9 0 0 1 18 0v13H0z" fill="none" stroke="var(--stone-ink)" strokeOpacity="0.85" strokeWidth="1.4" />
      <rect x="4.5" y="13.5" width="9" height="2" rx="1" fill="var(--stone-ink)" />
    </svg>
  );
}

export function Wordmark({ size = 24, className = "" }: { size?: number; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <MarkStone size={size} />
      <span className="display font-extrabold" style={{ fontSize: size * 1.12 }}>
        list-it
      </span>
    </span>
  );
}
