// Stable-fluids (Navier–Stokes) GPU simulation shaders — GLSL ES 1.00.
import { simVert } from './simGlsl'

export { simVert }

const head = /* glsl */ `
varying vec2 vUv;
uniform vec2 uTexel;
`

const advectFrag = head + /* glsl */ `
uniform sampler2D tVelocity;
uniform sampler2D tSource;
uniform float uDt;
uniform float uDissipation;
void main() {
  vec2 vel = texture2D(tVelocity, vUv).xy;
  vec2 p = vUv - uDt * vel * uTexel;
  vec4 res = texture2D(tSource, p);
  gl_FragColor = res * uDissipation;
}
`

const divergenceFrag = head + /* glsl */ `
uniform sampler2D tVelocity;
void main() {
  float l = texture2D(tVelocity, vUv - vec2(uTexel.x, 0.0)).x;
  float r = texture2D(tVelocity, vUv + vec2(uTexel.x, 0.0)).x;
  float b = texture2D(tVelocity, vUv - vec2(0.0, uTexel.y)).y;
  float t = texture2D(tVelocity, vUv + vec2(0.0, uTexel.y)).y;
  float div = 0.5 * ((r - l) + (t - b));
  gl_FragColor = vec4(div, 0.0, 0.0, 1.0);
}
`

const curlFrag = head + /* glsl */ `
uniform sampler2D tVelocity;
void main() {
  float l = texture2D(tVelocity, vUv - vec2(uTexel.x, 0.0)).y;
  float r = texture2D(tVelocity, vUv + vec2(uTexel.x, 0.0)).y;
  float b = texture2D(tVelocity, vUv - vec2(0.0, uTexel.y)).x;
  float t = texture2D(tVelocity, vUv + vec2(0.0, uTexel.y)).x;
  float c = 0.5 * ((r - l) - (t - b));
  gl_FragColor = vec4(c, 0.0, 0.0, 1.0);
}
`

const vorticityFrag = head + /* glsl */ `
uniform sampler2D tVelocity;
uniform sampler2D tCurl;
uniform float uCurl;
uniform float uDt;
void main() {
  float l = texture2D(tCurl, vUv - vec2(uTexel.x, 0.0)).x;
  float r = texture2D(tCurl, vUv + vec2(uTexel.x, 0.0)).x;
  float b = texture2D(tCurl, vUv - vec2(0.0, uTexel.y)).x;
  float t = texture2D(tCurl, vUv + vec2(0.0, uTexel.y)).x;
  float c = texture2D(tCurl, vUv).x;
  vec2 force = 0.5 * vec2(abs(t) - abs(b), abs(r) - abs(l));
  force /= length(force) + 1e-4;
  force *= uCurl * c;
  force.y *= -1.0;
  vec2 vel = texture2D(tVelocity, vUv).xy;
  vel += force * uDt;
  gl_FragColor = vec4(vel, 0.0, 1.0);
}
`

const pressureFrag = head + /* glsl */ `
uniform sampler2D tPressure;
uniform sampler2D tDivergence;
void main() {
  float l = texture2D(tPressure, vUv - vec2(uTexel.x, 0.0)).x;
  float r = texture2D(tPressure, vUv + vec2(uTexel.x, 0.0)).x;
  float b = texture2D(tPressure, vUv - vec2(0.0, uTexel.y)).x;
  float t = texture2D(tPressure, vUv + vec2(0.0, uTexel.y)).x;
  float div = texture2D(tDivergence, vUv).x;
  float p = (l + r + b + t - div) * 0.25;
  gl_FragColor = vec4(p, 0.0, 0.0, 1.0);
}
`

const gradientFrag = head + /* glsl */ `
uniform sampler2D tVelocity;
uniform sampler2D tPressure;
void main() {
  float l = texture2D(tPressure, vUv - vec2(uTexel.x, 0.0)).x;
  float r = texture2D(tPressure, vUv + vec2(uTexel.x, 0.0)).x;
  float b = texture2D(tPressure, vUv - vec2(0.0, uTexel.y)).x;
  float t = texture2D(tPressure, vUv + vec2(0.0, uTexel.y)).x;
  vec2 vel = texture2D(tVelocity, vUv).xy;
  vel -= 0.5 * vec2(r - l, t - b);
  gl_FragColor = vec4(vel, 0.0, 1.0);
}
`

const splatVelFrag = head + /* glsl */ `
uniform sampler2D tVelocity;
uniform float uTime;
uniform float uBass;
uniform float uMid;
uniform float uTreble;
uniform float uLevel;
uniform float uBeat;
uniform float uAudioOn;
uniform float uReactivity;
void main() {
  vec2 vel = texture2D(tVelocity, vUv).xy;
  vec2 c = vec2(0.5) + 0.32 * vec2(sin(uTime * 0.30), cos(uTime * 0.23));
  float d = length(vUv - c);
  float emit = exp(-d * d * 26.0) * (uBass * uAudioOn * uReactivity * 2.2 + 0.04);
  vec2 dir = normalize(vUv - c + 1e-4);
  vel += dir * emit * 0.6;
  vec2 sw = vec2(-(vUv.y - 0.5), (vUv.x - 0.5));
  vel += sw * (uMid * uAudioOn * uReactivity * 0.7 + 0.015);
  vel += vec2(0.0, 1.0) * (uTreble * uAudioOn * uReactivity * 0.4) * exp(-d * d * 12.0);
  gl_FragColor = vec4(vel, 0.0, 1.0);
}
`

const splatDyeFrag = head + /* glsl */ `
uniform sampler2D tDye;
uniform float uTime;
uniform float uBass;
uniform float uMid;
uniform float uTreble;
uniform float uLevel;
uniform float uCentroid;
uniform float uAudioOn;
uniform float uReactivity;
void main() {
  vec3 dye = texture2D(tDye, vUv).rgb;
  vec2 c = vec2(0.5) + 0.32 * vec2(sin(uTime * 0.30), cos(uTime * 0.23));
  float d = length(vUv - c);
  float emit = exp(-d * d * 26.0) * (uBass * uAudioOn * uReactivity * 1.6 + 0.03);
  vec3 dc = 0.55 + 0.45 * cos(6.2831 * (uCentroid + vec3(0.0, 0.33, 0.67)) + uTime * 0.1);
  dye += emit * dc * 1.4;
  gl_FragColor = vec4(dye, 1.0);
}
`

// dye display (used by the FLUID mode shader via uFluidTex — kept here for reference)
const _unused = splatDyeFrag

export const FLUID_SHADERS = {
  advect: advectFrag,
  divergence: divergenceFrag,
  curl: curlFrag,
  vorticity: vorticityFrag,
  pressure: pressureFrag,
  gradient: gradientFrag,
  splatVel: splatVelFrag,
  splatDye: splatDyeFrag,
}
