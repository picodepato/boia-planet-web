# Santa Bárbara and Postiguet — T101

Procedural sample landmark, replacing the former small castle in `/mar`.
Three stepped bastions and a square citadel rise above a faceted Benacantil;
the Postiguet beach, promenade, palms and parasols sit at its foot.
This is a stylized interpretation of Alicante, preserving the game's island footprint.

Generate with Blender 5.2.2 LTS:

```powershell
& '<portable Blender path>/blender.exe' -b -P tools/blender/decor/santa_barbara.py -- --preview node_modules/t101-preview
python tools/blender/check.py
```

The `.blend` retains all named editable components. The export joins them into
one mesh with eight flat materials; windows use emission. GLB has no textures,
compression extensions or remote dependencies. Scene units are unchanged: water
Y=0, up +Y, beach front +Z, origin at the existing castle centre, solid radius 13.
The procedural fallback, collision, wrap, coastline and world positions remain.
The asset checker verifies triangle/byte budgets and every vertex's footprint.

Latest stable was verified on 2026-10-03 against the official
[download page](https://www.blender.org/download/) and
[release page](https://www.blender.org/releases/5-2/): Blender **5.2.2 LTS**, released
2026-09-15. The portable Windows x64 distribution was installed in ignored
`node_modules/.tools/blender/`, without modifying PATH or file associations.

- ZIP: `https://download.blender.org/release/Blender5.2/blender-5.2.2-windows-x64.zip`
- Official checksums: `https://download.blender.org/release/Blender5.2/blender-5.2.2.sha256`
- Verified ZIP size: 404453484 bytes.
- Verified SHA256: `3849d17a682cba006075aaa3f3597ecb5c9c30ec31035b2e092c53e40679b535`.
- `blender --version`: 5.2.2 LTS, build hash `d13f752e3b9c`, Windows Release.

References used for the shape and relationship between hill, fortress and beach:
[Santa Bárbara](https://www.turismoalicante.es/es/alicante/castillo/castillo-de-santa-barbara-en-alicante),
[Postiguet](https://www.turismoalicante.es/es/alicante/playa/playa-del-postiguet-en-alicante).
Reference photographs are not redistributed.
