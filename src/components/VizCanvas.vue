<script setup lang="ts">
import { onMounted, onBeforeUnmount, watch } from 'vue'
import { TresCanvas } from '@tresjs/core'
import type { TresContext, TresContextWithClock } from '@tresjs/core'
import { state, animated, actions, animateParam } from '../lib/store'
import { audioEngine } from '../lib/audio'
import { modeShaders } from '../lib/shaders/modes'
import { VizPipeline } from '../lib/gl/pipeline'
import { VizSims, type SimType, type SimAudio } from '../lib/gl/sims'
import { VizFluid } from '../lib/gl/fluid'
import * as THREE from 'three'

/* ── Waveform DataTexture (256×1, R=wave mapped 0..1) ── */
const waveTexData = new Uint8Array(256 * 4)
const waveTexture = new THREE.DataTexture(waveTexData, 256, 1, THREE.RGBAFormat)
waveTexture.needsUpdate = true

/* ── Blank spectrum texture ── */
const specTexData = new Uint8Array(256 * 4)
const specTexture = new THREE.DataTexture(specTexData, 256, 1, THREE.RGBAFormat)
specTexture.needsUpdate = true

/* ── Blank image texture (2×2 black) ── */
const imgTexData = new Uint8Array(2 * 2 * 4)
const imgTexture = new THREE.DataTexture(imgTexData, 2, 2, THREE.RGBAFormat)
imgTexture.needsUpdate = true

/* ── Idle sim texture (2×2 black) — used when no GPU sim is active ── */
const simTexData = new Uint8Array(2 * 2 * 4)
const blackSimTex = new THREE.DataTexture(simTexData, 2, 2, THREE.RGBAFormat)
blackSimTex.needsUpdate = true

/* ── Idle fluid texture (2×2 black) ── */
const fluidTexData = new Uint8Array(2 * 2 * 4)
const blackFluidTex = new THREE.DataTexture(fluidTexData, 2, 2, THREE.RGBAFormat)
blackFluidTex.needsUpdate = true

const uniforms = {
  uTime: { value: 0 },
  uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
  uDose: { value: state.dose },
  uSpeed: { value: state.speed },
  uComplexity: { value: state.complexity },
  uSymmetry: { value: state.symmetry },
  uTrail: { value: state.trail },
  uPalette: { value: state.palette },
  uPlanform: { value: state.planform },
  uMouse: { value: new THREE.Vector2(0.5, 0.5) },
  uReactivity: { value: state.reactivity },
  uBass: { value: 0 },
  uMid: { value: 0 },
  uTreble: { value: 0 },
  uLevel: { value: 0 },
  uBeat: { value: 0 },
  uFlux: { value: 0 },
  uCentroid: { value: 0.5 },
  uAudioOn: { value: 0 },
  uBands0: { value: new THREE.Vector4(0, 0, 0, 0) },
  uBands1: { value: new THREE.Vector4(0, 0, 0, 0) },
  uDissonance: { value: 0 },
  uBeatPulse: { value: 0 },
  uBeatPhase: { value: 0 },
  uBloomT: { value: 0 },
  uStereo: { value: new THREE.Vector2(0, 0) },
  uBuild: { value: 0 },
  uDrop: { value: 0 },
  uDropMode: { value: 0 },
  uHueShift: { value: 0 },
  uPulse: { value: 0 },
  uPulseRate: { value: 6.0 },
  uShear: { value: 0 },
  uVoid: { value: 0 },
  uFlicker: { value: 0 },
  uFlickerHz: { value: 10.0 },
  uTone: { value: 0.35 },
  uAscension: { value: 0 },
  uAsc: { value: 0 },
  uRay: { value: state.ray ? 1.0 : 0.0 },
  uChoreo: { value: state.choreo ? 1.0 : 0.0 },
  uScope: { value: state.scope ? 1.0 : 0.0 },
  uCine: { value: state.cinematic ? 1.0 : 0.0 },
  uTrans: { value: 0 },
  uTransMode: { value: 0 },
  uWall: { value: state.wall },
  uWallScale: { value: state.wallScale },
  uSpectrum: { value: specTexture },
  uImage: { value: imgTexture },
  uImgPal: { value: [
    new THREE.Vector3(0.45, 0.25, 0.75),
    new THREE.Vector3(0.30, 0.55, 0.70),
    new THREE.Vector3(0.20, 0.70, 0.55),
    new THREE.Vector3(0.78, 0.42, 0.62),
    new THREE.Vector3(0.88, 0.74, 0.38),
    new THREE.Vector3(0.28, 0.18, 0.42),
  ]},
  uWaveform: { value: waveTexture },
  uSimTex: { value: blackSimTex as THREE.Texture },
  uSimActive: { value: 0 },
  uFluidTex: { value: blackFluidTex as THREE.Texture },
}

const smooth = {
  bass: 0, mid: 0, treble: 0, level: 0,
  beat: 0, flux: 0, centroid: 0.5,
  sub: 0, lowmid: 0, highmid: 0, air: 0,
  dissonance: 0,
}

let renderer: THREE.WebGLRenderer | null = null
let pipeline: VizPipeline | null = null
let sims: VizSims | null = null
let fluid: VizFluid | null = null
let sceneMaterial: THREE.ShaderMaterial | null = null

/* Phase 5 runtime: snapshots, recording, transitions, autopilot */
let pendingSnapshot = false
let mediaRecorder: MediaRecorder | null = null
let recording = false
let recChunks: BlobPart[] = []
let transT = 0
let transActive = false
let transMode = 0
let beatCount = 0

/* mode index → which GPU sim drives it (null = no sim) */
const SIM_FOR_MODE: Record<number, SimType> = {
  1: 'neural',
  2: 'turing',
  12: 'dragons',
  15: 'particles',
  30: 'spectro',
}

function createMaterial(modeIndex: number) {
  const shader = modeShaders[modeIndex] || modeShaders[0]
  return new THREE.ShaderMaterial({
    vertexShader: shader.vertex,
    fragmentShader: shader.fragment,
    uniforms,
    depthTest: false,
    depthWrite: false,
  })
}

watch(() => state.mode, () => {
  const old = sceneMaterial
  sceneMaterial = createMaterial(state.mode)
  if (old) old.dispose()
  transT = 0
  transActive = true
  transMode = (transMode + 1) % 3
  uniforms.uTransMode.value = transMode
})

watch(() => state.palette, (v) => { uniforms.uPalette.value = v })
watch(() => state.symmetry, (v) => { uniforms.uSymmetry.value = v })
watch(() => state.planform, (v) => { uniforms.uPlanform.value = v })
watch(() => state.reactivity, (v) => { uniforms.uReactivity.value = v })
watch(() => state.flicker, (v) => { uniforms.uFlicker.value = v ? 1.0 : 0.0 })
watch(() => state.flickerHz, (v) => { uniforms.uFlickerHz.value = v })
watch(() => state.ray, (v) => { uniforms.uRay.value = v ? 1.0 : 0.0 })
watch(() => state.choreo, (v) => { uniforms.uChoreo.value = v ? 1.0 : 0.0 })
watch(() => state.scope, (v) => { uniforms.uScope.value = v ? 1.0 : 0.0 })
watch(() => state.cinematic, (v) => { uniforms.uCine.value = v ? 1.0 : 0.0 })
watch(() => state.wall, (v) => { uniforms.uWall.value = v })
watch(() => state.wallScale, (v) => { uniforms.uWallScale.value = v })

/* ── Adaptive resolution: EMA of frame time, stepped render scale ── */
const SCALE_STEPS = [1.0, 0.85, 0.7, 0.6, 0.5]
let scaleIdx = 0
let emaMs = 16.7
let slowFrames = 0
let fastFrames = 0

function applySize() {
  if (!renderer || !pipeline) return
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const w = Math.max(2, Math.round(window.innerWidth * dpr))
  const h = Math.max(2, Math.round(window.innerHeight * dpr))
  pipeline.setSize(w, h, SCALE_STEPS[scaleIdx])
  uniforms.uResolution.value.set(pipeline.sceneWidth, pipeline.sceneHeight)
}

function adaptResolution(deltaMs: number) {
  emaMs = THREE.MathUtils.lerp(emaMs, deltaMs, 0.05)
  if (emaMs > 19) {
    if (++slowFrames > 45 && scaleIdx < SCALE_STEPS.length - 1) {
      scaleIdx++
      slowFrames = 0
      fastFrames = 0
      applySize()
    }
  } else slowFrames = 0
  if (emaMs < 12) {
    if (++fastFrames > 240 && scaleIdx > 0) {
      scaleIdx--
      fastFrames = 0
      slowFrames = 0
      applySize()
    }
  } else fastFrames = 0
}

/* ── TresCanvas lifecycle: manual render mode, single loop ── */
function onReady(ctx: TresContext) {
  renderer = ctx.renderer.instance as THREE.WebGLRenderer
  pipeline = new VizPipeline(renderer, uniforms)
  sims = new VizSims(renderer)
  fluid = new VizFluid(renderer)
  sceneMaterial = createMaterial(state.mode)
  applySize()

  actions.snapshot = () => { pendingSnapshot = true }
  actions.toggleRecord = toggleRecord
  actions.isRecording = () => recording
  actions.initTab = () => {
    audioEngine.initTab().then(() => { state.audioOn = true }).catch(() => {})
  }
}

function toggleRecord() {
  if (recording) {
    mediaRecorder?.stop()
    return
  }
  const canvas = renderer?.domElement
  if (!canvas || typeof (canvas as HTMLCanvasElement).captureStream !== 'function') return
  const stream = (canvas as HTMLCanvasElement).captureStream(30)
  const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
    ? 'video/webm;codecs=vp9'
    : 'video/webm'
  mediaRecorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 12_000_000 })
  recChunks = []
  mediaRecorder.ondataavailable = (e) => { if (e.data.size) recChunks.push(e.data) }
  mediaRecorder.onstop = () => {
    const blob = new Blob(recChunks, { type: 'video/webm' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `resonance-${Date.now()}.webm`
    a.click()
    URL.revokeObjectURL(url)
    recording = false
  }
  mediaRecorder.start()
  recording = true
}

let time = 0
let prevBeat = 0
let beatPulse = 0
let beatPhase = 0
let bloomT = 3.0

const SMOOTH_RATE = 0.15

function onLoop(ctx: TresContextWithClock) {
  if (!renderer || !pipeline || !sceneMaterial) return
  const delta = ctx.delta > 0 ? Math.min(ctx.delta, 0.1) : 0.016

  time += delta * state.speed
  const audio = audioEngine.analyse(state.reactivity)

  smooth.bass = THREE.MathUtils.lerp(smooth.bass, audio.bass, SMOOTH_RATE)
  smooth.mid = THREE.MathUtils.lerp(smooth.mid, audio.mid, SMOOTH_RATE)
  smooth.treble = THREE.MathUtils.lerp(smooth.treble, audio.treble, SMOOTH_RATE)
  smooth.level = THREE.MathUtils.lerp(smooth.level, audio.level, SMOOTH_RATE)
  smooth.beat = THREE.MathUtils.lerp(smooth.beat, audio.beat, SMOOTH_RATE)
  smooth.flux = THREE.MathUtils.lerp(smooth.flux, audio.flux, SMOOTH_RATE)
  smooth.centroid = THREE.MathUtils.lerp(smooth.centroid, audio.centroid, SMOOTH_RATE)
  smooth.sub = THREE.MathUtils.lerp(smooth.sub, audio.sub, SMOOTH_RATE)
  smooth.lowmid = THREE.MathUtils.lerp(smooth.lowmid, audio.lowmid, SMOOTH_RATE)
  smooth.highmid = THREE.MathUtils.lerp(smooth.highmid, audio.highmid, SMOOTH_RATE)
  smooth.air = THREE.MathUtils.lerp(smooth.air, audio.air, SMOOTH_RATE)
  smooth.dissonance = THREE.MathUtils.lerp(smooth.dissonance, audio.dissonance, SMOOTH_RATE)

  uniforms.uTime.value = time
  uniforms.uBass.value = smooth.bass
  uniforms.uMid.value = smooth.mid
  uniforms.uTreble.value = smooth.treble
  uniforms.uLevel.value = smooth.level
  uniforms.uBeat.value = smooth.beat
  uniforms.uFlux.value = smooth.flux
  uniforms.uCentroid.value = smooth.centroid
  uniforms.uAudioOn.value = audio.on ? 1.0 : 0.0
  uniforms.uBands0.value.set(smooth.sub, smooth.bass, smooth.lowmid, smooth.mid)
  uniforms.uBands1.value.set(smooth.highmid, smooth.treble, smooth.air, smooth.level)
  uniforms.uDissonance.value = smooth.dissonance

  if (audio.beat > 0.8 && prevBeat < 0.8) { beatPulse = 1.0; beatPhase = 0 }
  beatPulse = Math.max(0, beatPulse - delta * 3.5)
  beatPhase = Math.min(1, beatPhase + delta * audio.bpm / 60)
  uniforms.uBeatPulse.value = beatPulse
  uniforms.uBeatPhase.value = beatPhase

  if (audio.beat > 0.8 && prevBeat < 0.8) bloomT = 0
  bloomT = Math.min(3, bloomT + delta)
  uniforms.uBloomT.value = bloomT
  uniforms.uStereo.value.set(smooth.bass, smooth.treble)

  const wave = audio.waveform
  for (let i = 0; i < 256; i++) {
    const v = Math.max(0, Math.min(255, Math.round(((wave[i] ?? 0) * 0.5 + 0.5) * 255)))
    waveTexData[i * 4] = v
    waveTexData[i * 4 + 1] = v
    waveTexData[i * 4 + 2] = v
    waveTexData[i * 4 + 3] = 255
  }
  waveTexture.needsUpdate = true

  const spec = audio.spectrum
  for (let i = 0; i < 256 && i < spec.length; i++) {
    const v = Math.max(0, Math.min(255, Math.round(spec[i] * 255)))
    specTexData[i * 4] = v
    specTexData[i * 4 + 1] = v
    specTexData[i * 4 + 2] = v
    specTexData[i * 4 + 3] = 255
  }
  specTexture.needsUpdate = true

  uniforms.uDose.value = animated.dose
  uniforms.uSpeed.value = animated.speed
  uniforms.uComplexity.value = animated.complexity
  uniforms.uTrail.value = animated.trail
  uniforms.uHueShift.value = animated.hueShift
  uniforms.uPulse.value = animated.pulse
  uniforms.uVoid.value = animated.voidness
  uniforms.uTone.value = animated.tone
  uniforms.uAscension.value = animated.ascension
  uniforms.uAsc.value = animated.ascension

  if (audio.beat > 0.8 && prevBeat < 0.8) {
    uniforms.uDose.value = Math.min(1, uniforms.uDose.value + 0.05)
    state.beatIntensity = 1.0
  }
  if (uniforms.uDose.value > state.dose) {
    uniforms.uDose.value = Math.max(state.dose, uniforms.uDose.value - 0.02)
  }
  state.beatIntensity = Math.max(0, state.beatIntensity - 0.04)
  prevBeat = audio.beat

  adaptResolution(delta * 1000)

  // ── Transition progress + drop flash ──
  if (transActive) {
    transT += delta / 0.8
    if (transT >= 1) { transT = 1; transActive = false }
  }
  uniforms.uTrans.value = transActive ? transT : 0
  uniforms.uDrop.value = audio.drop

  // ── Autopilot (state.journey): re-score the trip every 8 beats ──
  if (state.journey && audio.beat > 0.8 && prevBeat < 0.8) {
    beatCount++
    if (beatCount % 8 === 0 && !transActive) {
      const next = Math.floor(Math.random() * modeShaders.length)
      if (next !== state.mode) state.mode = next
      animateParam('complexity', 0.3 + Math.random() * 0.6)
      animateParam('symmetry', 2 + Math.floor(Math.random() * 10))
      animateParam('speed', 0.5 + Math.random() * 1.5)
      state.palette = Math.floor(Math.random() * 9)
    }
  }

  // GPU simulations: advance the active sim, feed its texture to the modes.
  const simType = SIM_FOR_MODE[state.mode] ?? null
  if (sims) {
    const audioLike: SimAudio = {
      time,
      bass: smooth.bass,
      mid: smooth.mid,
      treble: smooth.treble,
      level: smooth.level,
      beat: smooth.beat,
      flux: smooth.flux,
      centroid: smooth.centroid,
      reactivity: state.reactivity,
      audioOn: audio.on ? 1 : 0,
      mouseX: state.mouse.x,
      mouseY: state.mouse.y,
    }
    const tex = sims.update(simType, audioLike, uniforms.uSpectrum.value as THREE.Texture)
    uniforms.uSimTex.value = tex ?? blackSimTex
    uniforms.uSimActive.value = simType ? 1 : 0
  }

  // Fluid solver — only stepped while its mode is active (saves GPU).
  if (fluid) {
    if (state.mode === 28) {
      uniforms.uFluidTex.value = fluid.update({
        time,
        bass: smooth.bass,
        mid: smooth.mid,
        treble: smooth.treble,
        level: smooth.level,
        beat: smooth.beat,
        flux: smooth.flux,
        centroid: smooth.centroid,
        reactivity: state.reactivity,
        audioOn: audio.on ? 1 : 0,
        mouseX: state.mouse.x,
        mouseY: state.mouse.y,
      })
    } else {
      uniforms.uFluidTex.value = blackFluidTex
    }
  }

  pipeline.render(sceneMaterial)

  // ── Snapshot (captured immediately after a fresh render) ──
  if (pendingSnapshot && renderer) {
    pendingSnapshot = false
    const url = renderer.domElement.toDataURL('image/png')
    const a = document.createElement('a')
    a.href = url
    a.download = `resonance-${Date.now()}.png`
    a.click()
  }
}

function onMouseMove(e: MouseEvent) {
  state.mouse.x = e.clientX / window.innerWidth
  state.mouse.y = 1.0 - e.clientY / window.innerHeight
  uniforms.uMouse.value.set(state.mouse.x, state.mouse.y)
}

function onTouchMove(e: TouchEvent) {
  if (e.touches[0]) {
    state.mouse.x = e.touches[0].clientX / window.innerWidth
    state.mouse.y = 1.0 - e.touches[0].clientY / window.innerHeight
    uniforms.uMouse.value.set(state.mouse.x, state.mouse.y)
  }
}

function onResize() {
  applySize()
}

onMounted(() => {
  window.addEventListener('resize', onResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize)
  if (sceneMaterial) sceneMaterial.dispose()
  if (pipeline) pipeline.dispose()
  if (sims) sims.dispose()
  if (fluid) fluid.dispose()
})
</script>

<template>
  <div
    class="fixed inset-0 w-screen h-screen"
    @mousemove="onMouseMove"
    @touchmove.passive="onTouchMove"
  >
    <TresCanvas
      render-mode="manual"
      :dpr="[1, 2]"
      :alpha="false"
      :antialias="false"
      class="w-full h-full"
      @ready="onReady"
      @loop="onLoop"
    />
  </div>
</template>
