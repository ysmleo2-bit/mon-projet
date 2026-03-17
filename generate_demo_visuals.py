"""
Script de démonstration — génère 3 visuels 1080x1080 réels.
Aucune API Claude requise, utilise les posts exemples hardcodés.
"""
import textwrap
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter

OUT = Path("data/generated_content/visuals")
OUT.mkdir(parents=True, exist_ok=True)

FONT_BOLD    = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
FONT_REGULAR = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"

def font(path, size):
    return ImageFont.truetype(path, size)

def wrap(text, width):
    return textwrap.wrap(text, width=width)

def centered_text(draw, text, y, fnt, color, canvas_w=1080):
    bb = fnt.getbbox(text)
    w  = bb[2] - bb[0]
    draw.text(((canvas_w - w) // 2, y), text, font=fnt, fill=color)
    return bb[3] - bb[1]

def rounded_rect(draw, xy, r, fill):
    draw.rounded_rectangle(xy, radius=r, fill=fill)


# ─────────────────────────────────────────────────────────────────────────────
# VISUEL 1 — Reconversion / Storytelling
# ─────────────────────────────────────────────────────────────────────────────
def visual_reconversion():
    W, H = 1080, 1080
    img  = Image.new("RGB", (W, H), (8, 8, 12))
    d    = ImageDraw.Draw(img)

    # Fond radial effet spot
    glow = Image.new("RGB", (W, H), (0, 0, 0))
    gd   = ImageDraw.Draw(glow)
    for r in range(420, 0, -6):
        alpha = int(18 * (1 - r / 420))
        gd.ellipse([(W//2-r, 300-r), (W//2+r, 300+r)],
                   fill=(0, alpha*3, alpha))
    img = Image.blend(img, glow, 0.6)
    d   = ImageDraw.Draw(img)

    # Barre verte haut
    d.rectangle([0, 0, W, 7], fill=(0, 255, 135))

    # Label catégorie
    f_label = font(FONT_BOLD, 28)
    rounded_rect(d, [40, 30, 280, 65], r=14, fill=(0, 60, 35))
    d.text((55, 37), "RECONVERSION", font=f_label, fill=(0, 255, 135))

    # Grande accroche
    f_hook = font(FONT_BOLD, 68)
    hook_lines = [
        "Il y a 4 mois,",
        "Karim gagnait",
        "2 200 €/mois.",
        "Et détestait ça."
    ]
    y = 110
    for i, line in enumerate(hook_lines):
        color = (0, 255, 135) if i == 3 else (255, 255, 255)
        bb = d.textbbox((0,0), line, font=f_hook)
        tw = bb[2] - bb[0]
        d.text(((W - tw)//2, y), line, font=f_hook, fill=color)
        y += 78

    # Séparateur
    d.rectangle([180, y+18, 900, y+22], fill=(0, 255, 135))
    y += 52

    # Corps court
    f_body = font(FONT_REGULAR, 42)
    body = [
        "Aujourd'hui il a rendu son badge.",
        "1 900 €/mois en parallèle —",
        "2h par jour depuis chez lui.",
        "Sans diplôme. Sans expérience.",
    ]
    for line in body:
        bb = d.textbbox((0,0), line, font=f_body)
        tw = bb[2] - bb[0]
        d.text(((W - tw)//2, y), line, font=f_body, fill=(190, 200, 210))
        y += 54

    # Citation mise en valeur
    y += 14
    rounded_rect(d, [80, y, W-80, y+70], r=16, fill=(0, 35, 20))
    f_quote = font(FONT_BOLD, 38)
    q = "« Le métier existe. Et les places se remplissent. »"
    bb = d.textbbox((0,0), q, font=f_quote)
    tw = bb[2] - bb[0]
    d.text(((W - tw)//2, y+16), q, font=f_quote, fill=(0, 255, 135))
    y += 90

    # CTA bouton
    y += 18
    rounded_rect(d, [120, y, W-120, y+80], r=22, fill=(0, 255, 135))
    f_cta = font(FONT_BOLD, 46)
    cta = "👇  Commente INFO en privé"
    bb  = d.textbbox((0,0), cta, font=f_cta)
    tw  = bb[2] - bb[0]
    d.text(((W - tw)//2, y+16), cta, font=f_cta, fill=(5, 5, 10))

    # Branding
    f_brand = font(FONT_REGULAR, 30)
    d.text((W//2, 1040), "Léo Ollivier — Setting", font=f_brand,
           fill=(0, 160, 85), anchor="mm")
    d.rectangle([0, 1072, W, 1080], fill=(0, 255, 135))

    path = OUT / "demo_reconversion.png"
    img.save(str(path), "PNG")
    print(f"✓ {path}")
    return path


# ─────────────────────────────────────────────────────────────────────────────
# VISUEL 2 — Emploi / Question douleur
# ─────────────────────────────────────────────────────────────────────────────
def visual_emploi():
    W, H = 1080, 1080
    img  = Image.new("RGB", (W, H), (6, 6, 10))
    d    = ImageDraw.Draw(img)

    # Grille de fond (effet tech)
    for x in range(0, W, 90):
        d.line([(x, 0), (x, H)], fill=(16, 16, 22), width=1)
    for y in range(0, H, 90):
        d.line([(0, y), (W, y)], fill=(16, 16, 22), width=1)

    # Accent ligne gauche colorée
    d.rectangle([0, 0, 7, H], fill=(0, 255, 135))

    # Label
    f_label = font(FONT_BOLD, 28)
    rounded_rect(d, [40, 30, 220, 66], r=14, fill=(0, 50, 30))
    d.text((55, 38), "EMPLOI", font=f_label, fill=(0, 255, 135))

    # Grande question en blanc + vert
    f_big = font(FONT_BOLD, 72)
    lines_q = ["T'as envoyé", "40 CV ce mois ?"]
    y = 120
    for i, line in enumerate(lines_q):
        color = (255, 255, 255) if i == 0 else (0, 255, 135)
        bb = d.textbbox((0,0), line, font=f_big)
        tw = bb[2] - bb[0]
        d.text(((W-tw)//2, y), line, font=f_big, fill=color)
        y += 88

    # Sous-titre douleur
    f_sub = font(FONT_REGULAR, 44)
    y += 10
    sub = "2 réponses. Ou 0."
    bb  = d.textbbox((0,0), sub, font=f_sub)
    d.text(((W - (bb[2]-bb[0]))//2, y), sub, font=f_sub, fill=(150, 160, 175))
    y += 70

    # Séparateur dégradé
    d.rectangle([200, y, W-200, y+3], fill=(0, 255, 135))
    y += 35

    # Stats comparatives
    f_stat_big  = font(FONT_BOLD, 96)
    f_stat_lab  = font(FONT_REGULAR, 36)

    cols = [(200, "Marché\nclassique", "Saturé", (220,70,70)),
            (540, "Ce métier\ndigital",  "Boom", (0,255,135)),
            (880, "Diplôme\nrequis",     "Zéro", (0,255,135))]

    for cx, label, value, color in cols:
        bb = d.textbbox((0,0), value, font=f_stat_big)
        tw = bb[2] - bb[0]
        d.text((cx - tw//2, y), value, font=f_stat_big, fill=color)
        for j, lline in enumerate(label.split("\n")):
            bb2 = d.textbbox((0,0), lline, font=f_stat_lab)
            tw2 = bb2[2] - bb2[0]
            d.text((cx - tw2//2, y+108+j*40), lline, font=f_stat_lab, fill=(130,140,155))

    y += 230

    # Corps
    f_body = font(FONT_REGULAR, 40)
    body = [
        "2h/jour · depuis chez toi · 800-1500€ dès le 1er mois",
    ]
    for line in body:
        bb = d.textbbox((0,0), line, font=f_body)
        d.text(((W-(bb[2]-bb[0]))//2, y), line, font=f_body, fill=(180,190,200))
        y += 54

    # CTA
    y += 20
    rounded_rect(d, [120, y, W-120, y+80], r=22, fill=(0, 255, 135))
    f_cta = font(FONT_BOLD, 46)
    cta = "👇  Tape OUI — je t'explique tout"
    bb  = d.textbbox((0,0), cta, font=f_cta)
    d.text(((W-(bb[2]-bb[0]))//2, y+16), cta, font=f_cta, fill=(5,5,10))

    # Branding
    f_brand = font(FONT_REGULAR, 30)
    d.text((W//2, 1040), "Léo Ollivier — Setting", font=f_brand,
           fill=(0,160,85), anchor="mm")
    d.rectangle([0, 1072, W, 1080], fill=(0,255,135))

    path = OUT / "demo_emploi.png"
    img.save(str(path), "PNG")
    print(f"✓ {path}")
    return path


# ─────────────────────────────────────────────────────────────────────────────
# VISUEL 3 — Étudiants / Chiffres
# ─────────────────────────────────────────────────────────────────────────────
def visual_etudiant():
    W, H = 1080, 1080
    img  = Image.new("RGB", (W, H), (8, 6, 18))
    d    = ImageDraw.Draw(img)

    # Fond dégradé violet → noir
    for y_row in range(H):
        ratio = y_row / H
        r = int(18 * (1 - ratio))
        g = int(8  * (1 - ratio))
        b = int(40 * (1 - ratio))
        d.line([(0, y_row), (W, y_row)], fill=(r, g, b))

    d = ImageDraw.Draw(img)

    # Barre top verte
    d.rectangle([0, 0, W, 7], fill=(0, 255, 135))

    # Label
    f_label = font(FONT_BOLD, 28)
    rounded_rect(d, [40, 28, 230, 64], r=14, fill=(30, 10, 60))
    d.text((55, 35), "ÉTUDIANT", font=f_label, fill=(180, 100, 255))

    # Titre
    f_big = font(FONT_BOLD, 66)
    titles = ["Job étudiant :", "250 €/mois", "VS"]
    colors = [(255,255,255), (220,70,70), (150,150,170)]
    y = 100
    for title, color in zip(titles, colors):
        bb = d.textbbox((0,0), title, font=f_big)
        tw = bb[2] - bb[0]
        d.text(((W-tw)//2, y), title, font=f_big, fill=color)
        y += 78

    # Grands chiffres verts
    f_mega = font(FONT_BOLD, 130)
    chiffre = "900 €"
    bb = d.textbbox((0,0), chiffre, font=f_mega)
    tw = bb[2] - bb[0]
    d.text(((W-tw)//2, y), chiffre, font=f_mega, fill=(0,255,135))
    y += 148

    f_sub = font(FONT_REGULAR, 40)
    sub = "dès le 1er mois · 2h/jour · depuis ton appart"
    bb  = d.textbbox((0,0), sub, font=f_sub)
    d.text(((W-(bb[2]-bb[0]))//2, y), sub, font=f_sub, fill=(160,170,190))
    y += 64

    # 3 points clés
    d.rectangle([160, y+10, 920, y+13], fill=(100,50,200))
    y += 40
    f_pts = font(FONT_BOLD, 40)
    points = ["✓  0 diplôme requis",
              "✓  Compatible avec tes cours",
              "✓  Paiement à la commission"]
    for pt in points:
        bb = d.textbbox((0,0), pt, font=f_pts)
        tw = bb[2] - bb[0]
        d.text(((W-tw)//2, y), pt, font=f_pts, fill=(200,210,225))
        y += 56

    # CTA
    y += 18
    rounded_rect(d, [120, y, W-120, y+82], r=24, fill=(0,255,135))
    f_cta = font(FONT_BOLD, 46)
    cta = "👇  Commente INFO 🎓"
    bb  = d.textbbox((0,0), cta, font=f_cta)
    d.text(((W-(bb[2]-bb[0]))//2, y+17), cta, font=f_cta, fill=(5,5,10))

    # Branding
    f_brand = font(FONT_REGULAR, 30)
    d.text((W//2, 1040), "Léo Ollivier — Setting", font=f_brand,
           fill=(0,160,85), anchor="mm")
    d.rectangle([0, 1072, W, 1080], fill=(0,255,135))

    path = OUT / "demo_etudiant.png"
    img.save(str(path), "PNG")
    print(f"✓ {path}")
    return path


if __name__ == "__main__":
    print("Génération des visuels de démonstration…\n")
    p1 = visual_reconversion()
    p2 = visual_emploi()
    p3 = visual_etudiant()
    print(f"\n3 visuels générés dans : {OUT}")
