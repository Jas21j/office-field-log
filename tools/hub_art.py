"""Vector art for Project Hub entries that have no usable photos.

    python3 tools/hub_art.py      # from office-field-log/

kitchen-build/art.svg: the layout plan drawn to scale (6 px per inch) from ~/Desktop/Kitchen Plan/kitchen-build-plan.md.
roof-coating/art.svg: an illustration only (no footage exists for that job).
Square canvases: the hub shows them with object-fit: cover, so the drawing sits inside the middle band.
"""
import os

OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "dist", "assets", "hub")
G = "#3ce04b"
FONT = 'font-family="Helvetica, Arial, sans-serif"'


def grid(bg):
    return f"""<rect width="1600" height="1600" fill="{bg}"/>
<defs>
  <pattern id="minor" width="24" height="24" patternUnits="userSpaceOnUse"><path d="M24 0H0V24" fill="none" stroke="{G}" stroke-opacity=".055" stroke-width="1"/></pattern>
  <pattern id="major" width="120" height="120" patternUnits="userSpaceOnUse"><path d="M120 0H0V120" fill="none" stroke="{G}" stroke-opacity=".11" stroke-width="1"/></pattern>
  <radialGradient id="fade" cx="50%" cy="50%" r="60%"><stop offset="0" stop-color="{bg}" stop-opacity="0"/><stop offset="1" stop-color="{bg}" stop-opacity=".92"/></radialGradient>
</defs>
<rect width="1600" height="1600" fill="url(#minor)"/><rect width="1600" height="1600" fill="url(#major)"/>"""


def kitchen():
    s = 6                       # px per inch
    W, D = 120 * s, 84 * s      # 10 ft x 7 ft
    x0, y0 = 800 - W / 2, 800 - D / 2
    X = lambda inch: x0 + inch * s
    Y = lambda inch: y0 + inch * s
    wall = 'stroke="#eef3ee" stroke-width="10" stroke-linecap="square"'
    new = f'stroke="{G}" stroke-width="7" stroke-dasharray="18 12"'
    fix = f'fill="{G}" fill-opacity=".08" stroke="{G}" stroke-width="2.5"'
    lab = f'{FONT} fill="#cfe9d3"'   # size, spacing and opacity are set per label
    dim = f'{FONT} font-size="19" letter-spacing="2" fill="{G}"'
    parts = [grid("#0a0d0b")]
    # existing walls: pocket-door wall (top, with its 60" opening at 15-75") and plumbing wall (right)
    parts.append(f'<line x1="{X(0)}" y1="{Y(0)}" x2="{X(15)}" y2="{Y(0)}" {wall}/>')
    parts.append(f'<line x1="{X(75)}" y1="{Y(0)}" x2="{X(120)}" y2="{Y(0)}" {wall}/>')
    parts.append(f'<line x1="{X(120)}" y1="{Y(0)}" x2="{X(120)}" y2="{Y(84)}" {wall}/>')
    # pocket: 30" of the opening holds the sliding panel, 30" stays clear for travel
    parts.append(f'<rect x="{X(15)}" y="{Y(0) - 7}" width="{30 * s}" height="14" fill="none" stroke="#eef3ee" stroke-width="2"/>')
    parts.append(f'<line x1="{X(17)}" y1="{Y(0)}" x2="{X(44)}" y2="{Y(0)}" stroke="{G}" stroke-width="5"/>')
    parts.append(f'<path d="M{X(45)} {Y(0)}H{X(75)}" stroke="#eef3ee" stroke-opacity=".5" stroke-width="2" stroke-dasharray="6 8"/>')
    parts.append(f'<path d="M{X(44)} {Y(10)}H{X(73)}" stroke="{G}" stroke-opacity=".7" stroke-width="2" marker-end="url(#arrow)"/>')
    parts.append(f'<defs><marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" fill="{G}"/></marker></defs>')
    # new walls (to be built): fridge wall (left) and old-counter wall (bottom)
    parts.append(f'<line x1="{X(0)}" y1="{Y(0)}" x2="{X(0)}" y2="{Y(84)}" {new}/>')
    parts.append(f'<line x1="{X(0)}" y1="{Y(84)}" x2="{X(120)}" y2="{Y(84)}" {new}/>')
    # plumbing-wall run, top to bottom: cabinets 0-30", stove counter 30-54", sink base 54-84"
    parts.append(f'<rect x="{X(90)}" y="{Y(0) + 5}" width="{30 * s - 5}" height="{30 * s - 5}" {fix}/>')
    parts.append(f'<rect x="{X(96)}" y="{Y(30)}" width="{24 * s - 5}" height="{24 * s}" {fix}/>')
    for cx, cy in ((103, 37), (113, 37), (103, 47), (113, 47)):
        parts.append(f'<circle cx="{X(cx)}" cy="{Y(cy)}" r="17" fill="none" stroke="{G}" stroke-width="2"/>')
    parts.append(f'<rect x="{X(90)}" y="{Y(54)}" width="{30 * s - 5}" height="{30 * s - 5}" {fix}/>')
    parts.append(f'<rect x="{X(96)}" y="{Y(60)}" width="{18 * s}" height="{18 * s}" rx="18" fill="none" stroke="{G}" stroke-width="2"/>')
    parts.append(f'<circle cx="{X(117)}" cy="{Y(80)}" r="6" fill="#ff7a6b"/><circle cx="{X(117)}" cy="{Y(75)}" r="6" fill="#6bb8ff"/>')
    # fridge in the corner of the pocket-door wall and the new fridge wall
    parts.append(f'<rect x="{X(0) + 5}" y="{Y(0) + 5}" width="{30 * s - 5}" height="{36 * s - 5}" {fix}/>')
    parts.append(f'<path d="M{X(4)} {Y(4)}L{X(28)} {Y(34)}M{X(28)} {Y(4)}L{X(4)} {Y(34)}" stroke="{G}" stroke-opacity=".35" stroke-width="1.5"/>')
    # labels
    parts.append(f'<text x="{X(105)}" y="{Y(16)}" text-anchor="middle" {lab} font-size="17" letter-spacing="2.4">CAB</text>')
    parts.append(f'<text x="{X(108)}" y="{Y(56.5)}" text-anchor="middle" {lab} font-size="14" letter-spacing="2.4">STOVE</text>')
    parts.append(f'<text x="{X(105)}" y="{Y(83) - 12}" text-anchor="middle" {lab} font-size="17" letter-spacing="2.4">SINK</text>')
    parts.append(f'<text x="{X(15)}" y="{Y(42)}" text-anchor="middle" {lab} font-size="17" letter-spacing="2.4">FRIDGE</text>')
    parts.append(f'<text x="{X(45)}" y="{Y(16) + 18}" text-anchor="middle" {lab} font-size="14" letter-spacing="2.4">POCKET DOOR · 60″</text>')
    parts.append(f'<text x="{X(45)}" y="{Y(52)}" text-anchor="middle" {lab} fill-opacity=".45" font-size="22" letter-spacing="6">NEW KITCHEN</text>')
    # dimensions
    parts.append(f'<path d="M{X(0)} {Y(0) - 54}H{X(120)}M{X(0)} {Y(0) - 64}V{Y(0) - 44}M{X(120)} {Y(0) - 64}V{Y(0) - 44}" stroke="{G}" stroke-width="1.5"/>')
    parts.append(f'<text x="{X(60)}" y="{Y(0) - 66}" text-anchor="middle" {dim}>10′ 0″ · 120″</text>')
    parts.append(f'<path d="M{X(120) + 54} {Y(0)}V{Y(84)}M{X(120) + 44} {Y(0)}H{X(120) + 64}M{X(120) + 44} {Y(84)}H{X(120) + 64}" stroke="{G}" stroke-width="1.5"/>')
    parts.append(f'<text transform="translate({X(120) + 80} {Y(42)}) rotate(90)" text-anchor="middle" {dim}>7′ 0″ · 84″</text>')
    # legend
    ly = Y(84) + 70
    parts.append(f'<line x1="{X(0)}" y1="{ly}" x2="{X(0) + 46}" y2="{ly}" {wall}/><text x="{X(0) + 62}" y="{ly + 6}" {lab} font-size="14" letter-spacing="2.4">EXISTING</text>')
    parts.append(f'<line x1="{X(40)}" y1="{ly}" x2="{X(40) + 46}" y2="{ly}" {new}/><text x="{X(40) + 62}" y="{ly + 6}" {lab} font-size="14" letter-spacing="2.4">TO BE BUILT</text>')
    parts.append(f'<text x="{X(120)}" y="{ly + 6}" text-anchor="end" {lab} font-size="14" letter-spacing="2.4" fill-opacity=".6">LAYOUT · DRAFT</text>')
    parts.append('<rect width="1600" height="1600" fill="url(#fade)"/>')
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1600" width="1600" height="1600">{"".join(parts)}</svg>'


def roof():
    parts = [grid("#0b0c0c")]
    # a house section: walls, gable roof, and the coating traced along the roof line
    parts.append('<path d="M470 1030V860M1130 1030V860M420 1030H1180" stroke="#e8ecea" stroke-opacity=".5" stroke-width="4" fill="none"/>')
    parts.append('<path d="M400 880L800 610L1200 880" stroke="#e8ecea" stroke-width="7" fill="none" stroke-linejoin="round"/>')
    parts.append(f'<path d="M412 862L800 600L1188 862" stroke="{G}" stroke-width="22" stroke-opacity=".22" fill="none" stroke-linejoin="round"/>')
    parts.append(f'<path d="M412 862L800 600L1188 862" stroke="{G}" stroke-width="6" fill="none" stroke-linejoin="round"/>')
    parts.append(f'<path d="M560 742L800 580" stroke="#fff" stroke-opacity=".55" stroke-width="2" stroke-dasharray="2 14" stroke-linecap="round"/>')
    # the leak, now sealed: a single drop under the ridge, faded
    parts.append('<path d="M800 700c0 0-30 40-30 62a30 30 0 0 0 60 0c0-22-30-62-30-62z" fill="#6bb8ff" fill-opacity=".18" stroke="#6bb8ff" stroke-opacity=".45" stroke-width="2"/>')
    parts.append('<rect width="1600" height="1600" fill="url(#fade)"/>')
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1600" width="1600" height="1600">{"".join(parts)}</svg>'


for pid, svg in (("kitchen-build", kitchen()), ("roof-coating", roof())):
    os.makedirs(os.path.join(OUT, pid), exist_ok=True)
    open(os.path.join(OUT, pid, "art.svg"), "w").write(svg)
    print(pid, len(svg), "bytes")
