# Field Log 02 · Building a home office

Buildless project site. From this directory, run `python3 -m http.server 4173 --directory dist` and open `http://localhost:4173`.

The landing shows the finished Blender model turning one slow, full circle (ceilings lifted off, walls kept), rendered on white and multiplied onto the cream, so it passes behind the headline. The scroll track runs through 53 documented states of the room in eight chapters. Each chapter scrolls for its own length (`--len` on the article), and the stage glides behind the scroll instead of jumping. Within one camera, scrolling dissolves between states and the parts that are new in a state light up in green outlines. When a new camera comes in for the first time, the view dissolves into that camera's blueprint (the finished room as a green line drawing over a grid) and a scan line builds the real view from top to bottom ("Plan → Built"). Returning to a camera already seen is a slower plain dissolve. A small mini-map shows the room from above at that state, with a green cone where the camera stands; the cone glides between viewpoints. Wide screens get 16:10 renders, phones get 9:16 renders from matching cameras. Reduced-motion settings turn off the orbit, the glide, the scans and the outlines.

## Refreshing the Blender renders

All renders come from the films' twin and look: `motion/3d/office_twin/Office-Twin_v005.blend`, scene `OT | Dollhouse` (EEVEE, the dollhouse rig, plus the films' softbox, bounce and closet fill inside the room). The .blend is read only, never saved.

1. From the parent workspace:
   `/Applications/Blender.app/Contents/MacOS/Blender -b motion/3d/office_twin/Office-Twin_v005.blend -S "OT | Dollhouse" --python office-field-log/tools/render_cinematic.py -- build,mask,bp,plan`
   then the same with `-- hero`. `--probe` renders small, fast versions of every camera (and 8 orbit angles) into `<out>/probe/` for framing checks; `--only 3,17` or `--only closet,desk` limits a run. Output goes to `$OFFICE_RENDER_DIR` (default `/tmp/office-cinematic`). About 4 s per scroll state per orientation and 3 s per orbit frame on the 8 GB Mac. Only one Blender render at a time on this machine: the film session and this site share the lock file `motion/work/.blender-render.lock`.
2. `python3 office-field-log/tools/pack_cinematic.py /tmp/office-cinematic` (Pillow, NumPy, FFmpeg) writes `dist/assets/build|accent|bp|plan/`, `build/frames.json`, `build/cameras.json`, `hero.webp` and `hero-loop.mp4`. Scroll positions are laid out here: each state stays in its chapter, and a camera change gets 2.6× the scroll of a step inside one shot.
3. Cameras, states and the orbit live in `tools/cinematic_shots.json`: each camera has a landscape view (`L`) and a portrait view (`P`) as `[eye, aim, lens]` in inches on the room plan, the walls cut away for a dollhouse view, objects to park, and its light (`studio`, `soft`, `closet`). The order pieces turn on within one documented milestone is illustrative; end states come from the footage.

## Finished-office photos

`python3 office-field-log/tools/pack_photos.py footage/` turns the crew's 12 MP stills (IMG_7184, 7191, 7216, from Oct 28–29) into `dist/assets/photo-*.webp` at two widths. The window glass is softened to plain daylight so the neighbour's roof beyond the hedge never shows.

The materials drawer uses the room log and production notes for supplier amounts (documented tally through Nov 9).
