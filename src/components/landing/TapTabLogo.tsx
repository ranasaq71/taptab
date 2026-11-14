/**
 * The TapTab mark drawn as SVG so its three signal lines can pulse.
 * `id` keeps gradient ids unique if the mark appears more than once on a page.
 */
export default function TapTabLogo({ id = "tt", className = "lp-logo" }: { id?: string; className?: string }) {
  const t = `${id}-t`, g = `${id}-g`;
  return (
    <svg className={className} viewBox="0 0 160 147" aria-hidden>
      <defs>
        <linearGradient id={t} x1="0" y1="1" x2="1" y2="0"><stop offset="0" stopColor="#4A0A1C" /><stop offset=".55" stopColor="#6E1532" /><stop offset="1" stopColor="#A12E4D" /></linearGradient>
        <linearGradient id={g} x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#F2D79B" /><stop offset=".55" stopColor="#C9963F" /><stop offset="1" stopColor="#8E6424" /></linearGradient>
      </defs>
      <polygon points="16,120 44,34 150,22 154,34 140,112 130,130 26,136 17,132" fill={`url(#${g})`} stroke={`url(#${g})`} strokeWidth="18" strokeLinejoin="round" />
      <polygon points="12,112 40,26 146,14 150,26 136,104 126,122 22,128 13,124" fill={`url(#${t})`} stroke={`url(#${t})`} strokeWidth="18" strokeLinejoin="round" />
      <g transform="rotate(-14 50 80)">
        <rect x="29" y="38" width="42" height="84" rx="9" fill="none" stroke="#fff" strokeWidth="5.5" />
        <rect x="43" y="40.5" width="14" height="4.5" rx="2.2" fill="#fff" />
      </g>
      <g transform="rotate(-10 82 70)">
        <path className="la la1" d="M 93.6 56.2 A 18 18 0 0 1 93.6 83.8" />
        <path className="la la2" d="M 101.9 46.3 A 31 31 0 0 1 101.9 93.7" />
        <path className="la la3" d="M 110.3 36.3 A 44 44 0 0 1 110.3 103.7" />
      </g>
    </svg>
  );
}
