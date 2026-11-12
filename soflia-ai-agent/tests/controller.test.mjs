import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { AvatarController, bounded, states } from '../integration/web/controller.ts';
const bytes=await readFile(new URL('../assets/glb/soflia_agent.glb',import.meta.url));
const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
const make=()=>new AvatarController(gltf);
test('Seis clips reales mantienen sus poses al principio y al final de cada bucle',()=>{
  assert.equal(gltf.animations.length,6);
  for(const state of states){
    const controller=make();controller.setState(state);controller.mixer.update(.35);
    const action=controller.mixer.existingAction(gltf.animations.find(a=>a.name===`STATE_${state.toUpperCase()}`));
    assert.ok(action);
    const eye=controller.object.getObjectByName('EYE_LEFT');
    const indicator=controller.object.getObjectByName('STATUS_0');
    assert.ok(Math.abs(eye.position.x)>.2,'La posición constante del ojo debe exportarse');
    assert.ok(indicator.scale.x<.05,'El tamaño constante del indicador debe exportarse');
    assert.equal(controller.object.getObjectByName('WARNING_MARK').scale.x<.001,state!=='warning');
    controller.dispose();
  }
  for(const clip of gltf.animations.filter(a=>!/SUCCESS|WARNING/.test(a.name))){
    for(const track of clip.tracks){
      const size=track.getValueSize(),values=track.values;
      for(let i=0;i<size;i++)assert.ok(Math.abs(values[i]-values[values.length-size+i])<1e-4,`${clip.name}: ${track.name}`);
    }
  }
});
test('Audio, mirada, expresiones y parpadeo producen cambios independientes',()=>{
  const controller=make();controller.setState('speaking');controller.setAudioLevel(1);controller.lookLeft();
  for(let i=0;i<10;i++)controller.update(.05);
  assert.ok(controller.object.getObjectByName('FLOW_BAND_LEFT_AUDIO_OVERLAY').scale.x>1.03);
  assert.ok(controller.object.getObjectByName('GAZE_CONTROLLER').position.x<-.06);
  controller.blink();controller.update(.1);
  assert.ok(controller.object.getObjectByName('EYE_LEFT_LENS').scale.y<.2);
  controller.setExpression('focused');controller.update(.1);controller.update(.1);
  assert.equal(controller.object.getObjectByName('EYE_LEFT_LENS').scale.y,.55);
  controller.nod();controller.update(.1);assert.notEqual(controller.object.getObjectByName('RIG_CONTROLLER').rotation.x,0);
  controller.resetPose();assert.equal(controller.state,'idle');
  controller.dispose();controller.dispose();
});
test('Éxito y advertencia retornan a espera; entradas no finitas se rechazan',()=>{
  for(const state of ['success','warning']){const c=make();c.setState(state);for(let i=0;i<30;i++)c.update(.1);assert.equal(c.state,'idle');c.dispose();}
  assert.throws(()=>bounded(NaN,0,1));assert.throws(()=>bounded(Infinity,0,1));assert.equal(bounded(9,0,1),1);
  const c=make();assert.throws(()=>c.setState('inventado'));assert.throws(()=>c.setAudioLevel(NaN));c.dispose();
});
test('Movimiento reducido no avanza el clip y conserva la expresión del estado',()=>{
  const c=make();c.setState('thinking');c.update(.1,true);
  const before=c.object.getObjectByName('STATE_MOTION').position.clone();c.update(.1,true);
  assert.ok(before.equals(c.object.getObjectByName('STATE_MOTION').position));c.dispose();
});
test('Cambios rápidos no dejan que un clip anterior interrumpa al estado vigente',()=>{
  const c=make();c.setState('success');for(let i=0;i<10;i++)c.update(.1);
  c.setState('warning');for(let i=0;i<12;i++)c.update(.1);assert.equal(c.state,'warning');
  assert.throws(()=>c.setExpression('__proto__'));c.lookRight();c.update(.1);c.resetPose();
  assert.equal(c.object.getObjectByName('GAZE_CONTROLLER').position.x,0);c.dispose();
});
