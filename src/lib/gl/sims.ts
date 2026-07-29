import * as THREE from 'three'
import { simVert, SIMS } from '../shaders/simGlsl'

export type SimType = 'neural' | 'turing' | 'dragons' | 'particles' | 'spectro'

export interface SimAudio {
  time: number
  bass: number
  mid: number
  treble: number
  level: number
  beat: number
  flux: number
  centroid: number
  reactivity: number
  audioOn: number
  mouseX: number
  mouseY: number
}

const SIM_SIZE = 512

interface SimEntry {
  rtA: THREE.WebGLRenderTarget
  rtB: THREE.WebGLRenderTarget
  stepMat: THREE.ShaderMaterial
  steps: number
}

function makeRT(size: number, type: THREE.TextureDataType) {
  return new THREE.WebGLRenderTarget(size, size, {
    type,
    format: THREE.RGBAFormat,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: false,
    stencilBuffer: false,
    wrapS: THREE.RepeatWrapping,
    wrapT: THREE.RepeatWrapping,
  })
}

/* Runs one or more ping-pong GPU simulations and exposes their latest
 * state texture for the mode shaders to sample. Each sim is lazily
 * initialised (seeded) on first use. */
export class VizSims {
  readonly hdr: boolean
  private renderer: THREE.WebGLRenderer
  private rtType: THREE.TextureDataType

  private quadScene = new THREE.Scene()
  private quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
  private geo = new THREE.PlaneGeometry(2, 2)
  private quad: THREE.Mesh

  private entries = new Map<SimType, SimEntry>()

  constructor(renderer: THREE.WebGLRenderer) {
    this.renderer = renderer
    const gl = renderer.getContext()
    this.hdr = renderer.capabilities.isWebGL2 && !!gl.getExtension('EXT_color_buffer_float')
    this.rtType = this.hdr ? THREE.HalfFloatType : THREE.UnsignedByteType
    this.quad = new THREE.Mesh(this.geo, new THREE.MeshBasicMaterial())
    this.quad.frustumCulled = false
    this.quadScene.add(this.quad)
  }

  private ensure(type: SimType): SimEntry | null {
    let e = this.entries.get(type)
    if (e) return e
    const def = SIMS[type]
    if (!def) return null

    const rtA = makeRT(SIM_SIZE, this.rtType)
    const rtB = makeRT(SIM_SIZE, this.rtType)

    const initMat = new THREE.ShaderMaterial({
      vertexShader: simVert,
      fragmentShader: def.fragInit,
      uniforms: {
        uSeed: { value: Math.random() * 10 },
        uStates: { value: def.states },
      },
      depthTest: false,
      depthWrite: false,
    })

    const stepMat = new THREE.ShaderMaterial({
      vertexShader: simVert,
      fragmentShader: def.fragStep,
      uniforms: {
        tState: { value: null as THREE.Texture | null },
        tSpectrum: { value: null as THREE.Texture | null },
        uTexel: { value: new THREE.Vector2(1 / SIM_SIZE, 1 / SIM_SIZE) },
        uTime: { value: 0 },
        uBass: { value: 0 },
        uMid: { value: 0 },
        uTreble: { value: 0 },
        uLevel: { value: 0 },
        uBeat: { value: 0 },
        uFlux: { value: 0 },
        uReactivity: { value: 1 },
        uAudioOn: { value: 0 },
        uStates: { value: def.states },
        uMouse: { value: new THREE.Vector2(0.5, 0.5) },
      },
      depthTest: false,
      depthWrite: false,
    })

    // seed the A buffer
    this.quad.material = initMat
    this.renderer.setRenderTarget(rtA)
    this.renderer.render(this.quadScene, this.quadCam)
    this.renderer.setRenderTarget(null)
    initMat.dispose()

    e = { rtA, rtB, stepMat, steps: def.steps }
    this.entries.set(type, e)
    return e
  }

  /* Advance `type` one or more steps and return its latest texture.
   * Returns null when type is null (no sim for the active mode). */
  update(type: SimType | null, a: SimAudio, spectrumTex?: THREE.Texture | null): THREE.Texture | null {
    if (!type) return null
    const e = this.ensure(type)
    if (!e) return null

    const u = e.stepMat.uniforms
    u.uTime.value = a.time
    u.uBass.value = a.bass
    u.uMid.value = a.mid
    u.uTreble.value = a.treble
    u.uLevel.value = a.level
    u.uBeat.value = a.beat
    u.uFlux.value = a.flux
    u.uReactivity.value = a.reactivity
    u.uAudioOn.value = a.audioOn
    ;(u.uMouse.value as THREE.Vector2).set(a.mouseX, a.mouseY)
    if (u.tSpectrum) u.tSpectrum.value = spectrumTex ?? null

    for (let i = 0; i < e.steps; i++) {
      u.tState.value = e.rtA.texture
      this.quad.material = e.stepMat
      this.renderer.setRenderTarget(e.rtB)
      this.renderer.render(this.quadScene, this.quadCam)
      const tmp = e.rtA
      e.rtA = e.rtB
      e.rtB = tmp
    }
    this.renderer.setRenderTarget(null)
    return e.rtA.texture
  }

  dispose() {
    for (const e of this.entries.values()) {
      e.rtA.dispose()
      e.rtB.dispose()
      e.stepMat.dispose()
    }
    this.entries.clear()
    this.geo.dispose()
    ;(this.quad.material as THREE.Material).dispose()
  }
}
