/** Build the original, offline Home background (no stock footage or external API).
 * Run with the bundled Node runtime. Chrome records a 12-second Canvas illustration.
 * Rebuild only when changing the artwork, not during normal startup/build. */
import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'public', 'media');
await fs.mkdir(output, {recursive: true});
const browser = await chromium.launch({headless: true, executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe'});
try {
  const page = await browser.newPage();
  await page.setContent('<canvas width="1280" height="640"></canvas>');
  const media = await page.evaluate(async () => {
    const canvas = document.querySelector('canvas');
    const c = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height, seconds = 12;
    const TAU = Math.PI * 2;
    const palette = {sky: '#d5e8e7', mist: '#f2f2e7', sea: '#9ec7cd', near: '#72a8b5',
      far: '#a4bfb5', hill: '#74958a', hillLight: '#8daa94', forest: '#5d8078',
      cliff: '#b8bca2', beach: '#e5d9b9', foam: '#ecf3e9', cloud: '#faf9ee'};
    function shape(fill, points) {
      c.fillStyle=fill; c.beginPath();
      for (const [op, ...values] of points) c[op](...values);
      c.closePath(); c.fill();
    }
    function draw(t) {
      const phase = TAU * t;
      const sky = c.createLinearGradient(0, 0, 0, H*.6);
      sky.addColorStop(0,palette.sky);sky.addColorStop(1,palette.mist);
      c.fillStyle=sky;c.fillRect(0,0,W,H);
      // Broad clouds drift and return to their starting point without a jump.
      c.save(); c.translate(Math.sin(phase)*12,0); c.globalAlpha=.43;
      shape(palette.cloud,[['moveTo',600,115],['bezierCurveTo',650,97,674,105,706,108],['bezierCurveTo',752,76,806,89,824,107],['bezierCurveTo',880,98,910,109,946,125],['bezierCurveTo',820,130,700,128,600,115]]);
      shape(palette.cloud,[['moveTo',950,63],['bezierCurveTo',1028,42,1064,60,1094,55],['bezierCurveTo',1142,27,1190,55,1220,67],['bezierCurveTo',1160,80,1030,77,950,63]]);
      c.restore();
      // Horizon islands and a curved headland, all original paths.
      shape(palette.far,[['moveTo',680,278],['bezierCurveTo',736,263,760,273,793,266],['bezierCurveTo',842,236,884,247,924,272],['lineTo',980,292],['lineTo',680,292]]);
      const sea=c.createLinearGradient(0,280,0,H);sea.addColorStop(0,palette.sea);sea.addColorStop(1,palette.near);
      c.fillStyle=sea;c.fillRect(0,284,W,H-284);
      // Quiet repeating wave lines; never slide across the reading area abruptly.
      c.lineWidth=1.3;
      for(let row=0;row<20;row++) {
        const y=300+row*17;
        c.strokeStyle=palette.foam;c.globalAlpha=.12+row*.003;
        c.beginPath();
        for(let x=0;x<=W;x+=8) {
          const yy=y+Math.sin(x*.008+phase+row*.8)*(2+row*.12);
          if(x===0)c.moveTo(x,yy);else c.lineTo(x,yy);
        }
        c.stroke();
      }
      c.globalAlpha=1;
      shape(palette.beach,[['moveTo',1280,244],['bezierCurveTo',1180,261,1178,315,1080,348],['bezierCurveTo',1002,376,1062,420,1008,460],['bezierCurveTo',953,497,917,533,1055,544],['bezierCurveTo',1186,552,1235,608,1280,634],['closePath']]);
      shape(palette.cliff,[['moveTo',1280,232],['bezierCurveTo',1160,258,1164,314,1080,343],['bezierCurveTo',1018,372,1080,414,1021,463],['bezierCurveTo',984,490,970,520,1065,527],['bezierCurveTo',1198,546,1238,593,1280,615],['closePath']]);
      shape(palette.hill,[['moveTo',1280,208],['bezierCurveTo',1205,216,1190,258,1148,275],['bezierCurveTo',1100,293,1093,304,1085,330],['bezierCurveTo',1068,365,1100,411,1050,446],['bezierCurveTo',1010,475,1024,498,1100,506],['bezierCurveTo',1181,514,1262,561,1280,580],['closePath']]);
      shape(palette.hillLight,[['moveTo',1280,225],['bezierCurveTo',1195,242,1190,290,1134,309],['bezierCurveTo',1109,320,1138,371,1093,419],['bezierCurveTo',1067,451,1040,472,1095,484],['bezierCurveTo',1155,497,1240,537,1280,556],['closePath']]);
      shape(palette.forest,[['moveTo',1280,318],['bezierCurveTo',1201,336,1186,385,1150,422],['bezierCurveTo',1111,461,1194,487,1280,520],['closePath']]);
      // A fine coastal path and a tiny pavilion make the scene specific, not abstract.
      c.strokeStyle=palette.beach;c.globalAlpha=.75;c.lineWidth=2;c.beginPath();c.moveTo(1260,264);c.bezierCurveTo(1190,302,1210,376,1124,453);c.stroke();c.globalAlpha=1;
      c.fillStyle=palette.forest;c.fillRect(1123,443,3,9);c.fillRect(1135,443,3,9);
      shape(palette.forest,[['moveTo',1117,443],['lineTo',1130,437],['lineTo',1144,443]]);
      c.strokeStyle=palette.foam;c.lineWidth=2;c.globalAlpha=.32+.08*Math.sin(phase);
      c.beginPath();c.moveTo(1280,641);c.bezierCurveTo(1170,556,1010,571,983,520);c.stroke();c.globalAlpha=1;
    }
    draw(0);
    const poster=canvas.toDataURL('image/png').split(',')[1];
    const mime=MediaRecorder.isTypeSupported('video/webm;codecs=vp9')?'video/webm;codecs=vp9':'video/webm;codecs=vp8';
    const stream=canvas.captureStream(24);
    const recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:650000});
    const chunks=[];
    const stopped=new Promise(resolve=>{recorder.onstop=resolve;});
    recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
    recorder.start();
    const start=performance.now();
    await new Promise(resolve=>{
      function tick(now){const elapsed=(now-start)/1000;if(elapsed>=seconds){resolve();return;}draw(elapsed/seconds);requestAnimationFrame(tick);}
      requestAnimationFrame(tick);
    });
    recorder.stop();await stopped;stream.getTracks().forEach(track=>track.stop());
    const blob=new Blob(chunks,{type:'video/webm'});
    const video=await new Promise(resolve=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);reader.readAsDataURL(blob);});
    return {poster,video};
  });
  for(const [file,data] of [['home-coast.webm',media.video],['home-coast-poster.png',media.poster]]) {
    const bytes=Buffer.from(data,'base64');await fs.writeFile(path.join(output,file),bytes);
    console.log(`${file}: ${(bytes.length/1024).toFixed(0)} KB`);
  }
} finally {await browser.close();}
