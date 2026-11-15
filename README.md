# Field Log 02 · Building a home office

Buildless project site. From this directory, run `python3 -m http.server 4173 --directory dist` and open `http://localhost:4173`.

- `dist/index.html` holds the day-by-day text, materials drawer, and finished-room gallery.
- `dist/main.js` links scrolling to camera moves and staged visibility in the GLB. Every chapter also has a Blender still. The site uses the stills by default with reduced motion or when WebGL is unavailable.
- `tools/room_views.json` lists the camera stops and still frames. `tools/export_room.py` reads Office Twin v005 and its progress log from the parent project. From the parent folder, run Blender in background mode with `motion/3d/office_twin/Office-Twin_v005.blend`, select scene `OT | Dollhouse`, then pass `--python office-field-log/tools/export_room.py`. The script writes the GLB and timing metadata to `dist/assets/`. Add `-- --stills` for the Blender renders and convert the PNGs at `/tmp/office-v005-*.png` to the matching `hero.webp` and `blender-*.webp` assets. The export repairs the stretched fan blade geometry in memory using the twin's room specification. It never saves over the .blend.
- The timeline and supplier amounts come from the twin log and existing film notes. The order of elements within a single dated milestone is illustrative. The finished-room photos are from interior frames of IMG_7530.
