from PIL import Image, ImageDraw, ImageFont
import os, math

OUT = os.path.join(os.path.dirname(__file__), "assets")
os.makedirs(OUT, exist_ok=True)

FOREST = (12, 59, 42, 255)
CREAM = (246, 243, 234, 255)
LIME = (216, 238, 139, 255)
SAGE = (164, 196, 170, 255)

def font(size, bold=False):
    path = r"C:\Windows\Fonts\georgiab.ttf" if bold else r"C:\Windows\Fonts\georgia.ttf"
    return ImageFont.truetype(path, size)

def draw_mark(img, size, with_bg=True, scale=1.0):
    draw = ImageDraw.Draw(img, "RGBA")
    cx, cy = size / 2, size / 2
    # rings
    for radius, width, color in [
        (size * 0.40, max(2, int(size * 0.006)), (246, 243, 234, 40)),
        (size * 0.31, max(2, int(size * 0.006)), (246, 243, 234, 55)),
    ]:
        draw.ellipse([cx - radius, cy - radius, cx + radius, cy + radius], outline=color, width=width)
    # lime arc (lower right)
    r = size * 0.36
    draw.arc([cx - r, cy - r, cx + r, cy + r], start=8, end=118, fill=LIME, width=max(4, int(size * 0.026)))
    # R letter
    f = font(int(size * 0.52 * scale), bold=True)
    bbox = draw.textbbox((0, 0), "R", font=f)
    w, h = bbox[2] - bbox[0], bbox[3] - bbox[1]
    draw.text((cx - w / 2 - bbox[0], cy - h / 2 - bbox[1] - size * 0.02), "W", font=f, fill=CREAM)
    # small lime dot
    dot = size * 0.028
    draw.ellipse([cx + size * 0.29, cy - size * 0.30, cx + size * 0.29 + dot, cy - size * 0.30 + dot], fill=LIME)

# icon (opaque)
icon = Image.new("RGBA", (1024, 1024), FOREST)
# subtle vertical gradient
grad = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
gd = ImageDraw.Draw(grad)
for y in range(1024):
    alpha = int(26 * (y / 1024))
    gd.line([(0, y), (1024, y)], fill=(0, 0, 0, alpha))
icon = Image.alpha_composite(icon, grad)
draw_mark(icon, 1024)
icon.convert("RGB").save(os.path.join(OUT, "icon.png"))

# adaptive foreground (transparent)
fg = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
draw_mark(fg, 1024, scale=0.82)
fg.save(os.path.join(OUT, "adaptive-icon.png"))

# splash icon (transparent, mark only)
splash = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
draw_mark(splash, 1024, scale=0.95)
splash.save(os.path.join(OUT, "splash-icon.png"))

# favicon
fav = Image.new("RGBA", (256, 256), FOREST)
draw_mark(fav, 256)
fav.save(os.path.join(OUT, "favicon.png"))

# og / social preview 1200x630
og = Image.new("RGB", (1200, 630), (247, 244, 237))
od = ImageDraw.Draw(og)
od.rectangle([0, 0, 1200, 630], fill=(247, 244, 237))
# right panel
od.rounded_rectangle([660, 90, 1120, 540], radius=40, fill=(12, 59, 42))
mark = Image.open(os.path.join(OUT, "icon.png")).resize((360, 360))
og.paste(mark, (710, 100))
od.text((90, 120), "WANO Rewards", font=font(64, True), fill=(12, 59, 42))
od.text((92, 215), "Devolva. Ganhe. Repita.", font=font(38), fill=(60, 70, 58))
od.text((92, 285), "Recycling rewards for the people\nwho bring packaging back.", font=font(28), fill=(110, 115, 104))
og.save(os.path.join(OUT, "og.png"))

print("assets:", os.listdir(OUT))

