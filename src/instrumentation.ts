export async function register(){
  if(process.env.NEXT_RUNTIME==='nodejs'&&process.env.NEXT_PHASE!=='phase-production-build'&&process.env.SARABUN_BUILD!=='desktop'&&process.env.SARABUN_BUILD!=='procurement-lab'&&process.env.SARABUN_BUILD!=='procurement-main-demo'){
    const {startAutomaticBackups}=await import('./lib/automatic-backup');
    startAutomaticBackups();
  }
}
