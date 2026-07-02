export function BiscuitLogo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <g transform="rotate(-20 32 32)">
        <rect x="18" y="27" width="28" height="10" rx="5" fill="#d9a662" />
        <circle cx="19" cy="27" r="6.5" fill="#d9a662" />
        <circle cx="19" cy="37" r="6.5" fill="#d9a662" />
        <circle cx="45" cy="27" r="6.5" fill="#d9a662" />
        <circle cx="45" cy="37" r="6.5" fill="#d9a662" />
        <circle cx="28" cy="32" r="1.4" fill="#a34c26" />
        <circle cx="34" cy="30" r="1.4" fill="#a34c26" />
        <circle cx="37" cy="34" r="1.4" fill="#a34c26" />
      </g>
    </svg>
  );
}
