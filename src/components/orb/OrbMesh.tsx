import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import {
  AUDIO_RAY_FRAGMENT_SHADER,
  AUDIO_RAY_VERTEX_SHADER,
  CIRCUIT_FRAGMENT_SHADER,
  CIRCUIT_VERTEX_SHADER,
  HALO_FRAGMENT_SHADER,
  HALO_VERTEX_SHADER,
  NODE_FRAGMENT_SHADER,
  NODE_VERTEX_SHADER,
  PARTICLE_FRAGMENT_SHADER,
  PARTICLE_VERTEX_SHADER,
  REACTOR_FRAGMENT_SHADER,
  REACTOR_VERTEX_SHADER,
  RING_FRAGMENT_SHADER,
  RING_VERTEX_SHADER,
  SHELL_FRAGMENT_SHADER,
  SHELL_VERTEX_SHADER,
} from './orb-shaders';
import {
  createAudioRayGeometry,
  createCircuitGeometry,
  createCrescentRibbonGeometry,
  createMechanicalShellGeometry,
  createParticleGeometry,
  createRingGeometry,
} from './orb-geometry';
import type { AudioFeatureRefs } from './useAudioFeatures';
import type { OrbPointerInteraction, OrbVisualState } from './orb-types';

interface StateConfig {
  base: THREE.Color;
  energy: THREE.Color;
  accent: THREE.Color;
  activity: number;
  rotationSpeed: number;
  ringSpeed: number;
  ringOpacity: number;
  circuitOpacity: number;
  signalMix: number;
  particleOpacity: number;
  haloEnergy: number;
  reactorEnergy: number;
  eventMinSeconds: number;
  eventRangeSeconds: number;
  syntheticBurst: number;
}

type ActingShapeIndex = 0 | 1 | 2 | 3;

interface ActingMorphState {
  current: ActingShapeIndex;
  previous: ActingShapeIndex;
  next: ActingShapeIndex;
  progress: number;
  duration: number;
  holdRemaining: number;
  sequence: number;
  weights: THREE.Vector4;
}

/**
 * Una misma identidad dorada con variaciones funcionales por estado. El color
 * de acento permanece cálido para conservar la estética de maquinaria premium.
 */
const STATE_CONFIGS: Record<OrbVisualState, StateConfig> = {
  idle: {
    base: new THREE.Color('#0A2540'),
    energy: new THREE.Color('#00D4B3'),
    accent: new THREE.Color('#FFFFFF'),
    activity: 0.23,
    rotationSpeed: 0.055,
    ringSpeed: 0.16,
    ringOpacity: 0.43,
    circuitOpacity: 0.82,
    signalMix: 0.08,
    particleOpacity: 0.38,
    haloEnergy: 0.25,
    reactorEnergy: 0.28,
    eventMinSeconds: 2.8,
    eventRangeSeconds: 4.6,
    syntheticBurst: 0.18,
  },
  listening: {
    base: new THREE.Color('#0A2540'),
    energy: new THREE.Color('#00D4B3'),
    accent: new THREE.Color('#FFFFFF'),
    activity: 0.48,
    rotationSpeed: 0.085,
    ringSpeed: 0.3,
    ringOpacity: 0.48,
    circuitOpacity: 0.82,
    signalMix: 1,
    particleOpacity: 0.45,
    haloEnergy: 0.42,
    reactorEnergy: 0.48,
    eventMinSeconds: 2.2,
    eventRangeSeconds: 3.1,
    syntheticBurst: 0.08,
  },
  thinking: {
    base: new THREE.Color('#0A2540'),
    energy: new THREE.Color('#00A88E'),
    accent: new THREE.Color('#FFFFFF'),
    activity: 0.7,
    rotationSpeed: 1.08,
    ringSpeed: 1.9,
    ringOpacity: 0.72,
    circuitOpacity: 0.9,
    signalMix: 0.26,
    particleOpacity: 0.58,
    haloEnergy: 0.54,
    reactorEnergy: 0.72,
    eventMinSeconds: 0.8,
    eventRangeSeconds: 1.7,
    syntheticBurst: 0.62,
  },
  speaking: {
    base: new THREE.Color('#0A2540'),
    energy: new THREE.Color('#00D4B3'),
    accent: new THREE.Color('#FFFFFF'),
    activity: 0.6,
    rotationSpeed: 0.09,
    ringSpeed: 0.48,
    ringOpacity: 0.62,
    circuitOpacity: 0.94,
    signalMix: 1,
    particleOpacity: 0.64,
    haloEnergy: 0.62,
    reactorEnergy: 0.68,
    eventMinSeconds: 3.2,
    eventRangeSeconds: 4.3,
    syntheticBurst: 0.03,
  },
  acting: {
    base: new THREE.Color('#0A2540'),
    energy: new THREE.Color('#F59E0B'),
    accent: new THREE.Color('#FFFFFF'),
    activity: 0.78,
    rotationSpeed: 0.22,
    ringSpeed: 1.45,
    ringOpacity: 0.84,
    circuitOpacity: 1,
    signalMix: 0.34,
    particleOpacity: 0.72,
    haloEnergy: 0.68,
    reactorEnergy: 0.82,
    eventMinSeconds: 0.55,
    eventRangeSeconds: 1.1,
    syntheticBurst: 0.82,
  },
};

const COLOR_RESPONSE = 3.8;
const PARAMETER_RESPONSE = 4.6;
const RING_SPEED_FACTORS = [1, -0.73, 1.31, -1.67] as const;
const ACTING_SHAPE_COUNT = 4;
const ACTING_DATA_COLOR = new THREE.Color('#00D4B3');
const CRESCENT_CONFIGS = [
  { radius: 1.035, width: 0.075, arc: 3.86, rotation: [0.22, 0.36, -0.52] },
  { radius: 1.09, width: 0.052, arc: 2.72, rotation: [1.08, -0.18, 0.76] },
] as const;

function transitionFactor(response: number, delta: number): number {
  return 1 - Math.exp(-response * delta);
}

function pseudoRandom(value: number): number {
  const sine = Math.sin(value * 12.9898 + 78.233) * 43758.5453;
  return sine - Math.floor(sine);
}

function smootherStep(value: number): number {
  const clamped = THREE.MathUtils.clamp(value, 0, 1);
  return clamped * clamped * clamped * (clamped * (clamped * 6 - 15) + 10);
}

function chooseNextActingShape(
  current: ActingShapeIndex,
  previous: ActingShapeIndex,
  random: number,
): ActingShapeIndex {
  const candidates: ActingShapeIndex[] = [0, 1, 2, 3]
    .filter((shape) => shape !== current && shape !== previous) as ActingShapeIndex[];
  const index = Math.min(candidates.length - 1, Math.floor(random * candidates.length));
  return candidates[Math.max(0, index)] ?? ((current + 1) % ACTING_SHAPE_COUNT) as ActingShapeIndex;
}

function createActingEdgeGeometries(): THREE.EdgesGeometry[] {
  const triangle = new THREE.CylinderGeometry(0.96, 0.96, 0.74, 3, 1, false);
  triangle.rotateX(Math.PI / 2);

  const hexagon = new THREE.CylinderGeometry(0.95, 0.95, 0.78, 6, 1, false);
  hexagon.rotateX(Math.PI / 2);

  const sources: THREE.BufferGeometry[] = [
    triangle,
    hexagon,
    new THREE.OctahedronGeometry(1.02, 0),
    new THREE.BoxGeometry(1.16, 1.16, 1.16),
    new THREE.TetrahedronGeometry(1.08, 0),
    new THREE.DodecahedronGeometry(1.02, 0),
    new THREE.IcosahedronGeometry(1.04, 0),
    new THREE.TorusGeometry(0.82, 0.24, 5, 12),
  ];
  const edges = sources.map((geometry) => new THREE.EdgesGeometry(geometry, 5));
  sources.forEach((geometry) => geometry.dispose());
  return edges;
}

function createRingUniforms() {
  return {
    uTime: { value: 0 },
    uSpeed: { value: 0.2 },
    uAudioLevel: { value: 0 },
    uTransient: { value: 0 },
    uOpacity: { value: 0.35 },
    uEnergyColor: { value: new THREE.Color('#00D4B3') },
    uAccentColor: { value: new THREE.Color('#FFFFFF') },
  };
}

export function OrbMesh({
  visualState,
  audio,
  interaction,
}: {
  visualState: OrbVisualState;
  audio: AudioFeatureRefs;
  interaction: OrbPointerInteraction;
}) {
  const rootRef = useRef<THREE.Group>(null);
  const interactionGroupRef = useRef<THREE.Group>(null);
  const structureRef = useRef<THREE.Group>(null);
  const cageRef = useRef<THREE.Group>(null);
  const nexusRef = useRef<THREE.Group>(null);
  const haloMeshRef = useRef<THREE.Mesh>(null);
  const ringGroupRefs = [
    useRef<THREE.Group>(null),
    useRef<THREE.Group>(null),
  ];
  const mechanicalLayerRefs = [
    useRef<THREE.Group>(null),
    useRef<THREE.Group>(null),
  ];
  const mechanicalMaterialRefs = [
    useRef<THREE.LineBasicMaterial>(null),
    useRef<THREE.LineBasicMaterial>(null),
  ];
  const crescentGroupRefs = [
    useRef<THREE.Group>(null),
    useRef<THREE.Group>(null),
  ];
  const crescentMaterialRefs = [
    useRef<THREE.MeshBasicMaterial>(null),
    useRef<THREE.MeshBasicMaterial>(null),
  ];
  const actingEdgeRefs = [
    useRef<THREE.LineSegments>(null),
    useRef<THREE.LineSegments>(null),
    useRef<THREE.LineSegments>(null),
    useRef<THREE.LineSegments>(null),
    useRef<THREE.LineSegments>(null),
    useRef<THREE.LineSegments>(null),
    useRef<THREE.LineSegments>(null),
    useRef<THREE.LineSegments>(null),
  ];

  const shellMaterialRef = useRef<THREE.ShaderMaterial>(null);
  const nexusMaterialRef = useRef<THREE.ShaderMaterial>(null);
  const circuitMaterialRef = useRef<THREE.ShaderMaterial>(null);
  const nodeMaterialRef = useRef<THREE.ShaderMaterial>(null);
  const audioRayMaterialRef = useRef<THREE.ShaderMaterial>(null);
  const particleMaterialRef = useRef<THREE.ShaderMaterial>(null);
  const haloMaterialRef = useRef<THREE.ShaderMaterial>(null);
  const wireMaterialRef = useRef<THREE.MeshBasicMaterial>(null);
  const nexusFrameMaterialRef = useRef<THREE.MeshBasicMaterial>(null);
  const nexusInnerFrameMaterialRef = useRef<THREE.MeshBasicMaterial>(null);
  const ringMaterialRefs = [
    useRef<THREE.ShaderMaterial>(null),
    useRef<THREE.ShaderMaterial>(null),
  ];
  const actingEdgeMaterialRefs = [
    useRef<THREE.LineBasicMaterial>(null),
    useRef<THREE.LineBasicMaterial>(null),
    useRef<THREE.LineBasicMaterial>(null),
    useRef<THREE.LineBasicMaterial>(null),
    useRef<THREE.LineBasicMaterial>(null),
    useRef<THREE.LineBasicMaterial>(null),
    useRef<THREE.LineBasicMaterial>(null),
    useRef<THREE.LineBasicMaterial>(null),
  ];

  const circuitGeometry = useMemo(() => createCircuitGeometry(156), []);
  const audioRayGeometry = useMemo(() => createAudioRayGeometry(128), []);
  const particleGeometry = useMemo(() => createParticleGeometry(560), []);
  const ringGeometries = useMemo(() => [
    createRingGeometry(1.04),
    createRingGeometry(1.1),
  ], []);
  const mechanicalGeometries = useMemo(() => [
    createMechanicalShellGeometry(1.015, 28, 0x50f11a),
    createMechanicalShellGeometry(1.105, 16, 0x0a2540),
  ], []);
  const crescentGeometries = useMemo(() => CRESCENT_CONFIGS.map((config) => (
    createCrescentRibbonGeometry(config.radius, config.arc, config.width)
  )), []);
  const actingEdgeGeometries = useMemo(() => createActingEdgeGeometries(), []);

  const baseColor = useRef(new THREE.Color('#0A2540'));
  const energyColor = useRef(new THREE.Color('#00D4B3'));
  const accentColor = useRef(new THREE.Color('#FFFFFF'));
  const activityRef = useRef(STATE_CONFIGS.idle.activity);
  const rotationSpeedRef = useRef(STATE_CONFIGS.idle.rotationSpeed);
  const ringSpeedRef = useRef(STATE_CONFIGS.idle.ringSpeed);
  const ringOpacityRef = useRef(STATE_CONFIGS.idle.ringOpacity);
  const circuitOpacityRef = useRef(STATE_CONFIGS.idle.circuitOpacity);
  const signalMixRef = useRef(STATE_CONFIGS.idle.signalMix);
  const particleOpacityRef = useRef(STATE_CONFIGS.idle.particleOpacity);
  const haloEnergyRef = useRef(STATE_CONFIGS.idle.haloEnergy);
  const reactorEnergyRef = useRef(STATE_CONFIGS.idle.reactorEnergy);
  const envelopeRef = useRef(0);
  const transientRef = useRef(0);
  const previousAudioLevelRef = useRef(0);
  const smoothedBandsRef = useRef(new Float32Array(8));
  const lastVisualStateRef = useRef<OrbVisualState>(visualState);
  const statePulseRef = useRef(0);
  const microEventRef = useRef(0);
  const nextMicroEventRef = useRef(1.8);
  const eventSequenceRef = useRef(1);
  const thinkingBlendRef = useRef(0);
  const actingBlendRef = useRef(0);
  const actingMorphRef = useRef<ActingMorphState>({
    current: 0,
    previous: 3,
    next: 1,
    progress: 0,
    duration: 0.72,
    holdRemaining: 0.62,
    sequence: 1,
    weights: new THREE.Vector4(1, 0, 0, 0),
  });
  const hoverBlendRef = useRef(0);

  const shellUniforms = useMemo(() => ({
    uTime: { value: 0 },
    uActivity: { value: STATE_CONFIGS.idle.activity },
    uAudioLevel: { value: 0 },
    uAudioTone: { value: 0.4 },
    uAudioBands: { value: new Float32Array(8) },
    uActingBlend: { value: 0 },
    uShapeWeights: { value: new THREE.Vector4(1, 0, 0, 0) },
    uBaseColor: { value: new THREE.Color('#0A2540') },
    uEnergyColor: { value: new THREE.Color('#00D4B3') },
    uAccentColor: { value: new THREE.Color('#FFFFFF') },
  }), []);
  const reactorUniforms = useMemo(() => ({
    uTime: { value: 0 },
    uEnergy: { value: STATE_CONFIGS.idle.reactorEnergy },
    uEnergyColor: { value: new THREE.Color('#00D4B3') },
    uAccentColor: { value: new THREE.Color('#FFFFFF') },
  }), []);
  const circuitUniforms = useMemo(() => ({
    uTime: { value: 0 },
    uAudioLevel: { value: 0 },
    uAudioBands: { value: new Float32Array(8) },
    uOpacity: { value: STATE_CONFIGS.idle.circuitOpacity },
    uEnergyColor: { value: new THREE.Color('#00D4B3') },
    uAccentColor: { value: new THREE.Color('#FFFFFF') },
  }), []);
  const nodeUniforms = useMemo(() => ({
    uTime: { value: 0 },
    uPixelRatio: { value: 1 },
    uAudioLevel: { value: 0 },
    uAudioBands: { value: new Float32Array(8) },
    uOpacity: { value: STATE_CONFIGS.idle.circuitOpacity },
    uEnergyColor: { value: new THREE.Color('#00D4B3') },
    uAccentColor: { value: new THREE.Color('#FFFFFF') },
  }), []);
  const audioRayUniforms = useMemo(() => ({
    uTime: { value: 0 },
    uSignalMix: { value: STATE_CONFIGS.idle.signalMix },
    uAudioLevel: { value: 0 },
    uTransient: { value: 0 },
    uAudioBands: { value: new Float32Array(8) },
    uOpacity: { value: 0.8 },
    uEnergyColor: { value: new THREE.Color('#00D4B3') },
    uAccentColor: { value: new THREE.Color('#FFFFFF') },
  }), []);
  const particleUniforms = useMemo(() => ({
    uTime: { value: 0 },
    uActivity: { value: STATE_CONFIGS.idle.activity },
    uAudioLevel: { value: 0 },
    uTransient: { value: 0 },
    uPixelRatio: { value: 1 },
    uOpacity: { value: STATE_CONFIGS.idle.particleOpacity },
    uEnergyColor: { value: new THREE.Color('#00D4B3') },
    uAccentColor: { value: new THREE.Color('#FFFFFF') },
  }), []);
  const haloUniforms = useMemo(() => ({
    uTime: { value: 0 },
    uEnergy: { value: STATE_CONFIGS.idle.haloEnergy },
    uOpacity: { value: 1 },
    uEnergyColor: { value: new THREE.Color('#00D4B3') },
  }), []);
  const ringUniforms = useMemo(() => [
    createRingUniforms(),
    createRingUniforms(),
  ], []);

  useFrame((state, unclampedDelta) => {
    const delta = Math.min(unclampedDelta, 0.05);
    const time = state.clock.elapsedTime;
    const target = STATE_CONFIGS[visualState];
    const colorMix = transitionFactor(COLOR_RESPONSE, delta);
    const parameterMix = transitionFactor(PARAMETER_RESPONSE, delta);

    if (lastVisualStateRef.current !== visualState) {
      lastVisualStateRef.current = visualState;
      statePulseRef.current = 1;
      microEventRef.current = Math.max(microEventRef.current, 0.55);
      nextMicroEventRef.current = time + target.eventMinSeconds;
      if (visualState === 'acting') {
        const morph = actingMorphRef.current;
        morph.current = 0;
        morph.previous = 3;
        morph.next = 1;
        morph.progress = 0;
        morph.duration = 0.72;
        morph.holdRemaining = 0.62;
        morph.sequence += 1;
        morph.weights.set(1, 0, 0, 0);
      }
    }

    baseColor.current.lerp(target.base, colorMix);
    energyColor.current.lerp(target.energy, colorMix);
    accentColor.current.lerp(target.accent, colorMix);
    activityRef.current = THREE.MathUtils.lerp(activityRef.current, target.activity, parameterMix);
    rotationSpeedRef.current = THREE.MathUtils.lerp(rotationSpeedRef.current, target.rotationSpeed, parameterMix);
    ringSpeedRef.current = THREE.MathUtils.lerp(ringSpeedRef.current, target.ringSpeed, parameterMix);
    ringOpacityRef.current = THREE.MathUtils.lerp(ringOpacityRef.current, target.ringOpacity, parameterMix);
    circuitOpacityRef.current = THREE.MathUtils.lerp(circuitOpacityRef.current, target.circuitOpacity, parameterMix);
    signalMixRef.current = THREE.MathUtils.lerp(signalMixRef.current, target.signalMix, parameterMix);
    particleOpacityRef.current = THREE.MathUtils.lerp(particleOpacityRef.current, target.particleOpacity, parameterMix);
    haloEnergyRef.current = THREE.MathUtils.lerp(haloEnergyRef.current, target.haloEnergy, parameterMix);
    reactorEnergyRef.current = THREE.MathUtils.lerp(reactorEnergyRef.current, target.reactorEnergy, parameterMix);
    thinkingBlendRef.current = THREE.MathUtils.damp(
      thinkingBlendRef.current,
      visualState === 'thinking' ? 1 : 0,
      visualState === 'thinking' ? 5.5 : 3.2,
      delta,
    );
    actingBlendRef.current = THREE.MathUtils.damp(
      actingBlendRef.current,
      visualState === 'acting' ? 1 : 0,
      4.2,
      delta,
    );

    // Ataque rápido, caída lenta y flujo espectral para que las sílabas generen
    // golpes distintos en vez de una simple escala sinusoidal.
    const rawAudioLevel = THREE.MathUtils.clamp(audio.level.current, 0, 1);
    const envelopeResponse = rawAudioLevel > envelopeRef.current ? 20 : 5.2;
    envelopeRef.current = THREE.MathUtils.damp(envelopeRef.current, rawAudioLevel, envelopeResponse, delta);
    let spectralFlux = 0;
    for (let index = 0; index < 8; index++) {
      const targetBand = THREE.MathUtils.clamp(audio.bands.current[index] ?? 0, 0, 1);
      const currentBand = smoothedBandsRef.current[index];
      spectralFlux += Math.max(0, targetBand - currentBand);
      const bandResponse = targetBand > currentBand ? 23 : 6.5;
      smoothedBandsRef.current[index] = THREE.MathUtils.damp(currentBand, targetBand, bandResponse, delta);
    }
    const onset = THREE.MathUtils.clamp(
      Math.max(0, rawAudioLevel - previousAudioLevelRef.current) * 7 + spectralFlux * 0.62,
      0,
      1,
    );
    const transientResponse = onset > transientRef.current ? 28 : 7;
    transientRef.current = THREE.MathUtils.damp(transientRef.current, onset, transientResponse, delta);
    previousAudioLevelRef.current = rawAudioLevel;

    statePulseRef.current = Math.max(0, statePulseRef.current - delta * 1.7);
    microEventRef.current = Math.max(0, microEventRef.current - delta * (0.58 + microEventRef.current * 0.35));
    if (time >= nextMicroEventRef.current) {
      const random = pseudoRandom(eventSequenceRef.current + time * 0.037);
      eventSequenceRef.current += 1;
      microEventRef.current = 0.55 + random * 0.45;
      nextMicroEventRef.current = time + target.eventMinSeconds + random * target.eventRangeSeconds;
    }

    const syntheticEvent = microEventRef.current * target.syntheticBurst;
    const visualTransient = Math.max(transientRef.current, syntheticEvent, statePulseRef.current * 0.38);
    const audioEnvelope = envelopeRef.current;
    const pixelRatio = Math.min(state.gl.getPixelRatio(), 1.5);
    const bands = smoothedBandsRef.current;
    const actingBlend = smootherStep(actingBlendRef.current);
    const actingMorph = actingMorphRef.current;

    if (visualState === 'acting') {
      if (actingMorph.holdRemaining > 0) {
        actingMorph.holdRemaining = Math.max(0, actingMorph.holdRemaining - delta);
      } else {
        actingMorph.progress = Math.min(1, actingMorph.progress + delta / actingMorph.duration);
        const easedProgress = smootherStep(actingMorph.progress);
        actingMorph.weights.set(0, 0, 0, 0);
        actingMorph.weights.setComponent(actingMorph.current, 1 - easedProgress);
        actingMorph.weights.setComponent(actingMorph.next, easedProgress);

        if (actingMorph.progress >= 1) {
          actingMorph.previous = actingMorph.current;
          actingMorph.current = actingMorph.next;
          actingMorph.sequence += 1;
          const random = pseudoRandom(actingMorph.sequence * 1.731 + time * 0.019);
          actingMorph.next = chooseNextActingShape(
            actingMorph.current,
            actingMorph.previous,
            random,
          );
          actingMorph.progress = 0;
          actingMorph.duration = 0.58 + random * 0.42;
          actingMorph.holdRemaining = 0.28
            + pseudoRandom(actingMorph.sequence * 2.417) * 0.54;
          actingMorph.weights.set(0, 0, 0, 0);
          actingMorph.weights.setComponent(actingMorph.current, 1);
        }
      }
    }
    const sphericalLayerOpacity = 1 - actingBlend;

    const shell = shellMaterialRef.current;
    if (shell) {
      shell.uniforms.uTime.value = time;
      shell.uniforms.uActivity.value = activityRef.current;
      shell.uniforms.uAudioLevel.value = audioEnvelope;
      shell.uniforms.uAudioTone.value = audio.tone.current;
      (shell.uniforms.uAudioBands.value as Float32Array).set(bands);
      shell.uniforms.uActingBlend.value = actingBlend;
      (shell.uniforms.uShapeWeights.value as THREE.Vector4).copy(actingMorph.weights);
      shell.uniforms.uBaseColor.value.copy(baseColor.current);
      shell.uniforms.uEnergyColor.value.copy(energyColor.current);
      shell.uniforms.uAccentColor.value.copy(accentColor.current);
    }

    const nexus = nexusMaterialRef.current;
    if (nexus) {
      nexus.uniforms.uTime.value = time;
      nexus.uniforms.uEnergy.value = reactorEnergyRef.current + audioEnvelope * 0.35 + visualTransient * 0.2;
      nexus.uniforms.uEnergyColor.value.copy(energyColor.current);
      nexus.uniforms.uAccentColor.value.copy(accentColor.current);
    }

    const circuit = circuitMaterialRef.current;
    if (circuit) {
      circuit.uniforms.uTime.value = time * (0.8 + activityRef.current * 0.5);
      circuit.uniforms.uAudioLevel.value = audioEnvelope;
      (circuit.uniforms.uAudioBands.value as Float32Array).set(bands);
      circuit.uniforms.uOpacity.value = circuitOpacityRef.current * sphericalLayerOpacity;
      circuit.uniforms.uEnergyColor.value.copy(energyColor.current);
      circuit.uniforms.uAccentColor.value.copy(accentColor.current);
    }

    const nodes = nodeMaterialRef.current;
    if (nodes) {
      nodes.uniforms.uTime.value = time;
      nodes.uniforms.uPixelRatio.value = pixelRatio;
      nodes.uniforms.uAudioLevel.value = audioEnvelope;
      (nodes.uniforms.uAudioBands.value as Float32Array).set(bands);
      nodes.uniforms.uOpacity.value = circuitOpacityRef.current * sphericalLayerOpacity;
      nodes.uniforms.uEnergyColor.value.copy(energyColor.current);
      nodes.uniforms.uAccentColor.value.copy(accentColor.current);
    }

    const audioRays = audioRayMaterialRef.current;
    if (audioRays) {
      audioRays.uniforms.uTime.value = time;
      audioRays.uniforms.uSignalMix.value = signalMixRef.current;
      audioRays.uniforms.uAudioLevel.value = audioEnvelope;
      // Solo transientes reales controlan el ecualizador en listening/speaking.
      audioRays.uniforms.uTransient.value = transientRef.current;
      (audioRays.uniforms.uAudioBands.value as Float32Array).set(bands);
      audioRays.uniforms.uOpacity.value = (0.62 + signalMixRef.current * 0.28)
        * sphericalLayerOpacity;
      audioRays.uniforms.uEnergyColor.value.copy(energyColor.current);
      audioRays.uniforms.uAccentColor.value.copy(accentColor.current);
    }

    const particles = particleMaterialRef.current;
    if (particles) {
      particles.uniforms.uTime.value = time;
      particles.uniforms.uActivity.value = activityRef.current;
      particles.uniforms.uAudioLevel.value = audioEnvelope;
      particles.uniforms.uTransient.value = visualTransient;
      particles.uniforms.uPixelRatio.value = pixelRatio;
      particles.uniforms.uOpacity.value = particleOpacityRef.current * (1 - actingBlend * 0.34);
      particles.uniforms.uEnergyColor.value.copy(energyColor.current);
      particles.uniforms.uAccentColor.value.copy(accentColor.current);
    }

    for (let index = 0; index < ringMaterialRefs.length; index++) {
      const material = ringMaterialRefs[index].current;
      if (!material) continue;
      material.uniforms.uTime.value = time;
      material.uniforms.uSpeed.value = ringSpeedRef.current * RING_SPEED_FACTORS[index];
      material.uniforms.uAudioLevel.value = audioEnvelope;
      material.uniforms.uTransient.value = visualTransient;
      material.uniforms.uOpacity.value = ringOpacityRef.current
        * (1 - index * 0.08)
        * sphericalLayerOpacity;
      material.uniforms.uEnergyColor.value.copy(energyColor.current);
      material.uniforms.uAccentColor.value.copy(accentColor.current);
    }

    for (let index = 0; index < mechanicalLayerRefs.length; index++) {
      const layer = mechanicalLayerRefs[index].current;
      const material = mechanicalMaterialRefs[index].current;
      if (!layer || !material) continue;
      const direction = index % 2 === 0 ? 1 : -1;
      const mechanicalSpeed = (0.055 + index * 0.035 + activityRef.current * 0.045)
        * (1 + actingBlend * (1.8 + index * 0.45));
      layer.rotation.y += mechanicalSpeed * direction * delta;
      layer.rotation.x += mechanicalSpeed * 0.38 * (index === 1 ? -1 : 1) * delta;
      layer.rotation.z += mechanicalSpeed * 0.17 * direction * delta;
      const assemblyPulse = visualState === 'acting'
        ? 0.72 + Math.sin(time * (2.1 + index * 0.37)) * 0.18
        : 0.48;
      material.color.copy(energyColor.current).lerp(accentColor.current, 0.08 + index * 0.11);
      material.opacity = THREE.MathUtils.clamp(
        (0.13 + activityRef.current * 0.12 + audioEnvelope * 0.1)
          * assemblyPulse
          * (1 - index * 0.13),
        0.035,
        0.36,
      );
      const layerScale = 1 + actingBlend * Math.sin(time * 1.7 + index * 2.1) * 0.025;
      layer.scale.setScalar(THREE.MathUtils.damp(layer.scale.x, layerScale, 8, delta));
    }

    for (let index = 0; index < crescentGroupRefs.length; index++) {
      const crescent = crescentGroupRefs[index].current;
      const material = crescentMaterialRefs[index].current;
      if (!crescent || !material) continue;
      const direction = index % 2 === 0 ? 1 : -1;
      const speed = (0.035 + index * 0.012 + activityRef.current * 0.018)
        * (1 + actingBlend * 1.5);
      crescent.rotation.z += speed * direction * delta;
      crescent.rotation.y += speed * 0.32 * (index % 3 === 0 ? -1 : 1) * delta;
      material.color.copy(energyColor.current).lerp(
        accentColor.current,
        index === 1 || index === 4 ? 0.46 : 0.12,
      );
      material.opacity = THREE.MathUtils.clamp(
        0.14 + activityRef.current * 0.13 + audioEnvelope * 0.08 + visualTransient * 0.05,
        0.15,
        0.36,
      ) * (1 - index * 0.055);
    }

    const halo = haloMaterialRef.current;
    if (halo) {
      halo.uniforms.uTime.value = time;
      halo.uniforms.uEnergy.value = haloEnergyRef.current + audioEnvelope * 0.34 + visualTransient * 0.16;
      halo.uniforms.uOpacity.value = 1 - actingBlend;
      halo.uniforms.uEnergyColor.value.copy(energyColor.current);
    }

    if (wireMaterialRef.current) {
      wireMaterialRef.current.color.copy(energyColor.current);
      wireMaterialRef.current.opacity = (0.11 + activityRef.current * 0.15 + audioEnvelope * 0.07)
        * sphericalLayerOpacity;
    }
    if (nexusFrameMaterialRef.current) {
      nexusFrameMaterialRef.current.color.copy(accentColor.current);
      nexusFrameMaterialRef.current.opacity = 0.36 + reactorEnergyRef.current * 0.38;
    }
    if (nexusInnerFrameMaterialRef.current) {
      nexusInnerFrameMaterialRef.current.color.copy(energyColor.current);
      nexusInnerFrameMaterialRef.current.opacity = 0.3 + reactorEnergyRef.current * 0.36;
    }

    for (let index = 0; index < actingEdgeMaterialRefs.length; index++) {
      const material = actingEdgeMaterialRefs[index].current;
      const edge = actingEdgeRefs[index].current;
      if (!material || !edge) continue;
      const shapeCycle = (time / 1.08) % actingEdgeMaterialRefs.length;
      const angularDistance = Math.cos(
        ((index - shapeCycle) / actingEdgeMaterialRefs.length) * Math.PI * 2,
      );
      const assemblyWeight = Math.pow(Math.max(0, angularDistance), 12);
      const morphWeight = index < ACTING_SHAPE_COUNT
        ? actingMorph.weights.getComponent(index)
        : 0;
      const weight = Math.max(morphWeight * 0.32, assemblyWeight, 0.035);
      const packet = Math.pow(
        0.5 + 0.5 * Math.sin(time * (2.3 + index * 0.17) + index * 1.73),
        7,
      );
      const opacity = actingBlend * Math.pow(weight, 0.72)
        * (0.62 + packet * 0.28 + visualTransient * 0.12);
      material.color.copy(index % 3 === 0 ? ACTING_DATA_COLOR : energyColor.current).lerp(
        index % 2 === 0 ? accentColor.current : energyColor.current,
        0.3 + packet * 0.38,
      );
      material.opacity = THREE.MathUtils.clamp(opacity, 0, 0.96);
      edge.visible = opacity > 0.004;
      const edgePulse = 0.72 + weight * 0.38 + packet * 0.025 + microEventRef.current * 0.008;
      edge.scale.setScalar(THREE.MathUtils.damp(edge.scale.x, edgePulse, 11, delta));
      edge.rotation.x += delta * (0.16 + index * 0.025) * (index % 2 === 0 ? 1 : -1);
      edge.rotation.y += delta * (0.24 + index * 0.032) * (index % 3 === 0 ? -1 : 1);
      edge.rotation.z += delta * (0.1 + index * 0.018) * (index % 2 === 0 ? -1 : 1);
    }

    hoverBlendRef.current = THREE.MathUtils.damp(
      hoverBlendRef.current,
      interaction.dragging.current ? 1 : 0,
      interaction.dragging.current ? 10 : 5,
      delta,
    );

    if (interactionGroupRef.current) {
      const group = interactionGroupRef.current;
      if (!interaction.dragging.current) {
        interaction.rotation.current.x = THREE.MathUtils.clamp(
          interaction.rotation.current.x + interaction.velocity.current.x * delta,
          -1.35,
          1.35,
        );
        interaction.rotation.current.y += interaction.velocity.current.y * delta;
        const inertia = Math.exp(-3.4 * delta);
        interaction.velocity.current.x *= inertia;
        interaction.velocity.current.y *= inertia;
      }
      group.rotation.x = THREE.MathUtils.damp(group.rotation.x, interaction.rotation.current.x, 18, delta);
      group.rotation.y = THREE.MathUtils.damp(group.rotation.y, interaction.rotation.current.y, 18, delta);
      group.rotation.z = THREE.MathUtils.damp(group.rotation.z, 0, 8, delta);
    }

    if (rootRef.current) {
      const voiceScale = visualState === 'speaking'
        ? audioEnvelope * 0.09
        : visualState === 'listening' ? audioEnvelope * 0.035 : 0;
      const targetScale = 1 + voiceScale + statePulseRef.current * 0.025 + hoverBlendRef.current * 0.012;
      const nextScale = THREE.MathUtils.damp(rootRef.current.scale.x, targetScale, 10, delta);
      rootRef.current.scale.setScalar(nextScale);
      rootRef.current.position.y = Math.sin(time * 0.229) * 0.012 + Math.sin(time * 0.137) * 0.007;
    }

    if (structureRef.current) {
      const thinkingModulation = 1
        + thinkingBlendRef.current * (Math.sin(time * 0.71) * 0.08 + Math.sin(time * 1.37) * 0.05)
        + microEventRef.current * thinkingBlendRef.current * 0.055;
      const rotationSpeed = rotationSpeedRef.current
        * (1 + visualTransient * 0.35)
        * thinkingModulation;
      const actingRotation = actingBlend
        * (0.2 + Math.sin(time * 0.83 + actingMorph.sequence) * 0.075);
      structureRef.current.rotation.y += (rotationSpeed + actingRotation) * delta;
      structureRef.current.rotation.x = Math.sin(time * 0.193) * 0.095
        + Math.sin(time * 0.113) * 0.035
        + thinkingBlendRef.current * Math.sin(time * 0.91) * 0.11
        + actingBlend * Math.sin(time * 0.67 + actingMorph.sequence * 0.31) * 0.19;
      structureRef.current.rotation.z = Math.sin(time * 0.157) * 0.055
        + thinkingBlendRef.current * Math.sin(time * 0.53) * 0.045
        + actingBlend * Math.sin(time * 0.47 + 1.2) * 0.14;
    }

    if (cageRef.current) {
      const counterSpeed = (0.045 + thinkingBlendRef.current * 1.32)
        * (1 + Math.sin(time * 0.83) * 0.045);
      cageRef.current.rotation.y -= counterSpeed * delta;
      cageRef.current.rotation.x = Math.sin(time * 0.31) * 0.035
        + thinkingBlendRef.current * Math.sin(time * 0.79) * 0.13;
      cageRef.current.rotation.z = Math.sin(time * 0.23) * 0.025;
    }

    if (nexusRef.current) {
      const normalReactorSpeed = 0.13 + ringSpeedRef.current * 0.18;
      const reactorSpeed = THREE.MathUtils.lerp(normalReactorSpeed, -1.45, thinkingBlendRef.current);
      nexusRef.current.rotation.z += reactorSpeed * delta;
      nexusRef.current.rotation.x += (0.07 + thinkingBlendRef.current * 0.34) * delta;
      nexusRef.current.rotation.y -= (0.045 + thinkingBlendRef.current * 0.52) * delta;
      const nexusPresence = 1 - actingBlend * 0.94;
      const reactorScale = (1 + audioEnvelope * 0.11 + visualTransient * 0.045)
        * Math.max(0.045, nexusPresence);
      nexusRef.current.scale.setScalar(THREE.MathUtils.damp(nexusRef.current.scale.x, reactorScale, 12, delta));
      nexusRef.current.position.z = THREE.MathUtils.damp(
        nexusRef.current.position.z,
        0,
        7,
        delta,
      );
    }

    const ringRotationAxes: Array<['x' | 'y' | 'z', 'x' | 'y' | 'z']> = [
      ['z', 'x'],
      ['x', 'y'],
      ['y', 'z'],
      ['z', 'y'],
    ];
    for (let index = 0; index < ringGroupRefs.length; index++) {
      const group = ringGroupRefs[index].current;
      if (!group) continue;
      const [primaryAxis, secondaryAxis] = ringRotationAxes[index];
      group.rotation[primaryAxis] += ringSpeedRef.current * RING_SPEED_FACTORS[index] * delta;
      group.rotation[secondaryAxis] += ringSpeedRef.current * (0.11 + index * 0.035) * delta;
      const ringScale = 1 - actingBlend * (0.18 + index * 0.035);
      group.scale.setScalar(THREE.MathUtils.damp(group.scale.x, ringScale, 6, delta));
    }

    if (haloMeshRef.current) {
      const haloScale = 1.29 + audioEnvelope * 0.045 + visualTransient * 0.025;
      haloMeshRef.current.scale.setScalar(THREE.MathUtils.damp(haloMeshRef.current.scale.x, haloScale, 7, delta));
    }
  });

  return (
    <group ref={rootRef}>
      <group ref={interactionGroupRef}>
      {/* Cuerpo sólido: la pieza que evita el aspecto lavado/transparente. */}
      <group ref={structureRef}>
        <mesh>
          <sphereGeometry args={[0.88, 64, 48]} />
          <shaderMaterial
            ref={shellMaterialRef}
            vertexShader={SHELL_VERTEX_SHADER}
            fragmentShader={SHELL_FRAGMENT_SHADER}
            uniforms={shellUniforms}
            depthWrite={false}
            depthTest
            transparent
          />
        </mesh>

        {/* Aristas de la forma activa: triángulo, hexágono, octaedro o cubo. */}
        {actingEdgeGeometries.map((geometry, index) => (
          <lineSegments
            key={`acting-shape-${index}`}
            ref={actingEdgeRefs[index]}
            geometry={geometry}
            visible={false}
            renderOrder={3}
          >
            <lineBasicMaterial
              ref={actingEdgeMaterialRefs[index]}
              color="#F59E0B"
              transparent
              opacity={0}
              depthWrite={false}
              depthTest
              blending={THREE.AdditiveBlending}
              toneMapped={false}
            />
          </lineSegments>
        ))}

        {/* Jaula técnica independiente: contra-rota con claridad al pensar. */}
        <group ref={cageRef}>
          {/* Placas trianguladas mecánicas sobre el cuerpo oscuro. */}
          <mesh>
          <icosahedronGeometry args={[0.93, 5]} />
          <meshBasicMaterial
            ref={wireMaterialRef}
            color="#00D4B3"
            wireframe
            transparent
            opacity={0.22}
            depthWrite={false}
            depthTest
            blending={THREE.AdditiveBlending}
            toneMapped={false}
          />
          </mesh>

        {/* Cientos de pistas cortas y nodos, distribuidos en profundidad. */}
          <lineSegments geometry={circuitGeometry.lines}>
          <shaderMaterial
            ref={circuitMaterialRef}
            vertexShader={CIRCUIT_VERTEX_SHADER}
            fragmentShader={CIRCUIT_FRAGMENT_SHADER}
            uniforms={circuitUniforms}
            transparent
            depthWrite={false}
            depthTest
            blending={THREE.AdditiveBlending}
            toneMapped={false}
          />
          </lineSegments>
          <points geometry={circuitGeometry.nodes}>
          <shaderMaterial
            ref={nodeMaterialRef}
            vertexShader={NODE_VERTEX_SHADER}
            fragmentShader={NODE_FRAGMENT_SHADER}
            uniforms={nodeUniforms}
            transparent
            depthWrite={false}
            depthTest
            blending={THREE.AdditiveBlending}
            toneMapped={false}
          />
          </points>

        {/* Ecualizador esférico: 96 radios alimentados por las 8 bandas reales. */}
          <lineSegments geometry={audioRayGeometry}>
          <shaderMaterial
            ref={audioRayMaterialRef}
            vertexShader={AUDIO_RAY_VERTEX_SHADER}
            fragmentShader={AUDIO_RAY_FRAGMENT_SHADER}
            uniforms={audioRayUniforms}
            transparent
            depthWrite={false}
            depthTest
            blending={THREE.AdditiveBlending}
            toneMapped={false}
          />
          </lineSegments>
        </group>
      </group>

      {/* Nexo geométrico facetado: sin iris, pupila ni círculos concéntricos. */}
      <group ref={nexusRef} position={[0, 0, 0]} rotation={[0.28, -0.36, 0.18]}>
        <mesh rotation={[Math.PI / 5, Math.PI / 4, -Math.PI / 8]} scale={[0.3, 0.37, 0.24]}>
          <octahedronGeometry args={[1, 0]} />
          <shaderMaterial
            ref={nexusMaterialRef}
            vertexShader={REACTOR_VERTEX_SHADER}
            fragmentShader={REACTOR_FRAGMENT_SHADER}
            uniforms={reactorUniforms}
            transparent
            depthWrite={false}
            depthTest
            blending={THREE.NormalBlending}
          />
        </mesh>
        <mesh rotation={[0.62, 0.31, 0.78]} scale={[1, 0.86, 0.72]}>
          <octahedronGeometry args={[0.46, 0]} />
          <meshBasicMaterial
            ref={nexusFrameMaterialRef}
            color="#FFFFFF"
            wireframe
            transparent
            opacity={0.55}
            depthWrite={false}
            depthTest
            blending={THREE.AdditiveBlending}
            toneMapped={false}
          />
        </mesh>
        <mesh rotation={[-0.45, 0.72, -0.38]} scale={[1, 0.82, 1.08]}>
          <tetrahedronGeometry args={[0.36, 0]} />
          <meshBasicMaterial
            ref={nexusInnerFrameMaterialRef}
            color="#00D4B3"
            wireframe
            transparent
            opacity={0.48}
            depthWrite={false}
            depthTest
            blending={THREE.AdditiveBlending}
            toneMapped={false}
          />
        </mesh>
      </group>

      <points geometry={particleGeometry}>
        <shaderMaterial
          ref={particleMaterialRef}
          vertexShader={PARTICLE_VERTEX_SHADER}
          fragmentShader={PARTICLE_FRAGMENT_SHADER}
          uniforms={particleUniforms}
          transparent
          depthWrite={false}
          depthTest
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </points>

      <group ref={ringGroupRefs[0]} rotation={[0.38, 0.18, 0.1]}>
        <lineLoop geometry={ringGeometries[0]}>
          <shaderMaterial
            ref={ringMaterialRefs[0]}
            vertexShader={RING_VERTEX_SHADER}
            fragmentShader={RING_FRAGMENT_SHADER}
            uniforms={ringUniforms[0]}
            transparent
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            toneMapped={false}
          />
        </lineLoop>
      </group>
      <group ref={ringGroupRefs[1]} rotation={[1.17, 0.73, 0.24]}>
        <lineLoop geometry={ringGeometries[1]}>
          <shaderMaterial
            ref={ringMaterialRefs[1]}
            vertexShader={RING_VERTEX_SHADER}
            fragmentShader={RING_FRAGMENT_SHADER}
            uniforms={ringUniforms[1]}
            transparent
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            toneMapped={false}
          />
        </lineLoop>
      </group>
      {/* Medias lunas estructurales: piezas grandes de la orbe principal. */}
      {CRESCENT_CONFIGS.map((config, index) => (
        <group
          key={`structural-crescent-${index}`}
          ref={crescentGroupRefs[index]}
          rotation={[...config.rotation]}
        >
          <mesh geometry={crescentGeometries[index]} renderOrder={6 + index}>
            <meshBasicMaterial
              ref={crescentMaterialRefs[index]}
              color="#00D4B3"
              transparent
              opacity={0.24}
              depthWrite={false}
              depthTest
              side={THREE.DoubleSide}
              blending={THREE.AdditiveBlending}
              toneMapped={false}
            />
          </mesh>
        </group>
      ))}

      {/* Carcasa mecánica: arcos incompletos y conectores en capas independientes. */}
      {mechanicalGeometries.map((geometry, index) => (
        <group
          key={`mechanical-shell-${index}`}
          ref={mechanicalLayerRefs[index]}
          rotation={[
            0.24 + index * 0.51,
            -0.38 + index * 0.43,
            0.16 - index * 0.37,
          ]}
        >
          <lineSegments geometry={geometry} renderOrder={2 + index}>
            <lineBasicMaterial
              ref={mechanicalMaterialRefs[index]}
              color="#00D4B3"
              transparent
              opacity={0.16}
              depthWrite={false}
              depthTest
              blending={THREE.AdditiveBlending}
              toneMapped={false}
            />
          </lineSegments>
        </group>
      ))}
      </group>

      {/* Halo acotado: termina antes del borde del canvas y nunca forma un cuadro. */}
      <mesh ref={haloMeshRef} scale={1.29} renderOrder={-1}>
        <sphereGeometry args={[1, 32, 24]} />
        <shaderMaterial
          ref={haloMaterialRef}
          vertexShader={HALO_VERTEX_SHADER}
          fragmentShader={HALO_FRAGMENT_SHADER}
          uniforms={haloUniforms}
          transparent
          depthWrite={false}
          depthTest={false}
          side={THREE.BackSide}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}
