"""Generate Selly 'Duo' brand assets (Concept C: purple + green chat bubbles).

Outputs production PNGs into selly-app/assets/ and a preview into branding/.
Drawing is done at 4x supersampling and downscaled with LANCZOS for clean edges.
"""
from PIL import Image, ImageDraw, ImageFont

PURPLE = (108, 71, 255, 255)    # #6c47ff
GREEN  = (34, 197, 94, 255)     # #22c55e
WHITE  = (255, 255, 255, 255)
BG     = (10, 10, 15, 255)      # #0a0a0f

ASSETS = r"D:\Selly\selly-app\assets"
BRAND  = r"D:\Selly\branding"


def draw_mark(canvas_px, content_scale=1.0, bg=None, rounded_bg_radius=None):
    """Draw the Duo mark. Design space is 120x120 units (matches the SVG concept).

    content_scale shrinks the mark around the canvas centre (for the Android
    adaptive icon safe zone). bg=None -> transparent background.
    """
    ss = 4
    size = canvas_px * ss
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    if bg is not None:
        if rounded_bg_radius:
            d.rounded_rectangle([0, 0, size - 1, size - 1], radius=rounded_bg_radius * ss, fill=bg)
        else:
            d.rectangle([0, 0, size, size], fill=bg)

    u = (size / 120.0) * content_scale          # design-unit -> px
    off = (size - 120 * u) / 2.0                # centre the 120-unit design

    def P(x, y):
        return (off + x * u, off + y * u)

    def rrect(x1, y1, x2, y2, r, fill):
        d.rounded_rectangle([P(x1, y1), P(x2, y2)], radius=r * u, fill=fill)

    def poly(pts, fill):
        d.polygon([P(x, y) for x, y in pts], fill=fill)

    def circle(cx, cy, r, fill):
        x, y = P(cx, cy)
        d.ellipse([x - r * u, y - r * u, x + r * u, y + r * u], fill=fill)

    # purple bubble (customer, typing dots) - top left
    rrect(22, 26, 78, 56, 14, PURPLE)
    poly([(30, 54), (26, 64), (38, 58)], PURPLE)          # tail, bottom-left
    for cx in (40, 52, 64):
        circle(cx, 41, 4, WHITE)

    # green bubble (bot, checkmark) - bottom right
    rrect(44, 64, 100, 94, 14, GREEN)
    poly([(92, 92), (96, 102), (84, 98)], GREEN)          # tail, bottom-right
    w = 5 * u
    pts = [P(58, 79), P(65, 86), P(78, 73)]
    d.line(pts, fill=WHITE, width=int(w), joint="curve")
    for px, py in (pts[0], pts[2]):                       # round the line caps
        d.ellipse([px - w / 2, py - w / 2, px + w / 2, py + w / 2], fill=WHITE)

    return img.resize((canvas_px, canvas_px), Image.LANCZOS)


def wordmark(height_px, dot=True, color=WHITE):
    """Render 'selly' with a green full stop, transparent bg."""
    ss = 4
    h = height_px * ss
    font = ImageFont.truetype(r"C:\Windows\Fonts\segoeuib.ttf", int(h * 0.78))
    tmp = ImageDraw.Draw(Image.new("RGBA", (1, 1)))
    text = "selly"
    tw = tmp.textlength(text, font=font)
    dot_w = tmp.textlength(".", font=font) if dot else 0
    img = Image.new("RGBA", (int(tw + dot_w + h * 0.1), h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.text((0, -h * 0.12), text, font=font, fill=color)
    if dot:
        d.text((tw, -h * 0.12), ".", font=font, fill=GREEN)
    img = img.resize((img.width // ss, img.height // ss), Image.LANCZOS)
    return img


def make_icon():
    # Full-bleed; the OS rounds the corners itself.
    # Saved as RGB with NO alpha channel — the App Store rejects icons that
    # contain transparency. (adaptive-icon.png keeps its alpha on purpose:
    # Android needs a transparent foreground layer.)
    icon = draw_mark(1024, content_scale=1.0, bg=BG)
    flat = Image.new("RGB", icon.size, BG[:3])
    flat.paste(icon, (0, 0), icon)
    flat.save(f"{ASSETS}\\icon.png")


def make_adaptive():
    # foreground layer: transparent bg, mark inside the ~66% safe zone
    fg = draw_mark(1024, content_scale=0.62, bg=None)
    fg.save(f"{ASSETS}\\adaptive-icon.png")


def make_splash():
    # Dark splash to match the app's dark theme (bg #0a0a0f)
    W, H = 1284, 2778
    img = Image.new("RGBA", (W, H), BG)
    mark = draw_mark(430, content_scale=1.0, bg=None)
    img.alpha_composite(mark, ((W - 430) // 2, H // 2 - 430))
    wm = wordmark(150, color=WHITE)
    img.alpha_composite(wm, ((W - wm.width) // 2, H // 2 + 60))
    img.convert("RGB").save(f"{ASSETS}\\splash.png")


def make_favicon():
    fav = draw_mark(48, content_scale=1.06, bg=BG, rounded_bg_radius=10)
    fav.save(f"{ASSETS}\\favicon.png")


def make_preview():
    """Side-by-side preview so the result can be eyeballed."""
    img = Image.new("RGBA", (1080, 420), (19, 19, 26, 255))
    img.alpha_composite(draw_mark(320, bg=BG), (40, 50))
    img.alpha_composite(draw_mark(160, content_scale=0.62, bg=(28, 28, 38, 255)), (420, 130))
    img.alpha_composite(draw_mark(48, content_scale=1.06, bg=BG, rounded_bg_radius=10), (640, 190))
    wm = wordmark(120)
    img.alpha_composite(wm, (700, 150))
    img.convert("RGB").save(f"{BRAND}\\preview.png")


if __name__ == "__main__":
    make_icon()
    make_adaptive()
    make_splash()
    make_favicon()
    make_preview()
    print("done")
