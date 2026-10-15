// Deja a Node (con su soporte de TypeScript) cargar el código de los paquetes,
// escrito para el bundler: importaciones relativas sin extensión («./iso») o
// de carpeta («./worlds»). Se usa con `node --import`.
import { registerHooks } from 'node:module';

registerHooks({
  resolve(specifier, context, next) {
    try {
      return next(specifier, context);
    } catch (err) {
      const relative = specifier.startsWith('./') || specifier.startsWith('../');
      const missing =
        err?.code === 'ERR_MODULE_NOT_FOUND' || err?.code === 'ERR_UNSUPPORTED_DIR_IMPORT';
      if (!relative || !missing) throw err;
      for (const candidate of [`${specifier}.ts`, `${specifier}/index.ts`]) {
        try {
          return next(candidate, context);
        } catch {
          // siguiente candidato
        }
      }
      throw err;
    }
  },
});
