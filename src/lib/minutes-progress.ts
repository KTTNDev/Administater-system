import type { Draft } from "./document";

/** สถานะช่วยกรอกเท่านั้น ไม่ใช่การตรวจรับรองเอกสาร และไม่บังคับให้มีมติทุกวาระ */
export function agendaProgress(agenda: Draft["meetingAgenda"][number], torSections: Draft["minutesTor"]["sections"] = []) {
  const speeches = agenda.speeches || [];
  const missing: string[] = [];
  // รายละเอียด TOR เป็นข้ออภิปรายของวาระที่ผูกไว้ เช่นเดียวกับ reviewIssues ใน document.ts
  const torContent = !!agenda.torDetails && torSections.some((section) => section.body.trim());
  if (!agenda.title.trim()) missing.push("หัวข้อวาระ");
  if (!agenda.discussion.trim() && !speeches.some((s) => s.text.trim()) && !torContent)
    missing.push("ข้ออภิปรายหรือบทพูด");
  speeches.forEach((speech, index) => {
    if (!speech.speaker.trim()) missing.push(`ชื่อผู้พูด ${index + 1}`);
    if (!speech.text.trim()) missing.push(`บทพูด ${index + 1}`);
  });
  const hasWork = !!(
    torContent ||
    agenda.discussion.trim() ||
    agenda.resolution.trim() ||
    speeches.some((s) => s.speaker.trim() || s.text.trim())
  );
  return {
    missing,
    complete: missing.length === 0,
    started: hasWork,
    speakers: speeches.length,
    resolution: !!agenda.resolution.trim(),
  };
}
