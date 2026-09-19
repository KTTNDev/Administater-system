import 'server-only';
import {z} from 'zod';
import {db} from './db';
import {documentSchema} from './document';
import {budgetSchema} from './budget';
export const recoveryScope=z.enum(['document','budget']);
export type RecoveryScope=z.infer<typeof recoveryScope>;
const envelope=z.object({id:z.string().uuid(),scope:recoveryScope,sequence:z.number().int().positive(),data:z.unknown()});
function connection(){const c=db();c.exec('CREATE TABLE IF NOT EXISTS recovery_drafts(id TEXT PRIMARY KEY,scope TEXT NOT NULL,sequence INTEGER NOT NULL,data TEXT NOT NULL,updated_at TEXT NOT NULL)');return c;}
function parse(scope:RecoveryScope,data:unknown){return scope==='document'?documentSchema.extend({subject:z.string().max(300)}).parse(data):budgetSchema.extend({title:z.string().max(200)}).parse(data);}
export function storeRecovery(input:unknown){const r=envelope.parse(input),data=parse(r.scope,r.data),c=connection();const at=new Date().toISOString();c.prepare('INSERT INTO recovery_drafts(id,scope,sequence,data,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET sequence=excluded.sequence,data=excluded.data,updated_at=excluded.updated_at WHERE excluded.sequence>recovery_drafts.sequence AND excluded.scope=recovery_drafts.scope').run(r.id,r.scope,r.sequence,JSON.stringify(data),at);return {at};}
export function listRecovery(scope:RecoveryScope){return connection().prepare('SELECT id,data,updated_at FROM recovery_drafts WHERE scope=? ORDER BY updated_at DESC LIMIT 30').all(recoveryScope.parse(scope)).map(r=>{const data=JSON.parse(String(r.data));return {id:String(r.id),title:String(data.subject||data.title||'ร่างยังไม่ระบุเรื่อง'),at:String(r.updated_at)};});}
export function readRecovery(id:string,scope:RecoveryScope){const r=connection().prepare('SELECT data FROM recovery_drafts WHERE id=? AND scope=?').get(z.string().uuid().parse(id),recoveryScope.parse(scope));if(!r)throw new Error('ไม่พบสำเนากู้คืน');return parse(scope,JSON.parse(String(r.data)));}
