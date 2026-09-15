import {defineConfig} from "@playwright/test";
import fs from "node:fs";
const executablePath=process.env.CHROMIUM_EXECUTABLE_PATH||["C:/Program Files/Google/Chrome/Application/chrome.exe","C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"].find(p=>fs.existsSync(p));
export default defineConfig({testDir:"./tests/e2e",workers:1,timeout:90000,use:{baseURL:"http://127.0.0.1:3000",headless:true,viewport:{width:1440,height:1000},launchOptions:{executablePath},screenshot:"only-on-failure"}});
