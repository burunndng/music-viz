export const commonGLSL = /* glsl */ `
precision highp float;

#define PI 3.14159265359
#define TAU 6.28318530718

uniform float uTime;
uniform float uDose;
uniform float uSpeed;
uniform float uComplexity;
uniform float uSymmetry;
uniform float uTrail;
uniform int uPalette;
uniform int uPlanform;
uniform vec2 uMouse;
uniform float uReactivity;
uniform vec2 uResolution;

// Core audio (0-1, reactivity-scaled)
uniform float uBass;
uniform float uMid;
uniform float uTreble;
uniform float uLevel;
uniform float uBeat;
uniform float uFlux;
uniform float uCentroid;
uniform float uAudioOn;

// Extended audio bands (sub, bass, lowmid, mid) — ported from enthea
uniform vec4 uBands0;
// Extended audio bands (highmid, treble, air, level)
uniform vec4 uBands1;
// Spectral dissonance (0-1)
uniform float uDissonance;
// Beat-synced pulse (1→0 each beat)
uniform float uBeatPulse;
// Beat phase (0..1 between beats)
uniform float uBeatPhase;
// Time since last beat (seconds)
uniform float uBloomT;
// Stereo split (bass, treble)
uniform vec2 uStereo;

// Drop / build engine
uniform float uBuild;
uniform float uDrop;
uniform int uDropMode;

// Visual parameters
uniform float uHueShift;
uniform float uPulse;
uniform float uPulseRate;
uniform float uShear;
uniform float uVoid;
uniform float uFlicker;
uniform float uFlickerHz;
uniform float uTone;
uniform float uAscension;
uniform float uAsc;

// Mode toggles
uniform float uRay;
uniform float uChoreo;
uniform float uScope;
uniform float uCine;
uniform float uTrans;
uniform int uTransMode;

// Wallpaper group lens
uniform int uWall;
uniform float uWallScale;

// Spectral / image textures
uniform sampler2D uSpectrum;
uniform sampler2D uImage;
uniform vec3 uImgPal[6];

// Waveform texture (R=L/mono, G=R)
uniform sampler2D uWaveform;

mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }
vec2 cdiv(vec2 a, vec2 b) { float d = dot(b, b) + 1e-9; return vec2(a.x * b.x + a.y * b.y, a.y * b.x - a.x * b.y) / d; }
float hash21(vec2 p) { p = fract(p * vec2(123.34, 345.45)); p += dot(p, p + 34.345); return fract(p.x * p.y); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  float a = hash21(i), b = hash21(i + vec2(1, 0));
  float c = hash21(i + vec2(0, 1)), d = hash21(i + vec2(1, 1));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
float fbm(vec2 p, int oct) {
  float s = 0.0, a = 0.5;
  mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 8; i++) {
    if (i >= oct) break;
    s += a * vnoise(p);
    p = m * p + vec2(1.7, 9.2);
    a *= 0.5;
  }
  return s;
}
vec2 fold(vec2 p, float n) {
  float a = atan(p.y, p.x), r = length(p);
  a = mod(a, TAU / n);
  a = abs(a - PI / n);
  return r * vec2(cos(a), sin(a));
}
int octaves() { return int(mix(3.0, 7.0, uComplexity)); }

// OKLab colour (Ottosson)
vec3 oklab2lin(vec3 L) {
  float l_ = L.x + 0.3963377774 * L.y + 0.2158037573 * L.z;
  float m_ = L.x - 0.1055613458 * L.y - 0.0638541728 * L.z;
  float s_ = L.x - 0.0894841775 * L.y - 1.2914855480 * L.z;
  float l = l_ * l_ * l_, m = m_ * m_ * m_, s = s_ * s_ * s_;
  return vec3(
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s
  );
}
vec3 lin2oklab(vec3 c) {
  c = max(c, 0.0);
  float l = 0.4122214708*c.r + 0.5363325363*c.g + 0.0514459929*c.b;
  float m = 0.2119034982*c.r + 0.6806995451*c.g + 0.1073969566*c.b;
  float s = 0.0883024619*c.r + 0.2817188376*c.g + 0.6299787005*c.b;
  l = pow(l, 1.0/3.0); m = pow(m, 1.0/3.0); s = pow(s, 1.0/3.0);
  return vec3(0.2104542553*l + 0.7936177850*m - 0.0040720468*s,
              1.9779984951*l - 2.4285922050*m + 0.4505937099*s,
              0.0259040371*l + 0.7827717662*m - 0.8086757660*s);
}
vec3 oklch(float L, float C, float h) {
  return max(oklab2lin(vec3(L, C * cos(h), C * sin(h))), 0.0);
}
vec3 PAL(float t, int id) {
  t = fract(t);
  float Lw = 0.5 + 0.34 * cos(t * TAU - 1.0);
  if (id == 0) return oklch(Lw, 0.17, t * TAU);
  if (id == 1) return oklch(mix(0.30, 0.86, t), 0.18, mix(0.45, 5.70, t));
  if (id == 2) return oklch(mix(0.14, 0.96, t), mix(0.08, 0.21, t), mix(0.10, 1.60, t));
  if (id == 3) return oklch(mix(0.16, 0.88, t), 0.15, mix(3.20, 4.85, t));
  if (id == 4) return oklch(mix(0.22, 0.90, t), 0.16, mix(5.0, 1.6, 0.5 + 0.5 * cos(t * TAU)));
  if (id == 5) return oklch(Lw * 1.08, 0.23, t * TAU);
  if (id == 6) return oklch(mix(0.03, 0.92, pow(t, 1.6)), 0.06 + 0.10 * t, mix(0.7, 1.1, t));
  if (id == 7) return oklch(mix(0.05, 0.78, t), mix(0.10, 0.24, t), mix(4.7, 6.0, t));
  if (id == 8) return oklch(mix(0.03, 0.90, pow(t, 1.3)), mix(0.10, 0.25, t), mix(0.02, 0.95, t));
  // IMAGE palette (fallback)
  float f = clamp(t, 0.0, 0.999) * 5.0;
  int idx = int(f);
  return mix(uImgPal[idx], uImgPal[idx + 1], fract(f));
}
vec3 hueShift(vec3 c, float a) {
  const vec3 k = vec3(0.57735);
  float ca = cos(a);
  return c * ca + cross(k, c) * sin(a) + k * dot(k, c) * (1.0 - ca);
}
vec3 aces(vec3 x) {
  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}

vec2 warpToMouse(vec2 p) {
  vec2 m = (uMouse - 0.5) * 2.0;
  m.x *= uResolution.x / uResolution.y;
  vec2 d = p - m;
  float r = length(d) + 0.001;
  return p - normalize(d) * 0.25 * exp(-r * 1.6);
}
float cortX(float r) { return log(1.0 + (0.051 / 0.087) * r); }

vec3 applyPostFX(vec3 col) {
  col = hueShift(col, uHueShift + uTime * 0.0);
  float flicker = uFlicker * 0.22 * (0.5 + 0.5 * sin(uTime * TAU * uFlickerHz));
  col *= 1.0 + flicker;
  float pulse = uPulse * (0.5 + 0.5 * sin(uTime * uPulseRate));
  col *= 1.0 + pulse;
  col = mix(col, vec3(0.0), uVoid);
  // Tone mapping (cinematic contrast)
  col = mix(col, aces(col), uCine);
  col = aces(col);
  return col;
}
`
