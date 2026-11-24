import {defineConfig} from "@playwright/test";
import fs from "node:fs";
import path from 'node:path';
const external=process.env.PLAYWRIGHT_BASE_URL;
// No E2E command is allowed to start against the officer's real database.
const root=external?undefined:process.env.SARABUN_E2E_DATA_ROOT||path.resolve('output','e2e',String(Date.now()),'output','feature-check');
if(root){process.env.RUN_PRODUCTION_SMOKE='1';process.env.SARABUN_E2E_DATA_ROOT=root;process.env.SARABUN_SAFETY_TEST_ROOT=root;}
const executablePath=process.env.CHROMIUM_EXECUTABLE_PATH||["C:/Program Files/Google/Chrome/Application/chrome.exe","C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"].find(p=>fs.existsSync(p));
export default defineConfig({testDir:"./tests/e2e",workers:1,timeout:90000,
 // Moving the disposable installation changes its DB path. Run it after tests that seed the original path.
 projects:[{name:'workspace',testIgnore:'**/data-location.spec.ts'},{name:'data-migration',testMatch:'**/data-location.spec.ts',dependencies:['workspace']}],
 webServer:external?undefined:{command:'node scripts/e2e-server.mjs',url:'http://127.0.0.1:3100/api/health',reuseExistingServer:false,timeout:120000,env:{SARABUN_E2E_DATA_ROOT:root!}},use:{baseURL:external||"http://127.0.0.1:3100",headless:true,actionTimeout:15000,viewport:{width:1440,height:1000},launchOptions:{executablePath},screenshot:"only-on-failure"}});
