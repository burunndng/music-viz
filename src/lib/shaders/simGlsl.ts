// GPU simulation shaders — ping-pong reaction-diffusion / CA / advection.
// All GLSL is ES 1.00 (matches the mode shaders: gl_FragColor, texture2D, varying).

export const simVert = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`

const simCommon = /* glsl */ `
varying vec2 vUv;
float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 345.45));
  p += dot(p, p + 34.345);
  return fract(p.x * p.y);
}
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  float a = hash21(i), b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0)), d = hash21(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
float fbm(vec2 p) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { s += a * vnoise(p); p = p * 2.0 + vec2(1.7, 9.2); a *= 0.5; }
  return s;
}
// 9-point laplacian of the .xy channels
vec2 lap2(sampler2D t, vec2 uv, vec2 tx) {
  vec2 s = vec2(0.0);
  s += texture2D(t, uv + vec2(-tx.x, 0.0)).xy * 0.20;
  s += texture2D(t, uv + vec2( tx.x, 0.0)).xy * 0.20;
  s += texture2D(t, uv + vec2(0.0, -tx.y)).xy * 0.20;
  s += texture2D(t, uv + vec2(0.0,  tx.y)).xy * 0.20;
  s += texture2D(t, uv + vec2(-tx.x, -tx.y)).xy * 0.05;
  s += texture2D(t, uv + vec2( tx.x, -tx.y)).xy * 0.05;
  s += texture2D(t, uv + vec2(-tx.x,  tx.y)).xy * 0.05;
  s += texture2D(t, uv + vec2( tx.x,  tx.y)).xy * 0.05;
  s += texture2D(t, uv).xy * -1.0;
  return s;
}
// curl of scalar fbm field (divergence-free flow)
vec2 curl(vec2 p) {
  float e = 0.08;
  float n1 = fbm(p + vec2(0.0, e));
  float n2 = fbm(p - vec2(0.0, e));
  float n3 = fbm(p + vec2(e, 0.0));
  float n4 = fbm(p - vec2(e, 0.0));
  float dx = (n1 - n2) / (2.0 * e);
  float dy = (n3 - n4) / (2.0 * e);
  return vec2(dy, -dx);
}
`

const simAudio = /* glsl */ `
uniform sampler2D tState;
uniform vec2 uTexel;
uniform float uTime;
uniform float uBass;
uniform float uMid;
uniform float uTreble;
uniform float uLevel;
uniform float uBeat;
uniform float uFlux;
uniform float uReactivity;
uniform float uAudioOn;
uniform float uStates;
uniform vec2 uMouse;
`

/* ── NEURAL FIELD: FitzHugh–Nagumo excitable media ── */
const neuralInit = simCommon + /* glsl */ `
uniform float uSeed;
void main() {
  float u = (hash21(vUv * 131.0 + uSeed) - 0.5) * 0.4;
  float v = hash21(vUv * 71.0 + uSeed * 2.1) * 0.3;
  gl_FragColor = vec4(u, v, 0.0, 1.0);
}
`
const neuralStep = simCommon + simAudio + /* glsl */ `
void main() {
  vec4 c = texture2D(tState, vUv);
  float u = c.x, v = c.y;
  float L = lap2(tState, vUv, uTexel).x;
  float beta = 0.75, gamma = 0.10, eps = 0.06, D = 0.14, dt = 0.5;
  float du = (u - u * u * u / 3.0 - v + D * L);
  float dv = eps * (u + beta - gamma * v);
  float ex = uBass * uAudioOn * uReactivity
           * (step(0.985, hash21(floor(vUv * 512.0) + floor(uTime * 6.0))) ? 1.0 : 0.0) * 1.3;
  u += du * dt + ex;
  v += dv * dt;
  gl_FragColor = vec4(clamp(u, -1.4, 1.4), clamp(v, 0.0, 1.6), 0.0, 1.0);
}
`

/* ── TURING FLUX: Gray–Scott reaction–diffusion ── */
const turingInit = simCommon + /* glsl */ `
uniform float uSeed;
void main() {
  vec2 c = floor(vUv * 9.0);
  float r = (hash21(c + uSeed) > 0.82) ? 1.0 : 0.0;
  gl_FragColor = vec4(r, 1.0, 0.0, 1.0);
}
`
const turingStep = simCommon + simAudio + /* glsl */ `
void main() {
  vec2 cc = texture2D(tState, vUv).xy;
  vec2 L = lap2(tState, vUv, uTexel);
  float f = 0.055 + 0.020 * uMid * uAudioOn * uReactivity;
  float k = 0.062 - 0.006 * uTreble * uAudioOn * uReactivity;
  float ru = 0.20, rv = 0.10;
  float R = cc.x, G = cc.y;
  float reaction = R * G * G;
  float dR = ru * L.x - reaction + f * (1.0 - R);
  float dG = rv * L.y + reaction - (f + k) * G;
  float kick = uBeat * uAudioOn * uReactivity
             * 0.25 * step(0.96, hash21(floor(vUv * 512.0) + uTime));
  R = clamp(R + dR + kick, 0.0, 1.0);
  G = clamp(G + dG, 0.0, 1.0);
  gl_FragColor = vec4(R, G, 0.0, 1.0);
}
`

/* ── DRAGONSCALES: cyclic cellular automaton ── */
const dragonsInit = simCommon + /* glsl */ `
uniform float uSeed;
uniform float uStates;
void main() {
  float s = floor(hash21(vUv * 777.0 + uSeed) * uStates);
  gl_FragColor = vec4(s / uStates, 0.0, 0.0, 1.0);
}
`
const dragonsStep = simCommon + simAudio + /* glsl */ `
void main() {
  float s = texture2D(tState, vUv).r;
  float st = floor(s * uStates + 0.5);
  float nst = mod(st + 1.0, uStates);
  float nfrac = nst / uStates;
  float cnt = 0.0;
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      if (i == 0 && j == 0) continue;
      float ns = texture2D(tState, vUv + vec2(float(i), float(j)) * uTexel).r;
      float nsv = floor(ns * uStates + 0.5);
      if (abs(nsv - nst) < 0.5) cnt += 1.0;
    }
  }
  float ns2 = (cnt >= 3.0) ? nfrac : s;
  if (hash21(floor(vUv * 512.0) + floor(uTime * 2.0)) > 0.9995) ns2 = nfrac;
  gl_FragColor = vec4(ns2, 0.0, 0.0, 1.0);
}
`

/* ── PARTICLE FLOW: advected density (semi-Lagrangian) ── */
const particlesInit = simCommon + /* glsl */ `
void main() { gl_FragColor = vec4(0.0); }
`
const particlesStep = simCommon + simAudio + /* glsl */ `
void main() {
  vec2 fl = curl(vUv * 3.0 + vec2(0.0, uTime * 0.05));
  fl += (vUv - 0.5) * (0.15 + uBass * uAudioOn * uReactivity * 1.5);
  vec2 p = vUv - fl * 0.012;
  float d = texture2D(tState, fract(p)).r;
  d *= 0.985;
  float r = length(vUv - 0.5);
  float ring = exp(-pow((r - 0.15 - 0.08 * sin(uTime + vUv.x * 3.0)) * 9.0, 2.0));
  d += ring * (0.15 + uLevel * uAudioOn * uReactivity * 1.2);
  float md = length(vUv - uMouse);
  d += exp(-md * 30.0) * 0.10 * uAudioOn;
  gl_FragColor = vec4(clamp(d, 0.0, 4.0), 0.0, 0.0, 1.0);
}
`

export interface SimDef {
  steps: number
  states: number
  fragInit: string
  fragStep: string
  spectrum?: boolean
}

/* ── SPECTROGRAPH: scrolling spectrum history (spectrogram) ── */
const spectroInit = simCommon + /* glsl */ `
void main() { gl_FragColor = vec4(0.0); }
`
const spectroStep = simCommon + simAudio + /* glsl */ `
uniform sampler2D tSpectrum;
void main() {
  vec2 uv = vUv;
  if (uv.x < 1.0 - uTexel.x * 1.5) {
    gl_FragColor = texture2D(tState, uv + vec2(uTexel.x, 0.0));
  } else {
    float v = texture2D(tSpectrum, vec2(0.5, uv.y)).r;
    gl_FragColor = vec4(v, 0.0, 0.0, 1.0);
  }
}
`

export const SIMS: Record<string, SimDef> = {
  neural: { steps: 1, states: 0, fragInit: neuralInit, fragStep: neuralStep },
  turing: { steps: 2, states: 0, fragInit: turingInit, fragStep: turingStep },
  dragons: { steps: 1, states: 14, fragInit: dragonsInit, fragStep: dragonsStep },
  particles: { steps: 1, states: 0, fragInit: particlesInit, fragStep: particlesStep },
  spectro: { steps: 1, states: 0, fragInit: spectroInit, fragStep: spectroStep, spectrum: true },
}
