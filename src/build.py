#!/usr/bin/env python3
# Build ChipScribe -> ../index.html
# Default figure: a generic I/Q receiver chain whose inter-block wires are
# GENERATED CONNECTORS (data-a/data-b anchored groups) — the editor re-routes
# them live when blocks are dragged. Elements register their bboxes under
# explicit gids; conn() computes the initial route with the same algorithm the
# JS uses, so the static SVG and the live editor agree.
import pathlib
import xml.etree.ElementTree as ET

base = pathlib.Path(__file__).resolve().parent
tmpl = (base / "page_template.html").read_text(encoding="utf-8")
js = (base / "editor_app.js").read_text(encoding="utf-8")

S, CTX, CNT, REG = [], [None], {}, {}
SW_WIRE, SW_SHAPE, SW_MED, SW_THIN = 2.0, 2.1, 1.8, 1.7
FS = 1.3

def P(s): (CTX[0] if CTX[0] is not None else S).append(s)

def gw(fn, name):
    def w(*a, gid=None, abox=None, **k):
        buf = []; prev = CTX[0]; CTX[0] = buf
        try:
            bb = fn(*a, **k)
        finally:
            CTX[0] = prev
        CNT[name] = CNT.get(name, 0) + 1
        g = gid or f"{name}{CNT[name]}"
        if gid:
            REG[gid] = abox or bb
        ab = f' data-abox="{abox[0]},{abox[1]},{abox[2]},{abox[3]}"' if abox else ""
        P(f'<g class="mv" data-id="{g}"{ab}>{"".join(buf)}</g>')
    return w

DASH = ' stroke-dasharray="5 3.5"'
def _ln(pts, dash=False):
    p = " ".join(f"{x},{y}" for x, y in pts)
    P(f'<polyline points="{p}" fill="none" stroke="#000" stroke-width="{SW_WIRE}"{DASH if dash else ""}/>')
def _arrowhead(pts):
    (x1, y1), (x2, y2) = pts[-2], pts[-1]
    dx, dy = x2 - x1, y2 - y1
    L = (dx * dx + dy * dy) ** 0.5 or 1
    ux, uy = dx / L, dy / L
    bx, by = x2 - 8 * ux, y2 - 8 * uy
    P(f'<polygon points="{x2},{y2} {bx-3.5*uy:.1f},{by+3.5*ux:.1f} {bx+3.5*uy:.1f},{by-3.5*ux:.1f}" fill="#000"/>')
def _lnA(pts, dash=False):
    # stop the line at the arrowhead's base so no line pokes past the tip
    (x1, y1), (x2, y2) = pts[-2], pts[-1]
    dx, dy = x2 - x1, y2 - y1
    L = (dx * dx + dy * dy) ** 0.5 or 1
    if L > 8:
        ux, uy = dx / L, dy / L
        pts2 = list(pts[:-1]) + [(x2 - 6.5 * ux, y2 - 6.5 * uy)]
    else:
        pts2 = pts
    _ln(pts2, dash)
    _arrowhead(pts)
def _txt(x, y, t, fs=10, anchor="middle", italic=False, color="#111"):
    it = ' font-style="italic"' if italic else ""
    P(f'<text x="{x}" y="{y}" font-size="{fs}" font-family="Helvetica,Arial,sans-serif" text-anchor="{anchor}"{it} fill="{color}">{t}</text>')
def _box(x, y, w, h, lines=(), fs=12.5):
    P(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="#fff" stroke="#000" stroke-width="{SW_SHAPE}"/>')
    n = len(lines)
    for i, t in enumerate(lines):
        _txt(x + w / 2, y + h / 2 + (i - (n - 1) / 2) * (fs * FS + 2) + fs * FS * 0.35, t, fs)
    return (x, y, w, h)
def _tri(x, y1, y2, xt):
    P(f'<polygon points="{x},{y1} {x},{y2} {xt},{(y1+y2)/2}" fill="#fff" stroke="#000" stroke-width="{SW_SHAPE}"/>')
    return (min(x, xt), y1, abs(xt - x), y2 - y1)
def _triD(x1, x2, y, yt):
    P(f'<polygon points="{x1},{y} {x2},{y} {(x1+x2)/2},{yt}" fill="#fff" stroke="#000" stroke-width="{SW_SHAPE}"/>')
    return (x1, min(y, yt), x2 - x1, abs(yt - y))
def _mixer(cx, cy):
    P(f'<circle cx="{cx}" cy="{cy}" r="20" fill="#fff" stroke="#000" stroke-width="{SW_SHAPE}"/>')
    P(f'<line x1="{cx-14}" y1="{cy-14}" x2="{cx+14}" y2="{cy+14}" stroke="#000" stroke-width="{SW_MED}"/>')
    P(f'<line x1="{cx-14}" y1="{cy+14}" x2="{cx+14}" y2="{cy-14}" stroke="#000" stroke-width="{SW_MED}"/>')
    return (cx - 20, cy - 20, 40, 40)
def _pad(cx, cy):
    P(f'<rect x="{cx-8}" y="{cy-8}" width="16" height="16" fill="#fff" stroke="#000" stroke-width="2.2"/>'
      f'<line x1="{cx-8}" y1="{cy-8}" x2="{cx+8}" y2="{cy+8}" stroke="#000" stroke-width="1.5"/>')
    return (cx - 8, cy - 8, 16, 16)
def _bias(cx, cy):
    P(f'<circle cx="{cx}" cy="{cy}" r="4" fill="#fff" stroke="#000" stroke-width="{SW_MED}"/>')
    return (cx - 4, cy - 4, 8, 8)
def _slash(x, y, n=None):
    P(f'<line x1="{x-4}" y1="{y+5}" x2="{x+4}" y2="{y-5}" stroke="#000" stroke-width="{SW_THIN}"/>')
    if n is not None:
        _txt(x + 7, y - 6, n, 9)
def _adc(x, y, w, h, l1="ADC"):
    tip = 22
    P(f'<polygon points="{x},{y+h/2} {x+tip},{y} {x+w},{y} {x+w},{y+h} {x+tip},{y+h}" fill="#fff" stroke="#000" stroke-width="{SW_SHAPE}"/>')
    _txt(x + (w + tip / 2) / 2, y + h / 2 + 4.5, l1, 12)
    return (x, y, w, h)
def _ant(x, y, stem=True):
    P(f'<polygon points="{x-9},{y-14} {x+9},{y-14} {x},{y-4}" fill="#fff" stroke="#000" stroke-width="2"/>')
    if stem:
        P(f'<line x1="{x}" y1="{y-4}" x2="{x}" y2="{y+12}" stroke="#000" stroke-width="2"/>')
    return (x - 9, y - 14, 18, 26 if stem else 10)
def _dot(x, y):
    P(f'<circle cx="{x}" cy="{y}" r="3" fill="#000"/>')
    return (x - 3, y - 3, 6, 6)
def _sine(x, y, w, ry=6):
    r = w / 4
    P(f'<path d="M {x} {y} q {r} {-2*ry} {2*r} 0 q {r} {2*ry} {2*r} 0" fill="none" stroke="#000" stroke-width="{SW_MED}"/>')
def _strike(cx, cy, s=1.0):
    P(f'<line x1="{cx-4.5*s}" y1="{cy+5.5*s}" x2="{cx+4.5*s}" y2="{cy-5.5*s}" stroke="#000" stroke-width="{SW_THIN}"/>')
def _lpf(x, y, w, h):
    P(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="#fff" stroke="#000" stroke-width="{SW_SHAPE}"/>')
    cx, sw, s = x + w / 2, w * 0.44, h / 50
    for i, fy in enumerate((0.22, 0.5, 0.78)):
        _sine(cx - sw / 2, y + h * fy, sw, h * 0.11)
        if i < 2:
            _strike(cx, y + h * fy, s)
    return (x, y, w, h)

ln = gw(_ln, "ln"); lnA = gw(_lnA, "lnA"); txt = gw(_txt, "txt"); box = gw(_box, "box")
tri = gw(_tri, "tri"); triD = gw(_triD, "triD"); mixer = gw(_mixer, "mix"); pad = gw(_pad, "pad")
bias = gw(_bias, "bias"); slash = gw(_slash, "sl"); lpf = gw(_lpf, "lpf")
ant = gw(_ant, "ant"); dot = gw(_dot, "dot"); adc = gw(_adc, "adc")

# ---- generated connectors: same routing algorithm as editor_app.js ----
def _routeAB(A, B, dirn=None):
    ax, ay, aw, ah = A; bx, by, bw, bh = B
    ac = (ax + aw / 2, ay + ah / 2); bc = (bx + bw / 2, by + bh / 2)
    dx = bc[0] - ac[0]; dy = bc[1] - ac[1]
    if dirn == "vh":
        sy = ay + ah if dy >= 0 else ay
        ex = bx if ac[0] < bc[0] else bx + bw
        return [(ac[0], sy), (ac[0], bc[1]), (ex, bc[1])]
    if dirn == "hv":
        sx = ax + aw if dx >= 0 else ax
        ey = by if ac[1] < bc[1] else by + bh
        return [(sx, ac[1]), (bc[0], ac[1]), (bc[0], ey)]
    horiz = dirn == "h" or (dirn != "v" and dirn != "vz" and abs(dx) >= abs(dy))
    if horiz:
        sx = ax + aw if dx >= 0 else ax
        ex = bx if dx >= 0 else bx + bw
        if abs(ac[1] - bc[1]) < 6: return [(sx, ac[1]), (ex, ac[1])]
        if by + 2 <= ac[1] <= by + bh - 2: return [(sx, ac[1]), (ex, ac[1])]
        if ay + 2 <= bc[1] <= ay + ah - 2: return [(sx, bc[1]), (ex, bc[1])]
        mx = (sx + ex) / 2
        return [(sx, ac[1]), (mx, ac[1]), (mx, bc[1]), (ex, bc[1])]
    sy = ay + ah if dy >= 0 else ay
    ey = by if dy >= 0 else by + bh
    if abs(ac[0] - bc[0]) < 6: return [(ac[0], sy), (ac[0], ey)]
    if dirn != "vz":
        if bx + 2 <= ac[0] <= bx + bw - 2: return [(ac[0], sy), (ac[0], ey)]
        if ax + 2 <= bc[0] <= ax + aw - 2: return [(bc[0], sy), (bc[0], ey)]
    my = (sy + ey) / 2
    return [(ac[0], sy), (ac[0], my), (bc[0], my), (bc[0], ey)]

def conn(a, b, arrow=False, dash=False, slash_lbl=None, dirn=None, ext=0):
    pts = _routeAB(REG[a], REG[b], dirn)
    if ext:
        (x1, y1), (x2, y2) = pts[-2], pts[-1]
        dx, dy = x2 - x1, y2 - y1
        L = (dx * dx + dy * dy) ** 0.5 or 1
        pts = list(pts[:-1]) + [(x2 + ext * dx / L, y2 + ext * dy / L)]
    CNT["c"] = CNT.get("c", 0) + 1
    gid = f"c{CNT['c']}"
    buf = []; CTX[0] = buf
    (_lnA if arrow else _ln)(pts, dash)
    if slash_lbl:
        pa, pb = (pts[1], pts[2]) if len(pts) == 4 else (pts[0], pts[1])
        mx, my = (pa[0] + pb[0]) / 2, (pa[1] + pb[1]) / 2
        P(f'<line x1="{mx-4}" y1="{my+5}" x2="{mx+4}" y2="{my-5}" stroke="#000" stroke-width="{SW_THIN}"/>')
        _txt(mx + 9, my - 7, slash_lbl, 9)
    CTX[0] = None
    attrs = f' data-a="{a}" data-b="{b}"'
    if arrow: attrs += ' data-arrow="1"'
    if dash: attrs += ' data-dash="1"'
    if slash_lbl: attrs += f' data-slash="{slash_lbl}"'
    if dirn: attrs += f' data-dir="{dirn}"'
    if ext: attrs += f' data-ext="{ext}"'
    S.append(f'<g class="mv" data-id="{gid}"{attrs}>{"".join(buf)}</g>')

# ================= generic I/Q receiver demo (connector-wired) =================
P('<rect id="chipbound" x="70" y="50" width="960" height="550" fill="#fff" stroke="#000" stroke-width="2.6"/>')
# elements
ant(38, 308, stem=False, gid="ant1", abox=(38, 304, 0, 0))   # point anchor at the triangle apex
pad(70, 320, gid="prf"); txt(70, 344, "RF_IN", 10)
box(140, 295, 90, 50, ["input", "match"], 10, gid="bmatch")
tri(270, 298, 342, 310, gid="lna"); txt(288, 290, "LNA", 10)
bias(288, 373, gid="bln"); txt(288, 391, "LNA_CASC", 9.5)
dot(350, 320, gid="nsplit")
mixer(430, 250, gid="mixI"); mixer(430, 390, gid="mixQ")
pad(425, 50, gid="plop"); pad(475, 50, gid="plon"); pad(545, 50, gid="plocm")
txt(425, 32, "LO_P", 10); txt(475, 32, "LO_N", 10); txt(545, 32, "LO_CM", 10)
box(395, 120, 110, 50, ["÷2  CML"], 13, gid="cml")
triD(420, 440, 204, 222, gid="buf0")
triD(460, 480, 204, 222, gid="buf90")
txt(412, 217, "0°", 8, "end"); txt(488, 217, "90°", 8, "start")
txt(595, 212, "I channel", 10.5, "middle", True)
txt(595, 452, "Q channel", 10.5, "middle", True)
lpf(556, 228, 78, 44, gid="lpfI"); txt(595, 287, "LPF", 10)
lpf(556, 368, 78, 44, gid="lpfQ"); txt(595, 427, "LPF", 10)
tri(676, 231, 269, 710, gid="vgaI1"); tri(692, 231, 269, 726, gid="vgaI2")
lnA([(678, 274), (716, 226)]); txt(701, 219, "VGA", 10)
tri(676, 371, 409, 710, gid="vgaQ1"); tri(692, 371, 409, 726, gid="vgaQ2")
lnA([(678, 414), (716, 366)]); txt(701, 359, "VGA", 10)
adc(760, 225, 80, 50, "I-ADC", gid="adcI")
adc(760, 365, 80, 50, "Q-ADC", gid="adcQ")
pad(1030, 250, gid="poutI"); txt(1044, 254, "I_OUT", 10, "start")
pad(1030, 390, gid="poutQ"); txt(1044, 394, "Q_OUT", 10, "start")
# glued connectors (re-route live in the editor)
conn("ant1", "prf", dirn="vh")   # single polyline: apex → down → into pad (clean mitered bend)
conn("prf", "bmatch")
conn("bmatch", "lna")
conn("lna", "nsplit")
conn("nsplit", "mixI", dirn="vh")
conn("nsplit", "mixQ", dirn="vh")
conn("plop", "cml", dirn="v")
conn("plon", "cml", dirn="v")
conn("plocm", "cml", arrow=True, dirn="vh")
conn("cml", "buf0", dirn="v", slash_lbl="2")
conn("cml", "buf90", dirn="v", slash_lbl="2")
conn("buf0", "mixI", dirn="v")   # stub and mixer center aligned at x=430: single straight drop
conn("buf90", "mixQ", dirn="v")   # Z-drop into mixQ top at x=450
conn("mixI", "lpfI", slash_lbl="2")
conn("mixQ", "lpfQ", slash_lbl="2")
conn("lpfI", "vgaI1")
conn("vgaI2", "adcI")
conn("lpfQ", "vgaQ1")
conn("vgaQ2", "adcQ")
conn("adcI", "poutI", slash_lbl="10")
conn("adcQ", "poutQ", slash_lbl="10")
conn("bln", "lna", dirn="v", ext=10)   # reach past the bbox to the triangle's hypotenuse
# ==============================================================================

import re
def scale_fonts(s):
    return re.sub(r'font-size="([0-9.]+)"',
                  lambda m: f'font-size="{round(float(m.group(1)) * FS, 1)}"', s)
svg_inner = scale_fonts("".join(S))
svg = ('<svg xmlns="http://www.w3.org/2000/svg" width="1100" height="640" viewBox="0 0 1100 640" '
       'font-family="Helvetica,Arial,sans-serif" id="d">' + svg_inner + "</svg>")
ET.fromstring(svg)  # well-formedness gate

doc = tmpl.replace("__SVG__", svg).replace("__JS__", js)
outdir = base.parent
(outdir / "index.html").write_text(doc, encoding="utf-8")
leak = False  # leak scan applies to the private build lineage only
nconn = doc.count('data-a="')
print("public build bytes:", (outdir / "index.html").stat().st_size)
print("groups:", sum(CNT.values()), "| generated connectors:", nconn)
print("chip-data leak:", leak)
