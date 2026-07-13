import * as THREE from 'three';

const TAU = Math.PI * 2;

/** PRNG determinista: la orbe conserva su identidad entre montajes. */
function mulberry32(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let next = value;
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

function randomDirection(random: () => number): THREE.Vector3 {
  const y = random() * 2 - 1;
  const azimuth = random() * TAU;
  const radius = Math.sqrt(Math.max(0, 1 - y * y));
  return new THREE.Vector3(
    radius * Math.cos(azimuth),
    y,
    radius * Math.sin(azimuth),
  );
}

function greatCircleBasis(random: () => number): [THREE.Vector3, THREE.Vector3] {
  const normal = randomDirection(random);
  const helper = Math.abs(normal.y) > 0.82
    ? new THREE.Vector3(1, 0, 0)
    : new THREE.Vector3(0, 1, 0);
  const first = new THREE.Vector3().crossVectors(normal, helper).normalize();
  const second = new THREE.Vector3().crossVectors(normal, first).normalize();
  return [first, second];
}

function pointOnCircle(
  first: THREE.Vector3,
  second: THREE.Vector3,
  angle: number,
  radius: number,
): THREE.Vector3 {
  return new THREE.Vector3()
    .addScaledVector(first, Math.cos(angle) * radius)
    .addScaledVector(second, Math.sin(angle) * radius);
}

export interface CircuitGeometrySet {
  lines: THREE.BufferGeometry;
  nodes: THREE.BufferGeometry;
}

/**
 * Crea trazas cortas sobre múltiples círculos máximos. El resultado recuerda
 * placas, pistas y arcos mecánicos sin depender de modelos 3D externos.
 */
export function createCircuitGeometry(pathCount = 112): CircuitGeometrySet {
  const random = mulberry32(0x50f11a);
  const linePositions: number[] = [];
  const linePhases: number[] = [];
  const lineStrengths: number[] = [];
  const lineBands: number[] = [];
  const nodePositions: number[] = [];
  const nodePhases: number[] = [];
  const nodeStrengths: number[] = [];
  const nodeBands: number[] = [];

  for (let path = 0; path < pathCount; path++) {
    const [first, second] = greatCircleBasis(random);
    const start = random() * TAU;
    const arcLength = 0.08 + random() * (path % 7 === 0 ? 1.05 : 0.52);
    const segments = 2 + Math.floor(random() * 6);
    const radius = 0.965 + random() * 0.035;
    const phase = random();
    const strength = 0.35 + random() * 0.65;
    const band = path % 8;
    let firstPoint: THREE.Vector3 | null = null;
    let lastPoint: THREE.Vector3 | null = null;

    for (let segment = 0; segment < segments; segment++) {
      const progressA = segment / segments;
      const progressB = (segment + 1) / segments;
      // Pequeños cortes irregulares evitan que las rutas parezcan círculos SVG.
      if (segments > 3 && segment === 1 && random() > 0.58) continue;
      const pointA = pointOnCircle(first, second, start + arcLength * progressA, radius);
      const pointB = pointOnCircle(first, second, start + arcLength * progressB, radius);
      firstPoint ??= pointA;
      lastPoint = pointB;
      linePositions.push(...pointA.toArray(), ...pointB.toArray());
      linePhases.push(phase, phase);
      lineStrengths.push(strength, strength);
      lineBands.push(band, band);
    }

    if (firstPoint && lastPoint) {
      for (const point of [firstPoint, lastPoint]) {
        nodePositions.push(...point.clone().multiplyScalar(1.008).toArray());
        nodePhases.push(phase);
        nodeStrengths.push(strength);
        nodeBands.push(band);
      }
    }

    // Un conector radial corto por cada cinco rutas añade profundidad mecánica.
    if (path % 5 === 0 && lastPoint) {
      const inner = lastPoint.clone().multiplyScalar(0.91);
      const outer = lastPoint.clone().multiplyScalar(1.065);
      linePositions.push(...inner.toArray(), ...outer.toArray());
      linePhases.push(phase, phase);
      lineStrengths.push(strength * 0.9, strength * 0.9);
      lineBands.push(band, band);
    }
  }

  const lines = new THREE.BufferGeometry();
  lines.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3));
  lines.setAttribute('aPhase', new THREE.Float32BufferAttribute(linePhases, 1));
  lines.setAttribute('aStrength', new THREE.Float32BufferAttribute(lineStrengths, 1));
  lines.setAttribute('aBand', new THREE.Float32BufferAttribute(lineBands, 1));

  const nodes = new THREE.BufferGeometry();
  nodes.setAttribute('position', new THREE.Float32BufferAttribute(nodePositions, 3));
  nodes.setAttribute('aPhase', new THREE.Float32BufferAttribute(nodePhases, 1));
  nodes.setAttribute('aStrength', new THREE.Float32BufferAttribute(nodeStrengths, 1));
  nodes.setAttribute('aBand', new THREE.Float32BufferAttribute(nodeBands, 1));
  return { lines, nodes };
}

/** 96 indicadores radiales agrupados en ocho bandas, como un ecualizador 3D. */
export function createAudioRayGeometry(rayCount = 96): THREE.BufferGeometry {
  const positions: number[] = [];
  const bands: number[] = [];
  const tips: number[] = [];
  const phases: number[] = [];
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));

  for (let index = 0; index < rayCount; index++) {
    const y = 1 - (index / (rayCount - 1)) * 2;
    const radial = Math.sqrt(Math.max(0, 1 - y * y));
    const angle = goldenAngle * index;
    const direction = new THREE.Vector3(
      Math.cos(angle) * radial,
      y,
      Math.sin(angle) * radial,
    );
    const base = direction.clone().multiplyScalar(0.985);
    const tip = direction.clone().multiplyScalar(1.045);
    const band = index % 8;
    const phase = (index * 0.61803398875) % 1;
    positions.push(...base.toArray(), ...tip.toArray());
    bands.push(band, band);
    tips.push(0, 1);
    phases.push(phase, phase);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('aBand', new THREE.Float32BufferAttribute(bands, 1));
  geometry.setAttribute('aTip', new THREE.Float32BufferAttribute(tips, 1));
  geometry.setAttribute('aPhase', new THREE.Float32BufferAttribute(phases, 1));
  return geometry;
}

export function createParticleGeometry(particleCount = 420): THREE.BufferGeometry {
  const random = mulberry32(0x1a2b3c4d);
  const positions = new Float32Array(particleCount * 3);
  const phases = new Float32Array(particleCount);
  const speeds = new Float32Array(particleCount);
  const sizes = new Float32Array(particleCount);

  for (let index = 0; index < particleCount; index++) {
    const direction = randomDirection(random);
    const radius = 1.04 + Math.pow(random(), 1.8) * 0.46;
    direction.multiplyScalar(radius).toArray(positions, index * 3);
    phases[index] = random();
    speeds[index] = 0.35 + random() * 0.95;
    sizes[index] = 0.55 + random() * 1.25;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
  geometry.setAttribute('aSpeed', new THREE.BufferAttribute(speeds, 1));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  return geometry;
}

export function createRingGeometry(radius: number, segments = 256): THREE.BufferGeometry {
  const positions = new Float32Array(segments * 3);
  const arcLengths = new Float32Array(segments);
  for (let index = 0; index < segments; index++) {
    const angle = (index / segments) * TAU;
    positions[index * 3] = Math.cos(angle) * radius;
    positions[index * 3 + 1] = 0;
    positions[index * 3 + 2] = Math.sin(angle) * radius;
    arcLengths[index] = index / segments;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aArcLength', new THREE.BufferAttribute(arcLengths, 1));
  return geometry;
}

/**
 * Carcasa mecánica fragmentada inspirada en interfaces holográficas: combina
 * arcos incompletos, pequeños puentes radiales y marcas técnicas. Cada capa
 * usa una semilla distinta para evitar una esfera uniforme de alambre.
 */
export function createMechanicalShellGeometry(
  radius: number,
  bandCount: number,
  seed: number,
): THREE.BufferGeometry {
  const random = mulberry32(seed);
  const positions: number[] = [];
  const addSegment = (from: THREE.Vector3, to: THREE.Vector3) => {
    positions.push(...from.toArray(), ...to.toArray());
  };

  for (let band = 0; band < bandCount; band++) {
    const [first, second] = greatCircleBasis(random);
    const start = random() * TAU;
    const span = 0.28 + random() * 1.55;
    const segments = 5 + Math.floor(random() * 13);
    const layerRadius = radius * (0.96 + random() * 0.08);
    let previous: THREE.Vector3 | null = null;

    for (let segment = 0; segment <= segments; segment++) {
      const progress = segment / segments;
      const point = pointOnCircle(first, second, start + span * progress, layerRadius);
      if (previous && !(segment % 5 === 2 && random() > 0.42)) addSegment(previous, point);
      previous = point;

      if (segment > 0 && segment < segments && segment % 3 === 0) {
        const inner = point.clone().multiplyScalar(0.91 - random() * 0.055);
        const outer = point.clone().multiplyScalar(1.035 + random() * 0.055);
        addSegment(inner, outer);
        if (band % 4 === 0) {
          const tangent = new THREE.Vector3().crossVectors(point, first).normalize();
          addSegment(outer, outer.clone().addScaledVector(tangent, radius * (0.035 + random() * 0.055)));
        }
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  return geometry;
}

/** Segmento de carcasa plano con extremos afinados, menos uniforme que un toro. */
export function createCrescentRibbonGeometry(
  radius: number,
  arc: number,
  width: number,
  segments = 72,
): THREE.BufferGeometry {
  const positions: number[] = [];
  const indices: number[] = [];

  for (let segment = 0; segment <= segments; segment++) {
    const progress = segment / segments;
    const angle = progress * arc;
    const taper = Math.pow(Math.sin(progress * Math.PI), 0.72);
    const halfWidth = width * taper * 0.5;
    for (const offset of [-halfWidth, halfWidth]) {
      const currentRadius = radius + offset;
      positions.push(
        Math.cos(angle) * currentRadius,
        Math.sin(angle) * currentRadius,
        Math.sin(progress * Math.PI) * width * 0.16,
      );
    }
    if (segment < segments) {
      const base = segment * 2;
      indices.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}
