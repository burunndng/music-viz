import { reactive } from 'vue'
import gsap from 'gsap'

/* ── State interface (ported from enthea, adapted for Vue) ── */
export interface VizState {
  mode: number
  dose: number
  speed: number
  complexity: number
  symmetry: number
  trail: number
  palette: number
  planform: number
  reactivity: number
  sensitivity: number
  audioOn: boolean
  trackPlaying: boolean
  journey: boolean
  mouse: { x: number; y: number }
  hueShift: number
  pulse: number
  pulseRate: number
  shear: number
  voidness: number
  flicker: boolean
  flickerHz: number
  scope: boolean
  cinematic: boolean
  tone: number
  ascension: number
  chaos: number
  substance: string | null
  /* new from enthea */
  wall: number
  wallScale: number
  ray: boolean
  choreo: boolean
  beatIntensity: number
}

/* ── All 26 modes (ported from enthea constants.ts) ── */
export const MODES = [
  { id: 'form',        name: 'FORM CONSTANTS',     sub: 'Klüver · Bressloff–Cowan' },
  { id: 'neural',      name: 'NEURAL FIELD',        sub: 'Wilson–Cowan · live Turing' },
  { id: 'turing',      name: 'TURING FLUX',         sub: 'reaction–diffusion' },
  { id: 'mandala',     name: 'SACRED GEOM',         sub: 'phyllotaxis · symmetry' },
  { id: 'flow',        name: 'BREATHING WALLS',     sub: 'domain-warped fBm' },
  { id: 'hyper',       name: 'HYPERSPACE',          sub: 'DMT breakthrough' },
  { id: 'hyperbolic',  name: 'HYPERBOLIC',          sub: 'negative curvature' },
  { id: 'entoptic',    name: 'ENTOPTIC',            sub: 'visual snow · blue-field' },
  { id: 'quasi',       name: 'QUASICRYSTAL',        sub: 'N-fold plane waves' },
  { id: 'cymatics',    name: 'CYMATICS',            sub: 'Chladni nodal lines' },
  { id: 'image',       name: 'IMAGE WARP',          sub: 'upload · kaleidoscope' },
  { id: 'voronoi',     name: 'CELLULAR',            sub: 'Voronoi · Worley · scales' },
  { id: 'phasor',      name: 'VINES',               sub: 'phasor noise · oriented flow' },
  { id: 'lizard',      name: 'DRAGONSCALES',        sub: 'living cellular automaton' },
  { id: 'waveform',    name: 'WAVEFORM',            sub: 'oscilloscope · vectorscope' },
  { id: 'fractal',     name: 'FRACTAL',             sub: 'Mandelbox flythrough · 3D' },
  { id: 'particles',   name: 'PARTICLE FLOW',       sub: '50k GPU particles · ABC flow' },
  { id: 'weier',       name: 'WEIER WELLS',         sub: 'elliptic ℘ · complex crystal' },
  { id: 'blaschke',    name: 'BLASCHKE',            sub: 'conformal disc · arg B′ flower' },
  { id: 'indra',       name: 'INDRA',               sub: 'Kleinian limit set · pearls' },
  { id: 'arnold',      name: 'ARNOLD',              sub: 'circle-map · devil\'s staircase' },
  { id: 'gauss',       name: 'GAUSSIAN HALO',       sub: 'ℤ[i] prime constellation' },
  { id: 'defect',      name: 'DEFECT GAS',          sub: 'excitable spiral waves' },
  { id: 'pentagrid',   name: 'PENTAGRID LOOM',      sub: 'de Bruijn · Penrose dual' },
  { id: 'orbital',     name: 'ATOMIC BEAT',         sub: 'hydrogen ψ · quantum slosh' },
  { id: 'denom',       name: 'DENOM DESCENT',       sub: 'modular Farey tessellation' },
  { id: 'wave',        name: 'WAVE CRYSTAL',        sub: 'sine-Gordon breather lattice' },
  { id: 'phase',       name: 'PHASE PORTAL',        sub: 'continued-fraction field' },
  { id: 'vortex',      name: 'VORTEX FIELD',        sub: 'Abrikosov vortex lattice' },
]

export const PALETTES = [
  'SPECTRAL', 'CHAKRA', 'EMBER', 'OCEAN', 'VIOLET GOLD',
  'DMT', 'NOIR', 'NEBULA', 'INFRARED',
]

/* ── Substance presets (ported from enthea) ── */
export interface SubstancePreset {
  name: string; glyph: string; klass: string; duration: string
  mode: number; palette: number; dose: number; speed: number
  complexity: number; symmetry: number; trail: number
  ascension?: number; voidness?: number; hueShift?: number
  pulse?: number; pulseRate?: number; reactivity?: number
  tone?: number; cinematic?: boolean
}

export const SUBSTANCES: SubstancePreset[] = [
  { name: 'LSD', glyph: '⚡', klass: 'lysergamide', duration: '8–12 h',
    mode: 0, palette: 0, dose: 0.70, speed: 1.0, complexity: 0.70, symmetry: 6, trail: 0.55,
    hueShift: 0.03, pulse: 0.1, pulseRate: 6, cinematic: true },
  { name: 'PSILOCYBIN', glyph: '🍄', klass: 'tryptamine', duration: '4–6 h',
    mode: 4, palette: 1, dose: 0.60, speed: 0.8, complexity: 0.60, symmetry: 5, trail: 0.40,
    pulse: 0.14, pulseRate: 1.2, cinematic: true },
  { name: 'DMT', glyph: '🌀', klass: 'tryptamine · breakthrough', duration: '5–20 min',
    mode: 5, palette: 5, dose: 0.95, speed: 1.6, complexity: 0.95, symmetry: 7, trail: 0.60,
    hueShift: 0.08, pulseRate: 8, cinematic: true },
  { name: 'MESCALINE', glyph: '🌵', klass: 'phenethylamine', duration: '8–14 h',
    mode: 3, palette: 1, dose: 0.65, speed: 0.6, complexity: 0.55, symmetry: 6, trail: 0.45,
    cinematic: true },
  { name: '2C-B', glyph: '🦋', klass: 'phenethylamine', duration: '4–6 h',
    mode: 8, palette: 0, dose: 0.60, speed: 1.2, complexity: 0.60, symmetry: 8, trail: 0.45,
    pulse: 0.12, pulseRate: 3, cinematic: true },
  { name: 'KETAMINE', glyph: '🕳', klass: 'dissociative', duration: '45–90 min',
    mode: 5, palette: 3, dose: 0.70, speed: 0.5, complexity: 0.40, symmetry: 6, trail: 0.65,
    voidness: 0.55, cinematic: true },
  { name: 'MDMA', glyph: '💗', klass: 'empathogen', duration: '3–5 h',
    mode: 4, palette: 1, dose: 0.40, speed: 0.7, complexity: 0.35, symmetry: 6, trail: 0.35,
    pulse: 0.10, pulseRate: 1.0, cinematic: true },
  { name: 'CANNABIS', glyph: '🌱', klass: 'cannabinoid', duration: '1–3 h',
    mode: 4, palette: 3, dose: 0.30, speed: 0.6, complexity: 0.40, symmetry: 6, trail: 0.45,
    cinematic: true },
  { name: '5-MeO-DMT', glyph: '🌬', klass: 'tryptamine', duration: '15–40 min',
    mode: 5, palette: 2, dose: 0.98, speed: 1.6, complexity: 0.42, symmetry: 6, trail: 0.62,
    voidness: 0.5, cinematic: true },
]

/* ── Vue reactive state ── */
export const state = reactive<VizState>({
  mode: 0,
  dose: 0.45,
  speed: 1.0,
  complexity: 0.55,
  symmetry: 6,
  trail: 0.35,
  palette: 0,
  planform: 0,
  reactivity: 0.6,
  sensitivity: 1.2,
  audioOn: false,
  trackPlaying: false,
  journey: false,
  mouse: { x: 0.5, y: 0.5 },
  hueShift: 0,
  pulse: 0,
  pulseRate: 6.0,
  shear: 0,
  voidness: 0,
  flicker: false,
  flickerHz: 10.0,
  scope: false,
  cinematic: true,
  tone: 0.35,
  ascension: 0,
  chaos: 0.3,
  substance: null,
  wall: 0,
  wallScale: 3.0,
  ray: true,
  choreo: true,
  beatIntensity: 0,
})

/* ── Animated state for smooth GSAP transitions ── */
export const animated = reactive({
  dose: state.dose,
  speed: state.speed,
  complexity: state.complexity,
  symmetry: state.symmetry,
  trail: state.trail,
  hueShift: state.hueShift,
  pulse: state.pulse,
  voidness: state.voidness,
  tone: state.tone,
  ascension: state.ascension,
})

const ANIM_DURATION = 0.8
const ANIM_EASE = 'power2.inOut'

export function animateToPreset(params: Record<string, number | boolean>) {
  const targets: Record<string, unknown> = {}
  for (const [key, val] of Object.entries(params)) {
    if (key in state) {
      ;(state as Record<string, unknown>)[key] = val
    }
    if (key in animated && typeof val === 'number') {
      targets[key] = val
    }
  }
  gsap.to(animated, { ...targets, duration: ANIM_DURATION, ease: ANIM_EASE, overwrite: true })
}

export function animateParam(key: string, value: number) {
  if (key in state) {
    ;(state as Record<string, unknown>)[key] = value
  }
  if (key in animated) {
    gsap.to(animated, { [key]: value, duration: 0.3, ease: 'power2.out', overwrite: true })
  }
}

/* ── Apply a substance preset ── */
export function applySubstance(sub: SubstancePreset) {
  state.substance = sub.name
  animateToPreset({
    mode: sub.mode, palette: sub.palette, dose: sub.dose, speed: sub.speed,
    complexity: sub.complexity, symmetry: sub.symmetry, trail: sub.trail,
    ...(sub.hueShift != null ? { hueShift: sub.hueShift } : {}),
    ...(sub.pulse != null ? { pulse: sub.pulse } : {}),
    ...(sub.pulseRate != null ? { pulseRate: sub.pulseRate } : {}),
    ...(sub.voidness != null ? { voidness: sub.voidness } : {}),
    ...(sub.reactivity != null ? { reactivity: sub.reactivity } : {}),
    ...(sub.tone != null ? { tone: sub.tone } : {}),
    ...(sub.cinematic != null ? { cinematic: sub.cinematic } : {}),
  })
}

/* ── User presets ── */
export interface Preset {
  name: string
  params: Record<string, number | boolean>
}

export const presets: Preset[] = [
  {
    name: 'Deep Space',
    params: { mode: 5, palette: 7, dose: 0.7, speed: 0.6, complexity: 0.7, symmetry: 8, trail: 0.6, cinematic: true, tone: 0.5 },
  },
  {
    name: 'LSD Geometry',
    params: { mode: 0, palette: 0, dose: 0.7, speed: 1.0, complexity: 0.7, symmetry: 6, trail: 0.55, hueShift: 0.03, pulse: 0.1, pulseRate: 6, cinematic: true },
  },
  {
    name: 'Psilocybin Flow',
    params: { mode: 4, palette: 1, dose: 0.6, speed: 0.8, complexity: 0.6, symmetry: 5, trail: 0.4, pulse: 0.14, pulseRate: 1.2, cinematic: true },
  },
  {
    name: 'DMT Breakthrough',
    params: { mode: 5, palette: 5, dose: 0.95, speed: 1.6, complexity: 0.95, symmetry: 7, trail: 0.6, hueShift: 0.08, pulseRate: 8, cinematic: true },
  },
  {
    name: 'K-Hole',
    params: { mode: 5, palette: 3, dose: 0.7, speed: 0.5, complexity: 0.4, symmetry: 6, trail: 0.65, voidness: 0.55, cinematic: true },
  },
  {
    name: 'Chladni Plate',
    params: { mode: 9, palette: 0, dose: 0.5, speed: 1.0, complexity: 0.5, symmetry: 5, trail: 0.2, reactivity: 0.8, cinematic: false },
  },
  {
    name: 'Mandelbox Cathedral',
    params: { mode: 15, palette: 6, dose: 0.6, speed: 0.7, complexity: 0.5, symmetry: 5, trail: 0.5, cinematic: true, tone: 0.6 },
  },
  {
    name: 'Neon Quasicrystal',
    params: { mode: 8, palette: 4, dose: 0.6, speed: 1.2, complexity: 0.6, symmetry: 8, trail: 0.45, pulse: 0.12, pulseRate: 3, cinematic: true },
  },
  {
    name: 'Phosphene Drift',
    params: { mode: 7, palette: 2, dose: 0.5, speed: 0.6, complexity: 0.4, symmetry: 6, trail: 0.5, flicker: true, flickerHz: 18, cinematic: false },
  },
  {
    name: 'Spiral Waves',
    params: { mode: 22, palette: 4, dose: 0.55, speed: 0.9, complexity: 0.55, symmetry: 5, trail: 0.4, reactivity: 0.7, cinematic: true },
  },
  {
    name: 'Live Scope',
    params: { mode: 14, palette: 0, dose: 0.3, speed: 1.0, complexity: 0.3, symmetry: 6, trail: 0.1, reactivity: 1.0, scope: true, cinematic: false },
  },
  {
    name: 'Dark Ambient',
    params: { mode: 4, palette: 6, dose: 0.3, speed: 0.4, complexity: 0.3, symmetry: 4, trail: 0.7, voidness: 0.4, cinematic: true, tone: 0.7 },
  },
  {
    name: 'Hyperbolic DMT',
    params: { mode: 6, palette: 5, dose: 0.85, speed: 1.3, complexity: 0.8, symmetry: 7, trail: 0.55, hueShift: 0.06, cinematic: true },
  },
  {
    name: 'Penrose Loom',
    params: { mode: 23, palette: 0, dose: 0.5, speed: 0.7, complexity: 0.6, symmetry: 5, trail: 0.45, reactivity: 0.6, cinematic: true },
  },
  {
    name: 'Vortex Lattice',
    params: { mode: 28, palette: 7, dose: 0.6, speed: 0.8, complexity: 0.5, symmetry: 6, trail: 0.5, cinematic: true },
  },
]
