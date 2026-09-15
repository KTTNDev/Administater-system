from pathlib import Path
import pypdfium2 as pdfium
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "output" / "pdf" / "drive-demo-2569"
QA = ROOT / "tmp" / "pdfs" / "qa"
QA.mkdir(parents=True, exist_ok=True)
thumbs = []
for path in sorted(SOURCE.glob("*.pdf")):
    doc = pdfium.PdfDocument(str(path))
    assert len(doc) == 1, f"{path.name}: expected one page"
    image = doc[0].render(scale=1.25).to_pil().convert("RGB")
    out = QA / f"{path.stem}.png"
    image.save(out)
    thumb = image.copy(); thumb.thumbnail((300, 425))
    thumbs.append((path.name, thumb))

sheet = Image.new("RGB", (4*340, 4*475), "#e9eeee")
draw = ImageDraw.Draw(sheet)
for i, (name, thumb) in enumerate(thumbs):
    x=(i%4)*340+20; y=(i//4)*475+20
    sheet.paste(thumb,(x,y)); draw.text((x,y+430),name[:34],fill="black")
sheet.save(QA / "contact-sheet.png")
print(QA / "contact-sheet.png")
