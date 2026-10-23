import {type InventorySnapshot} from './inventory';
import {committed} from './inventory-forms';
const dayMs=86400000;
export function inventoryAnalytics(data:InventorySnapshot,start:string,end:string,today:string){
 const from=start||data.movements.filter(committed).map(m=>m.date).sort()[0]||today;
 const to=end&&end<today?end:today,days=Math.max(1,Math.floor((Date.parse(to)-Date.parse(from))/dayMs)+1);
 const rows=data.movements.filter(m=>committed(m)&&m.date>=from&&m.date<=to);
 const previousEnd=new Date(Date.parse(from)-dayMs).toISOString().slice(0,10),previousStart=new Date(Date.parse(from)-days*dayMs).toISOString().slice(0,10);
 const previous=data.movements.filter(m=>committed(m)&&m.date>=previousStart&&m.date<=previousEnd);
 const receives=rows.filter(m=>m.kind==='receive'),issues=rows.filter(m=>m.kind==='issue');
 const issueCounts=new Map<string,number>(),quantities=new Map<string,number>(),departments=new Map<string,number>();
 for(const m of issues){departments.set(m.department,(departments.get(m.department)||0)+1);for(const l of m.lines){issueCounts.set(l.itemId,(issueCounts.get(l.itemId)||0)+1);quantities.set(l.itemId,(quantities.get(l.itemId)||0)+l.quantity);}}
 const supplies=data.items.filter(i=>i.kind==='supply'&&i.active);
 const demand=supplies.map(i=>({id:i.id,code:i.code,name:i.name,unit:i.unit,balance:i.balance,minimum:i.minimum,quantity:quantities.get(i.id)||0,count:issueCounts.get(i.id)||0,coverage:(quantities.get(i.id)||0)>0?Math.floor(i.balance*days/(quantities.get(i.id)||1)):null})).sort((a,b)=>b.count-a.count||a.code.localeCompare(b.code));
 const months=new Map<string,{month:string;receive:number;issue:number;loan:number;value:number}>();
 for(let d=new Date(from.slice(0,7)+'-01');d.toISOString().slice(0,10)<=to&&months.size<252;d.setUTCMonth(d.getUTCMonth()+1)){const month=d.toISOString().slice(0,7);months.set(month,{month,receive:0,issue:0,loan:0,value:0});}
 for(const m of rows){const v=months.get(m.date.slice(0,7));if(v){v[m.kind]++;if(m.kind==='receive')v.value+=m.lines.reduce((s,l)=>s+l.quantity*l.unitCost,0);}}
 const loans=data.movements.filter(m=>m.kind==='loan'&&m.status==='posted');
 const previousIssues=previous.filter(m=>m.kind==='issue').length;
 return {from,to,days,previousStart,previousEnd,receives:receives.length,issues:issues.length,previousIssues,changePercent:previousIssues?Math.round((issues.length-previousIssues)/previousIssues*100):null,receiveValue:receives.reduce((s,m)=>s+m.lines.reduce((a,l)=>a+l.quantity*l.unitCost,0),0),missingCosts:receives.reduce((s,m)=>s+m.lines.filter(l=>l.unitCost===0).length,0),months:[...months.values()],demand,departments:[...departments].map(([name,count])=>({name,count})).sort((a,b)=>b.count-a.count),low:demand.filter(i=>i.balance<=i.minimum),idle:demand.filter(i=>i.balance>0&&!i.count),loans:loans.length,overdue:loans.filter(m=>m.due<today).map(m=>({id:m.id,number:m.number,requester:m.requester,due:m.due,days:Math.floor((Date.parse(today)-Date.parse(m.due))/dayMs)})),asOf:today};
}
