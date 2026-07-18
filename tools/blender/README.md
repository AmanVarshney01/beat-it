# Blender asset pipeline

`build_game_assets.py` is the single production asset build. It generates the
weapons and dummy from Python, imports the checked-in
`assets/cap_source.glb`, reduces the cap to its runtime geometry budget, and
writes every deployable model plus `manifest.json`.

```sh
/Applications/Blender.app/Contents/MacOS/Blender \
  --background --python tools/blender/build_game_assets.py
```

The normalized cap source is intentionally separate from the optimized web
asset. Running the production build never replaces it.

To intentionally replace the cap source with another OBJ:

```sh
/Applications/Blender.app/Contents/MacOS/Blender \
  --background --python tools/blender/convert_downloaded_cap.py \
  -- /path/to/Cap.obj tools/blender/assets/cap_source.glb
```

After replacing the source, run the production build and review the cap fit,
label, recoil attachment, and max-damage star clearance in the game.
