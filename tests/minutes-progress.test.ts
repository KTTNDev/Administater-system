import { describe, expect, it } from "vitest";
import { agendaProgress } from "../src/lib/minutes-progress";

const agenda = {
  title: "เรื่องพิจารณา",
  discussion: "",
  resolution: "",
  resolutionLabel: "มติที่ประชุม" as const,
};
describe("agenda progress", () => {
  it("does not call a preset title complete and treats resolution as optional", () => {
    expect(agendaProgress(agenda)).toMatchObject({
      complete: false,
      started: false,
    });
    expect(
      agendaProgress({ ...agenda, discussion: "ที่ประชุมรับทราบ" }),
    ).toMatchObject({ complete: true, resolution: false });
  });
  it("accepts speeches as discussion but points to missing names or speech text", () => {
    const speeches = [
      { speaker: "", role: "", text: "ข้อเสนอ" },
      { speaker: "เลขานุการ", role: "", text: "" },
    ];
    expect(agendaProgress({ ...agenda, speeches }).missing).toEqual([
      "ชื่อผู้พูด 1",
      "บทพูด 2",
    ]);
    expect(
      agendaProgress({
        ...agenda,
        speeches: [{ speaker: "เลขานุการ", role: "", text: "ข้อเสนอ" }],
      }).complete,
    ).toBe(true);
  });
  it("does not mix speaker counts across agendas", () => {
    expect(
      agendaProgress({
        ...agenda,
        speeches: [{ speaker: "ก", role: "", text: "ข" }],
      }).speakers,
    ).toBe(1);
    expect(agendaProgress(agenda).speakers).toBe(0);
  });
});
