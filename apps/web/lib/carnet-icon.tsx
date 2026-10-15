/**
 * El Carnet BOIA (plan 032 T299): una tarjeta dibujada en código, en lugar del
 * emoji de la tarjeta de identidad (U+1FAAA, Unicode 14), que en Windows 10
 * sale como una caja vacía. Mide 1em y va en línea con el texto; decorativo
 * (`aria-hidden`), el nombre lo dice la palabra de al lado. Sin imports: la
 * landing lo carga en su ruta crítica (presupuesto de `scripts/landing-budget.mjs`).
 */
export function CarnetIcon() {
  return (
    <svg
      className="boia-carnet-icon"
      viewBox="0 0 32 32"
      width="1em"
      height="1em"
      style={{ display: 'inline-block', verticalAlign: '-0.14em', flex: 'none' }}
      aria-hidden="true"
      focusable="false"
    >
      <rect
        fill="#fff4e2"
        stroke="#36278a"
        strokeWidth="1.5"
        x="3"
        y="6.5"
        width="26"
        height="19"
        rx="3.5"
      />
      <path fill="#36278a" d="M3 12v-2a3.5 3.5 0 0 1 3.5-3.5h19A3.5 3.5 0 0 1 29 10v2z" />
      <circle fill="#ec4f24" cx="10.5" cy="18.6" r="3.4" />
      <path stroke="#36278a" strokeWidth="1.8" strokeLinecap="round" d="M17 17.2h7.5M17 21.2h4.5" />
    </svg>
  );
}
