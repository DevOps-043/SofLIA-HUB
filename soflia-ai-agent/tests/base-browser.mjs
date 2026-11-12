import { chromium } from 'playwright-core';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
const root=fileURLToPath(new URL('../',import.meta.url));
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
try{
  const page=await browser.newPage({viewport:{width:1600,height:1000},deviceScaleFactor:1});const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto('http://127.0.0.1:4336/');await page.waitForFunction(()=>window.baseReview);
  const frameCount=await page.evaluate(()=>window.baseReview.frames());await page.waitForTimeout(500);
  assert.equal(await page.evaluate(()=>window.baseReview.frames()),frameCount,'La escena inmóvil debe detener su bucle');
  const views={front:[0,-.093,6],three_quarter_left:[-4.2426,-.093,4.2426],three_quarter_right:[4.2426,-.093,4.2426],side_right:[6,-.093,0],side_left:[-6,-.093,0],back:[0,-.093,-6],top:[0,6,0]};
  for(const [name,position] of Object.entries(views)){
    await page.evaluate(({name,position})=>{const v=window.baseReview;v.camera.up.set(...(name==='top'?[0,0,-1]:[0,1,0]));v.camera.position.set(...position);v.camera.lookAt(0,-.093,0);v.render();},{name,position});
    await page.locator('#viewer canvas').screenshot({path:root+`previews/reconstruction/three-${name}.png`});
  }
  await page.evaluate(()=>{const v=window.baseReview;v.camera.up.set(0,1,0);v.camera.position.set(0,-.093,6);v.camera.lookAt(0,-.093,0);v.render();});
  await page.screenshot({path:root+'build/structural-comparison-browser.png',fullPage:true});
  const plain=await page.evaluate(()=>window.baseReview.benchmark(false));
  const effects=await page.evaluate(()=>window.baseReview.benchmark(true));
  assert.deepEqual(errors,[]);
  const report={idleRenderingStopped:true,views:Object.keys(views),plain,effects,errors};
  await writeFile(root+'build/base-browser-validation.json',JSON.stringify(report,null,2));console.info(JSON.stringify(report,null,2));
}finally{await browser.close();}
