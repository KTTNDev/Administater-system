import 'server-only';
import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {db} from './db';
import {thaiTermSchema,thaiDictionarySql,thaiKeepTerms,type ThaiTerm} from './thai-dictionary';
export function dictionaryDb(){const conn=db();conn.exec('CREATE TABLE IF NOT EXISTS thai_dictionary ('+thaiDictionarySql+')');return conn;}
export function listThaiTerms():ThaiTerm[]{return dictionaryDb().prepare('SELECT * FROM thai_dictionary ORDER BY word').all().map(r=>({...thaiTermSchema.parse(JSON.parse(String(r.data))),id:String(r.id),version:Number(r.version),updatedAt:String(r.updated_at)}));}
export function getThaiKeepTerms(){return thaiKeepTerms(listThaiTerms());}
export function saveThaiTerm(input:unknown,id:string=randomUUID(),version=0){const d=thaiTermSchema.parse(input);d.word=d.word.normalize('NFC');d.correction=d.correction.normalize('NFC');z.string().uuid().parse(id);z.number().int().nonnegative().parse(version);const conn=dictionaryDb();
 return conn.transaction(()=>{const match=conn.prepare('SELECT id FROM thai_dictionary WHERE word=?').get(d.word);if(match&&match.id!==id)throw Error('มีคำนี้ในคลังแล้ว ใช้ปุ่มแก้ไขของคำเดิม');
  if(!version){if(Number(conn.prepare('SELECT count(*) n FROM thai_dictionary').get()?.n)>=1000)throw Error('คลังคำเฉพาะรองรับ 1,000 รายการ');conn.prepare('INSERT INTO thai_dictionary VALUES(?,?,?,1,?)').run(id,d.word,JSON.stringify(d),new Date().toISOString());}
  else if(!conn.prepare('UPDATE thai_dictionary SET word=?,data=?,version=version+1,updated_at=? WHERE id=? AND version=?').run(d.word,JSON.stringify(d),new Date().toISOString(),id,version).changes)throw Error('คำนี้ถูกแก้ไขแล้ว กรุณาโหลดข้อมูลล่าสุด');
  return listThaiTerms();
 })();
}
export function deleteThaiTerm(id:string,version:number){z.string().uuid().parse(id);z.number().int().positive().parse(version);const conn=dictionaryDb();if(!conn.prepare('DELETE FROM thai_dictionary WHERE id=? AND version=?').run(id,version).changes)throw Error('คำนี้เปลี่ยนแปลงแล้ว กรุณาโหลดข้อมูลล่าสุด');return listThaiTerms();}
