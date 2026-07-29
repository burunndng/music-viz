import * as THREE from 'three'
import { simVert, FLUID_SHADERS } from '../shaders/fluidGlsl'
import type { SimAudio } from './sims'

const FLUID_SIZE = 256
const PRESSURE_ITERS = 18

type Fmt = 'rg' | 'rgb' | 'r'

function makeRT(size: number, type: THREE.TextureDataType, fmt: Fmt) {
  const format = fmt === 'rgb' ? THREE.RGBAFormat : fmt === 'rg' ? THREE.RGFormat : THREE.RedFormat
  return new THREE.WebGLRenderTarget(size, size, {
    type,
    format,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: false,
    stencilBuffer: false,
    wrapS: THREE.ClampToEdgeWrapping,
    wrapT: THREE.ClampToEdgeWrapping,
  })
}

/* Real-time stable-fluids solver (semi-Lagrangian advection + Jacobi
 * pressure projection + vorticity confinement). Drives the FLUID mode. */
export class VizFluid {
  private renderer: THREE.WebGLRenderer
  private rtType: THREE.TextureDataType

  private scene = new THREE.Scene()
  private cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
  private geo = new THREE.PlaneGeometry(2, 2)
  private quad: THREE.Mesh

  private velA!: THREE.WebGLRenderTarget
  private velB!: THREE.WebGLRenderTarget
  private dyeA!: THREE.WebGLRenderTarget
  private dyeB!: THREE.WebGLRenderTarget
  private div!: THREE.WebGLRenderTarget
  private pressureA!: THREE.WebGLRenderTarget
  private pressureB!: THREE.WebGLRenderTarget
  private curl!: THREE.WebGLRenderTarget

  private mAdvect!: THREE.ShaderMaterial
  private mDivergence!: THREE.ShaderMaterial
  private mCurl!: THREE.ShaderMaterial
  private mVorticity!: THREE.ShaderMaterial
  private mPressure!: THREE.ShaderMaterial
  private mGradient!: THREE.ShaderMaterial
  private mSplatVel!: THREE.ShaderMaterial
  private mSplatDye!: THREE.ShaderMaterial
  private texel = new THREE.Vector2(1 / FLUID_SIZE, 1 / FLUID_SIZE)

  constructor(renderer: THREE.WebGLRenderer) {
    this.renderer = renderer
    const gl = renderer.getContext()
    const hdr = renderer.capabilities.isWebGL2 && !!gl.getExtension('EXT_color_buffer_float')
    this.rtType = hdr ? THREE.HalfFloatType : THREE.UnsignedByteType
    this.quad = new THREE.Mesh(this.geo, new THREE.MeshBasicMaterial())
    this.quad.frustumCulled = false
    this.scene.add(this.quad)

    this.velA = makeRT(FLUID_SIZE, this.rtType, 'rg')
    this.velB = makeRT(FLUID_SIZE, this.rtType, 'rg')
    this.dyeA = makeRT(FLUID_SIZE, this.rtType, 'rgb')
    this.dyeB = makeRT(FLUID_SIZE, this.rtType, 'rgb')
    this.div = makeRT(FLUID_SIZE, this.rtType, 'r')
    this.pressureA = makeRT(FLUID_SIZE, this.rtType, 'r')
    this.pressureB = makeRT(FLUID_SIZE, this.rtType, 'r')
    this.curl = makeRT(FLUID_SIZE, this.rtType, 'r')

    const mk = (frag: string, uniforms: Record<string, THREE.IUniform>) =>
      new THREE.ShaderMaterial({
        vertexShader: simVert,
        fragmentShader: frag,
        uniforms: { uTexel: { value: this.texel }, ...uniforms },
        depthTest: false,
        depthWrite: false,
      })

    this.mAdvect = mk(FLUID_SHADERS.advect, {
      tVelocity: { value: null }, tSource: { value: null },
      uDt: { value: 1.0 }, uDissipation: { value: 1.0 },
    })
    this.mDivergence = mk(FLUID_SHADERS.divergence, { tVelocity: { value: null } })
    this.mCurl = mk(FLUID_SHADERS.curl, { tVelocity: { value: null } })
    this.mVorticity = mk(FLUID_SHADERS.vorticity, {
      tVelocity: { value: null }, tCurl: { value: null },
      uCurl: { value: 22.0 }, uDt: { value: 1.0 },
    })
    this.mPressure = mk(FLUID_SHADERS.pressure, {
      tPressure: { value: null }, tDivergence: { value: null },
    })
    this.mGradient = mk(FLUID_SHADERS.gradient, {
      tVelocity: { value: null }, tPressure: { value: null },
    })
    this.mSplatVel = mk(FLUID_SHADERS.splatVel, {
      tVelocity: { value: null },
      uTime: { value: 0 }, uBass: { value: 0 }, uMid: { value: 0 }, uTreble: { value: 0 },
      uLevel: { value: 0 }, uBeat: { value: 0 }, uAudioOn: { value: 0 }, uReactivity: { value: 1 },
    })
    this.mSplatDye = mk(FLUID_SHADERS.splatDye, {
      tDye: { value: null },
      uTime: { value: 0 }, uBass: { value: 0 }, uMid: { value: 0 }, uTreble: { value: 0 },
      uLevel: { value: 0 }, uCentroid: { value: 0.5 }, uAudioOn: { value: 0 }, uReactivity: { value: 1 },
    })
  }

  private blit(mat: THREE.ShaderMaterial, target: THREE.WebGLRenderTarget) {
    this.quad.material = mat
    this.renderer.setRenderTarget(target)
    this.renderer.render(this.scene, this.cam)
  }

  private swapVel() { const t = this.velA; this.velA = this.velB; this.velB = t }
  private swapDye() { const t = this.dyeA; this.dyeA = this.dyeB; this.dyeB = t }
  private swapPressure() { const t = this.pressureA; this.pressureA = this.pressureB; this.pressureB = t }

  update(a: SimAudio): THREE.Texture {
    const ar = a.audioOn * a.reactivity
    const dt = 1.0

    // 1. advect velocity
    this.mAdvect.uniforms.tVelocity.value = this.velA.texture
    this.mAdvect.uniforms.tSource.value = this.velA.texture
    this.mAdvect.uniforms.uDt.value = dt
    this.mAdvect.uniforms.uDissipation.value = 0.999
    this.blit(this.mAdvect, this.velB)
    this.swapVel()

    // 2. splat forces into velocity
    this.mSplatVel.uniforms.tVelocity.value = this.velA.texture
    this.mSplatVel.uniforms.uTime.value = a.time
    this.mSplatVel.uniforms.uBass.value = a.bass
    this.mSplatVel.uniforms.uMid.value = a.mid
    this.mSplatVel.uniforms.uTreble.value = a.treble
    this.mSplatVel.uniforms.uLevel.value = a.level
    this.mSplatVel.uniforms.uBeat.value = a.beat
    this.mSplatVel.uniforms.uAudioOn.value = a.audioOn
    this.mSplatVel.uniforms.uReactivity.value = a.reactivity
    this.blit(this.mSplatVel, this.velB)
    this.swapVel()

    // 3. curl + vorticity confinement
    this.mCurl.uniforms.tVelocity.value = this.velA.texture
    this.blit(this.mCurl, this.curl)
    this.mVorticity.uniforms.tVelocity.value = this.velA.texture
    this.mVorticity.uniforms.tCurl.value = this.curl.texture
    this.mVorticity.uniforms.uDt.value = dt
    this.blit(this.mVorticity, this.velB)
    this.swapVel()

    // 4. divergence
    this.mDivergence.uniforms.tVelocity.value = this.velA.texture
    this.blit(this.mDivergence, this.div)

    // 5. pressure solve (Jacobi)
    this.mPressure.uniforms.tDivergence.value = this.div.texture
    for (let i = 0; i < PRESSURE_ITERS; i++) {
      this.mPressure.uniforms.tPressure.value = this.pressureA.texture
      this.blit(this.mPressure, this.pressureB)
      this.swapPressure()
    }

    // 6. subtract pressure gradient
    this.mGradient.uniforms.tVelocity.value = this.velA.texture
    this.mGradient.uniforms.tPressure.value = this.pressureA.texture
    this.blit(this.mGradient, this.velB)
    this.swapVel()

    // 7. advect dye
    this.mAdvect.uniforms.tVelocity.value = this.velA.texture
    this.mAdvect.uniforms.tSource.value = this.dyeA.texture
    this.mAdvect.uniforms.uDt.value = dt
    this.mAdvect.uniforms.uDissipation.value = 0.992
    this.blit(this.mAdvect, this.dyeB)
    this.swapDye()

    // 8. splat dye
    this.mSplatDye.uniforms.tDye.value = this.dyeA.texture
    this.mSplatDye.uniforms.uTime.value = a.time
    this.mSplatDye.uniforms.uBass.value = a.bass
    this.mSplatDye.uniforms.uMid.value = a.mid
    this.mSplatDye.uniforms.uTreble.value = a.treble
    this.mSplatDye.uniforms.uLevel.value = a.level
    this.mSplatDye.uniforms.uCentroid.value = a.centroid
    this.mSplatDye.uniforms.uAudioOn.value = a.audioOn
    this.mSplatDye.uniforms.uReactivity.value = a.reactivity
    this.blit(this.mSplatDye, this.dyeB)
    this.swapDye()

    this.renderer.setRenderTarget(null)
    return this.dyeA.texture
  }

  getDye(): THREE.Texture { return this.dyeA.texture }

  dispose() {
    this.velA.dispose(); this.velB.dispose(); this.dyeA.dispose(); this.dyeB.dispose()
    this.div.dispose(); this.pressureA.dispose(); this.pressureB.dispose(); this.curl.dispose()
    this.geo.dispose()
    ;(this.quad.material as THREE.Material).dispose()
    this.mAdvect.dispose(); this.mDivergence.dispose(); this.mCurl.dispose()
    this.mVorticity.dispose(); this.mPressure.dispose(); this.mGradient.dispose()
    this.mSplatVel.dispose(); this.mSplatDye.dispose()
  }
}
