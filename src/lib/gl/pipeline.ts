import * as THREE from 'three'
import {
  postVert,
  feedbackFrag,
  brightPassFrag,
  downsampleFrag,
  upsampleFrag,
  compositeFrag,
} from '../shaders/post'

/* ── Subset of the VizCanvas uniform record the post passes consume.
 * Entries are shared by reference, so per-frame updates in VizCanvas
 * propagate to the pipeline materials automatically. ── */
export interface SharedUniforms {
  uTime: THREE.IUniform
  uTrail: THREE.IUniform
  uBeat: THREE.IUniform
  uBeatPulse: THREE.IUniform
  uFlux: THREE.IUniform
  uReactivity: THREE.IUniform
  uAudioOn: THREE.IUniform
  uHueShift: THREE.IUniform
  uFlicker: THREE.IUniform
  uFlickerHz: THREE.IUniform
  uPulse: THREE.IUniform
  uPulseRate: THREE.IUniform
  uVoid: THREE.IUniform
  uCine: THREE.IUniform
  uWall: THREE.IUniform
  uWallScale: THREE.IUniform
  uScope: THREE.IUniform
  uDrop: THREE.IUniform
  uDropMode: THREE.IUniform
  uTrans: THREE.IUniform
  uTransMode: THREE.IUniform
}

const BLOOM_LEVELS = 4

function makeRT(w: number, h: number, type: THREE.TextureDataType) {
  return new THREE.WebGLRenderTarget(w, h, {
    type,
    format: THREE.RGBAFormat,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: false,
    stencilBuffer: false,
  })
}

export class VizPipeline {
  /* true when EXT_color_buffer_float is available (RGBA16F HDR targets) */
  readonly hdr: boolean

  private renderer: THREE.WebGLRenderer
  private rtType: THREE.TextureDataType

  private sceneRT!: THREE.WebGLRenderTarget
  private fbA!: THREE.WebGLRenderTarget
  private fbB!: THREE.WebGLRenderTarget
  private bloomDown: THREE.WebGLRenderTarget[] = []
  private bloomUp: THREE.WebGLRenderTarget[] = []

  private quadScene = new THREE.Scene()
  private quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
  private quadMesh: THREE.Mesh
  private quadGeo = new THREE.PlaneGeometry(2, 2)

  private feedbackMat: THREE.ShaderMaterial
  private brightMat: THREE.ShaderMaterial
  private downMat: THREE.ShaderMaterial
  private upMat: THREE.ShaderMaterial
  private compositeMat: THREE.ShaderMaterial

  private fbTexel = new THREE.Vector2()
  private fullResolution = new THREE.Vector2(2, 2)

  private sizeW = 0
  private sizeH = 0
  private scale = 1

  constructor(renderer: THREE.WebGLRenderer, shared: SharedUniforms) {
    this.renderer = renderer

    const gl = renderer.getContext()
    this.hdr = renderer.capabilities.isWebGL2 && !!gl.getExtension('EXT_color_buffer_float')
    this.rtType = this.hdr ? THREE.HalfFloatType : THREE.UnsignedByteType

    const mkMat = (fragmentShader: string, uniforms: Record<string, THREE.IUniform>) =>
      new THREE.ShaderMaterial({
        vertexShader: postVert,
        fragmentShader,
        uniforms,
        depthTest: false,
        depthWrite: false,
      })

    this.feedbackMat = mkMat(feedbackFrag, {
      tScene: { value: null },
      tPrev: { value: null },
      uTexel: { value: this.fbTexel },
      uTrail: shared.uTrail,
      uTime: shared.uTime,
      uBeat: shared.uBeat,
      uFlux: shared.uFlux,
      uReactivity: shared.uReactivity,
      uAudioOn: shared.uAudioOn,
    })

    this.brightMat = mkMat(brightPassFrag, {
      tInput: { value: null },
      uThreshold: { value: this.hdr ? 1.0 : 0.75 },
      uKnee: { value: 0.5 },
    })

    this.downMat = mkMat(downsampleFrag, {
      tInput: { value: null },
      uTexel: { value: new THREE.Vector2() },
    })

    this.upMat = mkMat(upsampleFrag, {
      tPrev: { value: null },
      tAdd: { value: null },
      uTexel: { value: new THREE.Vector2() },
    })

    this.compositeMat = mkMat(compositeFrag, {
      tScene: { value: null },
      tBloom: { value: null },
      uResolution: { value: this.fullResolution },
      uBloomStrength: { value: this.hdr ? 0.9 : 0.55 },
      uHalation: { value: 0.35 },
      uGrain: { value: 0.03 },
      uTime: shared.uTime,
      uHueShift: shared.uHueShift,
      uFlicker: shared.uFlicker,
      uFlickerHz: shared.uFlickerHz,
      uPulse: shared.uPulse,
      uPulseRate: shared.uPulseRate,
      uVoid: shared.uVoid,
      uCine: shared.uCine,
      uFlux: shared.uFlux,
      uReactivity: shared.uReactivity,
      uAudioOn: shared.uAudioOn,
      uBeatPulse: shared.uBeatPulse,
      uWall: shared.uWall,
      uWallScale: shared.uWallScale,
      uScope: shared.uScope,
      uDrop: shared.uDrop,
      uDropMode: shared.uDropMode,
      uTrans: shared.uTrans,
      uTransMode: shared.uTransMode,
    })

    this.quadMesh = new THREE.Mesh(this.quadGeo, this.compositeMat)
    this.quadMesh.frustumCulled = false
    this.quadScene.add(this.quadMesh)
  }

  /* Current scaled render resolution (what mode shaders should use
   * for uResolution while rendering into the scene target). */
  get sceneWidth() { return Math.max(2, Math.round(this.sizeW * this.scale)) }
  get sceneHeight() { return Math.max(2, Math.round(this.sizeH * this.scale)) }

  /* (Re)size all render targets. w/h = full drawing-buffer size,
   * scale = renderScale (adaptive resolution). */
  setSize(w: number, h: number, scale: number) {
    if (w === this.sizeW && h === this.sizeH && scale === this.scale) return
    const first = !this.sceneRT
    this.sizeW = w
    this.sizeH = h
    this.scale = scale
    const sw = this.sceneWidth
    const sh = this.sceneHeight

    if (first) {
      this.sceneRT = makeRT(sw, sh, this.rtType)
      this.fbA = makeRT(sw, sh, this.rtType)
      this.fbB = makeRT(sw, sh, this.rtType)
      for (let i = 0; i < BLOOM_LEVELS; i++) {
        this.bloomDown.push(makeRT(sw >> (i + 1) || 1, sh >> (i + 1) || 1, this.rtType))
        if (i < BLOOM_LEVELS - 1) {
          this.bloomUp.push(makeRT(sw >> (i + 1) || 1, sh >> (i + 1) || 1, this.rtType))
        }
      }
    } else {
      this.sceneRT.setSize(sw, sh)
      this.fbA.setSize(sw, sh)
      this.fbB.setSize(sw, sh)
      for (let i = 0; i < BLOOM_LEVELS; i++) {
        this.bloomDown[i].setSize(sw >> (i + 1) || 1, sh >> (i + 1) || 1)
        if (i < BLOOM_LEVELS - 1) this.bloomUp[i].setSize(sw >> (i + 1) || 1, sh >> (i + 1) || 1)
      }
    }

    this.fbTexel.set(1 / sw, 1 / sh)
    this.fullResolution.set(w, h)

    // feedback history must start clean (fresh / resized targets are undefined)
    this.clearRT(this.fbA)
    this.clearRT(this.fbB)
  }

  private clearRT(rt: THREE.WebGLRenderTarget) {
    const prevColor = new THREE.Color()
    this.renderer.getClearColor(prevColor)
    const prevAlpha = this.renderer.getClearAlpha()
    this.renderer.setClearColor(0x000000, 0)
    this.renderer.setRenderTarget(rt)
    this.renderer.clear(true, false, false)
    this.renderer.setRenderTarget(null)
    this.renderer.setClearColor(prevColor, prevAlpha)
  }

  /* Render a ShaderMaterial fullscreen into a target (null = canvas). */
  private renderPass(material: THREE.ShaderMaterial, target: THREE.WebGLRenderTarget | null) {
    this.quadMesh.material = material
    this.renderer.setRenderTarget(target)
    this.renderer.render(this.quadScene, this.quadCam)
  }

  /* Full frame: scene → feedback → bloom pyramid → composite to screen. */
  render(sceneMaterial: THREE.ShaderMaterial) {
    // a. scene pass (linear HDR, no tonemap)
    this.renderPass(sceneMaterial, this.sceneRT)

    // b. feedback / trails (ping-pong A/B, skipped when uTrail ≈ 0)
    let accum = this.sceneRT
    const trail = this.feedbackMat.uniforms.uTrail.value as number
    if (trail > 0.005) {
      const fu = this.feedbackMat.uniforms
      fu.tScene.value = this.sceneRT.texture
      fu.tPrev.value = this.fbA.texture
      this.renderPass(this.feedbackMat, this.fbB)
      const tmp = this.fbA
      this.fbA = this.fbB
      this.fbB = tmp
      accum = this.fbA
    }

    // c. bloom: bright-pass → downsample chain → additive upsample chain
    this.brightMat.uniforms.tInput.value = accum.texture
    this.renderPass(this.brightMat, this.bloomDown[0])

    for (let i = 1; i < BLOOM_LEVELS; i++) {
      const src = this.bloomDown[i - 1]
      this.downMat.uniforms.tInput.value = src.texture
      ;(this.downMat.uniforms.uTexel.value as THREE.Vector2).set(1 / src.width, 1 / src.height)
      this.renderPass(this.downMat, this.bloomDown[i])
    }

    for (let i = BLOOM_LEVELS - 2; i >= 0; i--) {
      const prevTex = i === BLOOM_LEVELS - 2
        ? this.bloomDown[BLOOM_LEVELS - 1].texture
        : this.bloomUp[i + 1].texture
      const small = this.bloomDown[i + 1]
      this.upMat.uniforms.tPrev.value = prevTex
      this.upMat.uniforms.tAdd.value = this.bloomDown[i].texture
      ;(this.upMat.uniforms.uTexel.value as THREE.Vector2).set(1 / small.width, 1 / small.height)
      this.renderPass(this.upMat, this.bloomUp[i])
    }

    // d. composite → screen (tonemap + global FX live in the shader)
    const cu = this.compositeMat.uniforms
    cu.tScene.value = accum.texture
    cu.tBloom.value = this.bloomUp[0].texture
    this.renderPass(this.compositeMat, null)
    this.renderer.setRenderTarget(null)
  }

  dispose() {
    this.sceneRT?.dispose()
    this.fbA?.dispose()
    this.fbB?.dispose()
    for (const rt of this.bloomDown) rt.dispose()
    for (const rt of this.bloomUp) rt.dispose()
    this.feedbackMat.dispose()
    this.brightMat.dispose()
    this.downMat.dispose()
    this.upMat.dispose()
    this.compositeMat.dispose()
    this.quadGeo.dispose()
  }
}
