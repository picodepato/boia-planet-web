#!/usr/bin/env python3
"""Comprueba mapa.json: rutas por agua, zonas sin solaparse, lugares y secretos bien puestos.

    python3 mundos/arcilla/herramientas/validar.py

Sale con 1 si algo falla. El margen de agua es el radio de colisión del barco
(13,5 u de motor = 0,54 u_maq).
"""
import itertools
import sys

import mapa

SHIP_R = 13.5 / 24.87


def main():
    M = mapa.load()
    errors, notes = [], []
    zonas = M["zonas"]

    # Zonas: al menos 9, contornos sin solaparse (muestreo de rejilla).
    if len(zonas) < 9:
        errors.append("hay %d zonas; hacen falta 9" % len(zonas))
    for za, zb in itertools.combinations(zonas, 2):
        shared = 0
        for i in range(-150, 151):
            for j in range(-320, 320):
                p = (i * 0.1 + 0.05, j * 0.1 + 0.05)
                if mapa.point_in_poly(p, za["contorno"]) and mapa.point_in_poly(p, zb["contorno"]):
                    shared += 1
        if shared:
            errors.append("zonas %s y %s se solapan (%.2f u²)" % (za["id"], zb["id"], shared * 0.01))

    # Centro y lugares de cada zona dentro de su contorno; lugares de agua fuera de tierra.
    for z in zonas:
        if not mapa.point_in_poly(z["centro"], z["contorno"]):
            errors.append("%s: el centro cae fuera del contorno" % z["id"])
        for lg in z.get("lugares", []):
            if not mapa.point_in_poly(lg["pos"], z["contorno"]):
                notes.append("%s/%s: el lugar cae fuera del contorno de su zona" % (z["id"], lg["id"]))
        if len(z["piezas"]) < 5:
            errors.append("%s: sólo %d piezas en la lista" % (z["id"], len(z["piezas"])))
        for key in ("papel", "encuentro", "comportamientos", "req", "texto", "paleta", "dia_noche"):
            if not z.get(key):
                errors.append("%s: falta %s" % (z["id"], key))

    # Rutas por agua.
    R = M["rutas"]
    routes = [("principal", R["principal"]["puntos"]), ("directa", R["directa"]["puntos"]),
              ("mision", R["mision"]["puntos"]), ("exploracion", R["exploracion"]["puntos"])]
    routes += [(d["id"], d["puntos"]) for d in R["desvios"]]
    C = M["circuito"]
    routes += [("circuito/" + k, C[k]) for k in ("comun", "segura", "atajo", "final")]
    for name, pts in routes:
        for p, land in mapa.crossings(M, pts, margin=SHIP_R):
            errors.append("ruta %s pisa tierra en (%.2f, %.2f): %s" % (name, p[0], p[1], land))

    # Las islas sueltas (Las Calitas, plan 022 T237) no pisan otra tierra.
    lands = mapa.all_islands(M)
    for zid, isla in lands:
        if zid != "islas_sueltas":
            continue
        mine = mapa.outline(isla)
        for zo, other in lands:
            if other is isla:
                continue
            if any(mapa.inside(p, other) for p in mine) or any(mapa.inside(p, isla) for p in mapa.outline(other)):
                errors.append("la isla suelta %s pisa %s/%s" % (isla["id"], zo, other["id"]))

    # Secretos, restos, cofres, botellas y obstáculos en agua.
    wet = [("secreto " + s["id"], s["pos"]) for s in M["secretos"] if s["id"] != "cueva"]
    mv = next(z for z in zonas if z["id"] == "marvivo")
    wet += [("resto %d" % k, p) for k, p in enumerate(mv["restos"])]
    wet += [(lg["id"], lg["pos"]) for lg in mv["lugares"] if lg["id"] != "naufrago"]
    wet += [("obstáculo " + o["id"], o["pos"]) for o in C["obstaculos"]]
    wet += [("checkpoint " + c["id"], c["pos"]) for c in C["checkpoints"]]
    for name, p in wet:
        land = mapa.on_land(M, p, margin=0.2)
        if land:
            errors.append("%s en tierra (%s)" % (name, land))

    # Circuito: el atajo es más corto que la ruta segura y la meta queda junto a la última isla.
    ls, la = mapa.length(C["segura"]), mapa.length(C["atajo"])
    if la >= ls:
        errors.append("el atajo (%.1f) no es más corto que la ruta segura (%.1f)" % (la, ls))
    ult = next(z for z in zonas if z["id"] == "ultima")
    import math
    d = math.dist(C["meta"], ult["islas"][0]["centro"])
    notes.append("circuito: segura %.2f, atajo %.2f (%.0f %% más corto); meta a %.2f del centro de la última isla"
                 % (ls, la, 100 * (1 - la / ls), d))
    if len(C["obstaculos"]) != 3:
        errors.append("el circuito tiene %d obstáculos; deben ser 3" % len(C["obstaculos"]))

    for n in notes:
        print("nota:", n)
    for e in errors:
        print("ERROR:", e)
    print("%d errores" % len(errors))
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
