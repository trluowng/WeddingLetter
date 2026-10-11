"""Download the public visual assets used by the reference invitation."""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.request import Request, urlopen
import json

ROOT = Path(__file__).resolve().parents[1]
BASE = "https://chungdoi.com"
THEME = "/images/themes/minimalism-dark-red/"
ASSETS = {
    f"assets/images/{name}.webp": BASE + THEME + name + ".webp"
    for name in ["paper", "castle-background", "papernote-background", "envelope-background", "envelope-cover", "flower2-decoration", "camera", "cake", "cook"]
}
for name in ["ViaodaLibre-Regular.ttf", "TheNautigal-Regular.ttf", "TheNautigal-Bold.ttf", "Lora-Regular.ttf", "CormorantGaramond-Variable.ttf", "MsMadiAmpersand-Regular.woff2", "Uchen-Regular.ttf"]:
    ASSETS["assets/fonts/" + name] = BASE + "/fonts/" + name
ASSETS["assets/images/gift-envelope.webp"] = BASE + "/images/envelope/minimalism_darkred.webp"
ASSETS["assets/audio/wedding.mp3"] = "https://cdn.chungdoi.com/music/em-dong-y-i-do.mp3"

def download(item):
    destination, url = item
    path = ROOT / destination
    path.parent.mkdir(parents=True, exist_ok=True)
    if not path.exists():
        request = Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urlopen(request, timeout=45) as response:
            path.write_bytes(response.read())
    return f"{destination}: {path.stat().st_size} bytes"

if __name__ == "__main__":
    with ThreadPoolExecutor(max_workers=8) as pool:
        for result in pool.map(download, ASSETS.items()):
            print(result, flush=True)
    (ROOT / "assets/sources.json").write_text(json.dumps(ASSETS, indent=2), encoding="utf-8")
