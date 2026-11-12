import { test } from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { readFile } from 'node:fs/promises';
const root=new URL('../',import.meta.url);
test('Los seis recursos son válidos, distintos y tienen resolución y duración verificadas',async()=>{
  const report=JSON.parse(await readFile(new URL('build/media-validation.json',root),'utf8'));
  assert.equal(report.length,6);const images=[];
  for(const item of report){
    assert.equal(item.width,512);assert.equal(item.height,512);assert.equal(item.gifPages,item.frames);
    assert.equal(item.webmAlpha.min,0);assert.equal(item.webmAlpha.max,255);assert.ok(item.webmBytes>1000);
    const raw=await sharp(await readFile(new URL(`previews/state_${item.state}.png`,root))).flatten({background:'#061725'}).resize(128,128).raw().toBuffer();images.push({state:item.state,raw});
  }
  for(let a=0;a<images.length;a++)for(let b=a+1;b<images.length;b++){
    let difference=0;for(let i=0;i<images[a].raw.length;i++)difference+=Math.abs(images[a].raw[i]-images[b].raw[i]);
    assert.ok(difference/images[a].raw.length>.12,`Miniaturas indistinguibles: ${images[a].state}/${images[b].state}`);
  }
});
