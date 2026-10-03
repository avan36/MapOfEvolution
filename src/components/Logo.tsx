/** Animated logo mark: a tiny radial tree that breathes. */
export function Logo({ size = 30 }: { size?: number }) {
  return (
    <svg className="logo" width={size} height={size} viewBox="0 0 64 64" aria-hidden>
      <defs>
        <linearGradient id="logo-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#7cf5d1" />
          <stop offset=".5" stopColor="#62a8ff" />
          <stop offset="1" stopColor="#ff7ad9" />
        </linearGradient>
      </defs>
      <g className="logo__branches" fill="none" stroke="url(#logo-g)" strokeWidth="3.4" strokeLinecap="round">
        <path d="M32 32 C32 22 22 20 18 12" />
        <path d="M32 32 C40 26 46 24 52 18" />
        <path d="M32 32 C38 40 40 46 46 54" />
        <path d="M32 32 C24 38 18 40 12 44" />
        <path d="M25 20 C28 16 30 12 30 8" />
        <path d="M42 44 C48 44 52 42 56 38" />
      </g>
      <circle className="logo__core" cx="32" cy="32" r="5" fill="#fff4c2" />
    </svg>
  );
}
