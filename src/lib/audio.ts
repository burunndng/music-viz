/* ── Audio engine v2 ──────────────────────────────────────────
 * AudioWorklet captures raw samples (4096-FFT on the main thread via a
 * compact radix-2 FFT). Computes 8 bands, spectral centroid/flux,
 * onset (beat) detection, build/drop envelopes, chroma/key, and supports
 * mic, file, and tab/system audio capture. Falls back to a native
 * AnalyserNode (fftSize 4096) if AudioWorklet is unavailable. ── */

const FFT_SIZE = 4096
const HALF = FFT_SIZE / 2

/* ── Analysis result ───────────────────────────────────────── */
export interface AudioAnalysis {
  on: boolean
  sub: number; bass: number; lowmid: number; mid: number
  highmid: number; treble: number; air: number; level: number
  beat: number; flux: number; phase: number; bpm: number
  onset: number; build: number; drop: number
  centroid: number; dissonance: number
  crest: number; zcr: number
  waveform: Float32Array; spectrum: Float32Array
  detectedKey: number; isMinor: boolean; chroma: Float32Array
}

/* ── Compact iterative radix-2 FFT (in-place) ──────────────── */
function fft(re: Float32Array, im: Float32Array) {
  const n = re.length
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1
    for (; j & bit; bit >>= 1) j ^= bit
    j ^= bit
    if (i < j) {
      const tr = re[i]; re[i] = re[j]; re[j] = tr
      const ti = im[i]; im[i] = im[j]; im[j] = ti
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = -2 * Math.PI / len
    const wr = Math.cos(ang), wi = Math.sin(ang)
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0
      for (let k = 0; k < len >> 1; k++) {
        const a = re[i + k], b = im[i + k]
        const c = re[i + k + (len >> 1)], d = im[i + k + (len >> 1)]
        const vr = c * cr - d * ci
        const vi = c * ci + d * cr
        re[i + k] = a + vr; im[i + k] = b + vi
        re[i + k + (len >> 1)] = a - vr; im[i + k + (len >> 1)] = b - vi
        const ncr = cr * wr - ci * wi
        ci = cr * wi + ci * wr
        cr = ncr
      }
    }
  }
}

const normalizeDB = (db: number, min = -100, max = -10) =>
  Math.max(0, Math.min(1, (db - min) / (max - min)))

const smooth = (cur: number, raw: number, fast: number, slow: number, on: boolean) =>
  cur + (raw - cur) * (on ? fast : slow)

class AudioEngine {
  private ctx: AudioContext | null = null
  private worklet: AudioWorkletNode | null = null
  private analyser: AnalyserNode | null = null
  private useWorklet = true

  private source: AudioNode | null = null
  private audioElement: HTMLAudioElement | null = null
  private mediaStream: MediaStream | null = null
  private streamSource: MediaStreamAudioSourceNode | null = null

  /* raw-sample ring buffer (worklet path) */
  private ring = new Float32Array(FFT_SIZE)
  private ringPos = 0
  private lastSampleT = 0

  /* reusable FFT buffers */
  private re = new Float32Array(FFT_SIZE)
  private im = new Float32Array(FFT_SIZE)
  private mag = new Float32Array(HALF)
  private magPrev = new Float32Array(HALF)
  private hann = new Float32Array(FFT_SIZE)

  /* running stats */
  private fluxMean = 0.01
  private energyPrev = 0
  private buildEnv = 0
  private dropEnv = 0
  private onsetEnv = 0
  private lastBeatT = 0
  private bpm = 128
  private fluxHistory = new Float32Array(512)
  private chroma = new Float32Array(12)
  private isMinor = false
  private detectedKey = 0

  private emaSub = 0; private emaBass = 0; private emaLowmid = 0
  private emaMid = 0; private emaHighmid = 0; private emaTreble = 0
  private emaAir = 0; private emaLevel = 0

  analysis: AudioAnalysis = {
    on: false,
    sub: 0, bass: 0, lowmid: 0, mid: 0, highmid: 0, treble: 0, air: 0, level: 0,
    beat: 0, flux: 0, phase: 0, bpm: 128,
    onset: 0, build: 0, drop: 0,
    centroid: 0.5, dissonance: 0,
    crest: 1, zcr: 0,
    waveform: new Float32Array(256),
    spectrum: new Float32Array(1024),
    detectedKey: 0, isMinor: false, chroma: new Float32Array(12),
  }

  constructor() {
    for (let i = 0; i < FFT_SIZE; i++) {
      this.hann[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (FFT_SIZE - 1))
    }
  }

  private async ensureCtx(): Promise<AudioContext> {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
      try {
        await this.ctx.audioWorklet.addModule('/audio-worklets/analyzer-processor.js')
        this.useWorklet = true
      } catch {
        this.useWorklet = false
        this.analyser = this.ctx.createAnalyser()
        this.analyser.fftSize = FFT_SIZE
        this.analyser.smoothingTimeConstant = 0.6
      }
    }
    if (this.ctx.state === 'suspended') await this.ctx.resume()
    return this.ctx
  }

  private makeWorklet(ctx: AudioContext): AudioWorkletNode {
    const node = new AudioWorkletNode(ctx, 'analyzer-processor', {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [2],
    })
    node.port.onmessage = (e: MessageEvent) => {
      const block = e.data as Float32Array
      for (let i = 0; i < block.length; i++) {
        this.ring[this.ringPos] = block[i]
        this.ringPos = (this.ringPos + 1) % FFT_SIZE
      }
      this.lastSampleT = performance.now() / 1000
    }
    return node
  }

  private connectSource(node: AudioNode, ctx: AudioContext) {
    if (this.useWorklet) {
      this.worklet = this.makeWorklet(ctx)
      node.connect(this.worklet)
      this.worklet.connect(ctx.destination)
    } else if (this.analyser) {
      node.connect(this.analyser)
      this.analyser.connect(ctx.destination)
    }
    this.source = node
  }

  /* ── Mic ──────────────────────────────────────────────────── */
  async initMic() {
    await this.stop()
    const ctx = await this.ensureCtx()
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
    this.mediaStream = stream
    const src = ctx.createMediaStreamSource(stream)
    this.connectSource(src, ctx)
    this.analysis.on = true
  }

  /* ── File ─────────────────────────────────────────────────── */
  async loadFile(file: File) {
    await this.stop()
    const ctx = await this.ensureCtx()
    const url = URL.createObjectURL(file)
    const el = new Audio()
    el.src = url
    el.loop = true
    el.crossOrigin = 'anonymous'
    el.setAttribute('playsinline', 'true')
    this.audioElement = el
    const src = ctx.createMediaElementSource(el)
    this.connectSource(src, ctx)
    await el.play()
    this.analysis.on = true
  }

  /* ── Tab / system capture (getDisplayMedia) ───────────────── */
  async initTab() {
    await this.stop()
    const ctx = await this.ensureCtx()
    const stream = await (navigator.mediaDevices as any).getDisplayMedia({
      audio: true,
      video: true,
    })
    this.mediaStream = stream
    const src = ctx.createMediaStreamSource(stream)
    this.streamSource = src
    this.connectSource(src, ctx)
    this.analysis.on = true
  }

  async togglePlay() {
    if (!this.audioElement) return
    if (this.audioElement.paused) {
      await this.audioElement.play()
      this.analysis.on = true
    } else {
      this.audioElement.pause()
      this.analysis.on = false
    }
  }

  get isPlaying(): boolean {
    return this.audioElement ? !this.audioElement.paused : false
  }

  stop() {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((t) => t.stop())
      this.mediaStream = null
    }
    if (this.audioElement) {
      this.audioElement.pause()
      this.audioElement.src = ''
      this.audioElement = null
    }
    if (this.streamSource) { this.streamSource.disconnect(); this.streamSource = null }
    if (this.source) { this.source.disconnect(); this.source = null }
    if (this.worklet) { this.worklet.disconnect(); this.worklet.port.onmessage = null; this.worklet = null }
    if (this.analyser) { this.analyser.disconnect(); this.analyser = null }
    this.analysis.on = false
  }

  /* ── Per-frame analysis ───────────────────────────────────── */
  analyse(sensitivity: number = 1.2): AudioAnalysis {
    const a = this.analysis

    if (!this.ctx || !a.on || performance.now() / 1000 - this.lastSampleT > 0.4) {
      a.on = false
    }

    if (!a.on) {
      a.sub = a.bass = a.lowmid = a.mid = a.highmid = a.treble = a.air = a.level = 0
      a.beat = a.flux = a.onset = a.build = a.drop = 0
      a.centroid = 0.5; a.dissonance = 0
      return a
    }

    const sampleRate = this.ctx!.sampleRate
    const binHz = sampleRate / FFT_SIZE

    if (this.useWorklet) {
      // reconstruct ordered window from ring buffer
      for (let i = 0; i < FFT_SIZE; i++) {
        const s = this.ring[(this.ringPos + i) % FFT_SIZE] * this.hann[i]
        this.re[i] = s
        this.im[i] = 0
      }
      fft(this.re, this.im)
      let maxMag = 1e-6
      for (let i = 0; i < HALF; i++) {
        const m = Math.hypot(this.re[i], this.im[i])
        this.mag[i] = m
        if (m > maxMag) maxMag = m
      }
      // normalise magnitude to 0..1
      for (let i = 0; i < HALF; i++) this.mag[i] /= maxMag
    } else if (this.analyser) {
      const db = new Float32Array(this.analyser.frequencyBinCount)
      this.analyser.getFloatFrequencyData(db)
      let maxMag = 1e-6
      for (let i = 0; i < HALF && i < db.length; i++) {
        const m = normalizeDB(db[i])
        this.mag[i] = m
        if (m > maxMag) maxMag = m
      }
      if (maxMag > 1e-3) for (let i = 0; i < HALF; i++) this.mag[i] /= maxMag
    }

    /* bands */
    const band = (lo: number, hi: number) => {
      const i0 = Math.max(0, Math.floor(lo / binHz))
      const i1 = Math.min(HALF - 1, Math.floor(hi / binHz))
      let s = 0, c = 0
      for (let i = i0; i <= i1; i++) { s += this.mag[i]; c++ }
      return c > 0 ? (s / c) * sensitivity : 0
    }
    const sub = band(20, 60)
    const bass = band(60, 250)
    const lowmid = band(250, 500)
    const mid = band(500, 2000)
    const highmid = band(2000, 4000)
    const treble = band(4000, 8000)
    const air = band(8000, 16000)
    const level = (sub + bass + mid + treble) / 4

    /* spectral centroid */
    let cNum = 0, cDen = 0
    for (let i = 0; i < HALF; i++) {
      if (this.mag[i] > 0) { cNum += this.mag[i] * i; cDen += this.mag[i] }
    }
    const centroid = cDen > 0 ? cNum / cDen / HALF : 0.5

    /* spectral flux + onset (adaptive threshold) */
    let flux = 0
    for (let i = 0; i < HALF; i++) {
      const d = this.mag[i] - this.magPrev[i]
      if (d > 0) flux += d
      this.magPrev[i] = this.mag[i]
    }
    flux /= HALF
    this.fluxMean = this.fluxMean * 0.95 + flux * 0.05
    const fluxRatio = flux / (this.fluxMean + 1e-4)
    const onset = Math.max(0, Math.min(1, (fluxRatio - 1.4) * 2.5))
    this.onsetEnv = this.onsetEnv * 0.6 + onset * 0.4

    /* build / drop envelopes */
    const energy = level
    const dE = energy - this.energyPrev
    this.buildEnv = Math.max(0, Math.min(1, this.buildEnv * 0.96 + Math.max(0, dE) * 6))
    if (this.energyPrev > 0.25 && energy < this.energyPrev * 0.55 && this.onsetEnv > 0.35) {
      this.dropEnv = 1.0
    } else {
      this.dropEnv = Math.max(0, this.dropEnv - 0.05)
    }
    this.energyPrev = energy

    /* beat (peak of onset with cooldown) */
    const now = performance.now() / 1000
    let beat = a.beat
    if (this.onsetEnv > 0.6 && now - this.lastBeatT > 0.18) {
      beat = 1.0
      this.lastBeatT = now
    } else {
      beat = Math.max(0, beat - 0.06)
    }
    const phase = Math.min(1, (now - this.lastBeatT) / Math.max(0.3, 60 / this.bpm))

    /* BPM via autocorrelation of flux history */
    for (let i = 511; i > 0; i--) this.fluxHistory[i] = this.fluxHistory[i - 1]
    this.fluxHistory[0] = flux
    const autocorr = (lag: number) => {
      let sum = 0
      for (let i = 0; i < 512 - lag; i++) sum += this.fluxHistory[i] * this.fluxHistory[i + lag]
      return sum
    }
    let maxCorr = 0, bestLag = 30
    for (let lag = 20; lag <= 60; lag++) {
      const corr = autocorr(lag)
      if (corr > maxCorr) { maxCorr = corr; bestLag = lag }
    }
    this.bpm = Math.round(3600 / Math.max(bestLag, 1))

    /* chroma / key */
    for (let i = 0; i < 12; i++) this.chroma[i] *= 0.85
    for (let i = 0; i < HALF; i++) {
      const freq = i * binHz
      if (freq < 65 || freq > 4200) continue
      const midi = 69 + 12 * Math.log2(freq / 440)
      const pc = ((Math.round(midi) % 12) + 12) % 12
      this.chroma[pc] += this.mag[i]
    }
    let chromaMax = 0
    for (let i = 0; i < 12; i++) chromaMax = Math.max(chromaMax, this.chroma[i])
    if (chromaMax > 0) for (let i = 0; i < 12; i++) this.chroma[i] /= chromaMax
    const majorProfile = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88]
    const minorProfile = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17]
    let bestKey = 0, bestKeyScore = -1
    for (let k = 0; k < 12; k++) {
      let majorScore = 0, minorScore = 0
      for (let i = 0; i < 12; i++) {
        majorScore += this.chroma[(i + k) % 12] * majorProfile[i]
        minorScore += this.chroma[(i + k) % 12] * minorProfile[i]
      }
      const score = Math.max(majorScore, minorScore)
      if (score > bestKeyScore) { bestKeyScore = score; bestKey = k; this.isMinor = minorScore > majorScore }
    }
    this.detectedKey = bestKey

    /* spectral dissonance */
    let diss = 0
    for (let i = 2; i < HALF; i++) {
      const a_ = this.mag[i], b_ = this.mag[i - 2]
      diss += a_ * b_ * (a_ + b_) * 0.5
    }
    const dissonance = Math.min(1, diss / HALF) * sensitivity

    /* EMA smoothing of bands */
    const on = true
    this.emaSub = smooth(this.emaSub, sub, 0.40, 0.06, on)
    this.emaBass = smooth(this.emaBass, bass, 0.35, 0.06, on)
    this.emaLowmid = smooth(this.emaLowmid, lowmid, 0.22, 0.04, on)
    this.emaMid = smooth(this.emaMid, mid, 0.20, 0.04, on)
    this.emaHighmid = smooth(this.emaHighmid, highmid, 0.18, 0.03, on)
    this.emaTreble = smooth(this.emaTreble, treble, 0.15, 0.03, on)
    this.emaAir = smooth(this.emaAir, air, 0.12, 0.02, on)
    this.emaLevel = smooth(this.emaLevel, level, 0.25, 0.05, on)

    a.sub = this.emaSub; a.bass = this.emaBass; a.lowmid = this.emaLowmid
    a.mid = this.emaMid; a.highmid = this.emaHighmid; a.treble = this.emaTreble
    a.air = this.emaAir; a.level = this.emaLevel
    a.centroid = centroid; a.dissonance = dissonance
    a.flux = flux; a.onset = this.onsetEnv; a.build = this.buildEnv; a.drop = this.dropEnv
    a.beat = beat; a.phase = phase; a.bpm = this.bpm

    /* waveform (downsample ring → 256) */
    for (let i = 0; i < 256; i++) {
      const idx = Math.floor((i / 256) * FFT_SIZE)
      a.waveform[i] = this.ring[(this.ringPos + idx) % FFT_SIZE]
    }
    /* spectrum (downsample mag → 1024) */
    for (let i = 0; i < 1024; i++) {
      const idx = Math.floor((i / 1024) * HALF)
      a.spectrum[i] = this.mag[idx]
    }
    a.detectedKey = this.detectedKey
    a.isMinor = this.isMinor
    a.chroma = this.chroma

    return a
  }
}

export const audioEngine = new AudioEngine()
