export const workspaceViewLabels={home:'หน้าหลัก',tasks:'งานของฉัน',projects:'โครงการประจำปี',dashboard:'เอกสารของฉัน',templates:'แบบหนังสือราชการ',reports:'ภาพรวมและรายงาน',inventory:'พัสดุและครุภัณฑ์',register:'ทะเบียนรับ–ส่งหนังสือ',office:'งานธุรการ',budget:'โอนงบประมาณ',calendar:'ปฏิทินงาน',bookings:'จองห้องประชุม',laws:'คลังกฎหมาย',guide:'คู่มือใช้งาน',settings:'ตั้งค่า',editor:'จัดทำร่างหนังสือ'} as const;
export type WorkspaceView=keyof typeof workspaceViewLabels;
export type WorkspaceLocation={current:WorkspaceView;past:WorkspaceView[]};
export function visitWorkspaceView(state:WorkspaceLocation,next:WorkspaceView):WorkspaceLocation {
 if(state.current===next)return state;
 // There is one draft editor in memory. A newly opened draft supersedes older
 // editor entries so Back cannot misleadingly reopen another document's context.
 const past=next==='editor'?state.past.filter(view=>view!=='editor'):state.past;
 const visits=[...past,state.current];
 return {current:next,past:visits.filter((view,index)=>index===0||view!==visits[index-1]).slice(-40)};
}
export function previousWorkspaceView(state:WorkspaceLocation):WorkspaceLocation {
 return {current:state.past.at(-1)||'home',past:state.past.slice(0,-1)};
}
