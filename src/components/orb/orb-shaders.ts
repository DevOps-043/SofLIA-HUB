// Shaders de la Orbe Pulse. La composición mantiene un cuerpo oscuro sólido y
// reserva el blending aditivo para pistas, nodos y halo: así conserva detalle
// sobre escritorios claros sin quemar el centro a blanco.

const AUDIO_BAND_READER = /* glsl */ `
float readAudioBand(float bandIndex) {
  float value = 0.0;
  for (int i = 0; i < 8; i++) {
    float matchBand = 1.0 - step(0.45, abs(float(i) - bandIndex));
    value += uAudioBands[i] * matchBand;
  }
  return value;
}
`;

export const SHELL_VERTEX_SHADER = /* glsl */ `
uniform float uTime;
uniform float uActivity;
uniform float uAudioLevel;
uniform float uAudioTone;
uniform float uAudioBands[8];
uniform float uActingBlend;
uniform vec4 uShapeWeights;

varying vec3 vNormalView;
varying vec3 vViewDirection;
varying vec3 vViewPosition;
varying vec3 vObjectPosition;
varying float vBandEnergy;
varying float vSurfaceMotion;

${AUDIO_BAND_READER}

const float PI = 3.14159265359;
const float TWO_PI = 6.28318530718;

vec3 projectToPrism(
  vec3 direction,
  float sides,
  float circumradius,
  float halfDepth,
  float angleOffset
) {
  float sector = TWO_PI / sides;
  float angle = atan(direction.y, direction.x) + angleOffset;
  float localAngle = mod(angle + sector * 0.5, sector) - sector * 0.5;
  float inradius = circumradius * cos(PI / sides);
  float polygonRadius = inradius / max(cos(localAngle), 0.001);
  float sideHit = polygonRadius / max(length(direction.xy), 0.001);
  float capHit = halfDepth / max(abs(direction.z), 0.001);
  return direction * min(sideHit, capHit);
}

vec3 projectToOctahedron(vec3 direction, float radius) {
  float distanceToFace = radius
    / max(abs(direction.x) + abs(direction.y) + abs(direction.z), 0.001);
  return direction * distanceToFace;
}

vec3 projectToCube(vec3 direction, float halfExtent) {
  float distanceToFace = halfExtent
    / max(max(abs(direction.x), abs(direction.y)), abs(direction.z));
  return direction * distanceToFace;
}

void main() {
  float latitude = clamp(normal.y * 0.5 + 0.5, 0.0, 0.999);
  float bandIndex = floor(latitude * 8.0);
  float bandEnergy = readAudioBand(bandIndex);

  // Tres frecuencias inconmensurables crean una respiración sin loop evidente.
  float drift = sin(position.x * 5.7 + uTime * 0.47)
              * sin(position.y * 7.1 - uTime * 0.293)
              * sin(position.z * 4.3 + uTime * 0.618);
  float speechDetail = sin((position.x + position.z) * 13.0 + uTime * (1.1 + uAudioTone));
  float displacement = drift * (0.004 + uActivity * 0.009)
                     + bandEnergy * (0.012 + uAudioLevel * 0.09)
                     + speechDetail * uAudioLevel * 0.006;
  vec3 direction = normalize(position);
  vec3 trianglePosition = projectToPrism(direction, 3.0, 0.96, 0.37, PI / 6.0);
  vec3 hexagonPosition = projectToPrism(direction, 6.0, 0.95, 0.39, 0.0);
  vec3 octahedronPosition = projectToOctahedron(direction, 1.02);
  vec3 cubePosition = projectToCube(direction, 0.58);
  vec3 actionPosition = trianglePosition * uShapeWeights.x
                      + hexagonPosition * uShapeWeights.y
                      + octahedronPosition * uShapeWeights.z
                      + cubePosition * uShapeWeights.w;
  vec3 morphedPosition = mix(position, actionPosition, uActingBlend);
  vec3 displacementDirection = normalize(morphedPosition);
  vec3 displaced = morphedPosition + displacementDirection * displacement;
  vec4 viewPosition = modelViewMatrix * vec4(displaced, 1.0);

  vNormalView = normalize(normalMatrix * normal);
  vViewDirection = normalize(-viewPosition.xyz);
  vViewPosition = viewPosition.xyz;
  vObjectPosition = displaced;
  vBandEnergy = bandEnergy;
  vSurfaceMotion = drift * 0.5 + 0.5;
  gl_Position = projectionMatrix * viewPosition;
}
`;

export const SHELL_FRAGMENT_SHADER = /* glsl */ `
uniform float uTime;
uniform float uActivity;
uniform float uAudioLevel;
uniform float uAudioTone;
uniform float uActingBlend;
uniform vec3 uBaseColor;
uniform vec3 uEnergyColor;
uniform vec3 uAccentColor;

varying vec3 vNormalView;
varying vec3 vViewDirection;
varying vec3 vViewPosition;
varying vec3 vObjectPosition;
varying float vBandEnergy;
varying float vSurfaceMotion;

float hash21(vec2 point) {
  point = fract(point * vec2(123.34, 456.21));
  point += dot(point, point + 45.32);
  return fract(point.x * point.y);
}

float circuitLine(float value, float width) {
  float edgeDistance = min(fract(value), 1.0 - fract(value));
  return 1.0 - smoothstep(width, width * 2.25, edgeDistance);
}

void main() {
  vec3 sphere = normalize(vObjectPosition);
  float longitude = atan(sphere.z, sphere.x) / 6.2831853 + 0.5;
  float latitude = asin(clamp(sphere.y, -1.0, 1.0)) / 3.14159265 + 0.5;
  vec3 viewDirection = normalize(vViewDirection);
  vec3 geometricNormal = normalize(cross(dFdx(vViewPosition), dFdy(vViewPosition)));
  if (dot(geometricNormal, viewDirection) < 0.0) geometricNormal *= -1.0;
  vec3 normalView = normalize(mix(normalize(vNormalView), geometricNormal, uActingBlend));
  float facing = max(dot(normalView, viewDirection), 0.0);
  float fresnel = pow(1.0 - facing, 2.7);
  vec3 keyDirection = normalize(vec3(-0.52, 0.68, 0.72));
  float keyLight = max(dot(normalView, keyDirection), 0.0);
  float fillLight = max(dot(normalView, normalize(vec3(0.55, -0.25, 0.45))), 0.0);
  float sphericalLight = 0.38 + keyLight * 0.52 + fillLight * 0.15;
  float specular = pow(max(dot(reflect(-keyDirection, normalView), viewDirection), 0.0), 28.0);

  vec2 largeCell = floor(vec2(longitude * 26.0, latitude * 17.0));
  vec2 fineCell = floor(vec2(longitude * 41.0, latitude * 29.0));
  float latitudeTrace = circuitLine(latitude * 17.0 + sin(longitude * 18.8496) * 0.16, 0.035)
                      * step(0.25, hash21(largeCell));
  float longitudeTrace = circuitLine(longitude * 26.0 + sin(latitude * 12.5663) * 0.12, 0.028)
                       * step(0.38, hash21(largeCell + 7.3));
  float diagonalTrace = circuitLine((longitude + latitude * 0.31) * 37.0, 0.019)
                      * step(0.66, hash21(fineCell + 17.1));
  float circuits = clamp(max(latitudeTrace, longitudeTrace) + diagonalTrace * 0.7, 0.0, 1.0);

  float plateId = hash21(largeCell + 3.7);
  float plateShade = mix(0.72, 1.12, plateId) + vSurfaceMotion * 0.035;
  float travel = fract(longitude * 3.0 - latitude * 1.7 - uTime * (0.075 + uActivity * 0.13));
  float signalPulse = pow(1.0 - abs(travel * 2.0 - 1.0), 13.0);
  signalPulse *= circuits * (0.35 + uActivity * 0.65);
  float actionTravel = fract(
    vObjectPosition.y * 0.72
    + vObjectPosition.x * 0.21
    - uTime * 0.43
  );
  float actionScan = pow(1.0 - abs(actionTravel * 2.0 - 1.0), 19.0) * uActingBlend;
  float actionPacket = pow(
    0.5 + 0.5 * sin(
      dot(vObjectPosition, vec3(7.3, 11.1, 5.7))
      - uTime * 3.1
    ),
    12.0
  ) * uActingBlend;

  vec3 body = uBaseColor * plateShade * sphericalLight * (0.18 + facing * 0.08);
  vec3 rim = uEnergyColor * fresnel * (0.3 + uActivity * 0.28);
  vec3 traceColor = mix(uEnergyColor, uAccentColor, signalPulse + vBandEnergy * 0.5);
  vec3 traces = traceColor * circuits * (0.42 + uActivity * 0.48 + vBandEnergy * 0.8);
  vec3 pulse = uAccentColor * signalPulse * (0.58 + uAudioLevel * 0.7);
  vec3 actionData = mix(uEnergyColor, uAccentColor, actionPacket)
                  * (actionScan * 0.72 + actionPacket * 0.28);
  vec3 color = body + rim + traces + pulse + actionData + uEnergyColor * specular * 0.16;

  float surfaceAlpha = 0.025 + fresnel * 0.13;
  float detailAlpha = circuits * (0.1 + uActivity * 0.1)
                    + signalPulse * 0.2
                    + actionScan * 0.16
                    + actionPacket * 0.2
                    + specular * 0.08;
  float alpha = clamp(surfaceAlpha + detailAlpha, 0.0, 0.42);
  gl_FragColor = vec4(clamp(color, 0.0, 1.0), alpha);
}
`;

export const REACTOR_VERTEX_SHADER = /* glsl */ `
uniform float uTime;
uniform float uEnergy;
varying vec3 vNormalView;
varying vec3 vViewDirection;

void main() {
  float wave = sin(normal.x * 8.0 + uTime * 0.73)
             * sin(normal.y * 7.0 - uTime * 0.41) * 0.015;
  vec3 displaced = position + normal * wave * (0.3 + uEnergy);
  vec4 viewPosition = modelViewMatrix * vec4(displaced, 1.0);
  vNormalView = normalize(normalMatrix * normal);
  vViewDirection = normalize(-viewPosition.xyz);
  gl_Position = projectionMatrix * viewPosition;
}
`;

export const REACTOR_FRAGMENT_SHADER = /* glsl */ `
uniform float uTime;
uniform float uEnergy;
uniform vec3 uEnergyColor;
uniform vec3 uAccentColor;
varying vec3 vNormalView;
varying vec3 vViewDirection;

void main() {
  float facing = max(dot(normalize(vNormalView), normalize(vViewDirection)), 0.0);
  float rim = pow(1.0 - facing, 2.2);
  float pulse = 0.88 + sin(uTime * 1.17) * 0.06 + sin(uTime * 0.719) * 0.04;
  vec3 color = mix(uEnergyColor, uAccentColor, 0.25 + uEnergy * 0.35);
  color *= (0.45 + facing * 0.55 + rim * 0.35) * pulse * (0.78 + uEnergy * 0.35);
  gl_FragColor = vec4(clamp(color, 0.0, 1.0), 0.98);
}
`;

export const CIRCUIT_VERTEX_SHADER = /* glsl */ `
uniform float uTime;
uniform float uAudioLevel;
uniform float uAudioBands[8];
attribute float aPhase;
attribute float aStrength;
attribute float aBand;
varying float vEnergy;
varying float vBandEnergy;

${AUDIO_BAND_READER}

void main() {
  float bandEnergy = readAudioBand(aBand);
  float pulse = pow(0.5 + 0.5 * sin(uTime * (0.7 + aStrength * 1.3) + aPhase * 18.0), 9.0);
  vec3 displaced = position * (1.0 + bandEnergy * 0.018 + uAudioLevel * 0.006);
  vBandEnergy = bandEnergy;
  vEnergy = aStrength * (0.43 + pulse * 0.72 + bandEnergy * 0.8);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
}
`;

export const CIRCUIT_FRAGMENT_SHADER = /* glsl */ `
uniform float uOpacity;
uniform vec3 uEnergyColor;
uniform vec3 uAccentColor;
varying float vEnergy;
varying float vBandEnergy;

void main() {
  vec3 color = mix(uEnergyColor, uAccentColor, clamp(vBandEnergy * 1.4, 0.0, 1.0));
  float alpha = clamp(vEnergy * uOpacity, 0.0, 0.92);
  gl_FragColor = vec4(color * (0.55 + vEnergy * 0.35), alpha);
}
`;

export const NODE_VERTEX_SHADER = /* glsl */ `
uniform float uTime;
uniform float uPixelRatio;
uniform float uAudioLevel;
uniform float uAudioBands[8];
attribute float aPhase;
attribute float aStrength;
attribute float aBand;
varying float vEnergy;

${AUDIO_BAND_READER}

void main() {
  float bandEnergy = readAudioBand(aBand);
  float blink = pow(0.5 + 0.5 * sin(uTime * (0.9 + aStrength) + aPhase * 31.0), 12.0);
  vEnergy = clamp(0.25 + blink * 0.75 + bandEnergy * 1.2 + uAudioLevel * 0.35, 0.0, 1.6);
  vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = (1.5 + aStrength * 2.2 + vEnergy * 1.7) * uPixelRatio * (3.8 / -viewPosition.z);
  gl_Position = projectionMatrix * viewPosition;
}
`;

export const NODE_FRAGMENT_SHADER = /* glsl */ `
uniform vec3 uEnergyColor;
uniform vec3 uAccentColor;
uniform float uOpacity;
varying float vEnergy;

void main() {
  float distanceToCenter = length(gl_PointCoord - vec2(0.5));
  if (distanceToCenter > 0.5) discard;
  float core = 1.0 - smoothstep(0.08, 0.24, distanceToCenter);
  float glow = 1.0 - smoothstep(0.05, 0.5, distanceToCenter);
  vec3 color = mix(uEnergyColor, uAccentColor, core) * (0.55 + core * 0.4);
  gl_FragColor = vec4(color, glow * clamp(vEnergy, 0.0, 1.0) * uOpacity);
}
`;

export const AUDIO_RAY_VERTEX_SHADER = /* glsl */ `
uniform float uTime;
uniform float uSignalMix;
uniform float uAudioLevel;
uniform float uTransient;
uniform float uAudioBands[8];
attribute float aBand;
attribute float aTip;
attribute float aPhase;
varying float vEnergy;
varying float vTip;

${AUDIO_BAND_READER}

void main() {
  float bandEnergy = readAudioBand(aBand);
  float idleData = pow(0.5 + 0.5 * sin(uTime * 0.47 + aPhase * 23.0), 10.0) * 0.015;
  float extension = aTip * (idleData + uSignalMix * (0.018 + bandEnergy * 0.24
                    + uAudioLevel * 0.055 + uTransient * 0.09));
  vec3 displaced = normalize(position) * (length(position) + extension);
  vEnergy = uSignalMix * (0.16 + bandEnergy * 1.35 + uAudioLevel * 0.45 + uTransient * 0.7);
  vTip = aTip;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
}
`;

export const AUDIO_RAY_FRAGMENT_SHADER = /* glsl */ `
uniform vec3 uEnergyColor;
uniform vec3 uAccentColor;
uniform float uOpacity;
varying float vEnergy;
varying float vTip;

void main() {
  vec3 color = mix(uEnergyColor, uAccentColor, clamp(vEnergy * 0.8 + vTip * 0.18, 0.0, 1.0));
  gl_FragColor = vec4(color, clamp((0.12 + vEnergy) * uOpacity, 0.0, 0.9));
}
`;

export const PARTICLE_VERTEX_SHADER = /* glsl */ `
uniform float uTime;
uniform float uActivity;
uniform float uAudioLevel;
uniform float uTransient;
uniform float uPixelRatio;
attribute float aPhase;
attribute float aSpeed;
attribute float aSize;
varying float vEnergy;

mat2 rotate2d(float angle) {
  float sine = sin(angle);
  float cosine = cos(angle);
  return mat2(cosine, -sine, sine, cosine);
}

void main() {
  vec3 displaced = position;
  float rotation = uTime * (0.025 + aSpeed * 0.045);
  displaced.xz = rotate2d(rotation) * displaced.xz;
  displaced.xy = rotate2d(-rotation * 0.37) * displaced.xy;
  float drift = sin(uTime * (0.31 + aSpeed * 0.17) + aPhase * 31.0);
  displaced *= 1.0 + drift * (0.004 + uActivity * 0.008)
             + uTransient * (0.02 + aPhase * 0.055);
  vec4 viewPosition = modelViewMatrix * vec4(displaced, 1.0);
  vEnergy = 0.22 + uActivity * 0.34 + uAudioLevel * 0.42 + uTransient * 0.65;
  gl_PointSize = (0.75 + aSize * 1.3 + uTransient * 2.0) * uPixelRatio * (3.6 / -viewPosition.z);
  gl_Position = projectionMatrix * viewPosition;
}
`;

export const PARTICLE_FRAGMENT_SHADER = /* glsl */ `
uniform vec3 uEnergyColor;
uniform vec3 uAccentColor;
uniform float uOpacity;
varying float vEnergy;

void main() {
  float distanceToCenter = length(gl_PointCoord - vec2(0.5));
  if (distanceToCenter > 0.5) discard;
  float glow = 1.0 - smoothstep(0.06, 0.5, distanceToCenter);
  vec3 color = mix(uEnergyColor, uAccentColor, clamp(vEnergy, 0.0, 1.0));
  gl_FragColor = vec4(color, glow * vEnergy * uOpacity);
}
`;

export const RING_VERTEX_SHADER = /* glsl */ `
attribute float aArcLength;
varying float vArcLength;
varying float vDepthFade;

void main() {
  vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
  vArcLength = aArcLength;
  vDepthFade = smoothstep(6.0, 2.0, -viewPosition.z);
  gl_Position = projectionMatrix * viewPosition;
}
`;

export const RING_FRAGMENT_SHADER = /* glsl */ `
uniform float uTime;
uniform float uSpeed;
uniform float uAudioLevel;
uniform float uTransient;
uniform float uOpacity;
uniform vec3 uEnergyColor;
uniform vec3 uAccentColor;
varying float vArcLength;
varying float vDepthFade;

void main() {
  float sequence = fract(vArcLength * 42.0 - uTime * uSpeed);
  float dash = 1.0 - smoothstep(0.48, 0.72, sequence);
  float packetPosition = fract(vArcLength * 3.0 - uTime * uSpeed * 0.17);
  float packet = pow(1.0 - abs(packetPosition * 2.0 - 1.0), 15.0);
  float energy = packet * (0.55 + uAudioLevel * 0.8 + uTransient);
  vec3 color = mix(uEnergyColor, uAccentColor, clamp(energy, 0.0, 1.0));
  float alpha = (dash * 0.34 + energy * 0.66) * uOpacity * vDepthFade;
  gl_FragColor = vec4(color, clamp(alpha, 0.0, 0.85));
}
`;

export const HALO_VERTEX_SHADER = /* glsl */ `
varying vec3 vNormalView;
varying vec3 vViewDirection;

void main() {
  vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
  vNormalView = normalize(normalMatrix * normal);
  vViewDirection = normalize(-viewPosition.xyz);
  gl_Position = projectionMatrix * viewPosition;
}
`;

export const HALO_FRAGMENT_SHADER = /* glsl */ `
uniform float uTime;
uniform float uEnergy;
uniform float uOpacity;
uniform vec3 uEnergyColor;
varying vec3 vNormalView;
varying vec3 vViewDirection;

void main() {
  // abs corrige las normales de BackSide; el centro queda realmente transparente.
  float facing = abs(dot(normalize(vNormalView), normalize(vViewDirection)));
  float fresnel = pow(1.0 - facing, 4.2);
  float breathe = 0.91 + sin(uTime * 0.37) * 0.05 + sin(uTime * 0.229) * 0.04;
  float alpha = fresnel * (0.035 + uEnergy * 0.095) * breathe * uOpacity;
  gl_FragColor = vec4(uEnergyColor * 0.55, clamp(alpha, 0.0, 0.19));
}
`;

// Alias conservado para imports antiguos del prototipo.
export const ORB_VERTEX_SHADER = SHELL_VERTEX_SHADER;
export const ORB_FRAGMENT_SHADER = SHELL_FRAGMENT_SHADER;
