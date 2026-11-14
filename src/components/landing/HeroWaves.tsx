/**
 * Hero animation: a gold phone outline sends out the three TapTab signal lines,
 * followed by fainter echo rings. Pure SVG + CSS (see .lp-waves in landing.css),
 * so it costs nothing on the main thread and respects reduced motion.
 */
const MAIN = [
  "M 340.1 255.4 A 60 60 0 0 1 340.1 344.6",
  "M 373.6 218.2 A 110 110 0 0 1 373.6 381.8",
  "M 407.1 181.1 A 160 160 0 0 1 407.1 418.9",
];
const ECHO = [
  "M 440.5 144.0 A 210 210 0 0 1 440.5 456.0",
  "M 474.0 106.8 A 260 260 0 0 1 474.0 493.2",
  "M 507.5 69.7 A 310 310 0 0 1 507.5 530.3",
];

export default function HeroWaves() {
  return (
    <div className="lp-waves" aria-hidden>
      <div className="lp-waves-glow" />
      <svg viewBox="0 0 600 600">
        <defs>
          <linearGradient id="lp-wave-gold" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#F2D79B" /><stop offset="1" stopColor="#C9963F" />
          </linearGradient>
        </defs>
        <g className="lp-waves-phone">
          <rect className="body" x="160" y="190" width="120" height="220" rx="24" />
          <rect x="200" y="204" width="40" height="7" rx="3.5" fill="#F2D79B" opacity=".7" />
          <circle className="dot" cx="220" cy="300" r="10" />
        </g>
        {MAIN.map((d, i) => <path key={d} className={`arc main a${i + 1}`} pathLength={1} d={d} />)}
        {ECHO.map((d, i) => <path key={d} className={`arc echo e${i + 1}`} pathLength={1} d={d} />)}
      </svg>
    </div>
  );
}
