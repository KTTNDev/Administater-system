import 'server-only';
import {db} from './db';
import {defaultHomeLayout,homeLayoutSchema,homeLayoutSql,type HomeLayoutSnapshot} from './home-layout';
function ensure(){db().exec(`CREATE TABLE IF NOT EXISTS home_layout (${homeLayoutSql})`);}
export function readHomeLayout():HomeLayoutSnapshot {
 ensure();const row=db().prepare("SELECT data,version FROM home_layout WHERE id='home'").get();
 return row?{layout:homeLayoutSchema.parse(JSON.parse(String(row.data))),version:Number(row.version)}:{layout:defaultHomeLayout(),version:0};
}
export function writeHomeLayout(input:unknown,expectedVersion:number):HomeLayoutSnapshot {
 const layout=homeLayoutSchema.parse(input);ensure();
 return db().transaction(()=>{
  const current=readHomeLayout();if(current.version!==expectedVersion)throw Error('หน้าหลักถูกแก้ไขจากหน้าต่างอื่น กรุณาโหลดค่าล่าสุดก่อนบันทึก');
  const version=current.version+1;
  db().prepare("INSERT INTO home_layout(id,data,version,updated_at) VALUES('home',?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,version=excluded.version,updated_at=excluded.updated_at").run(JSON.stringify(layout),version,new Date().toISOString());
  return {layout,version};
 })();
}
