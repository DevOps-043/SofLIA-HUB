import { AnimationAction, AnimationMixer, Group, LoopOnce, LoopRepeat, Material, Mesh, MeshStandardMaterial, Object3D } from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';

export const states = ['idle', 'listening', 'thinking', 'speaking', 'success', 'warning'] as const;
export type AvatarState = typeof states[number];
export type Expression = 'calm' | 'attentive' | 'focused' | 'friendly';
export type Quality = 'low' | 'medium' | 'high';
export const profiles = { low: { pixelRatio: 1, fps: 30 }, medium: { pixelRatio: 1.5, fps: 60 }, high: { pixelRatio: 2, fps: 60 } } as const;
const cache = new Map<string, { promise: Promise<GLTF>; users: number }>();

export function bounded(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) throw new TypeError('El valor debe ser finito');
  return Math.max(min, Math.min(max, value));
}

/** Liberar sólo cachés sin instancias activas. La geometría compartida pertenece a esta caché. */
export async function clearAvatarCache(): Promise<void> {
  for (const [url, entry] of cache) {
    if (entry.users) continue;
    cache.delete(url);
    const gltf = await entry.promise.catch(() => null);
    const geometries = new Set<Mesh['geometry']>();
    const materials = new Set<Material>();
    gltf?.scene.traverse(object => {
      if (object instanceof Mesh) {
        geometries.add(object.geometry);
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material);
      }
    });
    geometries.forEach(geometry => geometry.dispose());
    materials.forEach(material => material.dispose());
  }
}

export class AvatarController {
  readonly object: Group;
  readonly mixer: AnimationMixer;
  state: AvatarState = 'idle';
  private readonly actions = new Map<AvatarState, AnimationAction>();
  private readonly materials = new Map<MeshStandardMaterial, number>();
  private readonly lenses: Object3D[];
  private readonly bandOverlays: Group[] = [];
  private readonly rig: Object3D;
  private readonly gaze: Object3D;
  private readonly bars: { object: Object3D; height: number }[];
  private audioTarget = 0;
  private audio = 0;
  private elapsed = 0;
  private blinkTime = -10;
  private nextBlink = 3.7;
  private nodTime = -10;
  private gazeTarget = { x: 0, y: 0 };
  private pitch = 0;
  private yaw = 0;
  private expression = 1;
  private bandSpeed = 1;
  private blinkSpeed = 1;
  private audioIntensity = 1;
  private disposed = false;
  private release: () => void;

  static async load(url: string): Promise<AvatarController> {
    const key = typeof document === 'undefined' ? url : new URL(url, document.baseURI).href;
    let entry = cache.get(key);
    if (!entry) {
      const promise = new GLTFLoader().loadAsync(key);
      entry = { promise, users: 0 };
      cache.set(key, entry);
      promise.catch(() => { if (cache.get(key) === entry) cache.delete(key); });
    }
    entry.users++;
    try {
      const source = await entry.promise;
      return new AvatarController(source, () => { entry.users--; });
    } catch (error) { entry.users--; throw error; }
  }

  /** También admite un GLTF ya cargado para pruebas y visores independientes. */
  constructor(source: GLTF, release: () => void = () => {}) {
    this.release = release;
    this.object = source.scene.clone(true);
    this.object.traverse(object => {
      if (object instanceof Mesh) {
        const clone = (material: Material): Material => {
          const result = material.clone();
          if (result instanceof MeshStandardMaterial) this.materials.set(result, result.emissiveIntensity);
          return result;
        };
        object.material = Array.isArray(object.material) ? object.material.map(clone) : clone(object.material);
      }
    });
    const node = (name: string): Object3D => {
      const found = this.object.getObjectByName(name);
      if (!found) throw new Error(`El modelo no contiene ${name}`);
      return found;
    };
    this.rig = node('RIG_CONTROLLER'); this.gaze = node('GAZE_CONTROLLER');
    this.lenses = [node('EYE_LEFT_LENS'), node('EYE_RIGHT_LENS')];
    this.bars = Array.from({ length: 5 }, (_, index) => { const object = node(`AUDIO_${index}`); return { object, height: object.scale.y }; });
    for (const name of ['FLOW_BAND_LEFT', 'FLOW_BAND_RIGHT']) {
      const band = node(name); const overlay = new Group(); overlay.name = `${name}_AUDIO_OVERLAY`;
      for (const child of [...band.children]) overlay.add(child);
      band.add(overlay); this.bandOverlays.push(overlay);
    }
    this.mixer = new AnimationMixer(this.object);
    for (const state of states) {
      const clip = source.animations.find(animation => animation.name === `STATE_${state.toUpperCase()}`);
      if (!clip) throw new Error(`Falta el clip de ${state}`);
      this.actions.set(state, this.mixer.clipAction(clip));
    }
    this.mixer.addEventListener('finished', this.onFinished);
    this.setState('idle');
  }

  private onFinished = (event: { action: AnimationAction }): void => {
    if (!this.disposed && event.action === this.actions.get(this.state)) this.setState('idle');
  };

  setState(state: AvatarState): void {
    if (!states.includes(state)) throw new RangeError('Estado visual desconocido');
    if (this.disposed) return;
    const previous = this.actions.get(this.state);
    const next = this.actions.get(state)!;
    if (state === this.state && next.isRunning()) return;
    this.state = state;
    const oneShot = state === 'success' || state === 'warning';
    next.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).setLoop(oneShot ? LoopOnce : LoopRepeat, oneShot ? 1 : Infinity);
    next.clampWhenFinished = oneShot;
    next.play();
    if (previous && previous !== next) next.crossFadeFrom(previous, .28, false);
  }
  setAudioLevel(level: number): void { this.audioTarget = bounded(level, 0, 1); }
  setExpression(expression: Expression): void {
    const values = { calm: 1, attentive: 1.25, focused: .55, friendly: 1.08 };
    if (!Object.hasOwn(values, expression)) throw new RangeError('Expresión desconocida');
    this.expression = values[expression];
  }
  setLightIntensity(value: number): void { const intensity = bounded(value, .1, 3); this.materials.forEach((base, material) => { material.emissiveIntensity = base * intensity; }); }
  setBandSpeed(value: number): void { this.bandSpeed = bounded(value, 0, 3); }
  setBlinkSpeed(value: number): void { this.blinkSpeed = bounded(value, .2, 3); }
  setAudioIntensity(value: number): void { this.audioIntensity = bounded(value, 0, 2); }
  setSpeed(value: number): void { this.mixer.timeScale = bounded(value, .1, 2); }
  lookLeft(): void { this.gazeTarget = { x: -.075, y: 0 }; }
  lookRight(): void { this.gazeTarget = { x: .075, y: 0 }; }
  lookUp(): void { this.gazeTarget = { x: 0, y: .06 }; }
  lookDown(): void { this.gazeTarget = { x: 0, y: -.06 }; }
  blink(): void { this.blinkTime = this.elapsed; }
  nod(): void { this.nodTime = this.elapsed; }
  tilt(horizontal = .08, vertical = 0): void { this.yaw = bounded(horizontal, -.25, .25); this.pitch = bounded(vertical, -.2, .2); }
  resetPose(): void {
    this.audioTarget = 0; this.audio = 0; this.pitch = 0; this.yaw = 0; this.expression = 1;
    this.gazeTarget = { x: 0, y: 0 }; this.blinkTime = -10; this.nodTime = -10;
    this.gaze.position.x = 0; this.gaze.position.y = 0;
    this.setState('idle'); this.actions.get('idle')!.reset().play(); this.update(0);
  }

  update(delta: number, reducedMotion = false): void {
    if (this.disposed) return;
    const dt = bounded(delta, 0, .1);
    if (!reducedMotion) { this.elapsed += dt; this.mixer.update(dt); }
    else {
      this.mixer.stopAllAction();
      const action = this.actions.get(this.state)!; action.reset().setEffectiveWeight(1).play();
      action.time = action.getClip().duration * .3; this.mixer.update(0);
    }
    const smoothing = reducedMotion ? 1 : 1 - Math.exp(-dt * 12);
    this.audio += (this.audioTarget - this.audio) * smoothing;
    this.gaze.position.x += (this.gazeTarget.x - this.gaze.position.x) * smoothing;
    this.gaze.position.y += (this.gazeTarget.y - this.gaze.position.y) * smoothing;
    if (this.elapsed > this.nextBlink && !reducedMotion) { this.blink(); this.nextBlink = this.elapsed + 3.7 / this.blinkSpeed; }
    const blinkAge = (this.elapsed - this.blinkTime) * this.blinkSpeed;
    const blink = !reducedMotion && blinkAge < .24 ? 1 - .97 * Math.sin(Math.PI * Math.max(0, blinkAge) / .24) ** 2 : 1;
    this.lenses.forEach(lens => { lens.scale.y = this.expression * blink; });
    const nodAge = this.elapsed - this.nodTime;
    this.rig.rotation.x = this.pitch + (!reducedMotion && nodAge < .65 ? .10 * Math.sin(nodAge / .65 * Math.PI * 2) * Math.sin(nodAge / .65 * Math.PI) : 0);
    this.rig.rotation.y = this.yaw;
    const reactive = this.state === 'speaking' || this.state === 'listening';
    const amplitude = reducedMotion || !reactive ? 0 : this.audio * this.audioIntensity;
    this.bandOverlays.forEach((band, index) => {
      band.scale.setScalar(1 + amplitude * .045);
      band.rotation.z = reducedMotion ? 0 : .008 * Math.sin(this.elapsed * this.bandSpeed + index * Math.PI);
    });
    this.bars.forEach(({ object, height }, index) => { object.scale.y = height * (1 + amplitude * (1.3 + Math.sin(this.elapsed * 9 + index) * .7)); });
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true; this.mixer.removeEventListener('finished', this.onFinished);
    this.mixer.stopAllAction(); this.mixer.uncacheRoot(this.object);
    const materials = new Set<Material>();
    this.object.traverse(object => { if (object instanceof Mesh) for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material); });
    materials.forEach(material => material.dispose()); this.object.removeFromParent(); this.release();
  }
}
