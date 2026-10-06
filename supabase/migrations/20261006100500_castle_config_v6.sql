-- Castillo v3 (plan 016 T181). Escrita, NO aplicada a ningún proyecto.
-- Las reglas suben a DEFENSE_CONFIG_VERSION 6 (curvas en U más anchas,
-- Ibiza 45/30/20 s y 100/70/50 %, daño +15 % de cuatro islas). Los topes de
-- las tablas no cambian (mismo calendario de enemigos y mismos puntos):
-- sólo su etiqueta de versión de configuración. Mismas tablas (version 1).
update public.castle_boards set config_version = 6 where version = 1;
