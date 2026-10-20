from PIL import Image
import json, os, glob

base = os.path.dirname(__file__)
frames_dir = os.path.join(base, "demo-frames")
out = os.path.join(base, "..", "docs", "demo", "asaas-payout-demo.gif")

files = sorted(glob.glob(os.path.join(frames_dir, "frame-*.jpg")))
if not files:
    raise SystemExit("no frames")

with open(os.path.join(frames_dir, "timestamps.json"), "r", encoding="utf-8") as fh:
    timestamps = json.load(fh)

images = []
durations = []
for index, path in enumerate(files):
    img = Image.open(path).convert("RGB")
    width = 960
    height = round(img.height * width / img.width)
    img = img.resize((width, height), Image.LANCZOS)
    images.append(img.quantize(colors=128, method=Image.Quantize.MEDIANCUT))
    if index + 1 < len(timestamps):
        delta = (timestamps[index + 1] - timestamps[index]) * 1000
    else:
        delta = 120
    durations.append(max(40, min(600, int(delta))))

# keep every frame but normalize very short gaps so the GIF stays readable
images[0].save(
    out,
    save_all=True,
    append_images=images[1:],
    duration=durations,
    loop=0,
    optimize=True,
    disposal=2,
)

size_mb = os.path.getsize(out) / 1e6
print(f"saved {out} · {len(images)} frames · {size_mb:.2f} MB")
