/**
 * Logo de BOIA (T50): la mascota y el wordmark de Álvaro, vectorizados en
 * art/marca/ (tools/blender/intro/trazar_marca.py). Las copias de la web (las
 * variantes ligeras de art/marca/logo/)
 * están en ../_marca/ y las pinta el CSS (landing.css › .brand-logo), así las
 * sirve Next como archivos estáticos sin tipos de importación de imágenes.
 *
 * `label`: el nombre para lectores de pantalla; sin él es decorativo (el
 * enlace que lo envuelve ya se nombra). `variant="wordmark"`: only the
 * wordmark (plan 007 T79: the header and the large footer logo of the
 * editorial landing).
 */
export function BrandLogo({
  size = 'header',
  variant = 'full',
  label,
}: {
  size?: 'header' | 'footer';
  variant?: 'full' | 'wordmark';
  label?: string;
}) {
  const a11y = label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true };
  return (
    <span
      className={`brand-logo brand-logo--${size} brand-logo--${variant}`}
      {...a11y}
      data-testid="brand-logo"
    >
      {variant === 'full' && <span className="brand-logo__mascot" />}
      <span className="brand-logo__wordmark" />
    </span>
  );
}
