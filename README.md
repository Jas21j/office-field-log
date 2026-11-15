# Field Log 02 · Building a home office

Buildless project site. From this directory, run `python3 -m http.server 4173 --directory dist` and open `http://localhost:4173`.

The scroll track maps eight chapter stops to Blender renders at documented moments. Camera cuts take the viewer into the room and the walk-in closet. Within a shot, scrolling dissolves between adjacent geometry states. The landing uses a short, silent camera loop of the finished model. The fan blades rotate around their ceiling mount and the closet LEDs cast light on the slats. Visitors can pause the orbit. Reduced-motion settings disable autoplay and crossfades.

## Refreshing the Blender footage

1. From the parent workspace, run Blender in background mode with `motion/3d/office_twin/Office-Twin_v005.blend`. Select the scene `OT | Dollhouse` and pass `--python office-field-log/tools/render_cinematic.py -- all eevee`. Set `OFFICE_RENDER_DIR` to override the default render folder, `/tmp/office-cinematic`.
2. Run `python3 office-field-log/tools/pack_cinematic.py /tmp/office-cinematic` from the parent workspace. This requires Pillow and FFmpeg. It writes WebP frames, the scroll track, and the landing video under `dist/assets/`.
3. Edit the camera positions and the shot sequence in `tools/cinematic_shots.json`. The order of pieces turning on within a single documented milestone is illustrative. The renderer reads the source model without saving it.

The materials drawer uses the room log and production notes for supplier amounts. The finished-room pictures are interior frames from IMG_7530.
