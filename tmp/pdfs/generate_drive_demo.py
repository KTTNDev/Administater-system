from pathlib import Path
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "output" / "pdf" / "drive-demo-2569"
OUT.mkdir(parents=True, exist_ok=True)
pdfmetrics.registerFont(TTFont("THSarabun", str(ROOT / "public" / "fonts" / "THSarabunNew.ttf")))
pdfmetrics.registerFont(TTFont("THSarabunBold", str(ROOT / "public" / "fonts" / "THSarabunNew-Bold.ttf")))

docs = [
    ("หนังสือภายนอก", "ขอเชิญประชุมทดสอบระบบสารบรรณ", "จึงเรียนมาเพื่อโปรดพิจารณาเข้าร่วมประชุม"),
    ("หนังสือภายใน", "รายงานผลการทดสอบระบบจัดทำหนังสือ", "จึงเรียนมาเพื่อโปรดทราบ"),
    ("หนังสือประทับตรา", "ส่งสำเนาเอกสารทดสอบ", "จึงแจ้งมาเพื่อทราบ"),
    ("คำสั่ง", "แต่งตั้งคณะทำงานทดสอบระบบสารบรรณ", "ทั้งนี้ ตั้งแต่บัดนี้เป็นต้นไป"),
    ("ระเบียบ", "ว่าด้วยการทดลองใช้ระบบสารบรรณอิเล็กทรอนิกส์", "ให้ใช้เป็นแนวทางในการทดสอบเท่านั้น"),
    ("ข้อบังคับ", "ว่าด้วยการจัดหมวดหมู่ข้อมูลสาธิต", "ให้ใช้บังคับเฉพาะชุดข้อมูลสาธิตนี้"),
    ("ประกาศ", "การเปิดทดลองระบบจัดทำหนังสือราชการ", "จึงประกาศให้ทราบโดยทั่วกัน"),
    ("แถลงการณ์", "ผลการทดสอบการจัดเก็บเอกสารบน Google Drive", "ขอให้ผู้เกี่ยวข้องใช้ข้อมูลนี้เพื่อการทดสอบ"),
    ("ข่าว", "ระบบสารบรรณเพิ่มการจัดเก็บแยกประเภท", "เผยแพร่เพื่อทดสอบการแสดงผลของระบบ"),
    ("หนังสือรับรอง", "รับรองการสร้างข้อมูลสาธิต", "หนังสือฉบับนี้ใช้เพื่อทดสอบระบบเท่านั้น"),
    ("รายงานการประชุม", "คณะทำงานทดสอบระบบสารบรรณ ครั้งที่ ๑/๒๕๖๙", "ที่ประชุมมีมติรับทราบผลการจำลอง"),
    ("บันทึก", "ขออนุมัติทดสอบการจัดเก็บข้อมูลบน Drive", "จึงเรียนมาเพื่อโปรดพิจารณาอนุมัติ"),
    ("หนังสืออื่น", "บัญชีตรวจสอบโครงสร้างการจัดเก็บเอกสาร", "จัดทำไว้เป็นหลักฐานการทดสอบระบบ"),
]

def draw_wrapped(c, text, x, y, width, size=16, leading=20):
    c.setFont("THSarabun", size)
    words = text.split(" ")
    line = ""
    for word in words:
        trial = (line + " " + word).strip()
        if pdfmetrics.stringWidth(trial, "THSarabun", size) > width and line:
            c.drawString(x, y, line); y -= leading
            line = word
        else:
            line = trial
    if line: c.drawString(x, y, line)
    return y - leading

for idx, (kind, subject, ending) in enumerate(docs, 1):
    number = f"ทส ๐๐๐๐/{idx:03d}".translate(str.maketrans("0123456789", "๐๑๒๓๔๕๖๗๘๙"))
    path = OUT / f"{idx:02d}_{kind}_ข้อมูลสาธิต.pdf"
    c = canvas.Canvas(str(path), pagesize=A4)
    c.setTitle(f"ข้อมูลสาธิต - {kind}")
    c.setAuthor("ระบบสารบรรณ - ข้อมูลสาธิต")
    c.setFont("THSarabunBold", 13)
    c.setFillColorRGB(0.72, 0.1, 0.1)
    c.drawCentredString(A4[0]/2, A4[1]-12*mm, "ข้อมูลสาธิต - ไม่ใช่หนังสือราชการที่ออกจริง")
    c.setFillColorRGB(0, 0, 0)
    garuda = ROOT / "public" / "assets" / "garuda.png"
    if garuda.exists(): c.drawImage(str(garuda), A4[0]/2-9*mm, A4[1]-48*mm, width=18*mm, height=24*mm, preserveAspectRatio=True, mask="auto")
    c.setFont("THSarabunBold", 24)
    c.drawCentredString(A4[0]/2, A4[1]-57*mm, kind)
    y = A4[1]-72*mm
    c.setFont("THSarabun", 16)
    c.drawString(30*mm, y, f"ที่  {number}")
    c.drawRightString(A4[0]-20*mm, y, "วันที่  ๑๒ กันยายน ๒๕๖๙")
    y -= 10*mm
    c.setFont("THSarabunBold", 16); c.drawString(30*mm, y, "เรื่อง")
    c.setFont("THSarabun", 16); c.drawString(46*mm, y, subject)
    y -= 10*mm
    if kind in ("หนังสือภายนอก", "หนังสือภายใน", "บันทึก"):
        c.setFont("THSarabunBold", 16); c.drawString(30*mm, y, "เรียน")
        c.setFont("THSarabun", 16); c.drawString(46*mm, y, "ผู้รับหนังสือ (ข้อมูลสาธิต)")
        y -= 11*mm
    body = "เอกสารฉบับนี้จัดทำขึ้นเพื่อจำลองการสร้าง การแบ่งประเภท และการจัดเก็บไฟล์จากระบบสารบรรณไปยัง Google Drive โดยใช้ข้อมูลสมมติทั้งหมด เพื่อให้ตรวจสอบโครงสร้างโฟลเดอร์ ชื่อไฟล์ และขั้นตอนการค้นคืนเอกสารได้อย่างเป็นระบบ"
    y = draw_wrapped(c, body, 40*mm, y, A4[0]-60*mm)
    y -= 5*mm
    y = draw_wrapped(c, ending, 40*mm, y, A4[0]-60*mm)
    y -= 18*mm
    c.setFont("THSarabun", 16)
    c.drawCentredString(A4[0]-62*mm, y, "(ผู้ทดสอบระบบ)")
    c.drawCentredString(A4[0]-62*mm, y-7*mm, "เจ้าหน้าที่สารบรรณ (ข้อมูลสาธิต)")
    c.setFont("THSarabun", 12)
    c.setFillColorRGB(0.35, 0.35, 0.35)
    c.drawString(30*mm, 18*mm, f"ประเภท: {kind} | ปีงบประมาณ ๒๕๖๙ | รหัสจำลอง DEMO-{idx:03d}")
    c.save()
print(OUT)
