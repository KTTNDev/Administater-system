import {exportDatabase} from './workspace-backup.mjs';
try{
 const [database,folder,source]=process.argv.slice(2);
 if(!database||!folder||!source)throw Error('Missing backup paths');
 console.log(JSON.stringify(exportDatabase(database,folder,source)));
}catch(error){console.error(error.message);process.exitCode=1;}
