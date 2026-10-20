from PIL import Image
import os

base = r"D:\桌面\deepseek 工作区\rvm-rewards\apps\mobile\assets"
src = os.path.join(base, "wano-logo.webp")
img = Image.open(src).convert("RGBA")

# make near-white pixels transparent and trim the canvas
pixels = img.load()
w, h = img.size
for y in range(h):
    for x in range(w):
        r, g, b, a = pixels[x, y]
        if r > 242 and g > 242 and b > 242:
            pixels[x, y] = (255, 255, 255, 0)

bbox = img.getbbox()
if bbox:
    img = img.crop(bbox)

# scale to a reasonable in-app width (retina friendly)
max_width = 900
if img.width > max_width:
    ratio = max_width / img.width
    img = img.resize((max_width, int(img.height * ratio)), Image.LANCZOS)

out = os.path.join(base, "wano-logo.png")
img.save(out)
print("saved", out, img.size)

# white version for dark surfaces
white = img.copy()
wp = white.load()
for y in range(white.height):
    for x in range(white.width):
        r, g, b, a = wp[x, y]
        if a > 0:
            wp[x, y] = (246, 243, 234, a)
white.save(os.path.join(base, "wano-logo-light.png"))
print("saved light version")
