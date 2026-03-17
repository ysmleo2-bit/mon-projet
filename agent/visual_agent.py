"""
Agent 4 — VisualAgent
Génère les visuels 1080x1080 adaptés à chaque post.

Chaque visuel est construit à partir du brief fourni par ContentAgent :
  - Style : fond noir / accents vert électrique (#00FF87) / blanc
  - Structure : accroche principale, sous-titre, branding Léo Ollivier
  - Variation de layouts selon l'angle du post

Dépendance : Pillow (PIL)
"""

import os
import random
import textwrap
from pathlib import Path
from datetime import datetime

try:
    from PIL import Image, ImageDraw, ImageFont, ImageFilter
    PIL_AVAILABLE = True
except ImportError:
    PIL_AVAILABLE = False

from agent.content_agent import GeneratedPost

# Upload Drive automatique après génération
def _try_upload(path: Path) -> str | None:
    """Upload le visuel vers Drive. Retourne l'URL publique ou None si échec."""
    try:
        from upload_drive import upload_single_file
        result = upload_single_file(str(path))
        return result.get("view_url") if result else None
    except BaseException as e:
        print(f"  [Drive] Upload ignoré : {e}")
        return None

VISUALS_DIR = Path("data/generated_content/visuals")
VISUALS_DIR.mkdir(parents=True, exist_ok=True)

# Palette
C_BLACK      = (10, 10, 15)          # Fond
C_DARK_CARD  = (18, 18, 25)          # Carte
C_GREEN      = (0, 255, 135)         # Vert électrique #00FF87
C_GREEN_DIM  = (0, 180, 95)          # Vert atténué
C_WHITE      = (255, 255, 255)
C_GREY       = (160, 160, 180)
C_ACCENT     = (100, 60, 255)        # Violet secondaire

SIZE = (1080, 1080)

# Chemins polices (Pillow utilise les polices système ou des chemins explicites)
FONT_PATHS = {
    "bold":    ["/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
                "/System/Library/Fonts/Helvetica.ttc",
                "C:/Windows/Fonts/arialbd.ttf"],
    "regular": ["/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
                "/System/Library/Fonts/Helvetica.ttc",
                "C:/Windows/Fonts/arial.ttf"],
    "light":   ["/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
                "/System/Library/Fonts/HelveticaNeue.ttc",
                "C:/Windows/Fonts/arial.ttf"],
}


def _load_font(style: str = "bold", size: int = 48) -> "ImageFont":
    for path in FONT_PATHS.get(style, FONT_PATHS["bold"]):
        if os.path.exists(path):
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


def _wrap_text(text: str, max_chars: int = 28) -> list[str]:
    return textwrap.wrap(text, width=max_chars)


def _draw_rounded_rect(draw, xy, radius=24, fill=None, outline=None, width=2):
    x0, y0, x1, y1 = xy
    draw.rounded_rectangle([x0, y0, x1, y1], radius=radius, fill=fill, outline=outline, width=width)


class VisualAgent:
    """
    Génère des visuels 1080x1080 PNG à partir d'un GeneratedPost.
    Trois layouts disponibles, choisis selon l'angle du post.
    """

    # Mapping angle → layout
    ANGLE_LAYOUTS = {
        "storytelling_transformation": "split",          # Gauche/droite avant-après
        "chiffres_concrets":           "numbers",        # Chiffres mis en avant
        "question_douleur":            "question",       # Grande question centrale
        "temoignage_fictif":           "quote",          # Citation stylée
        "mythe_vs_realite":            "myth",           # Vrai/faux
        "curiosite_metier":            "mystery",        # Mystère révélé
        "urgence_marche":              "urgency",        # Urgence + chiffres
    }

    def generate(self, post: GeneratedPost) -> Path:
        if not PIL_AVAILABLE:
            print("  ⚠ Pillow non installé (pip install Pillow). Visuel ignoré.")
            return None

        layout = self.ANGLE_LAYOUTS.get(post.angle, "question")
        method = getattr(self, f"_layout_{layout}", self._layout_question)
        img    = method(post)

        date_str = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
        out_path = VISUALS_DIR / f"{post.group_id}_{date_str}.png"
        img.save(str(out_path), "PNG", optimize=True)
        print(f"  ✓ Visuel sauvegardé : {out_path.name}")

        # Upload automatique vers Google Drive
        drive_url = _try_upload(out_path)
        if drive_url:
            print(f"  ☁  Drive : {drive_url}")

        return out_path

    # ── Layout: question ─────────────────────────────────────────────────────

    def _layout_question(self, post: GeneratedPost) -> "Image":
        img  = Image.new("RGB", SIZE, C_BLACK)
        draw = ImageDraw.Draw(img)

        # Bande verte en haut
        draw.rectangle([0, 0, 1080, 8], fill=C_GREEN)

        # Hook (grande question)
        hook_lines = _wrap_text(post.hook, max_chars=22)
        font_hook  = _load_font("bold", 72)
        y = 200
        for line in hook_lines[:3]:
            bbox = font_hook.getbbox(line)
            w    = bbox[2] - bbox[0]
            draw.text(((1080 - w) // 2, y), line, font=font_hook, fill=C_WHITE)
            y += 90

        # Trait vert
        draw.rectangle([200, y + 20, 880, y + 24], fill=C_GREEN)

        # Body (extrait court)
        body_short = post.body[:180].rstrip() + "…"
        body_lines = _wrap_text(body_short, max_chars=38)
        font_body  = _load_font("regular", 40)
        y += 60
        for line in body_lines[:4]:
            bbox = font_body.getbbox(line)
            w    = bbox[2] - bbox[0]
            draw.text(((1080 - w) // 2, y), line, font=font_body, fill=C_GREY)
            y += 52

        # CTA box
        cta_text = f"👇  {post.cta}"
        font_cta = _load_font("bold", 44)
        _draw_rounded_rect(draw, [140, 800, 940, 880], radius=20,
                           fill=C_GREEN, outline=None)
        bbox = font_cta.getbbox(cta_text)
        w    = bbox[2] - bbox[0]
        draw.text(((1080 - w) // 2, 820), cta_text, font=font_cta, fill=C_BLACK)

        # Branding
        font_brand = _load_font("regular", 28)
        draw.text((540, 950), "Léo Ollivier — Setting",
                  font=font_brand, fill=C_GREEN_DIM, anchor="mm")

        # Bande verte en bas
        draw.rectangle([0, 1072, 1080, 1080], fill=C_GREEN)
        return img

    # ── Layout: numbers ──────────────────────────────────────────────────────

    def _layout_numbers(self, post: GeneratedPost) -> "Image":
        img  = Image.new("RGB", SIZE, C_BLACK)
        draw = ImageDraw.Draw(img)

        # Grille légère
        for x in range(0, 1080, 120):
            draw.line([(x, 0), (x, 1080)], fill=(20, 20, 28), width=1)
        for y in range(0, 1080, 120):
            draw.line([(0, y), (1080, y)], fill=(20, 20, 28), width=1)

        # Chiffres clés — extraits du brief ou hardcodés DEA
        numbers = [("1 500 €", "à 3 000 €/mois"), ("2-3h", "par jour"), ("0", "expérience")]
        font_big   = _load_font("bold", 100)
        font_small = _load_font("regular", 36)

        positions = [(180, 200), (540, 200), (900, 200)]
        for (num, label), (cx, cy) in zip(numbers, positions):
            bbox = font_big.getbbox(num)
            w    = bbox[2] - bbox[0]
            draw.text((cx - w // 2, cy), num, font=font_big, fill=C_GREEN)
            bbox2 = font_small.getbbox(label)
            w2    = bbox2[2] - bbox2[0]
            draw.text((cx - w2 // 2, cy + 110), label, font=font_small, fill=C_GREY)

        # Hook
        font_hook  = _load_font("bold", 60)
        hook_lines = _wrap_text(post.hook, max_chars=28)
        y = 480
        for line in hook_lines[:2]:
            bbox = font_hook.getbbox(line)
            w    = bbox[2] - bbox[0]
            draw.text(((1080 - w) // 2, y), line, font=font_hook, fill=C_WHITE)
            y += 76

        # CTA
        font_cta = _load_font("bold", 44)
        _draw_rounded_rect(draw, [140, 800, 940, 880], radius=20, fill=C_GREEN)
        cta_text = f"👇  {post.cta}"
        bbox = font_cta.getbbox(cta_text)
        draw.text(((1080 - (bbox[2]-bbox[0])) // 2, 820),
                  cta_text, font=font_cta, fill=C_BLACK)

        # Branding
        font_brand = _load_font("regular", 28)
        draw.text((540, 950), "Léo Ollivier — Setting",
                  font=font_brand, fill=C_GREEN_DIM, anchor="mm")
        draw.rectangle([0, 0, 1080, 8], fill=C_GREEN)
        draw.rectangle([0, 1072, 1080, 1080], fill=C_GREEN)
        return img

    # ── Layout: quote ────────────────────────────────────────────────────────

    def _layout_quote(self, post: GeneratedPost) -> "Image":
        img  = Image.new("RGB", SIZE, C_DARK_CARD)
        draw = ImageDraw.Draw(img)

        # Guillemets décoratifs
        font_quote_mark = _load_font("bold", 200)
        draw.text((60, 60), "❝", font=font_quote_mark, fill=(0, 255, 135, 30))

        # Corps de la citation
        quote_lines = _wrap_text(post.body[:220], max_chars=30)
        font_body   = _load_font("regular", 52)
        y = 280
        for line in quote_lines[:4]:
            bbox = font_body.getbbox(line)
            w    = bbox[2] - bbox[0]
            draw.text(((1080 - w) // 2, y), line, font=font_body, fill=C_WHITE)
            y += 68

        # Attribution fictive
        draw.rectangle([430, y + 30, 650, y + 34], fill=C_GREEN)
        font_attr = _load_font("regular", 36)
        draw.text((540, y + 60), "— Membre de la communauté",
                  font=font_attr, fill=C_GREY, anchor="mm")

        # CTA
        font_cta = _load_font("bold", 44)
        _draw_rounded_rect(draw, [140, 820, 940, 900], radius=20, fill=C_GREEN)
        cta_text = f"👇  {post.cta}"
        bbox = font_cta.getbbox(cta_text)
        draw.text(((1080 - (bbox[2]-bbox[0])) // 2, 840),
                  cta_text, font=font_cta, fill=C_BLACK)

        # Branding
        font_brand = _load_font("regular", 28)
        draw.text((540, 960), "Léo Ollivier — Setting",
                  font=font_brand, fill=C_GREEN_DIM, anchor="mm")
        draw.rectangle([0, 0, 1080, 8], fill=C_GREEN)
        return img

    # ── Layout: mystery ──────────────────────────────────────────────────────

    def _layout_mystery(self, post: GeneratedPost) -> "Image":
        img  = Image.new("RGB", SIZE, C_BLACK)
        draw = ImageDraw.Draw(img)

        # Cercle central mystérieux
        draw.ellipse([340, 180, 740, 580], outline=C_GREEN, width=4)
        font_qmark = _load_font("bold", 200)
        draw.text((540, 280), "?", font=font_qmark, fill=C_GREEN, anchor="mm")

        font_hook  = _load_font("bold", 58)
        hook_lines = _wrap_text(post.hook, max_chars=26)
        y = 630
        for line in hook_lines[:2]:
            bbox = font_hook.getbbox(line)
            draw.text(((1080 - (bbox[2]-bbox[0])) // 2, y), line,
                      font=font_hook, fill=C_WHITE)
            y += 74

        font_cta = _load_font("bold", 44)
        _draw_rounded_rect(draw, [140, 820, 940, 900], radius=20, fill=C_GREEN)
        cta_text = f"👇  {post.cta}"
        bbox = font_cta.getbbox(cta_text)
        draw.text(((1080 - (bbox[2]-bbox[0])) // 2, 840),
                  cta_text, font=font_cta, fill=C_BLACK)

        font_brand = _load_font("regular", 28)
        draw.text((540, 960), "Léo Ollivier — Setting",
                  font=font_brand, fill=C_GREEN_DIM, anchor="mm")
        draw.rectangle([0, 0, 1080, 8], fill=C_GREEN)
        draw.rectangle([0, 1072, 1080, 1080], fill=C_GREEN)
        return img

    # ── Layouts redirigés ────────────────────────────────────────────────────
    # split, myth et urgency utilisent question/numbers comme base

    def _layout_split(self, post: GeneratedPost) -> "Image":
        return self._layout_question(post)

    def _layout_myth(self, post: GeneratedPost) -> "Image":
        return self._layout_numbers(post)

    def _layout_urgency(self, post: GeneratedPost) -> "Image":
        return self._layout_numbers(post)

    # ── Batch generation ─────────────────────────────────────────────────────

    def generate_batch(self, posts: list[GeneratedPost]) -> list[Path]:
        paths = []
        for post in posts:
            path = self.generate(post)
            if path:
                paths.append(path)
        return paths
