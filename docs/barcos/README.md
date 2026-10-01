# Barcos

Cada barco es una entidad propia: tiene su estilo, su paleta, su construcción y, más adelante, su nombre, su historia y su mundo. Esta carpeta los reúne.

Estado: `muestra`. Nombres, historias y colores de marca los aprueba Álvaro; hasta entonces van como `null` o `pendiente`.

## Los 8 barcos

Son los remolcadores de la exploración de estilos del encargo 01 (`tools/blender/styles/`).

| ID | Estilo | Cómo es |
|---|---|---|
| B01 | Boceto a lápiz | Casco claro con tramado gris, neumáticos en el costado |
| B02 | Acuarela ilustrada | Casco azul, toldo crema, macetas con plantas |
| B03 | Low-poly | Rojo y blanco de facetas limpias, techo azul |
| B04 | Semi-realista | Verde azulado gastado, óxido y neumáticos |
| B05 | Arcilla, maqueta | Verde redondo, techo de paja, palmera y guirnalda |
| B06 | Cartoon años 30 | Negro, rojo y crema, ojos de buey que parecen ojos |
| B07 | Cel-shaded cómic | Azul cielo con tinta de cómic, bandera con olas |
| B08 | Pixel art | Rojo y blanco en 16 colores fijos |

El velero que hoy usa el juego (`tools/blender/ship.py`, skins base, noche y fiesta) todavía no está en el registro.

## Qué hay

- `barcos.json` es el registro: una ficha por barco. Los colores no se copian; cada uno apunta por nombre a su constante en el script de Blender.
- `variantes` (en `barcos.json`, T59) son barcos sin arte propio: el arte de otro estilo en una de sus skins con el tono girado (`tono`, grados). Hoy, «La Fiestera», el barco exclusivo de quien entrega a la Boia Fiestera. Blender y la guía de colores no las leen.
- `colores.html` es la guía de colores, generada. No se edita a mano.
- `tools/barcos/guia_colores.py` es el generador. Lee cada color del script, mide el render de cada barco y escribe la guía.

```bash
python3 tools/barcos/guia_colores.py
```

Tarda unos 5 s. Con `--check` sólo comprueba que todas las referencias de color siguen existiendo en los scripts. Para verla, con el servidor estático en la raíz del repo, abrí `http://localhost:8080/docs/barcos/colores.html`.

El generador mide sobre la vista SE a 512 px con alfa que escribe cada script en `tools/blender/out/styles/`, fuera de git. Si falta, el generador dice el comando de Blender que la regenera.

## Lo que viene, por partes

1. **Colores.** Primera versión hecha: paleta por grupos, colores medidos en pantalla, contraste con el mar del juego y cercanía a los colores de marca.
2. **Ficha técnica.** Piezas de cada barco (casco, caseta, chimenea, carga), medidas, slots y anclajes, y qué color lleva cada pieza, sacado también de los scripts.
3. **Historia y mundo.** Nombre, origen, carácter, su isla o puerto y su relación con BOIA, escrito con Hernán y aprobado por Álvaro.

## Mundos

- `mundos/b05/` es el primer ejemplo, la **Cala del Alfar** del barco de arcilla. Tiene una ficha (`index.html`), renders de día y de noche y las posiciones de sus lugares. Es propuesta: nombres e historia están por aprobar.
- Se regenera con Blender sin interfaz, en unos 18 s:

```bash
/Applications/Blender.app/Contents/MacOS/Blender -b -P tools/barcos/mundos/b05_cala.py
```

- El script importa el estilo 05 sin modificarlo, así que la isla usa el mismo material, luz y cámara que el barco.
