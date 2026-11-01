"""Generate symmetric hooded-figure SVG drafts. Right half is authored as cubic segments; the left half is mirrored."""
W, H = 400, 800

def mirror_path(start, segs):
    # start: (x,y) on the centre line; segs: list of ('C', p1, p2, p) or ('L', p) going down the right side to the centre line.
    def m(p): return (W - p[0], p[1])
    d = [f"M{start[0]} {start[1]}"]
    pts = [start]
    for s in segs:
        if s[0] == 'C':
            d.append("C{} {} {} {} {} {}".format(*s[1], *s[2], *s[3])); pts.append(s[3])
        else:
            d.append("L{} {}".format(*s[1])); pts.append(s[1])
    # mirror back up the left side, reversing
    for i in range(len(segs) - 1, -1, -1):
        s = segs[i]; prev = pts[i]
        if s[0] == 'C':
            d.append("C{} {} {} {} {} {}".format(*m(s[2]), *m(s[1]), *m(prev)))
        else:
            d.append("L{} {}".format(*m(prev)))
    d.append("Z")
    return " ".join(d)

def jag(x0, x1, y, n, amp, seed):
    """Torn, uneven hem: irregular spacing and depth, curved tatters."""
    import random
    r = random.Random(seed); out = []
    xs = sorted(x0 + (x1 - x0) * (i + r.uniform(-0.3, 0.3)) / n for i in range(1, n))
    xs.append(x1)
    px, py = x0, y
    for i, x in enumerate(xs):
        down = i % 2 == 0
        ty = y + (amp * r.uniform(0.6, 1.4) if down else -amp * r.uniform(0.0, 0.5))
        mx = (px + x) / 2
        out.append(('C', (round(mx + r.uniform(-3, 3), 1), round(py, 1)), (round(mx, 1), round(ty, 1)), (round(x, 1), round(ty, 1))))
        px, py = x, ty
    return out

DEFS = '''<defs>
  <linearGradient id="robe" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#1a1d27"/><stop offset="0.5" stop-color="#11131b"/><stop offset="1" stop-color="#090a0f"/>
  </linearGradient>
  <radialGradient id="face" cx="50%" cy="40%" r="62%">
    <stop offset="0" stop-color="#000"/><stop offset="0.6" stop-color="#010102"/><stop offset="1" stop-color="#0e1017" stop-opacity="0"/>
  </radialGradient>
  <filter id="soft3" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3"/></filter>
  <filter id="soft6" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6"/></filter>
  <filter id="soft10" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="10"/></filter>
  <linearGradient id="hoodlight" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#2c3142" stop-opacity=".9"/><stop offset=".5" stop-color="#2c3142" stop-opacity="0"/>
  </linearGradient>
  <linearGradient id="sideshade" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="#000" stop-opacity=".55"/><stop offset=".3" stop-color="#000" stop-opacity="0"/>
    <stop offset=".7" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".55"/>
  </linearGradient>
</defs>'''

def folds(lines, w=1.6, op=.55):
    """Cloth relief: a soft highlight ridge with a deeper shadow trough beside it."""
    out = []
    for l in lines:
        out.append(f'<path d="{l}" fill="none" stroke="#000" stroke-width="{w*6}" stroke-opacity="{op*0.9}" stroke-linecap="round" filter="url(#soft6)" transform="translate(5 0)"/>')
        out.append(f'<path d="{l}" fill="none" stroke="#3a4054" stroke-width="{w*3}" stroke-opacity="{op*0.55}" stroke-linecap="round" filter="url(#soft3)"/>')
    return "".join(out)

# ---------- Draft A: the Wanderer (full length, arms at sides) ----------
a_out = mirror_path((200, 70), [
    ('C', (232, 70), (258, 96), (262, 134)),
    ('C', (265, 164), (258, 186), (252, 200)),
    ('C', (262, 212), (282, 218), (298, 224)),
    ('C', (316, 232), (322, 252), (322, 276)),
    ('C', (322, 340), (326, 410), (338, 468)),
    ('L', (312, 476)),
    ('C', (310, 540), (318, 640), (324, 738)),
] + jag(324, 236, 742, 9, 12, 1) + [('L', (200, 740))])
a_face = mirror_path((200, 100), [
    ('C', (226, 102), (242, 128), (242, 160)),
    ('C', (242, 196), (228, 222), (200, 230)),
])
a_hoodrim = mirror_path((200, 88), [
    ('C', (234, 90), (254, 122), (252, 160)),
    ('C', (250, 196), (236, 222), (214, 236)),
    ('L', (200, 238)),
])
a_hands = ''.join(f'<path d="M{x-9} 474 C{x-10} 492 {x-7} 508 {x} 512 C{x+7} 508 {x+10} 492 {x+9} 474Z" fill="#0d0e13"/>' for x in (300, 100))
a_boots = '<path d="M170 742 L168 770 C168 780 196 782 196 772 L196 742Z" fill="#07080b"/><path d="M230 742 L232 770 C232 780 204 782 204 772 L204 742Z" fill="#07080b"/>'
a_folds = folds([
    "M200 230 C198 380 196 560 200 736", "M176 232 C170 400 166 580 168 736", "M224 232 C230 400 234 580 232 736",
    "M150 260 C142 420 138 600 140 734", "M250 260 C258 420 262 600 260 734",
    "M126 300 C118 380 112 440 102 466", "M274 300 C282 380 288 440 298 466",
    "M160 214 C176 236 224 236 240 214",
]) + folds(["M188 236 C186 420 184 600 186 736", "M212 236 C214 420 216 600 214 736"], 1, .35)
A = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}">{DEFS}
<path d="{a_out}" fill="url(#robe)"/>{a_folds}<path d="{a_out}" fill="url(#sideshade)"/>
<path d="{a_out}" fill="url(#hoodlight)"/>
<path d="{a_hoodrim}" fill="#06070a" filter="url(#soft6)"/>
<path d="{a_face}" fill="#000" filter="url(#soft10)"/><path d="{a_face}" fill="url(#face)"/>{a_hands}{a_boots}</svg>'''

# ---------- Draft B: the Shade (close, from the chest up, fading into mist) ----------
b_out = mirror_path((200, 150), [
    ('C', (250, 150), (288, 190), (292, 248)),
    ('C', (296, 300), (290, 334), (282, 360)),
    ('C', (304, 380), (340, 392), (360, 410)),
    ('C', (380, 428), (388, 470), (390, 520)),
    ('L', (392, 800)),
    ('L', (200, 800)),
])
b_face = mirror_path((200, 196), [
    ('C', (240, 198), (262, 240), (262, 290)),
    ('C', (262, 340), (240, 370), (200, 382)),
])
b_hoodrim = mirror_path((200, 176), [
    ('C', (252, 178), (276, 226), (274, 284)),
    ('C', (272, 336), (250, 370), (220, 390)),
    ('L', (200, 392)),
])
b_folds = folds([
    "M200 372 C198 520 196 660 200 800", "M160 368 C150 520 146 660 148 800", "M240 368 C250 520 254 660 252 800",
    "M110 410 C96 540 90 660 92 800", "M290 410 C304 540 310 660 308 800",
    "M146 352 C170 384 230 384 254 352", "M200 160 C206 200 214 220 230 236",
], 2.2, .6)
B = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}">{DEFS}
<defs><linearGradient id="fadeB" x1="0" y1="0" x2="0" y2="1"><stop offset=".55" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
<mask id="mB"><rect width="{W}" height="{H}" fill="url(#fadeB)"/></mask></defs>
<g mask="url(#mB)"><path d="{b_out}" fill="url(#robe)"/>{b_folds}<path d="{b_out}" fill="url(#sideshade)"/>
<path d="{b_out}" fill="url(#hoodlight)"/></g>
<path d="{b_hoodrim}" fill="#06070a" filter="url(#soft6)"/>
<path d="{b_face}" fill="#000" filter="url(#soft10)"/><path d="{b_face}" fill="url(#face)"/></svg>'''

# ---------- Draft C: the Ascendant (arms lifted from the sides, sleeves hanging like wings) ----------
c_out = mirror_path((200, 76), [
    ('C', (232, 76), (258, 102), (262, 140)),
    ('C', (265, 170), (258, 192), (252, 206)),
    ('C', (262, 218), (282, 222), (298, 228)),
    ('C', (318, 238), (336, 262), (352, 300)),
    ('C', (370, 342), (384, 380), (392, 410)),   # arm reaching out and down
    ('L', (376, 418)),
    ('C', (360, 470), (338, 520), (314, 560)),   # sleeve hanging like a wing
    ('C', (304, 520), (296, 470), (292, 420)),
    ('C', (294, 520), (310, 640), (330, 736)),
] + jag(330, 236, 742, 9, 14, 3) + [('L', (200, 740))])
c_face = mirror_path((200, 106), [
    ('C', (226, 108), (242, 134), (242, 166)),
    ('C', (242, 202), (228, 228), (200, 236)),
])
c_hoodrim = mirror_path((200, 94), [
    ('C', (234, 96), (254, 128), (252, 166)),
    ('C', (250, 202), (236, 228), (214, 242)),
    ('L', (200, 244)),
])
c_hands = ''.join(f'<path d="M{x} 404 C{x+(10 if x>200 else -10)} 404 {x+(18 if x>200 else -18)} 412 {x+(16 if x>200 else -16)} 428 C{x+(8 if x>200 else -8)} 432 {x} 424 {x-(2 if x>200 else -2)} 414Z" fill="#0d0e13"/>' for x in (384, 16))
c_folds = folds([
    "M200 236 C198 400 196 580 200 736", "M172 238 C164 420 160 600 162 736", "M228 238 C236 420 240 600 238 736",
    "M140 270 C128 440 120 620 116 734", "M260 270 C272 440 280 620 284 734",
    "M310 300 C330 380 330 460 316 552", "M90 300 C70 380 70 460 84 552",
    "M162 218 C178 240 222 240 238 218",
])
C = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}">{DEFS}
<path d="{c_out}" fill="url(#robe)"/>{c_folds}<path d="{c_out}" fill="url(#sideshade)"/>
<path d="{c_out}" fill="url(#hoodlight)"/>
<path d="{c_hoodrim}" fill="#06070a" filter="url(#soft6)"/>
<path d="{c_face}" fill="#000" filter="url(#soft10)"/><path d="{c_face}" fill="url(#face)"/>{c_hands}{a_boots}</svg>'''

for name, svg in (('wanderer', A), ('shade', B), ('ascendant', C)):
    open(f'figures/{name}.svg', 'w').write(svg)
print('ok')
