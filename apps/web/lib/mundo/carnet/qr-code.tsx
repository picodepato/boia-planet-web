import { encode } from 'uqr';

/**
 * Un QR en SVG (módulos negros sobre blanco; la zona tranquila la pone la
 * baldosa blanca que lo rodea). Lo usa el anverso del Carnet para el enlace a
 * su Carnet público. Corrección M: aguanta el brillo de una pantalla.
 */
export function qrPath(text: string): { size: number; d: string } {
  const qr = encode(text, { ecc: 'M', border: 0 });
  let d = '';
  qr.data.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      if (!row[x]) {
        x++;
        continue;
      }
      const start = x;
      while (x < row.length && row[x]) x++;
      d += `M${start} ${y}h${x - start}v1h${start - x}z`;
    }
  });
  return { size: qr.size, d };
}

export function QrCode({ text, label }: { text: string; label: string }) {
  const { size, d } = qrPath(text);
  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      shapeRendering="crispEdges"
      role="img"
      aria-label={label}
      data-qr={text}
    >
      <path d={d} fill="#000" />
    </svg>
  );
}
