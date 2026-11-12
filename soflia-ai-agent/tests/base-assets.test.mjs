import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Box3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
const root=new URL('../',import.meta.url);
const buffer=await readFile(new URL('assets/glb/soflia_agent_base.glb',root));
test('La base GLB es válida, estática y contiene volumen corporal completo',async()=>{
  assert.equal(buffer.subarray(0,4).toString(),'glTF');assert.equal(buffer.readUInt32LE(8),buffer.length);
  const model=await new GLTFLoader().parseAsync(buffer.buffer.slice(buffer.byteOffset,buffer.byteOffset+buffer.byteLength),'');
  assert.equal(model.animations.length,0);model.scene.updateMatrixWorld(true);
  for(const name of ['BODY_MAIN','SHELL_UPPER','SHELL_LOWER','FACE_DISPLAY','FLOW_BAND_RIGHT_SURFACE','LOGO_SOFLIA'])assert.ok(model.scene.getObjectByName(name),name);
  const body=model.scene.getObjectByName('BODY_MAIN'),box=new Box3().setFromObject(body);
  assert.ok(box.max.z-box.min.z>1.2,'La parte posterior no debe aplanarse');
  const band=new Box3().setFromObject(model.scene.getObjectByName('FLOW_BAND_RIGHT_SURFACE'));
  assert.ok(band.max.x>1,'La banda turquesa debe conservar el lado derecho');
  assert.ok(band.max.z-band.min.z>1.0,'La banda debe recorrer frente y parte posterior');
});
test('La evidencia geométrica demuestra cierre y separación entre bandas',async()=>{
  const report=JSON.parse(await readFile(new URL('build/geometry-validation.json',root),'utf8'));
  assert.ok(report.meshes.length>=13);
  for(const mesh of report.meshes){assert.equal(mesh.nonManifold,0,mesh.name);assert.ok(mesh.signedVolume>0,mesh.name);}
  assert.ok(report.bandIntersections.every(pair=>pair.outsideAnchoredJoint===0));
  for(const name of ['FLOW_BAND_LEFT_SURFACE','FLOW_BAND_RIGHT_SURFACE'])assert.equal(report.meshes.find(mesh=>mesh.name===name).euler,2,'Las bandas no deben ser toros');
  const logo=JSON.parse(await readFile(new URL('build/logo-validation.json',root),'utf8'));assert.ok(logo.silhouetteIoU>.99);
});
