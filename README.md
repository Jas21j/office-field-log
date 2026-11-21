# Salesman Solutions · Project Hub

Buildless site in `dist/`. `index.html` is the **Project Hub**, told as five chapters after a one-line premise ("Every job, on the record", shown once per visit):

1. **Projects:** a row of project tiles. The focused project fills the screen with its key art, its numbers (only what is recorded, plus one line naming what is not) and a row of its jobs.
2. **The work:** that project's jobs on a timeline, its ledger, its record counts, what is planned next and what is not confirmed yet.
3. **Schedule:** every job on one calendar. Columns for days, hours, miles and materials appear only once some job has that number.
4. **Record:** everything completed, under four foundations (Home, Outdoor, Supply runs, Planning & design), grouped by job. Supply runs read straight from the receipts.
5. **Premise:** why the hub keeps the record.

Every job opens a sheet (photos, numbers, tasks, costs). The look follows Apple's Liquid Glass: blurred, saturated glass panels over each project's environment, spring-timed motion without overshoot, selection pills that slide, and a floating tab bar on phones. `office.html` is the office build's scroll story.

Run `python3 -m http.server 4173 --directory dist` and open `http://localhost:4173`. `#/<project-id>` focuses a project, `#/<project-id>/ledger` opens its ledger. Arrow keys move along the project row, Enter opens the project, and ⌘K (or `/`) searches projects, jobs, tasks and foundations.

## Project data: `dist/data/projects.json`

Projects → jobs → timeline entries → tasks.

- **Project:** `id`, `name` (e.g. "Project Juniper"), `rank` (order on the row), `type`, `city` (city level only, never an address or client name), `statusLabel` (optional; status is otherwise worked out from the jobs), `summary`, `keyJob` (whose art leads), `links`, `ledger`, `jobs`.
- **Project `ledger`** (the part a passcode can lock later): `agreed`, `changes` (`{date, job, title, reason, amount, status: "approved" | "proposed", evidence}`), `payments` (`{date, amount, note}`).
- **Job:** `id` (also its image folder, `assets/hub/<id>/`), `title`, `foundation`, `category`, `icon`, `start` / `end` (ISO; `end: null` = ongoing, `start: null` = undated), `status` (`active`, `planning`, `complete`, `reported`), `statusLabel`, `summary`, `focus`, `facts`, `objectives`, `open`, `timeline`, and the practical numbers:
  - `metrics`: `daysOnSite`, `hours`, `miles` (and an optional `note`).
  - `costs`: `agreed` (if the job is priced on its own), `labor`, `materials` (`{date, vendor, city, item, amount, basis}`), `unpriced`, `stops`, `materialsThrough`.
- **Timeline entry:** `{date, time "HH:MM", title, note, img: "t-<key>", tag, milestone, upcoming, tasks: [{t, f}]}`. Each task is filed under a foundation `f`.
- **`foundations`** (top of the file): the four groups the record is organised by (`home`, `outdoor`, `supply`, `planning`), each with a name and a one-line description. Every purchase and stop in a job's `costs` shows up under Supply runs on its own.
- **`trades`**: the finer label a task keeps (`carpentry` → "Carpentry"), shown small beside it. A task is `{t, f, trade}`.

### Using it for another kind of business

Nothing in the page is specific to building work. Rename or replace the `foundations` and `trades` in `projects.json` (for example Design, Build, Launch and Purchasing) and the record, the job sheets and search follow. Projects, jobs, statuses, dates, days, hours, miles, costs and the ledger work the same in any industry.

`null` means not recorded: it shows as such, is never guessed, and roll-ups say how many jobs have recorded each number ("6 of 10 jobs recorded"). Balance due = agreed price + approved changes − payments (`balanceOf` in `dist/ledger.js`). Purchases and changes also appear on the update for their date. Bump the `?v=` query in `ledger.js` and the HTML after changing data.

## Images

`tools/hub_media.json` holds one crop recipe per picture. `python3 tools/pack_hub.py --review <dir>` writes `dist/assets/hub/<job-id>/{tile,hero-L,hero-P,t-*}.webp` and `manifest.json` (each job's accent colour), plus full-size review copies in `<dir>`. Video is read as pictures only (`ffmpeg -an`) and `IMG_7505` is refused. Crops avoid faces, house fronts, papers and screens, and the lake skyline: check the review copies at full size before publishing. `python3 tools/hub_art.py` draws the kitchen plan (to scale) and the roof-coating illustration, the two jobs without usable photos. A project with several jobs gets a four-photo tile and its backdrop cycles through its jobs.

## Passcode lock (planned, not built)

Each project's `ledger` (and later its jobs' costs) is kept apart from the public layer so it can be encrypted with that project's passcode (key derived in the browser, AES-GCM), leaving only scrambled data in the public repo. Until then everything in `projects.json` is public.

## Publishing

The repo is public and every push to `main` redeploys GitHub Pages. Run the privacy check (no addresses, client names, faces or house exteriors) before each push.

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

## The invoice (Project Juniper)

Chapter 03 tells the open invoice one day at a time. It lives in `dist/data/projects.json` under `projects[].invoice`:

- `rates`: `{ "day": 150, "gas": 35 }`. Each day sets `dayRate` (true or false) and `gas`: `true` charges the usual $35, a number charges that amount (Nov 8 is $10), and `false` charges nothing.
- `days[]`: date, job codes (`A` office build, `B` floor and paint), a short title, and `stops[]` with the time, place, what happened, any receipt amount, the receipt images (`receipt` thumb, `receiptFull`), and `mi`, the estimated miles from the previous stop. `confirm[]` holds open questions, which also gather at the end of the statement.
- Days that were paid on the spot stay out of the invoice. Juniper C is kept as a job only.
- `materialsBilled: true` adds each day's purchases to that day's charge and to the balance.
- `lastPayment` opens the statement period.

The math is in `invoiceOf()`, `chargesFor()` and `gasGroups()` in `dist/ledger.js`. Miles are estimates: the straight-line distance between stop towns × 1.3. They come from a script kept outside this public repo, because it holds town-level points for home and the client sites. Receipts are published only after redaction, with customer names, card digits and staff names blacked out. Sinclair, the apartment walkthrough and the kitchen are archived (`"archived": true`). They stay in the file but no longer appear in the hub.
