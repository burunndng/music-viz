/* ── Post-processing shader sources (Phase 1 render pipeline) ──
 * Scene modes output linear HDR; everything below runs offscreen and
 * the composite pass is the only one that writes to the canvas. */

export const postVert = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`

const postCommon = /* glsl */ `
precision highp float;
varying vec2 vUv;

#define PI 3.14159265359
#define TAU 6.28318530718

mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }
float hash21(vec2 p) { p = fract(p * vec2(123.34, 345.45)); p += dot(p, p + 34.345); return fract(p.x * p.y); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  float a = hash21(i), b = hash21(i + vec2(1, 0));
  float c = hash21(i + vec2(0, 1)), d = hash21(i + vec2(1, 1));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
vec3 hueShift(vec3 c, float a) {
  const vec3 k = vec3(0.57735);
  float ca = cos(a);
  return c * ca + cross(k, c) * sin(a) + k * dot(k, c) * (1.0 - ca);
}
vec3 aces(vec3 x) {
  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}
`

/* ── Feedback / trails: max-accumulate scene against the drifted,
 * decayed previous frame (ENTHEA-style persistence). uTrail 0 = none. ── */
export const feedbackFrag = postCommon + /* glsl */ `
uniform sampler2D tScene;
uniform sampler2D tPrev;
uniform vec2 uTexel;
uniform float uTrail;
uniform float uTime;
uniform float uBeat;
uniform float uFlux;
uniform float uReactivity;
uniform float uAudioOn;

void main() {
  float ar = uAudioOn * uReactivity;
  vec2 c = vUv - 0.5;
  // drift warp: slight zoom + rotation + tiny noise offset, audio-reactive
  float zoom = 1.002 + uBeat * ar * 0.004;
  float ang = 0.0015 * (0.5 + ar * (uBeat * 2.0 + uFlux));
  vec2 nOff = (vec2(
    vnoise(vUv * 9.0 + uTime * 0.7),
    vnoise(vUv * 9.0 - uTime * 0.6 + 31.7)
  ) - 0.5) * uTexel * (2.0 + ar * 6.0);
  vec2 p = rot(ang) * c / zoom + 0.5 + nOff;
  vec3 prev = clamp(texture2D(tPrev, p).rgb, vec3(0.0), vec3(64.0));
  // uTrail 0 → no trails, ~0.9 → long persistence
  float decay = min(uTrail * 1.08, 0.97);
  vec3 scene = texture2D(tScene, vUv).rgb;
  gl_FragColor = vec4(max(scene, prev * decay), 1.0);
}
`

/* ── Bright-pass: threshold + soft knee (Unity-style quadratic) ── */
export const brightPassFrag = postCommon + /* glsl */ `
uniform sampler2D tInput;
uniform float uThreshold;
uniform float uKnee;

void main() {
  vec3 c = texture2D(tInput, vUv).rgb;
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  float soft = clamp(l - uThreshold + uKnee, 0.0, 2.0 * uKnee);
  soft = soft * soft / (4.0 * uKnee + 1e-4);
  float w = max(soft, l - uThreshold) / max(l, 1e-4);
  gl_FragColor = vec4(c * max(w, 0.0), 1.0);
}
`

/* ── Kawase downsample (center + 4 diagonal taps) ── */
export const downsampleFrag = postCommon + /* glsl */ `
uniform sampler2D tInput;
uniform vec2 uTexel;

void main() {
  vec3 c = texture2D(tInput, vUv).rgb * 4.0;
  c += texture2D(tInput, vUv + uTexel * vec2( 1.0,  1.0)).rgb;
  c += texture2D(tInput, vUv + uTexel * vec2(-1.0,  1.0)).rgb;
  c += texture2D(tInput, vUv + uTexel * vec2( 1.0, -1.0)).rgb;
  c += texture2D(tInput, vUv + uTexel * vec2(-1.0, -1.0)).rgb;
  gl_FragColor = vec4(c / 8.0, 1.0);
}
`

/* ── Upsample: 3×3 tent filter of the smaller level + add same-res level ── */
export const upsampleFrag = postCommon + /* glsl */ `
uniform sampler2D tPrev;
uniform sampler2D tAdd;
uniform vec2 uTexel;

void main() {
  vec2 d = uTexel;
  vec3 s = texture2D(tPrev, vUv + vec2(-d.x,  d.y)).rgb
         + texture2D(tPrev, vUv + vec2( 0.0,  d.y)).rgb * 2.0
         + texture2D(tPrev, vUv + vec2( d.x,  d.y)).rgb
         + texture2D(tPrev, vUv + vec2(-d.x,  0.0)).rgb * 2.0
         + texture2D(tPrev, vUv).rgb * 4.0
         + texture2D(tPrev, vUv + vec2( d.x,  0.0)).rgb * 2.0
         + texture2D(tPrev, vUv + vec2(-d.x, -d.y)).rgb
         + texture2D(tPrev, vUv + vec2( 0.0, -d.y)).rgb * 2.0
         + texture2D(tPrev, vUv + vec2( d.x, -d.y)).rgb;
  vec3 col = s / 16.0 + texture2D(tAdd, vUv).rgb;
  gl_FragColor = vec4(col, 1.0);
}
`

/* ── Composite → screen: bloom + halation + chromatic aberration, then the
 * global FX relocated from the old in-shader applyPostFX (hue shift,
 * flicker, pulse, void, uCine contrast, ACES), vignette and film grain. ── */
export const compositeFrag = postCommon + /* glsl */ `
uniform sampler2D tScene;
uniform sampler2D tBloom;
uniform vec2 uResolution;
uniform float uBloomStrength;
uniform float uHalation;
uniform float uGrain;
uniform float uTime;
uniform float uHueShift;
uniform float uFlicker;
uniform float uFlickerHz;
uniform float uPulse;
uniform float uPulseRate;
uniform float uVoid;
uniform float uCine;
uniform float uFlux;
uniform float uReactivity;
uniform float uAudioOn;
uniform float uBeatPulse;
// wired-but-previously-dead controls
uniform int uWall;
uniform float uWallScale;
uniform float uScope;
uniform float uDrop;
uniform int uDropMode;
uniform float uTrans;
uniform int uTransMode;

// wallpaper-group kaleidoscopic fold (screen-space lens, applies to every mode)
vec2 wallpaper(vec2 uv, float scale, int g) {
  if (g == 0) return uv;
  vec2 p = (uv - 0.5) * scale;
  int n = 2 + (g % 6);
  float ang = atan(p.y, p.x);
  float r = length(p);
  float span = PI / float(n);
  ang = mod(ang, 2.0 * span);
  ang = abs(ang - span);
  p = vec2(cos(ang), sin(ang)) * r;
  p = p / scale + 0.5;
  // mirror fold for odd groups → richer symmetry
  if ((g % 2) == 1) p = abs(fract(p) - 0.5) * 2.0;
  return fract(p);
}

void main() {
  float ar = uAudioOn * uReactivity;
  vec2 dir = vUv - 0.5;

  // ── transition warp (uTrans: 0 = none, 1 = settled) ──
  float tr = uTrans;
  vec2 tuv = vUv;
  if (tr > 0.0001) {
    if (uTransMode == 0) {            // radial zoom wipe
      tuv = (vUv - 0.5) * (1.0 - 0.35 * sin(tr * PI)) + 0.5;
    } else if (uTransMode == 1) {     // glitch slices
      float sl = step(0.5, hash21(vec2(floor(vUv.y * 24.0), floor(uTime * 8.0))));
      tuv.x += (sl - 0.5) * 0.08 * sin(tr * PI);
    } else {                          // iris
      float d = length(dir);
      tuv = (vUv - 0.5) * mix(1.4, 1.0, tr) + 0.5;
    }
  }

  // ── wallpaper lens ──
  vec2 suv = wallpaper(tuv, uWallScale, uWall);

  // chromatic aberration: radial RGB split scaled by flux reactivity
  float ca = 0.0012 + uFlux * ar * 0.012 + (tr > 0.0001 ? 0.01 * sin(tr * PI) : 0.0);
  vec3 col;
  col.r = texture2D(tScene, fract(suv - dir * ca)).r;
  col.g = texture2D(tScene, fract(suv)).g;
  col.b = texture2D(tScene, fract(suv + dir * ca)).b;

  // bloom (beat-pulse modulated) + warm halation
  vec3 bloom = texture2D(tBloom, fract(suv)).rgb;
  float bloomAmt = uBloomStrength * (1.0 + uBeatPulse * 0.8);
  col += bloom * bloomAmt;
  col += bloom * bloom * vec3(1.0, 0.45, 0.25) * uHalation * bloomAmt;

  // relocated global FX (was applyPostFX in the mode shaders)
  col = hueShift(col, uHueShift);
  float flicker = uFlicker * 0.22 * (0.5 + 0.5 * sin(uTime * TAU * uFlickerHz));
  col *= 1.0 + flicker;
  float pulse = uPulse * (0.5 + 0.5 * sin(uTime * uPulseRate));
  col *= 1.0 + pulse;

  // ── drop / build flash ──
  if (uDrop > 0.001) {
    if (uDropMode == 0) {                 // white-out bloom burst
      col += vec3(1.0) * uDrop * (0.6 + 0.4 * sin(uTime * 30.0));
    } else if (uDropMode == 1) {          // desaturate + darken (the drop)
      float l = dot(col, vec3(0.299, 0.587, 0.114));
      col = mix(col, vec3(l), uDrop * 0.9);
      col *= 1.0 - 0.5 * uDrop;
    } else {                              // chromatic shock
      col.r += uDrop * 0.4; col.b += uDrop * 0.4;
    }
  }

  col = mix(col, vec3(0.0), uVoid);
  col = mix(col, aces(col), uCine);
  col = aces(col);

  // ── scope / CRT overlay ──
  if (uScope > 0.5) {
    vec2 sc = vUv * 2.0 - 1.0;
    float curve = 1.0 + dot(sc, sc) * 0.12;
    vec2 scuv = sc / curve;
    float mask = smoothstep(1.0, 0.85, length(scuv));
    col *= mask;
    col *= 0.85 + 0.15 * sin(vUv.y * uResolution.y * 1.5);
    col *= 1.0 + 0.25 * (0.5 + 0.5 * sin(uTime * 6.0));
    col = mix(col, col * vec3(0.7, 1.0, 0.8), 0.3);
  }

  // vignette
  vec2 q = vUv - 0.5;
  q.x *= uResolution.x / uResolution.y;
  col *= 1.0 - 0.28 * smoothstep(0.55, 1.30, length(q));

  // film grain (time-varying hash)
  float g = hash21(vUv * uResolution + fract(uTime) * vec2(113.1, 271.7));
  col += (g - 0.5) * uGrain;

  // transition flash at the midpoint
  if (tr > 0.0001) col += vec3(0.9, 0.8, 1.0) * sin(tr * PI) * 0.25;

  gl_FragColor = vec4(col, 1.0);
}
`
