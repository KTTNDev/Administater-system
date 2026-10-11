export async function register(){
  if(process.env.NEXT_RUNTIME==='nodejs'&&process.env.NEXT_PHASE!=='phase-production-build'&&process.env.SARABUN_BUILD!=='desktop'){
    const {startAutomaticBackups}=await import('./lib/automatic-backup');
    startAutomaticBackups();
  }
}
