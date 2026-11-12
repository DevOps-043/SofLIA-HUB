import { ACESFilmicToneMapping, AmbientLight, Color, DirectionalLight, PerspectiveCamera, PMREMGenerator, Scene, WebGLRenderer } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { Vector2 } from 'three';
import { AvatarController, profiles, type Quality } from './controller';

export interface Metrics { fps: number; frameMs: number; drawCalls: number; triangles: number; geometries: number; textures: number; loadMs: number; }
export interface ViewerOptions { modelUrl: string; fallbackUrl: string; quality?: Quality; onMetrics?: (metrics: Metrics) => void; onError?: (message: string) => void; }

export class AvatarViewer {
  controller?: AvatarController;
  readonly ready: Promise<void>;
  private renderer?: WebGLRenderer;
  private controls?: OrbitControls;
  private composer?: EffectComposer;
  private bloom?: UnrealBloomPass;
  private renderPass?: RenderPass;
  private outputPass?: OutputPass;
  private resizeObserver?: ResizeObserver;
  private intersectionObserver?: IntersectionObserver;
  private disposed = false;
  private visible = true;
  private frame = 0;
  private last = 0;
  private quality: Quality;
  private dirty = true;
  private readonly motion = matchMedia('(prefers-reduced-motion: reduce)');
  private readonly fallback = document.createElement('img');
  private environment?: ReturnType<PMREMGenerator['fromScene']>;
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(36, 1, .1, 50);
  private metricsStart = 0;
  private frames = 0;
  private frameCosts = 0;
  private loadMs = 0;
  private contextLost = false;

  constructor(private host: HTMLElement, private options: ViewerOptions) {
    this.quality = options.quality ?? 'medium';
    this.fallback.src = options.fallbackUrl; this.fallback.alt = 'Agente visual SofLIA'; this.fallback.className = 'avatar-fallback';
    Object.assign(this.fallback.style, { width: '100%', height: '100%', objectFit: 'contain' });
    this.host.append(this.fallback);
    this.ready = this.initialize();
  }

  private async initialize(): Promise<void> {
    const start = performance.now();
    try {
      this.renderer = new WebGLRenderer({ antialias: this.quality !== 'low', alpha: true, powerPreference: 'low-power' });
      this.renderer.setClearColor(0x000000, 0); this.renderer.toneMapping = ACESFilmicToneMapping;
      this.renderer.info.autoReset = false;
      this.renderer.toneMappingExposure = .80;
      this.renderer.domElement.setAttribute('aria-label', 'Modelo tridimensional de SofLIA; arrastra para girar');
      this.renderer.domElement.addEventListener('webglcontextlost', this.onLost);
      this.renderer.domElement.addEventListener('webglcontextrestored', this.onRestored);
      this.host.append(this.renderer.domElement);
      this.camera.position.set(0, .18, 5.1);
      this.controls = new OrbitControls(this.camera, this.renderer.domElement); this.controls.enableDamping = false;
      this.controls.enablePan = false; this.controls.minDistance = 3.4; this.controls.maxDistance = 7;
      this.controls.addEventListener('change', this.invalidate);
      const ambient = new AmbientLight(0xb6edff, 1.6); this.scene.add(ambient);
      const key = new DirectionalLight(0xd8efff, 3); key.position.set(-3, 4, 4); this.scene.add(key);
      const rim = new DirectionalLight(0x25ebdb, 3); rim.position.set(3, 1, -3); this.scene.add(rim);
      const room = new RoomEnvironment(); const generator = new PMREMGenerator(this.renderer);
      this.environment = generator.fromScene(room, .04); this.scene.environment = this.environment.texture;
      this.scene.environmentIntensity = .6;
      room.dispose(); generator.dispose();
      this.scene.background = new Color('#061927');
      this.composer = new EffectComposer(this.renderer);
      this.renderPass = new RenderPass(this.scene, this.camera);
      this.bloom = new UnrealBloomPass(new Vector2(512, 512), .14, .15, 2.5);
      this.outputPass = new OutputPass();
      this.composer.addPass(this.renderPass); this.composer.addPass(this.bloom); this.composer.addPass(this.outputPass);
      const controller = await AvatarController.load(this.options.modelUrl);
      if (this.disposed) { controller.dispose(); return; }
      this.controller = controller; this.scene.add(controller.object); this.fallback.hidden = true;
      this.loadMs = performance.now() - start;
      this.resizeObserver = new ResizeObserver(this.resize); this.resizeObserver.observe(this.host);
      this.intersectionObserver = new IntersectionObserver(entries => { this.visible = entries[0]?.isIntersecting ?? true; this.schedule(); });
      this.intersectionObserver.observe(this.host);
      document.addEventListener('visibilitychange', this.onVisibility); this.motion.addEventListener('change', this.invalidate);
      this.resize(); this.schedule();
      this.setQuality(this.quality);
    } catch (error) {
      if (!this.disposed) {
        this.fallback.hidden = false;
        if (this.renderer) this.renderer.domElement.hidden = true;
        this.options.onError?.(error instanceof Error ? error.message : 'No fue posible iniciar el visor 3D');
      }
    }
  }

  private onLost = (event: Event): void => {
    event.preventDefault(); this.contextLost = true; cancelAnimationFrame(this.frame); this.frame = 0;
    if (this.renderer) this.renderer.domElement.hidden = true;
    this.fallback.hidden = false; this.options.onError?.('Contexto gráfico perdido; esperando recuperación');
  };
  private onRestored = (): void => {
    this.contextLost = false; this.fallback.hidden = !this.controller;
    if (this.renderer) this.renderer.domElement.hidden = false;
    this.invalidate();
  };
  private onVisibility = (): void => { this.last = 0; this.schedule(); };
  private resize = (): void => {
    if (this.disposed || !this.renderer) return;
    const width = Math.max(1, this.host.clientWidth), height = Math.max(1, this.host.clientHeight);
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, profiles[this.quality].pixelRatio));
    this.renderer.setSize(width, height); this.camera.aspect = width / height; this.camera.updateProjectionMatrix(); this.invalidate();
    this.composer?.setPixelRatio(this.renderer.getPixelRatio()); this.composer?.setSize(width, height);
  };
  invalidate = (): void => { this.dirty = true; this.schedule(); };
  private schedule(): void {
    if (this.disposed || this.contextLost || !this.controller) return;
    if (document.hidden || !this.visible) { cancelAnimationFrame(this.frame); this.frame = 0; this.last = 0; return; }
    if (!this.frame && (this.dirty || !this.motion.matches)) this.frame = requestAnimationFrame(this.tick);
  }
  private tick = (time: number): void => {
    this.frame = 0;
    if (this.disposed || !this.renderer || document.hidden || !this.visible || this.contextLost) return;
    const interval = 1000 / profiles[this.quality].fps;
    if (this.last && time - this.last < interval - 1 && !this.dirty) { this.schedule(); return; }
    const delta = this.last ? Math.min((time - this.last) / 1000, .1) : 1 / 60;
    this.last = time; const start = performance.now();
    this.controller?.update(delta, this.motion.matches); this.controls?.update();
    this.renderer.info.reset();
    if (this.quality === 'low' || !this.composer) this.renderer.render(this.scene, this.camera);
    else this.composer.render(delta);
    this.dirty = false;
    this.frames++; this.frameCosts += performance.now() - start;
    if (!this.metricsStart) this.metricsStart = time;
    if (time - this.metricsStart >= 1000) {
      const info = this.renderer.info;
      this.options.onMetrics?.({ fps: this.frames * 1000 / (time - this.metricsStart), frameMs: this.frameCosts / this.frames, drawCalls: info.render.calls, triangles: info.render.triangles, geometries: info.memory.geometries, textures: info.memory.textures, loadMs: this.loadMs });
      this.frames = 0; this.frameCosts = 0; this.metricsStart = time;
    }
    this.schedule();
  };

  setQuality(quality: Quality): void {
    if (!Object.hasOwn(profiles, quality)) throw new RangeError('Calidad desconocida');
    this.quality = quality; this.scene.environment = quality === 'low' ? null : this.environment?.texture ?? null; this.resize();
  }
  setBackground(light: boolean): void { this.scene.background = new Color(light ? '#eaf2f2' : '#061927'); this.invalidate(); }
  resetCamera(): void { this.camera.position.set(0, .18, 5.1); this.controls?.target.set(0, 0, 0); this.controls?.update(); this.invalidate(); }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true; cancelAnimationFrame(this.frame);
    this.resizeObserver?.disconnect(); this.intersectionObserver?.disconnect();
    document.removeEventListener('visibilitychange', this.onVisibility); this.motion.removeEventListener('change', this.invalidate);
    this.controls?.removeEventListener('change', this.invalidate); this.controls?.dispose();
    this.controller?.dispose(); this.environment?.dispose(); this.scene.clear();
    this.renderPass?.dispose(); this.bloom?.dispose(); this.outputPass?.dispose(); this.composer?.dispose();
    if (this.renderer) {
      this.renderer.domElement.removeEventListener('webglcontextlost', this.onLost);
      this.renderer.domElement.removeEventListener('webglcontextrestored', this.onRestored);
      this.renderer.dispose(); this.renderer.forceContextLoss(); this.renderer.domElement.remove();
    }
    this.fallback.remove();
  }
}
