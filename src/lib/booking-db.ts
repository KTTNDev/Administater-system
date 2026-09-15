import "server-only";
import { randomUUID } from "node:crypto";
import { db } from "./db";
import { bookingSchema, roomSchema, minutes, type Booking, type Room } from "./booking";

function connection() {
  const c = db();
  c.exec(`CREATE TABLE IF NOT EXISTS meeting_rooms(id TEXT PRIMARY KEY, data TEXT NOT NULL, version INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS room_bookings(
      id TEXT PRIMARY KEY, room_id TEXT NOT NULL, day TEXT NOT NULL,
      start_min INTEGER NOT NULL, end_min INTEGER NOT NULL, status TEXT NOT NULL,
      data TEXT NOT NULL, version INTEGER NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS room_booking_slot ON room_bookings(room_id,day,status,start_min,end_min);
    CREATE TRIGGER IF NOT EXISTS prevent_booking_overlap_insert BEFORE INSERT ON room_bookings
    WHEN NEW.status='booked' AND EXISTS(SELECT 1 FROM room_bookings b WHERE b.status='booked' AND b.room_id=NEW.room_id AND b.day=NEW.day AND b.start_min<NEW.end_min AND b.end_min>NEW.start_min)
    BEGIN SELECT RAISE(ABORT,'ห้องนี้มีการจองซ้อน กรุณาเลือกเวลาใหม่'); END;
    CREATE TRIGGER IF NOT EXISTS prevent_booking_overlap_update BEFORE UPDATE ON room_bookings
    WHEN NEW.status='booked' AND EXISTS(SELECT 1 FROM room_bookings b WHERE b.id<>NEW.id AND b.status='booked' AND b.room_id=NEW.room_id AND b.day=NEW.day AND b.start_min<NEW.end_min AND b.end_min>NEW.start_min)
    BEGIN SELECT RAISE(ABORT,'ห้องนี้มีการจองซ้อน กรุณาเลือกเวลาใหม่'); END;`);
  return c;
}
export function bookingSnapshot(): { rooms: Room[]; bookings: Booking[] } {
  const c = connection();
  return c.transaction(() => ({
    rooms: c.prepare("SELECT * FROM meeting_rooms ORDER BY json_extract(data,'$.name')").all().map(r => ({ ...roomSchema.parse(JSON.parse(String(r.data))), id: String(r.id), version: Number(r.version) })),
    bookings: c.prepare("SELECT * FROM room_bookings ORDER BY day,start_min,id").all().map(r => ({ ...JSON.parse(String(r.data)), id: String(r.id), version: Number(r.version), status: String(r.status), updatedAt: String(r.updated_at) } as Booking)),
  }))();
}
function audit(id: string, action: string, version: number) {
  db().prepare("INSERT INTO audit(document_id,action,version,at) VALUES(?,?,?,?)").run(id, action, version, new Date().toISOString());
}
export function saveRoom(input: unknown, id?: string, version?: number) {
  const data = roomSchema.parse(input), c = connection(), key = id || randomUUID();
  c.transaction(() => {
    if (c.prepare("SELECT id FROM meeting_rooms WHERE json_extract(data,'$.name')=? AND id<>?").get(data.name,key)) throw new Error("ชื่อห้องนี้มีอยู่แล้ว");
    if (id) {
      if (!c.prepare("UPDATE meeting_rooms SET data=?,version=version+1 WHERE id=? AND version=?").run(JSON.stringify(data),id,version??-1).changes) throw new Error("ข้อมูลห้องเปลี่ยนแล้ว กรุณารีเฟรช");
    } else c.prepare("INSERT INTO meeting_rooms VALUES(?,?,1)").run(key,JSON.stringify(data));
    audit(key,id?"room_update":"room_create",id?(version??0)+1:1);
  })(); return key;
}
export function saveBooking(input: unknown, id?: string, version?: number) {
  const data = bookingSchema.parse(input), c = connection(), key = id || randomUUID();
  c.transaction(() => {
    const row = c.prepare("SELECT data FROM meeting_rooms WHERE id=?").get(data.roomId);
    if (!row) throw new Error("ไม่พบห้องประชุม");
    const room = roomSchema.parse(JSON.parse(String(row.data)));
    if (!room.active) throw new Error("ห้องนี้ปิดรับจอง");
    if (data.attendees > room.capacity) throw new Error(`ห้องนี้รองรับได้ ${room.capacity} คน`);
    if (minutes(data.end)+room.bufferMinutes>1440) throw new Error("เวลาใช้ห้องรวมจัดเก็บต้องไม่ข้ามวัน");
    if (data.documentId && !c.prepare("SELECT id FROM documents WHERE id=?").get(data.documentId)) throw new Error("ไม่พบหนังสือที่เชื่อมโยง กรุณาเลือกใหม่");
    const stored = JSON.stringify({...data,bufferMinutes:room.bufferMinutes,cancellationReason:""});
    const now = new Date().toISOString();
    if (id) {
      const old = c.prepare("SELECT status,version FROM room_bookings WHERE id=?").get(id);
      if (!old || old.version!==version) throw new Error("รายการเปลี่ยนแล้ว กรุณารีเฟรชก่อนแก้ไข");
      if (old.status==="cancelled") throw new Error("รายการยกเลิกแล้ว กรุณาสร้างการจองใหม่");
      c.prepare("UPDATE room_bookings SET room_id=?,day=?,start_min=?,end_min=?,data=?,version=version+1,updated_at=? WHERE id=?").run(data.roomId,data.date,minutes(data.start),minutes(data.end)+room.bufferMinutes,stored,now,id);
    } else c.prepare("INSERT INTO room_bookings VALUES(?,?,?,?,?,'booked',?,1,?)").run(key,data.roomId,data.date,minutes(data.start),minutes(data.end)+room.bufferMinutes,stored,now);
    audit(key,id?"booking_update":"booking_create",id?(version??0)+1:1);
  })(); return key;
}
export function cancelBooking(id: string, version: number, reason: string) {
  const c=connection();
  c.transaction(()=>{
    const row=c.prepare("SELECT * FROM room_bookings WHERE id=?").get(id);
    if(!row||row.version!==version)throw new Error("รายการเปลี่ยนแล้ว กรุณารีเฟรช");
    if(row.status==="cancelled")throw new Error("รายการนี้ยกเลิกแล้ว");
    c.prepare("UPDATE room_bookings SET status='cancelled',data=?,version=version+1,updated_at=? WHERE id=?").run(JSON.stringify({...JSON.parse(String(row.data)),cancellationReason:reason}),new Date().toISOString(),id);
    audit(id,"booking_cancel",version+1);
  })();
}
