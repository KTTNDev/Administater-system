"""Verify the app's actual PDFs and the PNGs rendered from them with Poppler."""
import json
from pathlib import Path
from PIL import Image
from pypdf import PdfReader

root = Path(__file__).resolve().parent.parent / "output" / "procurement-stage-a"
report = json.loads((root / "validation.json").read_text(encoding="utf-8"))
results = []
for scenario in report["scenarios"]:
    name = scenario["scenario"]
    reader = PdfReader(root / f"D07-{name}.pdf")
    assert len(reader.pages) == scenario["pages"], name
    for index, page in enumerate(reader.pages, 1):
        assert abs(float(page.mediabox.width) - 595.28) < 1
        assert abs(float(page.mediabox.height) - 841.89) < 1
        image = Image.open(root / f"final-{name}-{index}.png").convert("L")
        # Both footer lines must actually render. Text extraction alone would
        # also find invisible/clipped text and cannot establish print fidelity.
        ink = [sum(value < 180 for value in image.crop((105,y,735,y+18)).get_flattened_data()) for y in (1035,1053)]
        if index > 1:
            assert min(ink) > 300, (name,index,"continuation footer did not render",ink)
            assert "0001/007" in page.extract_text()
        else:
            assert max(ink) < 50, (name,"unexpected first-page footer",ink)
        results.append({"scenario": name, "page": index, "A4": True, "footer_ink": ink})
native = PdfReader(root / "word-qa-long.pdf")
for page in native.pages[1:]:
    text = page.extract_text()
    assert "0001/009" in text, "Word footer must reference the edited first-page number"
    assert "16" in text and "2569" in text
(root / "pdf-validation.json").write_text(json.dumps(results,indent=2),encoding="utf-8")
print(json.dumps({"app_pdf_pages_verified":len(results),"native_word_footer_references_verified":len(native.pages)-1}))
