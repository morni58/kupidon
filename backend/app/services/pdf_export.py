"""Server-side beautiful profile-card PDF (reportlab, Cyrillic-safe).

Rendered on the backend and delivered to the user via the bot as a document —
reliable inside Telegram (no webview download trap) and supports Russian text.
"""
import os
from datetime import date

from reportlab.lib.pagesizes import A4
from reportlab.lib.utils import simpleSplit, ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas

MEDIA_ROOT = os.environ.get("MEDIA_ROOT", "/app/media")

# Fonts (installed via fonts-dejavu-core in the Docker image).
_FONT_CANDIDATES = [
    ("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"),
    ("/usr/share/fonts/dejavu/DejaVuSans.ttf", "/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf"),
]
REG, BOLD = "Body", "BodyBold"
_fonts_ready = False


def _ensure_fonts():
    global _fonts_ready, REG, BOLD
    if _fonts_ready:
        return
    for reg, bold in _FONT_CANDIDATES:
        if os.path.isfile(reg) and os.path.isfile(bold):
            pdfmetrics.registerFont(TTFont(REG, reg))
            pdfmetrics.registerFont(TTFont(BOLD, bold))
            _fonts_ready = True
            return
    # Fallback to built-ins (Latin only) — better a PDF than a crash.
    REG, BOLD = "Helvetica", "Helvetica-Bold"
    _fonts_ready = True


MAGENTA = (1, 0, 1)
PINK = (1, 0.4, 0.8)
INK = (0.06, 0.06, 0.075)
GRAY = (0.42, 0.45, 0.5)
LIGHT = (0.953, 0.957, 0.965)
CHIPBG = (1, 0.94, 0.99)

PROMPTS = [
    ("green_flags", "Грин-флаги", (0.06, 0.72, 0.51)),
    ("red_flags", "Ред-флаги", (0.94, 0.27, 0.27)),
    ("ideal_date", "Идеальное свидание", (1, 0, 1)),
    ("looking_for", "Что ищу", (0.23, 0.51, 0.96)),
    ("weakness", "Слабость", (0.96, 0.62, 0.04)),
]
PLAN = {"free": "Free", "premium": "Premium", "kupidon": "Kupidon VIP"}


def _age(birth):
    if not birth:
        return None
    t = date.today()
    return t.year - birth.year - ((t.month, t.day) < (birth.month, birth.day))


def _disk_path(media_url: str):
    """Map a stored media_url to its on-disk path under MEDIA_ROOT."""
    if not media_url:
        return None
    rel = media_url.split("/media/")[-1] if "/media/" in media_url else media_url
    rel = rel.split("?")[0].lstrip("/")
    p = os.path.join(MEDIA_ROOT, rel)
    return p if os.path.isfile(p) else None


def build_profile_pdf(*, profile: dict, stats: dict | None, tag_names: list[str], photo_paths: list[str]) -> bytes:
    _ensure_fonts()
    import io
    buf = io.BytesIO()
    W, H = A4
    c = canvas.Canvas(buf, pagesize=A4)
    M = 40
    y = H  # work from the top down

    def rrect(x, yt, w, h, r, color, fill=1, stroke=0):
        c.setFillColorRGB(*color) if fill else None
        c.setStrokeColorRGB(*color) if stroke else None
        c.roundRect(x, H - yt - h, w, h, r, stroke=stroke, fill=fill)

    def text(x, yt, s, font=REG, size=11, color=INK, center=False, right=False):
        c.setFont(font, size); c.setFillColorRGB(*color)
        if center: c.drawCentredString(x, H - yt, s)
        elif right: c.drawRightString(x, H - yt, s)
        else: c.drawString(x, H - yt, s)

    # ---------- header gradient ----------
    headH = 200
    strips = 80
    for i in range(strips):
        t = i / (strips - 1)
        r = MAGENTA[0] + (PINK[0] - MAGENTA[0]) * t
        g = MAGENTA[1] + (PINK[1] - MAGENTA[1]) * t
        b = MAGENTA[2] + (PINK[2] - MAGENTA[2]) * t
        c.setFillColorRGB(r, g, b)
        c.rect((W / strips) * i, H - headH, W / strips + 1, headH, stroke=0, fill=1)

    text(M, 42, "CupidBot", BOLD, 14, (1, 1, 1))
    text(M, 58, "Карточка профиля", REG, 9.5, (1, 1, 1))

    # ---------- avatar (circular clip) ----------
    avS, avX, avYtop = 92, M, 80
    cx, cyc, rr = avX + avS / 2, H - (avYtop + avS / 2), avS / 2
    c.setFillColorRGB(1, 1, 1)
    c.circle(cx, cyc, rr + 4, stroke=0, fill=1)
    drew = False
    for pth in photo_paths:
        try:
            img = ImageReader(pth)
            c.saveState()
            p = c.beginPath(); p.circle(cx, cyc, rr); c.clipPath(p, stroke=0, fill=0)
            c.drawImage(img, avX, H - (avYtop + avS), avS, avS, mask="auto", preserveAspectRatio=True)
            c.restoreState()
            drew = True
            break
        except Exception:
            continue
    if not drew:
        c.setFillColorRGB(*MAGENTA); c.circle(cx, cyc, rr, stroke=0, fill=1)
        text(cx, avYtop + avS / 2 + 12, (profile.get("name") or "?")[0].upper(), BOLD, 38, (1, 1, 1), center=True)

    # ---------- name + meta ----------
    nx = avX + avS + 20
    age = _age(profile.get("birth_date"))
    nm = profile.get("name") or "—"
    text(nx, avYtop + 26, f"{nm}{(', ' + str(age)) if age else ''}", BOLD, 23, (1, 1, 1))
    text(nx, avYtop + 47, profile.get("city_name") or "Рядом", REG, 11, (1, 1, 1))

    bx = nx
    def badge(label, fill, fg=(1, 1, 1)):
        nonlocal bx
        c.setFont(BOLD, 8.5)
        w = c.stringWidth(label, BOLD, 8.5) + 16
        c.setFillColorRGB(*fill); c.roundRect(bx, H - (avYtop + 76), w, 17, 8, stroke=0, fill=1)
        c.setFillColorRGB(*fg); c.drawString(bx + 8, H - (avYtop + 64), label)
        bx += w + 8
    badge(PLAN.get(profile.get("tier"), "Free"),
          (1, 0.78, 0.23) if profile.get("tier") == "kupidon" else (1, 1, 1),
          INK if profile.get("tier") == "kupidon" else MAGENTA)
    if profile.get("is_verified"):
        badge("✓ Verified", (0.23, 0.51, 0.96))

    y = headH + 28

    def section(title):
        nonlocal y
        text(M, y, title, BOLD, 13, INK)
        c.setStrokeColorRGB(*MAGENTA); c.setLineWidth(2)
        c.line(M, H - (y + 6), M + 26, H - (y + 6))
        y += 22

    def footer():
        today = date.today().strftime("%d.%m.%Y")
        c.setStrokeColorRGB(*LIGHT); c.setLineWidth(0.8)
        c.line(M, 40, W - M, 40)
        c.setFont(REG, 8); c.setFillColorRGB(*GRAY)
        c.drawString(M, 28, f"CupidBot · выгружено {today}")
        c.drawRightString(W - M, 28, "cupidbot")

    def ensure(need):
        nonlocal y
        if y + need > H - 56:
            footer(); c.showPage(); _ensure_fonts(); y = 48

    # ---------- stats ----------
    if stats:
        section("Моя статистика")
        cards = [
            ("Мэтчей", str(stats.get("matches", 0))),
            ("Лайков получено", str(stats.get("likes_received", 0))),
            ("Лайков отправлено", str(stats.get("likes_given", 0))),
            ("Мэтч-рейт", f"{stats.get('match_rate', 0)}%"),
            ("Дней с нами", str(stats.get("days_with_us", 0))),
            ("Рейтинг анкеты", f"{stats.get('profile_score', 0)}/100"),
        ]
        cols, gap = 3, 12
        cw = (W - M * 2 - gap * (cols - 1)) / cols
        ch = 54
        for i, (label, val) in enumerate(cards):
            col, row = i % cols, i // cols
            x = M + col * (cw + gap); yt = y + row * (ch + gap)
            rrect(x, yt, cw, ch, 10, LIGHT)
            text(x + 12, yt + 25, val, BOLD, 17, MAGENTA)
            text(x + 12, yt + 41, label, REG, 8.5, GRAY)
        y += ((len(cards) + cols - 1) // cols) * (ch + gap) + 8

    # ---------- about ----------
    bio = (profile.get("bio") or "").strip()
    if bio:
        ensure(70); section("О себе")
        for ln in simpleSplit(bio, REG, 11, W - M * 2):
            ensure(16); text(M, y + 4, ln, REG, 11, (0.22, 0.25, 0.32)); y += 15
        y += 10

    # ---------- interests ----------
    if tag_names:
        ensure(50); section("Интересы")
        x = M
        for name in tag_names:
            w = c.stringWidth(name, BOLD, 9.5) + 20
            if x + w > W - M:
                x = M; y += 26
            rrect(x, y - 2, w, 20, 10, CHIPBG)
            text(x + 10, y + 12, name, BOLD, 9.5, MAGENTA)
            x += w + 8
        y += 28

    # ---------- prompts ----------
    filled = [(k, lbl, col) for k, lbl, col in PROMPTS if (profile.get("prompts") or {}).get(k, "").strip()]
    if filled:
        ensure(50); section("Обо мне подробнее")
        for k, label, col in filled:
            lines = simpleSplit(profile["prompts"][k].strip(), REG, 10.5, W - M * 2 - 18)
            blockH = 22 + len(lines) * 13
            ensure(blockH + 8)
            rrect(M, y, W - M * 2, blockH, 8, (0.98, 0.98, 0.99))
            rrect(M, y, 4, blockH, 2, col)
            text(M + 14, y + 15, label.upper(), BOLD, 8.5, col)
            yy = y + 29
            for ln in lines:
                text(M + 14, yy, ln, REG, 10.5, (0.22, 0.25, 0.32)); yy += 13
            y += blockH + 8

    # ---------- anthem ----------
    if profile.get("anthem_url"):
        ensure(40); section("Мой гимн")
        rrect(M, y, W - M * 2, 30, 8, CHIPBG)
        text(M + 12, y + 19, f"♪  {profile.get('anthem_title') or 'Мой трек'}", BOLD, 11, MAGENTA)
        y += 40

    footer()
    c.showPage()
    c.save()
    return buf.getvalue()
