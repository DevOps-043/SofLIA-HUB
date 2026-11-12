import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const build=fileURLToPath(new URL('../build/',import.meta.url));await mkdir(build,{recursive:true});
const executable=process.env.CHROME_BIN||'C:/Program Files/Google/Chrome/Application/chrome.exe';
const browser=await chromium.launch({executablePath:executable,headless:true});
const results={profiles:{},errors:[],states:[]};
try{
  const page=await browser.newPage({viewport:{width:1400,height:1060}});
  page.on('pageerror',error=>results.errors.push(error.message));
  let requests=0,modelUrl='';page.on('request',request=>{if(request.url().includes('.glb')&&request.resourceType()==='fetch'){requests++;modelUrl=request.url();}});
  await page.goto('http://127.0.0.1:4336/');
  await page.waitForFunction(()=>window.sofliaDemo?.viewer.controller);
  results.gpu=await page.evaluate(()=>{
    const canvas=document.querySelector('#stage canvas');const context=canvas.getContext('webgl2');
    const debug=context.getExtension('WEBGL_debug_renderer_info');
    return {renderer:debug?context.getParameter(debug.UNMASKED_RENDERER_WEBGL):context.getParameter(context.RENDERER),vendor:context.getParameter(context.VENDOR),userAgent:navigator.userAgent};
  });
  for(const quality of ['low','medium','high']){
    await page.selectOption('#quality',quality);await page.waitForTimeout(2300);
    results.profiles[quality]=await page.evaluate(()=>window.sofliaDemo.metrics());
    assert.ok(results.profiles[quality].fps>0);
  }
  for(const state of ['idle','listening','thinking','speaking','success','warning']){
    await page.click(`[data-state=${state}]`);await page.waitForTimeout(450);
    assert.equal(await page.evaluate(()=>window.sofliaDemo.viewer.controller.state),state);
    await page.locator('.stage-shell').screenshot({path:build+`browser-${state}.png`});results.states.push(state);
  }
  await page.waitForTimeout(2300);assert.equal(await page.evaluate(()=>window.sofliaDemo.viewer.controller.state),'idle');
  await page.click('[data-state=speaking]');
  await page.locator('#audio').fill('0.85');await page.waitForTimeout(300);
  assert.ok(await page.evaluate(()=>window.sofliaDemo.viewer.controller.object.getObjectByName('FLOW_BAND_LEFT_AUDIO_OVERLAY').scale.x>1.02));
  await page.click('[data-gesture=lookLeft]');await page.waitForTimeout(250);
  assert.ok(await page.evaluate(()=>window.sofliaDemo.viewer.controller.object.getObjectByName('GAZE_CONTROLLER').position.x<-.05));
  await page.emulateMedia({reducedMotion:'reduce'});await page.waitForTimeout(200);
  const before=await page.evaluate(()=>window.sofliaDemo.viewer.controller.object.getObjectByName('STATE_MOTION').position.toArray());
  await page.waitForTimeout(300);
  assert.deepEqual(await page.evaluate(()=>window.sofliaDemo.viewer.controller.object.getObjectByName('STATE_MOTION').position.toArray()),before);
  await page.click('[data-state=thinking]');await page.waitForTimeout(200);
  assert.ok(await page.evaluate(()=>window.sofliaDemo.viewer.controller.object.getObjectByName('EYE_LEFT').scale.y<.5));
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.click('[data-state=idle]');await page.selectOption('#quality','medium');await page.waitForTimeout(350);
  await page.screenshot({path:build+'viewer-final.png',fullPage:true});
  await page.click('#background');await page.screenshot({path:build+'viewer-light.png',fullPage:true});
  const restored=await page.evaluate(async()=>{
    const canvas=document.querySelector('#stage canvas'),gl=canvas.getContext('webgl2'),ext=gl.getExtension('WEBGL_lose_context');
    if(!ext)return 'No disponible';ext.loseContext();await new Promise(resolve=>setTimeout(resolve,150));
    const fallback=!document.querySelector('.avatar-fallback').hidden;ext.restoreContext();await new Promise(resolve=>setTimeout(resolve,350));return fallback;
  });
  assert.equal(restored,true);results.contextLossFallback=restored;
  results.sharedCache=await page.evaluate(async url=>{
    const current=window.sofliaDemo.viewer.controller;
    const [first,second]=await Promise.all([current.constructor.load(url),current.constructor.load(url)]);
    const a=first.object.getObjectByName('BODY_MAIN'),b=second.object.getObjectByName('BODY_MAIN');
    const valid=a.geometry===b.geometry&&a.material!==b.material;first.dispose();second.dispose();return valid;
  },modelUrl);
  assert.equal(results.sharedCache,true);
  await page.evaluate(()=>{document.querySelector('#stage').style.display='none';});await page.waitForTimeout(150);
  const paused=await page.evaluate(()=>window.sofliaDemo.viewer.controller.mixer.time);await page.waitForTimeout(350);
  assert.equal(await page.evaluate(()=>window.sofliaDemo.viewer.controller.mixer.time),paused);results.hiddenPause=true;
  await page.evaluate(()=>{document.querySelector('#stage').style.display='';});await page.waitForTimeout(100);
  await page.evaluate(()=>window.sofliaDemo.viewer.dispose());
  assert.equal(await page.locator('#stage canvas').count(),0);
  assert.equal(requests,1);results.glbRequests=requests;
  const fallback=await browser.newPage();
  await fallback.route('**/*.glb',route=>route.abort());await fallback.goto('http://127.0.0.1:4336/');
  await fallback.waitForFunction(()=>document.querySelector('#error')?.textContent.includes('Vista estática'));
  assert.ok(await fallback.locator('.avatar-fallback').isVisible());results.networkFallback=true;
  await fallback.close();assert.deepEqual(results.errors,[]);
  const noWebgl=await browser.newPage();
  await noWebgl.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return type==='webgl2'||type==='webgl'?null:original.call(this,type,...args);};});
  await noWebgl.goto('http://127.0.0.1:4336/');await noWebgl.waitForFunction(()=>document.querySelector('#error')?.textContent.includes('Vista estática'));
  assert.ok(await noWebgl.locator('.avatar-fallback').isVisible());results.noWebglFallback=true;await noWebgl.close();
  const memory=await page.evaluate(()=>performance.memory?{heapUsed:performance.memory.usedJSHeapSize,heapTotal:performance.memory.totalJSHeapSize}:null);
  results.memoryAfterDispose=memory;
  await writeFile(build+'browser-validation.json',JSON.stringify(results,null,2));
  console.info(JSON.stringify(results,null,2));
}finally{await browser.close();}
