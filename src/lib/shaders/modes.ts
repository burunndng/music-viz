import { commonGLSL } from './common'

function fullscreenVert() {
  return `in vec2 position; void main() { gl_Position = vec4(position, 0.0, 1.0); }`
}

function fragBody(body: string) {
  return commonGLSL + `
uniform vec2 uResolution; out vec4 fragColor;
void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution) / min(uResolution.x, uResolution.y);
  float t = uTime * uSpeed;
  float ar = uAudioOn * uReactivity;
  vec3 col;
` + body + `
  col = applyPostFX(col);
  fragColor = vec4(col, 1.0);
}`
}

/* ── 0: FORM CONSTANTS (Klüver) ── */
export const formConstants = {
  vertex: fullscreenVert(),
  fragment: fragBody(`
    vec2 p = warpToMouse(uv);
    float r = length(p) + 1e-3, th = atan(p.y, p.x) + t * 0.15;
    float cx = cortX(r);
    float kr = mix(14.0, 46.0, uComplexity);
    float m = floor(mix(3.0, 12.0, uComplexity));
    float tunnel = cos(kr * cx - t * 1.3);
    float spiral = cos(kr * cx + m * th - t);
    float fan = cos(m * th - t * 1.1);
    float lattice = cos(kr * cx + m * th - t) * cos(kr * cx - m * th - t);
    int pf = uPlanform;
    float v;
    if (pf == 1) v = tunnel;
    else if (pf == 2) v = spiral;
    else if (pf == 3) v = lattice;
    else {
      float s1 = 0.5 + 0.5 * sin(t * 0.13), s2 = 0.5 + 0.5 * sin(t * 0.09 + 1.7);
      float s3 = 0.5 + 0.5 * sin(t * 0.17 + 3.0);
      v = mix(tunnel, spiral, s1);
      v = mix(v, fan, s2 * 0.5);
      v = mix(v, lattice, s3 * 0.5);
    }
    float fl = uFlicker * 0.22 * (0.5 + 0.5 * sin(uTime * TAU * uFlickerHz));
    float act = smoothstep(-0.2, 0.45, v + fl);
    col = PAL(fract(0.55 * v + 0.18 * cx - t * 0.05 + uBass * ar * 0.2), uPalette) * (0.4 + 0.75 * act);
    col *= smoothstep(0.0, 0.10, r);
    col += col * uBeat * ar * 0.3;
  `),
}

/* ── 1: NEURAL FIELD (fallback — domain-warped fBm with symmetry) ── */
export const neuralField = {
  vertex: fullscreenVert(),
  fragment: fragBody(`
    vec2 p = warpToMouse(uv);
    int oc = octaves();
    vec2 q = vec2(
      fbm(p + vec2(0.0, t * 0.12 + uBass * ar * 0.4), oc),
      fbm(p + vec2(5.2, 1.3) - t * 0.10, oc)
    );
    vec2 b = vec2(
      fbm(p + 4.0 * q + vec2(1.7, 9.2) + t * 0.15 + uMid * ar * 0.2, oc),
      fbm(p + 4.0 * q + vec2(8.3, 2.8), oc)
    );
    float f = fbm(p + 4.0 * b, oc);
    float stripe = sin(f * 18.0 + t * 0.8 + uBass * ar * 3.0);
    float spot = smoothstep(0.1, 0.3, abs(f - 0.5));
    col = PAL(fract(f + 0.18 * length(b) - 0.04 * t + uTreble * ar * 0.2), uPalette);
    col *= 0.35 + 0.85 * spot;
    col += PAL(fract(0.5 + stripe * 0.3), uPalette) * 0.15 * ar;
    col += col * uBeat * ar * 0.35;
  `),
}

/* ── 2: TURING FLUX (fallback — noise-based pattern) ── */
export const turingFlux = {
  vertex: fullscreenVert(),
  fragment: fragBody(`
    vec2 p = warpToMouse(uv);
    float scale = mix(2.0, 6.0, uComplexity);
    vec2 g = p * scale;
    float v = 0.0;
    for (int i = 0; i < 3; i++) {
      float fi = float(i);
      vec2 q = g + vec2(sin(t * 0.3 + fi * 2.1), cos(t * 0.25 + fi * 1.7));
      v += sin(q.x * 3.0 + t) * cos(q.y * 3.0 - t * 0.7 + uBass * ar * 2.0) * 0.33;
    }
    float stripes = sin(v * 8.0 + t * 1.5 + uMid * ar * 3.0);
    float spots = smoothstep(0.05, 0.15, abs(fract(v * 2.0 + t * 0.3) - 0.5));
    col = PAL(fract(v + 0.1 * t + uCentroid * 0.3), uPalette);
    col *= 0.25 + 0.8 * spots;
    col += PAL(fract(0.5 + stripes * 0.3), uPalette) * 0.12 * ar;
    col += col * uBeat * ar * 0.3;
  `),
}

/* ── 3: SACRED GEOMETRY (phyllotaxis + dihedral symmetry) ── */
export const sacredGeometry = {
  vertex: fullscreenVert(),
  fragment: fragBody(`
    vec2 p = warpToMouse(uv);
    float r = length(p) + 1e-3;
    float th = atan(p.y, p.x) + t * 0.08;
    float N = max(3.0, uSymmetry);
    float cnt = mix(28.0, 90.0, uComplexity);
    float golden = 2.39996323;
    float glow = 0.0;
    for (int i = 1; i <= 90; i++) {
      if (float(i) > cnt) break;
      float fi = float(i);
      vec2 c = 0.045 * sqrt(fi) * vec2(
        cos(fi * golden + t * 0.25 + uBass * ar * 2.0),
        sin(fi * golden + t * 0.25 + uBass * ar * 2.0)
      );
      glow += smoothstep(0.03, 0.0, length(p - fold(c, N)));
    }
    int oc = octaves();
    vec2 q = fold(rot(t * 0.08) * p * (1.0 + 0.18 * sin(t * 0.5 + uBeat * ar)), N);
    float pat = fbm(q * 3.0 + vec2(t * 0.18, 0.0), oc)
              + 0.5 * fbm(q * 6.0 - t * 0.1, oc);
    col = PAL(fract(pat + 0.12 * t + uBass * ar * 0.3), uPalette) * (0.5 + 0.6 * pat);
    col += PAL(fract(0.3 + t * 0.1), uPalette) * glow * 0.9;
    col += col * uBeat * ar * 0.4;
  `),
}

/* ── 4: BREATHING WALLS (domain-warped fBm) ── */
export const breathingWalls = {
  vertex: fullscreenVert(),
  fragment: fragBody(`
    vec2 p = warpToMouse(uv);
    int oc = octaves();
    vec2 q = vec2(
      fbm(p + vec2(0.0, t * 0.12 + uBass * ar * 0.3), oc),
      fbm(p + vec2(5.2, 1.3) - t * 0.10, oc)
    );
    vec2 b = vec2(
      fbm(p + 4.0 * q + vec2(1.7, 9.2) + t * 0.15, oc),
      fbm(p + 4.0 * q + vec2(8.3, 2.8), oc)
    );
    float f = fbm(p + 4.0 * b, oc);
    col = PAL(fract(f + 0.18 * length(b) - 0.04 * t + uTreble * ar * 0.2), uPalette);
    col = mix(col, PAL(fract(0.5 + length(q) * 0.6), uPalette), 0.35);
    col *= 0.45 + 0.85 * f;
    col += col * uBeat * ar * 0.35;
  `),
}

/* ── 5: HYPERSPACE (2D kaleidoscopic tunnel — fallback when uRay off) ── */
export const hyperspace = {
  vertex: fullscreenVert(),
  fragment: fragBody(`
    vec2 p = warpToMouse(uv);
    float n = max(6.0, uSymmetry);
    vec2 q = fold(p, n);
    float r = length(p) + 0.08;
    float a = atan(q.y, q.x);
    float depth = 1.0 / r + t * 0.6;
    int oc = octaves();
    vec2 tp = vec2(a * 3.0, depth);
    float pat = fbm(tp * 2.0, oc) + 0.5 * fbm(tp * 5.0 - t, oc)
              + 0.5 * sin(depth * 6.0 + a * n);
    col = PAL(fract(pat * 0.6 + depth * 0.08 - t * 0.1 + uBass * ar * 0.3), uPalette);
    col *= 0.4 + 1.2 * smoothstep(0.0, 0.5, r);
    col += PAL(fract(t * 0.2), uPalette) * exp(-r * 5.0) * 1.2;
    col += col * uBeat * ar * 0.5;
  `),
}

/* ── 6: HYPERSPACE 3D (raymarched tunnel — used when uRay on) ── */
export const hyperspace3D = {
  vertex: fullscreenVert(),
  fragment: fragBody(`
    vec2 p = warpToMouse(uv);
    vec3 rd = normalize(vec3(p * 1.1, 1.5));
    rd.xy = rot(t * 0.12) * rd.xy;
    float N = max(5.0, uSymmetry);
    vec3 acc = vec3(0.0);
    float z = 0.4;
    for (int i = 0; i < 40; i++) {
      vec3 q = vec3(rd.xy * z, z + t * 2.2);
      float a = atan(q.y, q.x), r = length(q.xy) + 1e-3;
      a = mod(a, TAU / N); a = abs(a - PI / N);
      float cell = sin(a * N * 1.5) * 0.5 + sin(r * 5.0 - q.z * 1.8) + sin(q.z * 2.0);
      float dens = smoothstep(0.3, 1.0, 0.5 + 0.5 * cell) * exp(-r * 0.7);
      acc += PAL(fract(q.z * 0.04 + 0.15 * cell + t * 0.05 + uBass * ar * 0.3), uPalette) * dens * 0.06;
      z += 0.14;
    }
    col = acc * (1.0 / (1.0 + dot(p, p) * 0.25));
    col *= 1.0 + uBeat * ar * 0.5;
  `),
}

/* ── 7: HYPERBOLIC (Poincaré disk tessellation) ── */
export const hyperbolic = {
  vertex: fullscreenVert(),
  fragment: fragBody(`
    vec2 p = warpToMouse(uv);
    vec2 z = p * 0.5;
    float R = length(z);
    if (R > 0.98) z *= 0.98 / R;
    float a = 0.34 * sin(t * 0.13 + uBass * ar * 2.0);
    z = cdiv(vec2(z.x - a, z.y), vec2(1.0 - a * z.x, -a * z.y));
    z = rot(t * 0.05) * z;
    float P = max(3.0, floor(uSymmetry));
    vec2 cc = vec2(1.15, 0.0);
    float rho2 = dot(cc, cc) - 1.0;
    float cell = 0.0;
    for (int i = 0; i < 10; i++) {
      float an = atan(z.y, z.x), r2 = length(z);
      an = mod(an, TAU / P); an = abs(an - PI / P);
      z = r2 * vec2(cos(an), sin(an));
      vec2 zz = z - cc;
      float dd = dot(zz, zz);
      if (dd < rho2) { z = cc + zz * (rho2 / dd); cell += 1.0; }
      else break;
    }
    float v = cell * 0.18 + 0.35 * length(z) + 0.08 * t + uCentroid * 0.3;
    col = PAL(fract(v + uBass * ar * 0.2), uPalette) * (0.45 + 0.55 * sin(cell * 1.7 + length(z) * 4.0));
    col = max(col, 0.0);
  `),
}

/* ── 8: ENTOPTIC (visual snow · blue-field) ── */
export const entoptic = {
  vertex: fullscreenVert(),
  fragment: fragBody(`
    vec3 c = vec3(0.015, 0.015, 0.03);
    float sn = hash21(floor(gl_FragCoord.xy) + floor(t * 28.0));
    c += vec3(sn * sn) * 0.22;
    for (int i = 0; i < 6; i++) {
      float fi = float(i);
      vec2 ctr = 0.45 * vec2(sin(t * 0.3 + fi * 1.3), cos(t * 0.23 + fi * 1.9));
      c += PAL(fract(0.12 * fi + 0.05 * t), uPalette) * 0.05 / (length(uv - ctr) * 7.0 + 0.3);
    }
    for (int i = 0; i < 24; i++) {
      float fi = float(i);
      float an = fi * 2.4 + t * (1.4 + 0.4 * sin(fi));
      float rad = 0.08 + 0.34 * fract(fi * 0.137 + 0.1 * sin(t * 0.2 + fi));
      vec2 ctr = rad * vec2(cos(an), sin(an * 0.9));
      c += vec3(0.55, 0.78, 1.0) * 0.018 / (length(uv - ctr) * 70.0 + 0.4);
    }
    c += PAL(fract(0.5 + uCentroid * 0.3), uPalette) * uBeat * ar * 0.15;
    col = c;
  `),
}

/* ── 9: QUASICRYSTAL (N-fold plane wave interference) ── */
export const quasicrystal = {
  vertex: fullscreenVert(),
  fragment: fragBody(`
    vec2 p = warpToMouse(uv) * mix(3.0, 8.0, uComplexity);
    float N = clamp(floor(uSymmetry), 3.0, 12.0);
    float v = 0.0;
    float ph = t * 0.5 + uBass * ar * 4.0;
    for (int i = 0; i < 12; i++) {
      if (float(i) >= N) break;
      float a = PI * float(i) / N;
      v += cos(p.x * cos(a) + p.y * sin(a) + ph);
    }
    v /= N;
    float band = 0.5 + 0.5 * cos(v * PI * 4.0 + t + uBeat * ar);
    col = PAL(fract(v * 0.6 + 0.1 * t + uCentroid * 0.3), uPalette) * (0.35 + 0.95 * band);
    col += col * uBeat * ar * 0.3;
  `),
}

/* ── 10: CYMATICS (Chladni nodal lines) ── */
export const cymatics = {
  vertex: fullscreenVert(),
  fragment: fragBody(`
    vec2 p = warpToMouse(uv);
    float n = floor(mix(2.0, 9.0, uComplexity)) + floor(uMid * ar * 5.0);
    float m = floor(mix(1.0, 7.0, uComplexity)) + floor(uTreble * ar * 5.0);
    float f = cos(n * PI * p.x * 0.5) * cos(m * PI * p.y * 0.5)
            - cos(m * PI * p.x * 0.5) * cos(n * PI * p.y * 0.5);
    f += 0.3 * sin(t * 0.5 + uBeat * ar * 0.5) * cos((n + m) * PI * length(p) * 0.4);
    float nodal = smoothstep(0.07, 0.0, abs(f));
    col = PAL(fract(0.5 + 0.25 * f + 0.08 * t + uBass * ar * 0.2), uPalette) * (0.12 + nodal * 1.1);
    col += vec3(0.9, 0.85, 0.7) * nodal * 0.4;
  `),
}


/* ── Mandelbox distance estimator ── */
const mandelboxDE = /* glsl */ `
float deMandelbox(vec3 p, float scale) {
  vec3 z = p; float dr = 1.0;
  for (int i = 0; i < 9; i++) {
    z = clamp(z, -1.0, 1.0) * 2.0 - z;
    float r2 = dot(z, z);
    if (r2 < 0.25) { z *= 4.0; dr *= 4.0; }
    else if (r2 < 1.0) { z /= r2; dr /= r2; }
    z = z * scale + p;
    dr = dr * abs(scale) + 1.0;
  }
  return length(z) / abs(dr);
}
`

/* ── 15: FRACTAL (Mandelbox flythrough — custom main) ── */
export const fractal = {
  vertex: fullscreenVert(),
  fragment: commonGLSL + `
uniform vec2 uResolution; out vec4 fragColor;
${mandelboxDE}
void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution) / min(uResolution.x, uResolution.y);
  float t = uTime * uSpeed;
  float ar = uAudioOn * uReactivity;
  vec2 p = warpToMouse(uv);
  vec3 ro = vec3(0.0, 0.0, -3.4 + t * 0.5);
  vec3 rd = normalize(vec3(p * 0.9, 1.4));
  rd.xy = rot(t * 0.05) * rd.xy; rd.yz = rot(t * 0.03) * rd.yz;
  float scale = 2.6 + 0.4 * sin(t * 0.1) + uBass * ar * 0.4;
  float tt = 0.05, glow = 0.0;
  bool hit = false;
  vec3 pos = ro;
  for (int i = 0; i < 90; i++) {
    pos = ro + rd * tt;
    float d = deMandelbox(pos, scale);
    glow += 0.008 / (1.0 + d * d * 120.0);
    if (d < 0.0012) { hit = true; break; }
    if (tt > 18.0) break;
    tt += d * 0.75;
  }
  vec3 col = vec3(0.0);
  if (hit) {
    vec2 e = vec2(0.0009, 0.0);
    vec3 n = normalize(vec3(
      deMandelbox(pos + e.xyy, scale) - deMandelbox(pos - e.xyy, scale),
      deMandelbox(pos + e.yxy, scale) - deMandelbox(pos - e.yxy, scale),
      deMandelbox(pos + e.yyx, scale) - deMandelbox(pos - e.yyx, scale)));
    vec3 lig = normalize(vec3(0.6, 0.7, -0.4));
    float dif = clamp(dot(n, lig), 0.0, 1.0), amb = 0.22 + 0.28 * n.y;
    float ao = 1.0 / (1.0 + tt * 0.18), fog = exp(-tt * 0.14);
    col = PAL(fract(0.14 * tt + 0.3 * dif + uCentroid * 0.3 - t * 0.04), uPalette) * (amb + dif) * ao * fog;
    col += PAL(fract(0.5 + 0.1 * tt), uPalette) * pow(dif, 10.0) * 0.5 * fog;
  }
  col += PAL(fract(0.6 + glow * 0.8), uPalette) * min(glow, 1.2) * 0.45;
  col *= 0.9 + uLevel * ar * 0.4;
  col = applyPostFX(col);
  fragColor = vec4(col, 1.0);
}
`,
}


/* ── 11: IMAGE WARP (kaleidoscope + image texture) ── */
export const imageWarp = {
  vertex: fullscreenVert(),
  fragment: fragBody(`
    vec2 p = warpToMouse(uv);
    vec2 q = fold(rot(t * 0.05) * p, max(2.0, uSymmetry));
    q += uMid * ar * 0.12 * vec2(sin(q.y * 5.0 + t), cos(q.x * 5.0 + t));
    vec2 imgUv = fract(q * mix(0.5, 1.2, uComplexity) + 0.5);
    vec3 img = texture(uImage, imgUv).rgb;
    float lum = dot(img, vec3(0.299, 0.587, 0.114));
    img = mix(img, PAL(fract(lum + 0.1 * t), uPalette), 0.15 + 0.4 * uAsc);
    col = img * (0.55 + 0.7 * lum);
  `),
}

/* ── 12: VORONOI / CELLULAR ── */
export const voronoi = {
  vertex: fullscreenVert(),
  fragment: fragBody(`
    vec2 p = warpToMouse(uv);
    float scale = mix(2.5, 7.5, uComplexity) + uBass * ar * 2.0;
    vec2 g = p * scale;
    vec2 ic = floor(g);
    vec2 f = fract(g);
    float F1 = 9.0, F2 = 9.0;
    vec2 id1 = vec2(0.0);
    int metric = int(mod(uSymmetry, 3.0));
    for (int j = -1; j <= 1; j++) {
      for (int i = -1; i <= 1; i++) {
        vec2 o = vec2(float(i), float(j));
        vec2 cc = ic + o;
        vec2 jt = 0.5 + 0.40 * vec2(
          sin(t * 0.7 + TAU * hash21(cc) + uMid * ar * 2.0),
          cos(t * 0.6 + TAU * hash21(cc + 7.1))
        );
        vec2 r = o + jt - f;
        float d;
        if (metric == 0) d = length(r);
        else if (metric == 1) d = abs(r.x) + abs(r.y);
        else d = max(abs(r.x), abs(r.y));
        if (d < F1) { F2 = F1; F1 = d; id1 = cc; }
        else if (d < F2) { F2 = d; }
      }
    }
    float wall = smoothstep(0.0, 0.07, F2 - F1);
    float dome = 1.0 - F1;
    float ch = hash21(id1);
    vec3 base = PAL(fract(ch * 0.7 + 0.10 * t + uCentroid * 0.3 + uTreble * ar * 0.2), uPalette);
    col = base * (0.28 + 0.95 * dome * dome);
    col *= 0.30 + 0.70 * wall;
    col += PAL(fract(ch + 0.5), uPalette) * (1.0 - wall) * (0.45 + 0.4 * uFlux * ar);
    col += col * uBeat * ar * 0.3;
    col *= smoothstep(0.0, 0.05, length(p));
  `),
}

/* ── 13: PHASOR / VINES (oriented flow filaments) ── */
export const phasorVines = {
  vertex: fullscreenVert(),
  fragment: fragBody(`
    vec2 p = warpToMouse(uv);
    float F = mix(2.0, 6.5, uComplexity) + uMid * ar * 3.0;
    float ang = fbm(p * 0.55 + vec2(0.0, t * 0.05), octaves()) * TAU + t * 0.08 + uBands0.w * 1.5;
    float ks = 1.3;
    vec2 g = p * ks, ic = floor(g);
    vec2 acc = vec2(0.0);
    for (int j = -1; j <= 1; j++) {
      for (int i = -1; i <= 1; i++) {
        vec2 o = vec2(float(i), float(j)), cc = ic + o;
        vec2 kp = (cc + 0.5) / ks;
        float a2 = ang + (hash21(cc) - 0.5) * 0.7;
        vec2 dir = vec2(cos(a2), sin(a2));
        float ph = TAU * F * dot(p - kp, dir) + TAU * hash21(cc + 3.3);
        float d = length(p - kp) * ks;
        float w = exp(-d * d * 1.3);
        acc += w * vec2(cos(ph), sin(ph));
      }
    }
    float phase = atan(acc.y, acc.x);
    float stripe = 0.5 + 0.5 * sin(phase);
    float vine = pow(stripe, 3.0);
    col = PAL(fract(phase / TAU + 0.08 * t + uCentroid * 0.3), uPalette) * (0.22 + 1.05 * vine);
    col += PAL(fract(0.5 + phase / TAU), uPalette) * smoothstep(0.85, 1.0, stripe) * (0.45 + 0.4 * uFlux * ar);
  `),
}

/* ── 14: DRAGONSCALES (fallback — hexagonal pattern without live CA) ── */
export const dragonScales = {
  vertex: fullscreenVert(),
  fragment: fragBody(`
    vec2 p = warpToMouse(uv);
    float scale = mix(4.0, 10.0, uComplexity);
    vec2 g = p * scale;
    const vec2 r = vec2(1.0, 1.7320508), h = r * 0.5;
    vec2 a = mod(g, r) - h, b = mod(g - h, r) - h;
    vec2 local = dot(a, a) < dot(b, b) ? a : b;
    float d = length(local);
    float edge = smoothstep(0.52, 0.40, d);
    float hex = smoothstep(0.0, 0.12, d);
    float pat = sin(d * 14.0 - t * 2.0 + uBass * ar * 3.0);
    float act = smoothstep(-0.2, 0.4, pat);
    col = PAL(fract(pat * 0.3 + t * 0.04 + uCentroid * 0.3), uPalette) * (0.3 + 0.8 * act);
    col *= edge;
    col += PAL(fract(0.5 + 0.1 * t), uPalette) * pow(max(0.0, 1.0 - d * 2.5), 4.0) * 0.3;
    col += col * uBeat * ar * 0.3;
  `),
}

/* ── 15: WAVEFORM / OSCILLOSCOPE ── */
export const waveform = {
  vertex: fullscreenVert(),
  fragment: fragBody(`
    vec2 q = uv * 2.4;
    q = rot(t * 0.03) * q;
    float r = length(q), a = atan(q.y, q.x);
    float s = abs(fract(a / TAU) * 2.0 - 1.0);
    vec2 wv = texture(uWaveform, vec2(s, 0.5)).rg * 2.0 - 1.0;
    float w = 0.011 + 0.6 / uResolution.y;
    float dL = abs(r - (0.98 + wv.x * 0.52));
    float dR = abs(r - (0.60 + wv.y * 0.30));
    vec3 cL = PAL(fract(s * 0.6 + 0.10 * t + uCentroid * 0.3), uPalette);
    vec3 cR = PAL(fract(s * 0.6 + 0.5 + 0.10 * t), uPalette);
    col = cL * smoothstep(w, 0.0, dL) * 1.1 + cL * smoothstep(0.05, 0.0, dL) * 0.10;
    col += cR * smoothstep(w, 0.0, dR) * 0.9 + cR * smoothstep(0.05, 0.0, dR) * 0.08;
    col += vec3(0.85, 0.9, 1.05) * smoothstep(0.03, 0.0, r) * (0.35 + uLevel * ar * 0.9);
    col *= 0.9 + uLevel * ar * 0.4;
  `),
}

/* ── 16: PARTICLE FLOW (fallback — animated noise field) ── */
export const particleFlow = {
  vertex: fullscreenVert(),
  fragment: fragBody(`
    vec2 p = warpToMouse(uv);
    int oc = octaves();
    float acc = 0.0;
    for (int i = 0; i < 40; i++) {
      float fi = float(i);
      vec2 q = p * (2.0 + fi * 0.05);
      q += vec2(sin(t * 0.3 + fi * 0.7), cos(t * 0.25 + fi * 0.5)) * 0.3;
      float v = vnoise(q + t * 0.1);
      acc += v / (1.0 + fi * 0.15);
    }
    acc /= 3.0;
    float glow = acc * acc * 3.0;
    col = PAL(fract(glow * 0.8 + t * 0.05 + uCentroid * 0.3), uPalette) * glow;
    col += PAL(fract(0.6 + t * 0.02), uPalette) * glow * 0.3;
    col *= 1.0 + uBeat * ar * 0.5;
  `),
}

/* ── 17: WEIER WELLS (elliptic ℘ function domain colouring) ── */
export const weierWells = {
  vertex: fullscreenVert(),
  fragment: commonGLSL + `
uniform vec2 uResolution; out vec4 fragColor;
vec2 cmulC(vec2 a, vec2 b) { return vec2(a.x*b.x - a.y*b.y, a.x*b.y + a.y*b.x); }
void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution) / min(uResolution.x, uResolution.y);
  float t = uTime * uSpeed;
  float ar = uAudioOn * uReactivity;
  vec2 p = warpToMouse(uv);
  vec2 z = p * mix(1.4, 3.2, uComplexity);
  vec2 w1 = vec2(1.0, 0.0);
  float inhale = 1.0 - (uBands0.y * 0.18 + uBeatPulse * 0.10);
  float reT = 0.5 + 0.4 * sin(t * 0.07 + uBands0.z * 2.0);
  float imT = mix(0.62, 0.95, uComplexity) * inhale;
  imT = max(imT, 0.30);
  vec2 w2 = vec2(reT, imT);
  mat2 B = mat2(w1, w2);
  vec2 mn = inverse(B) * z;
  mn = floor(mn + 0.5);
  z -= B * mn;
  vec2 I = vec2(1.0, 0.0);
  vec2 wp = cdiv(I, cmulC(z, z));
  for (int j = -3; j <= 3; j++) {
    for (int i = -3; i <= 3; i++) {
      if (i == 0 && j == 0) continue;
      vec2 om = w1 * float(i) + w2 * float(j);
      vec2 d = z - om;
      wp += cdiv(I, cmulC(d, d)) - cdiv(I, cmulC(om, om));
    }
  }
  float ang = atan(wp.y, wp.x);
  float mag = length(wp) + 1e-6;
  float lm = fract(log(mag) * 0.5 - t * 0.15);
  float terr = smoothstep(0.0, 0.08, lm) * smoothstep(1.0, 0.92, lm);
  float ridgeN = max(2.0, floor(uSymmetry));
  float phase = abs(fract(ang / TAU * ridgeN) - 0.5) * 2.0;
  vec3 col = PAL(fract(ang / TAU + 0.10 * t + uCentroid * 0.3), uPalette);
  col *= (0.35 + 0.65 * terr);
  col = mix(col, col * 0.22, smoothstep(0.25, 0.0, phase));
  float bloom = smoothstep(8.0, 42.0, mag) * (0.6 + 0.9 * uBeat * ar + 0.7 * uBeatPulse);
  col += PAL(fract(0.6), uPalette) * bloom * 0.6 + vec3(bloom * bloom * 0.5);
  col = max(col, 0.0);
  col = applyPostFX(col);
  fragColor = vec4(col, 1.0);
}
`,
}

/* ── 18: BLASCHKE ROSETTE (finite Blaschke product domain colouring) ── */
export const blaschkeRosette = {
  vertex: fullscreenVert(),
  fragment: commonGLSL + `
uniform vec2 uResolution; out vec4 fragColor;
vec2 cmul(vec2 a, vec2 b) { return vec2(a.x*b.x - a.y*b.y, a.x*b.y + a.y*b.x); }
vec2 cmulConj(vec2 a, vec2 b) { return vec2(a.x*b.x + a.y*b.y, a.x*b.y - a.y*b.x); }
void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution) / min(uResolution.x, uResolution.y);
  float t = uTime * uSpeed;
  float ar = uAudioOn * uReactivity;
  vec2 p = warpToMouse(uv);
  vec2 z = p * 0.62;
  float R = length(z);
  if (R > 0.985) z *= 0.985 / R;
  R = length(z);
  int n = int(clamp(uSymmetry, 2.0, 9.0));
  float fn = float(n);
  float drift = 0.30 + 0.34 * clamp(uBands0.y + 0.5 * uBass * ar, 0.0, 1.0);
  drift = clamp(drift, 0.0, 0.86);
  float dph = t * 0.10 + uBands0.w * 1.6;
  vec2 c = drift * vec2(cos(dph) * sin(t * 0.11), cos(t * 0.09));
  float cl = length(c);
  if (cl > 0.92) c *= 0.92 / cl;
  vec2 cc = vec2(c.x, -c.y);
  float r0 = mix(0.42, 0.62, uComplexity);
  float rot0 = t * 0.07;
  vec2 B = vec2(1.0, 0.0);
  vec2 LB = vec2(0.0, 0.0);
  float nearZero = 1e9;
  for (int k = 0; k < 9; k++) {
    if (k >= n) break;
    float ph = TAU * float(k) / fn + rot0;
    vec2 a0 = r0 * vec2(cos(ph), sin(ph));
    vec2 ak = cdiv(a0 + c, vec2(1.0, 0.0) + cmul(cc, a0));
    float ar2 = length(ak);
    if (ar2 > 0.985) ak *= 0.985 / ar2;
    vec2 num = z - ak;
    vec2 den = vec2(1.0, 0.0) - cmulConj(ak, z);
    B = cmul(B, cdiv(num, den));
    LB += cdiv(vec2(1.0, 0.0), num) + cdiv(vec2(ak.x, -ak.y), den);
    nearZero = min(nearZero, length(num));
  }
  float th = t * 0.13 + uCentroid * PI;
  B = cmul(B, vec2(cos(th), sin(th)));
  float thB = atan(B.y, B.x);
  float magB = length(B);
  vec2 dB = cmul(B, LB);
  float thD = atan(dB.y, dB.x);
  float magD = length(dB);
  vec3 col = PAL(fract(thD / TAU + 0.10 * t + uCentroid * 0.3), uPalette);
  float iso = abs(fract(thB / TAU * fn) - 0.5) * 2.0;
  float isoSharp = mix(0.40, 0.20, uComplexity);
  col *= 0.40 + 0.60 * smoothstep(0.15, isoSharp, iso);
  float fil = smoothstep(0.28, 0.0, abs(magB - 1.0));
  float airAmt = 0.5 + 1.1 * (uBands1.y + uBands1.z);
  col += PAL(fract(0.5 + thB / TAU), uPalette) * fil * airAmt * 0.6;
  float zeroGlow = exp(-nearZero * nearZero * 26.0);
  col += PAL(fract(0.5), uPalette) * zeroGlow * (1.0 + 1.6 * uBeatPulse) * 1.2;
  float crit = smoothstep(0.05, 0.0, magD);
  col += PAL(fract(0.72), uPalette) * crit * (0.7 + 1.4 * uBands1.y) * 0.9;
  col *= smoothstep(1.0, 0.90, R / 0.985);
  col = max(col, 0.0);
  col = applyPostFX(col);
  fragColor = vec4(col, 1.0);
}
`,
}

/* ── 19: INDRA'S NECKLACE (Kleinian limit set) ── */
export const indrasNecklace = {
  vertex: fullscreenVert(),
  fragment: commonGLSL + `
uniform vec2 uResolution; out vec4 fragColor;
void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution) / min(uResolution.x, uResolution.y);
  float t = uTime * uSpeed;
  float ar = uAudioOn * uReactivity;
  vec2 p = warpToMouse(uv);
  float symN = clamp(floor(uSymmetry), 2.0, 12.0);
  if (uSymmetry > 2.5) p = fold(rot(t * 0.04) * p, symN);
  vec2 z = p * 1.18;
  const float R = 1.5;
  float th = 0.55 * sin(t * 0.10) + uBands0.w * 1.4;
  float th2 = -0.55 * cos(t * 0.13) - uBands0.x * 1.4;
  float phi = t * 0.06 + 0.30 * sin(t * 0.07);
  float r = clamp(0.62 + uBass * ar * 0.12 + uBands0.x * 0.06, 0.40, 0.80);
  float r2 = r * r;
  vec2 cen[4];
  for (int k = 0; k < 4; k++) {
    float ang = phi + float(k) * 1.5707963;
    cen[k] = R * vec2(cos(ang), sin(ang));
  }
  vec2 eA = r2 * vec2(cos(th), sin(th));
  vec2 eB = r2 * vec2(cos(th2), sin(th2));
  vec4 g1[4]; vec4 g2[4];
  vec2 Aa = cen[2]; vec2 Ba = eA - cmul(cen[0], cen[2]);
  vec2 Ca = vec2(1.0, 0.0); vec2 Da = -cen[0];
  g1[0] = vec4(Aa, Ba); g2[0] = vec4(Ca, Da);
  g1[1] = vec4(Da, -Ba); g2[1] = vec4(-Ca, Aa);
  vec2 Ab = cen[3]; vec2 Bb = eB - cmul(cen[1], cen[3]);
  vec2 Cb = vec2(1.0, 0.0); vec2 Db = -cen[1];
  g1[2] = vec4(Ab, Bb); g2[2] = vec4(Cb, Db);
  g1[3] = vec4(Db, -Bb); g2[3] = vec4(-Cb, Ab);
  vec2 ic[4];
  ic[0] = cen[0]; ic[1] = cen[2]; ic[2] = cen[1]; ic[3] = cen[3];
  int STEPS = int(mix(20.0, 40.0, clamp(uComplexity + uMid * ar * 0.4, 0.0, 1.0)));
  float deriv = 1.0; float trap = 0.0; float wordH = 0.0; float mind = 1e9;
  bool escaped = false;
  for (int s = 0; s < 40; s++) {
    if (s >= STEPS) break;
    int hit = -1;
    for (int k = 0; k < 4; k++) {
      if (length(z - ic[k]) < r) hit = k;
    }
    if (hit < 0) { escaped = true;
      for (int k = 0; k < 4; k++) mind = min(mind, abs(length(z - ic[k]) - r));
      break;
    }
    vec2 den = cmul(g2[hit].xy, z) + g2[hit].zw;
    float dd = length(cmul(g1[hit].xy, g2[hit].zw) - cmul(g1[hit].zw, g2[hit].xy)) / (dot(den, den) + 1e-6);
    deriv *= dd;
    z = cdiv(cmul(g1[hit].xy, z) + g1[hit].zw, cmul(g2[hit].xy, z) + g2[hit].zw);
    wordH += float(hit) + 1.0 + 0.25 * float(hit * hit);
    trap += 1.0;
  }
  float distLambda = escaped ? (mind / max(deriv, 1e-6)) : 0.0;
  float ang = atan(z.y, z.x);
  float hueK = fract(trap * 0.055 + wordH * 0.013 + uCentroid * 0.30 + ang * 0.04 + 0.04 * t);
  vec3 col = PAL(hueK, uPalette);
  col *= 0.22 + 0.55 * smoothstep(0.0, 0.06, distLambda);
  float flare = 1.0 + uFlux * 1.4 * ar + uBeat * ar * 1.1;
  col += PAL(fract(0.55 + uCentroid * 0.3), uPalette) * exp(-distLambda * 55.0) * 1.25 * flare;
  col *= 0.45 + 1.10 * clamp(deriv * 0.06, 0.0, 1.0);
  if (!escaped) col += PAL(fract(0.6 + uCentroid * 0.3), uPalette) * (0.9 + 0.6 * uBeat * ar);
  col *= 1.0 / (1.0 + dot(p, p) * 0.18);
  col = max(col, 0.0);
  col = applyPostFX(col);
  fragColor = vec4(col, 1.0);
}
`,
}


/* ── 20: ARNOLD TONGUES (sine circle map parameter plane) ── */
export const arnoldTongues = {
  vertex: fullscreenVert(),
  fragment: commonGLSL + `
uniform vec2 uResolution; out vec4 fragColor;
float arnoldWind(float Omega, float K, float seed, int N) {
  float th = seed;
  for (int n = 0; n < 20; n++) { th += Omega - (K / TAU) * sin(TAU * th); }
  float th0 = th, steps = 0.0;
  for (int n = 0; n < 48; n++) {
    if (n >= N) break;
    th += Omega - (K / TAU) * sin(TAU * th);
    steps += 1.0;
  }
  return (th - th0) / max(steps, 1.0);
}
void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution) / min(uResolution.x, uResolution.y);
  float t = uTime * uSpeed;
  float ar = uAudioOn * uReactivity;
  vec2 p = warpToMouse(uv);
  float click = floor(uBeat * 6.0) / 6.0;
  float Omega0 = 0.50 + (uCentroid - 0.5) * 0.45 + 0.025 * sin(t * 0.05) + click * 0.03;
  float Omega = Omega0 + p.x * 0.30;
  float energy = uBands1.y * 0.55 + uLevel * ar * 0.35;
  float yy = (p.y + 2.4) / 4.8;
  float K = 0.02 + yy * yy * (1.35 + energy * 0.9);
  K = clamp(K, 0.0, 1.7);
  int N = int(mix(30.0, 48.0, clamp(uComplexity, 0.0, 1.0)));
  float seed = 0.137 + 0.05 * sin(t * 0.07);
  float dO = 0.006;
  float W = arnoldWind(Omega, K, seed, N);
  float W2 = arnoldWind(Omega + dO, K, seed, N);
  float slope = abs(W2 - W) / dO;
  float lock = 1.0 - smoothstep(0.12, 0.85, slope);
  float edge = smoothstep(0.20, 0.55, slope) * (1.0 - smoothstep(1.6, 3.2, slope));
  edge *= lock + 0.15;
  float q = clamp(uSymmetry, 2.0, 18.0);
  float Wq = floor(W * q + 0.5) / q;
  float Wc = mix(W, Wq, 0.55);
  vec3 col = PAL(fract(Wc + 0.07 * t), uPalette);
  col *= 0.16 + 1.55 * lock;
  col += PAL(fract(0.30 + W * 3.0 + t * 0.10), uPalette) * edge * (0.40 + 0.7 * uFlux * ar);
  col += PAL(fract(W * 5.0 - t * 0.06), uPalette)
       * smoothstep(1.0, 1.45, K) * (0.08 + 0.22 * energy)
       * (0.5 + 0.5 * sin(W * 38.0 + t));
  col *= 0.85 + 0.15 * smoothstep(0.0, 0.6, length(p));
  col = max(col, 0.0);
  col = applyPostFX(col);
  fragColor = vec4(col, 1.0);
}
`,
}

/* ── 21: GAUSSIAN HALO (ℤ[i] prime constellation) ── */
export const gaussianHalo = {
  vertex: fullscreenVert(),
  fragment: commonGLSL + `
uniform vec2 uResolution; out vec4 fragColor;
bool isPrimeI(int n) {
  if (n < 2) return false; if (n == 2) return true;
  if ((n % 2) == 0) return false;
  for (int d = 3; d < 256; d += 2) { if (d * d > n) break; if ((n % d) == 0) return false; }
  return true;
}
bool gaussPrime(int a, int b) {
  int A = a < 0 ? -a : a, B = b < 0 ? -b : b;
  int N = A * A + B * B;
  if (A == 0 || B == 0) { int m = A + B; return isPrimeI(m) && ((m % 4) == 3); }
  return isPrimeI(N);
}
void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution) / min(uResolution.x, uResolution.y);
  float t = uTime * uSpeed;
  float ar = uAudioOn * uReactivity;
  vec2 p = warpToMouse(uv);
  p = rot(t * 0.02) * p;
  float scale = mix(3.5, 9.0, uComplexity);
  vec2 g = p * scale, ic = floor(g + 0.5);
  vec3 col = vec3(0.0);
  for (int j = -2; j <= 2; j++) {
    for (int i = -2; i <= 2; i++) {
      vec2 lp = ic + vec2(float(i), float(j));
      int a = int(lp.x), b = int(lp.y);
      if (!gaussPrime(a, b)) continue;
      int N = a * a + b * b;
      float d = length(g - lp);
      float ring = 0.5 + 0.5 * cos(float(N) * 0.20 - t * 2.0 + d * 5.0);
      col += PAL(fract(float(N) * 0.013 + uCentroid * 0.3 + 0.05 * t), uPalette)
           * exp(-d * d * 2.2) * (0.5 + 1.2 * ring) * (1.0 + 1.3 * uBeatPulse * ar);
    }
  }
  float halo = 0.5 + 0.5 * sin(length(g) * mix(2.0, 6.0, uComplexity) - t * 1.5);
  col += PAL(fract(0.55 - 0.02 * t), uPalette) * halo * halo * 0.06;
  col = max(col, 0.0);
  col = applyPostFX(col);
  fragColor = vec4(col, 1.0);
}
`,
}

/* ── 22: DEFECT GAS (excitable spiral waves) ── */
export const defectGas = {
  vertex: fullscreenVert(),
  fragment: fragBody(`
    vec2 p = warpToMouse(uv);
    int N = int(mix(3.0, 8.0, clamp(uComplexity + uMid * ar * 0.3, 0.0, 1.0)));
    float phase = 0.0, prox = 0.0, nearest = 1e9;
    for (int k = 0; k < 8; k++) {
      if (k >= N) break;
      float fk = float(k);
      vec2 c = 1.7 * vec2(sin(t * 0.23 + fk * 2.39 + uBands0.w * ar * 1.5),
                           cos(t * 0.19 + fk * 1.71 + uBands0.x * ar * 1.2));
      float q = float(k - (k / 2) * 2) == 0.0 ? 1.0 : -1.0;
      vec2 d = p - c;
      phase += q * atan(d.y, d.x);
      float dl = length(d);
      prox += 0.6 / (dl + 0.25);
      nearest = min(nearest, dl);
    }
    float wave = cos(phase + prox * mix(1.0, 3.0, uComplexity) - t * 3.0);
    float front = smoothstep(-0.1, 0.5, wave);
    col = PAL(fract(0.5 + 0.4 * wave + uCentroid * 0.3 - 0.03 * t), uPalette) * (0.25 + 0.8 * front);
    col += PAL(fract(0.6 + 0.1 * t), uPalette) * pow(max(0.0, wave), 10.0) * (0.4 + 0.6 * uFlux * ar);
    col += vec3(1.0, 0.95, 0.9) * exp(-nearest * nearest * 8.0) * (0.3 + 0.7 * uBeat * ar);
    col = max(col, vec3(0.0));
  `),
}

/* ── 23: PENTAGRID LOOM (de Bruijn pentagrid / Penrose dual) ── */
export const pentagridLoom = {
  vertex: fullscreenVert(),
  fragment: fragBody(`
    vec2 p = warpToMouse(uv);
    p = rot(t * 0.015) * p;
    p *= mix(1.8, 4.5, uComplexity);
    float edge = 1e9, lineGlow = 0.0;
    int idxSum = 0;
    for (int j = 0; j < 5; j++) {
      float a = TAU * float(j) / 5.0 + 0.2;
      vec2 e = vec2(cos(a), sin(a));
      float proj = dot(p, e) + 0.2 * float(j) + 0.15 * sin(t * 0.1 + float(j));
      float f = fract(proj), dl = min(f, 1.0 - f);
      edge = min(edge, dl);
      idxSum += int(floor(proj));
      lineGlow += smoothstep(0.04, 0.0, dl);
    }
    int cls = idxSum - (idxSum / 5) * 5;
    if (cls < 0) cls += 5;
    float hue = float(cls) / 5.0;
    col = PAL(fract(hue + 0.1 * t + uCentroid * 0.3), uPalette) * (0.42 + 0.58 * smoothstep(0.0, 0.12, edge));
    col += PAL(fract(hue + 0.5), uPalette) * lineGlow * (0.3 + 0.6 * uBands1.y * ar) * 0.4;
    col = max(col, 0.0);
  `),
}

/* ── 24: ATOMIC BEAT (hydrogen orbitals + quantum beat) ── */
export const atomicBeat = {
  vertex: fullscreenVert(),
  fragment: fragBody(`
    vec2 p = warpToMouse(uv) * 1.15;
    float r = length(p) + 1e-4;
    float c = p.y / r;
    int nA = 2, lA = 1;
    int nB = (uComplexity > 0.55) ? 4 : 3;
    int lB = (uSymmetry > 7.0) ? 3 : 2;
    if (nB <= lB) nB = lB + 1;
    // Legendre P_l(cos θ) — inline
    float angA, angB;
    if (lA == 0) angA = 1.0; else if (lA == 1) angA = c;
    else if (lA == 2) angA = 0.5 * (3.0 * c * c - 1.0); else angA = 0.5 * c * (5.0 * c * c - 3.0);
    if (lB == 0) angB = 1.0; else if (lB == 1) angB = c;
    else if (lB == 2) angB = 0.5 * (3.0 * c * c - 1.0); else angB = 0.5 * c * (5.0 * c * c - 3.0);
    // Radial (simplified Laguerre)
    float rhoA = 2.0 * r / float(nA);
    float rhoB = 2.0 * r / float(nB);
    float psiA = pow(rhoA, float(lA)) * exp(-0.5 * rhoA) * angA;
    float psiB = pow(rhoB, float(lB)) * exp(-0.5 * rhoB) * angB * 0.55;
    float w = clamp(0.30 + 0.55 * uCentroid, 0.05, 0.95);
    float wa = sqrt(1.0 - w), wb = sqrt(w);
    float omega = 1.10 + uBass * ar * 2.6 + uBands0.y * 1.6;
    float beatPhase = t * omega + uBeat * ar * PI;
    float re = wa * psiA + wb * psiB * cos(beatPhase);
    float im = wb * psiB * sin(beatPhase);
    float dens = re * re + im * im;
    float phase = atan(im, re);
    float gain = mix(1.6, 4.6, uComplexity);
    float lum = pow(clamp(dens * gain, 0.0, 1.0), 0.62);
    col = PAL(fract(phase / TAU + 0.12 * r - 0.05 * t + 0.30 * uCentroid), uPalette) * lum;
    col += PAL(fract(0.5 + phase / TAU), uPalette) * smoothstep(0.55, 1.0, lum) * (0.35 + 0.5 * uFlux * ar);
    float node = smoothstep(0.0, 0.045, sqrt(dens));
    col *= mix(1.0, node, 0.6 + 0.4 * uFlux * ar);
    col *= smoothstep(0.0, 0.06, r);
    col = max(col, 0.0);
  `),
}

/* ── 25: DENOM DESCENT (modular Farey tessellation) ── */
export const denomDescent = {
  vertex: fullscreenVert(),
  fragment: fragBody(`
    vec2 p = warpToMouse(uv);
    vec2 z = vec2(p.x * mix(0.5, 1.1, uComplexity), (p.y + 2.55) * 0.46);
    z.x += 0.12 * sin(t * 0.05);
    z.y = max(z.y, 0.015);
    int depth = 0;
    float wall = 1e9;
    for (int k = 0; k < 48; k++) {
      z.x -= floor(z.x + 0.5);
      wall = min(wall, 0.5 - abs(z.x));
      float r2 = dot(z, z);
      wall = min(wall, abs(sqrt(r2) - 1.0));
      if (r2 < 1.0) { z = -z / r2; depth++; } else break;
    }
    float hue = fract(float(depth) * 0.105 + z.x * 0.6 + uCentroid * 0.3 + 0.04 * t);
    col = PAL(hue, uPalette) * (0.28 + 0.72 * smoothstep(0.0, 0.6, z.y));
    col *= 0.40 + 0.60 * smoothstep(0.0, 0.05, wall);
    col += PAL(fract(hue + 0.5), uPalette) * exp(-wall * 26.0) * (0.3 + 0.7 * uFlux * ar);
    col = max(col, 0.0);
  `),
}

/* ── 26: WAVE CRYSTAL (sine-Gordon breather lattice) ── */
export const waveCrystal = {
  vertex: fullscreenVert(),
  fragment: fragBody(`
    vec2 p = warpToMouse(uv);
    float scale = mix(1.8, 4.5, uComplexity);
    vec2 q = p * scale;
    vec2 cell = floor(q + 0.5), f = q - cell;
    float om = 0.55 + 0.30 * (0.5 + 0.5 * sin(t * 0.2 + uBands0.y * 3.0));
    float k = sqrt(max(1e-3, 1.0 - om * om));
    float ph = om * (t * 1.6);
    float ux = 4.0 * atan((k / om) * sin(ph + cell.x * 1.7) / cosh(k * f.x * 3.2));
    float uy = 4.0 * atan((k / om) * cos(ph + cell.y * 1.3) / cosh(k * f.y * 3.2));
    float field = sin(0.5 * (ux + uy));
    float amp = abs(field);
    col = PAL(fract(0.5 + 0.4 * field + dot(cell, vec2(0.06, 0.04)) + uCentroid * 0.3 - 0.03 * t), uPalette)
        * (0.28 + 0.72 * amp);
    col += PAL(fract(0.62), uPalette) * pow(amp, 6.0) * (0.3 + 0.7 * uBeatPulse * ar);
    col = max(col, 0.0);
  `),
}

/* ── 27: PHASE PORTAL (continued-fraction domain colouring) ── */
export const phasePortal = {
  vertex: fullscreenVert(),
  fragment: commonGLSL + `
uniform vec2 uResolution; out vec4 fragColor;
void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution) / min(uResolution.x, uResolution.y);
  float t = uTime * uSpeed;
  float ar = uAudioOn * uReactivity;
  vec2 p = warpToMouse(uv);
  vec2 z = p * 0.85;
  int N = int(mix(6.0, 16.0, clamp(uComplexity, 0.0, 1.0)));
  float bSub = uBands0.x, bBass = uBands0.y, bLow = uBands0.z, bMid = uBands0.w;
  float bHigh = uBands1.x, bTre = uBands1.y, bAir = uBands1.z;
  vec2 h = vec2(0.0);
  bool seeded = false;
  for (int i = 0; i < 16; i++) {
    int k = N - i;
    if (k < 1) break;
    float fk = float(k);
    float hx = hash21(vec2(fk, 11.3));
    float hy = hash21(vec2(fk, 27.7));
    float band = (k <= 2) ? (0.6 + 1.4 * bBass + 0.8 * bSub)
               : (k <= 5) ? (0.9 + 1.2 * bLow + 0.9 * bMid)
                          : (1.3 + 1.6 * bTre + 1.1 * bHigh + bAir);
    float w = (0.10 + 0.05 * fk) * band;
    float pull = uFlux * 0.35 * sin(t * 1.7 + fk * 2.3);
    vec2 d = (0.55 - pull) * vec2(sin(t * w + hx * TAU), cos(t * w * 0.83 + hy * TAU));
    vec2 c = 0.7 + 0.6 * vec2(hx - 0.5, hy - 0.5);
    vec2 bk = vec2(z.x * c.x - z.y * c.y, z.x * c.y + z.y * c.x) + d;
    vec2 ak = 0.30 * vec2(cos(fk * 1.9), sin(fk * 1.9));
    if (!seeded) { h = bk; seeded = true; }
    else h = bk + cdiv(ak, h);
  }
  vec2 f = h;
  float modu = length(f);
  float ph = atan(f.y, f.x);
  float lm = log(modu + 1e-4);
  float hue = fract(ph / TAU + 0.04 * t + uCentroid * 0.30);
  vec3 col = PAL(hue, uPalette);
  float rings = fract(lm * mix(1.5, 4.0, clamp(uComplexity, 0.0, 1.0)) - t * 0.30);
  rings = pow(rings, 1.0 + 1.5 * uLevel * ar);
  col *= 0.35 + 0.90 * rings;
  float poleDark = modu / (1.0 + modu);
  col *= 0.22 + 0.78 * poleDark;
  float zeroGlow = 1.0 / (0.06 + modu * modu);
  vec3 coreCol = mix(PAL(hue, uPalette), vec3(1.0), 0.6);
  col += coreCol * clamp(zeroGlow * 0.05, 0.0, 6.0) * (0.7 + 0.9 * uFlux * ar);
  col = hueShift(col, uFlux * 0.6 * rings * ar);
  col = max(col, 0.0);
  col = applyPostFX(col);
  fragColor = vec4(col, 1.0);
}
`,
}

/* ── 28: VORTEX FIELD (Abrikosov vortex lattice) ── */
export const vortexField = {
  vertex: fullscreenVert(),
  fragment: fragBody(`
    vec2 p = warpToMouse(uv);
    p = rot(t * 0.03) * p;
    float scale = mix(2.0, 5.0, uComplexity) + uBass * ar * 1.0;
    vec2 g = p * scale;
    const vec2 b1 = vec2(1.0, 0.0), b2 = vec2(0.5, 0.8660254);
    const mat2 Binv = mat2(1.1547, 0.0, -0.5774, 1.1547);
    vec2 base = floor(Binv * g);
    float phase = 0.0, amp = 1.0, nearest = 1e9;
    for (int j = -1; j <= 1; j++) {
      for (int i = -1; i <= 1; i++) {
        vec2 cell = base + vec2(float(i), float(j));
        vec2 v = cell.x * b1 + cell.y * b2;
        v += 0.10 * vec2(sin(t * 0.5 + cell.x * 1.7 + uBands0.w * ar),
                          cos(t * 0.4 + cell.y * 2.1));
        vec2 d = g - v;
        float dl = length(d);
        phase += atan(d.y, d.x);
        amp *= tanh(dl * 1.7);
        nearest = min(nearest, dl);
      }
    }
    float fringe = 0.5 + 0.5 * cos(phase - t * 2.0 + uCentroid * 3.0);
    col = PAL(fract(phase / TAU + uCentroid * 0.3 + 0.04 * t), uPalette) * (0.2 + 0.85 * amp);
    col += PAL(fract(0.5 + 0.1 * t), uPalette) * pow(fringe, 4.0) * amp * 0.4;
    col += vec3(0.7, 0.85, 1.0) * exp(-nearest * nearest * 6.0) * (0.3 + 0.7 * uBeatPulse * ar);
    col = max(col, 0.0);
  `),
}

/* ── Mode shader array — index matches store.ts MODES order ── */
export const modeShaders = [
  formConstants,       // 0: FORM CONSTANTS
  neuralField,         // 1: NEURAL FIELD (fallback)
  turingFlux,          // 2: TURING FLUX (fallback)
  sacredGeometry,      // 3: SACRED GEOMETRY
  breathingWalls,      // 4: BREATHING WALLS
  hyperspace,          // 5: HYPERSPACE (2D)
  hyperbolic,          // 6: HYPERBOLIC
  entoptic,            // 7: ENTOPTIC
  quasicrystal,        // 8: QUASICRYSTAL
  cymatics,            // 9: CYMATICS
  imageWarp,           // 10: IMAGE WARP
  voronoi,             // 11: CELLULAR
  phasorVines,         // 12: VINES
  dragonScales,        // 13: DRAGONSCALES (fallback)
  waveform,            // 14: WAVEFORM
  fractal,             // 15: FRACTAL (defined below)
  particleFlow,        // 16: PARTICLE FLOW (fallback)
  weierWells,          // 17: WEIER WELLS
  blaschkeRosette,     // 18: BLASCHKE
  indrasNecklace,      // 19: INDRA
  arnoldTongues,       // 20: ARNOLD
  gaussianHalo,        // 21: GAUSSIAN HALO
  defectGas,           // 22: DEFECT GAS
  pentagridLoom,       // 23: PENTAGRID LOOM
  atomicBeat,          // 24: ATOMIC BEAT
  denomDescent,        // 25: DENOM DESCENT
  waveCrystal,         // 26: WAVE CRYSTAL
  phasePortal,         // 27: PHASE PORTAL
  vortexField,         // 28: VORTEX FIELD
]

