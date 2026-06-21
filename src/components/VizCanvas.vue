<script setup lang="ts">
import { ref, provide, onMounted, onBeforeUnmount, watch } from 'vue'
import { state, animated } from '../lib/store'
import { audioEngine } from '../lib/audio'
import { modeShaders } from '../lib/shaders/modes'
import RenderLoop from './RenderLoop.vue'
import * as THREE from 'three'

const materialRef = ref<THREE.ShaderMaterial>()

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
  // Core audio (legacy names used by many modes)
  uBass: { value: 0 },
  uMid: { value: 0 },
  uTreble: { value: 0 },
  uLevel: { value: 0 },
  uBeat: { value: 0 },
  uFlux: { value: 0 },
  uCentroid: { value: 0.5 },
  uAudioOn: { value: 0 },
  // 8-band audio (ported from enthea)
  uBands0: { value: new THREE.Vector4(0, 0, 0, 0) },
  uBands1: { value: new THREE.Vector4(0, 0, 0, 0) },
  uDissonance: { value: 0 },
  uBeatPulse: { value: 0 },
  uBeatPhase: { value: 0 },
  uBloomT: { value: 0 },
  uStereo: { value: new THREE.Vector2(0, 0) },
  // Drop / build engine
  uBuild: { value: 0 },
  uDrop: { value: 0 },
  uDropMode: { value: 0 },
  // Visual params
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
  // Mode toggles
  uRay: { value: state.ray ? 1.0 : 0.0 },
  uChoreo: { value: state.choreo ? 1.0 : 0.0 },
  uScope: { value: state.scope ? 1.0 : 0.0 },
  uCine: { value: state.cinematic ? 1.0 : 0.0 },
  uTrans: { value: 0 },
  uTransMode: { value: 0 },
  // Wallpaper
  uWall: { value: state.wall },
  uWallScale: { value: state.wallScale },
  // Textures
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
}

const smooth = {
  bass: 0, mid: 0, treble: 0, level: 0,
  beat: 0, flux: 0, centroid: 0.5,
  sub: 0, lowmid: 0, highmid: 0, air: 0,
  dissonance: 0,
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
  if (materialRef.value) materialRef.value.dispose()
  materialRef.value = createMaterial(state.mode)
})

// Sync discrete params immediately
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

let time = 0
let prevBeat = 0
let beatPulse = 0
let beatPhase = 0
let bloomT = 3.0

const SMOOTH_RATE = 0.15

/* ── Render loop — injected into RenderLoop.vue (child of TresCanvas) ── */
provide('renderLoop', ({ delta }: { delta: number }) => {
  time += delta * state.speed
  const audio = audioEngine.analyse(state.reactivity)

  // Smooth core audio values
  smooth.bass = THREE.MathUtils.lerp(smooth.bass, audio.bass, SMOOTH_RATE)
  smooth.mid = THREE.MathUtils.lerp(smooth.mid, audio.mid, SMOOTH_RATE)
  smooth.treble = THREE.MathUtils.lerp(smooth.treble, audio.treble, SMOOTH_RATE)
  smooth.level = THREE.MathUtils.lerp(smooth.level, audio.level, SMOOTH_RATE)
  smooth.beat = THREE.MathUtils.lerp(smooth.beat, audio.beat, SMOOTH_RATE)
  smooth.flux = THREE.MathUtils.lerp(smooth.flux, audio.flux, SMOOTH_RATE)
  smooth.centroid = THREE.MathUtils.lerp(smooth.centroid, audio.centroid, SMOOTH_RATE)

  // Smooth 8-band values
  smooth.sub = THREE.MathUtils.lerp(smooth.sub, audio.sub, SMOOTH_RATE)
  smooth.lowmid = THREE.MathUtils.lerp(smooth.lowmid, audio.lowmid, SMOOTH_RATE)
  smooth.highmid = THREE.MathUtils.lerp(smooth.highmid, audio.highmid, SMOOTH_RATE)
  smooth.air = THREE.MathUtils.lerp(smooth.air, audio.air, SMOOTH_RATE)
  smooth.dissonance = THREE.MathUtils.lerp(smooth.dissonance, audio.dissonance, SMOOTH_RATE)

  // Core uniforms
  uniforms.uTime.value = time
  uniforms.uBass.value = smooth.bass
  uniforms.uMid.value = smooth.mid
  uniforms.uTreble.value = smooth.treble
  uniforms.uLevel.value = smooth.level
  uniforms.uBeat.value = smooth.beat
  uniforms.uFlux.value = smooth.flux
  uniforms.uCentroid.value = smooth.centroid
  uniforms.uAudioOn.value = audio.on ? 1.0 : 0.0

  // 8-band vec4 uniforms
  uniforms.uBands0.value.set(smooth.sub, smooth.bass, smooth.lowmid, smooth.mid)
  uniforms.uBands1.value.set(smooth.highmid, smooth.treble, smooth.air, smooth.level)
  uniforms.uDissonance.value = smooth.dissonance

  // Beat pulse (1→0 per beat) and beat phase (0..1 between beats)
  if (audio.beat > 0.8 && prevBeat < 0.8) {
    beatPulse = 1.0
    beatPhase = 0
  }
  beatPulse = Math.max(0, beatPulse - delta * 3.5)
  beatPhase = Math.min(1, beatPhase + delta * audio.bpm / 60)
  uniforms.uBeatPulse.value = beatPulse
  uniforms.uBeatPhase.value = beatPhase

  // Bloom time since beat
  if (audio.beat > 0.8 && prevBeat < 0.8) bloomT = 0
  bloomT = Math.min(3, bloomT + delta)
  uniforms.uBloomT.value = bloomT

  // Stereo (bass left, treble right — approximated from mono)
  uniforms.uStereo.value.set(smooth.bass, smooth.treble)

  // Waveform → DataTexture (map -1..1 → 0..1 for shader)
  const wave = audio.waveform
  for (let i = 0; i < 256; i++) {
    const v = Math.max(0, Math.min(255, Math.round(((wave[i] ?? 0) * 0.5 + 0.5) * 255)))
    waveTexData[i * 4] = v
    waveTexData[i * 4 + 1] = v
    waveTexData[i * 4 + 2] = v
    waveTexData[i * 4 + 3] = 255
  }
  waveTexture.needsUpdate = true

  // Spectrum → DataTexture
  const spec = audio.spectrum
  for (let i = 0; i < 256 && i < spec.length; i++) {
    const v = Math.max(0, Math.min(255, Math.round(spec[i] * 255)))
    specTexData[i * 4] = v
    specTexData[i * 4 + 1] = v
    specTexData[i * 4 + 2] = v
    specTexData[i * 4 + 3] = 255
  }
  specTexture.needsUpdate = true

  // Use GSAP-animated values for smooth parameter transitions
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

  // Beat dose bump with decay
  if (audio.beat > 0.8 && prevBeat < 0.8) {
    uniforms.uDose.value = Math.min(1, uniforms.uDose.value + 0.05)
    state.beatIntensity = 1.0
  }
  if (uniforms.uDose.value > state.dose) {
    uniforms.uDose.value = Math.max(state.dose, uniforms.uDose.value - 0.02)
  }
  // Beat intensity decay for UI
  state.beatIntensity = Math.max(0, state.beatIntensity - 0.04)
  prevBeat = audio.beat
})

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
  uniforms.uResolution.value.set(window.innerWidth, window.innerHeight)
}

onMounted(() => {
  materialRef.value = createMaterial(state.mode)
  window.addEventListener('resize', onResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize)
})
</script>

<template>
  <div
    class="fixed inset-0 w-screen h-screen"
    @mousemove="onMouseMove"
    @touchmove.passive="onTouchMove"
  >
    <TresCanvas
      :alpha="false"
      :antialias="false"
      :preserve-drawing-buffer="true"
      class="w-full h-full"
    >
      <TresMesh :frustum-culled="false">
        <TresPlaneGeometry :args="[2, 2]" />
        <primitive v-if="materialRef" :object="materialRef" />
      </TresMesh>
      <RenderLoop />
    </TresCanvas>
  </div>
</template>
