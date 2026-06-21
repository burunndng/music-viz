import * as Tone from 'tone'

/* ── Normalisation helpers ─────────────────────────────────── */
const normalizeDB = (db: number, min = -100, max = 0) =>
  Math.max(0, Math.min(1, (db - min) / (max - min)))

const ema = (cur: number, raw: number, fast: number, slow: number, on: boolean) =>
  cur + (raw - cur) * (on ? fast : slow)

/* ── Tone.js to Native Web Audio helpers ────────────────────── */
const getNativeInput = (node: any): AudioNode | AudioParam | null => {
  let current = node
  while (current && (current instanceof Tone.ToneAudioNode || current instanceof Tone.Param)) {
    current = current.input
  }
  return current
}

const getNativeOutput = (node: any): AudioNode | null => {
  let current = node
  while (current && current instanceof Tone.ToneAudioNode) {
    current = current.output
  }
  return current
}

/* ── Analysis result ───────────────────────────────────────── */
export interface AudioAnalysis {
  on: boolean
  /* core bands (0-1, sensitivity-scaled) */
  sub: number; bass: number; lowmid: number; mid: number
  highmid: number; treble: number; air: number; level: number
  /* beat / rhythm */
  beat: number; flux: number; phase: number; bpm: number
  /* spectral */
  centroid: number; dissonance: number
  /* time-domain */
  crest: number; zcr: number
  /* waveform & spectrum */
  waveform: Float32Array; spectrum: Float32Array
  /* chroma / key */
  detectedKey: number; isMinor: boolean; chroma: Float32Array
}

/* ── Audio Engine ──────────────────────────────────────────── */
class AudioEngine {
  private fft: InstanceType<typeof Tone.Analyser> | null = null
  private waveformAnalyser: InstanceType<typeof Tone.Analyser> | null = null
  private mic: Tone.UserMedia | null = null
  private audioElement: HTMLAudioElement | null = null
  private micStream: MediaStream | null = null
  private micSource: MediaStreamAudioSourceNode | null = null

  /* internal state (bypassed by frame loop — no Vue reactivity) */
  private fluxHistory = new Float32Array(512)
  private specPrev = new Float32Array(1024)
  private bassSlow = 0.05
  private lastBeatT = 0
  private chroma = new Float32Array(12)
  private isMinor = false
  private detectedKey = 0

  /* EMA-smoothed band envelopes */
  private emaSub = 0; private emaBass = 0; private emaLowmid = 0
  private emaMid = 0; private emaHighmid = 0; private emaTreble = 0
  private emaAir = 0; private emaLevel = 0; private emaDissonance = 0

  analysis: AudioAnalysis = {
    on: false,
    sub: 0, bass: 0, lowmid: 0, mid: 0, highmid: 0, treble: 0, air: 0, level: 0,
    beat: 0, flux: 0, phase: 0, bpm: 128,
    centroid: 0.5, dissonance: 0,
    crest: 1, zcr: 0,
    waveform: new Float32Array(256),
    spectrum: new Float32Array(1024),
    detectedKey: 0, isMinor: false,
    chroma: new Float32Array(12),
  }

  /* ── Mic ──────────────────────────────────────────────────── */
  async initMic() {
    await this.stop()
    await Tone.start()

    this.fft = new Tone.Analyser({ type: 'fft', size: 1024 })
    this.waveformAnalyser = new Tone.Analyser({ type: 'waveform', size: 256 })

    this.mic = new Tone.UserMedia()
    await this.mic.open()

    // Connect mic → fft → waveform using native nodes
    const micOut = getNativeOutput(this.mic) as AudioNode
    const fftIn = getNativeInput(this.fft) as AudioNode
    const waveIn = getNativeInput(this.waveformAnalyser) as AudioNode

    if (micOut && fftIn && waveIn) {
      micOut.connect(fftIn)
      fftIn.connect(waveIn)
    }

    this.analysis.on = true
  }

  /* ── File ─────────────────────────────────────────────────── */
  async loadFile(file: File) {
    await this.stop()
    await Tone.start()

    this.fft = new Tone.Analyser({ type: 'fft', size: 1024 })
    this.waveformAnalyser = new Tone.Analyser({ type: 'waveform', size: 256 })

    const url = URL.createObjectURL(file)
    this.audioElement = new Audio()
    this.audioElement.src = url
    this.audioElement.loop = true
    this.audioElement.crossOrigin = 'anonymous'
    this.audioElement.setAttribute('playsinline', 'true')

    this.audioElement.addEventListener('ended', () => {
      this.analysis.on = false
    })

    // Use native Web Audio API for reliable connections
    const ctx = Tone.context.rawContext as unknown as AudioContext
    const sourceNode = ctx.createMediaElementSource(this.audioElement)
    const fftIn = getNativeInput(this.fft) as AudioNode
    const waveIn = getNativeInput(this.waveformAnalyser) as AudioNode

    if (fftIn && waveIn) {
      // source → destination (so we hear it) + source → fft → waveform
      sourceNode.connect(ctx.destination)
      sourceNode.connect(fftIn)
      fftIn.connect(waveIn)
    }

    this.micSource = sourceNode as unknown as MediaStreamAudioSourceNode

    await this.audioElement.play()
    this.analysis.on = true
  }

  /* ── Playback controls ────────────────────────────────────── */
  async togglePlay() {
    if (!this.audioElement) return
    if (this.audioElement.paused) {
      await this.audioElement.play()
    } else {
      this.audioElement.pause()
    }
  }

  get isPlaying(): boolean {
    return this.audioElement ? !this.audioElement.paused : false
  }

  stop() {
    if (this.micStream) {
      this.micStream.getTracks().forEach((t) => t.stop())
      this.micStream = null
    }
    if (this.mic) {
      this.mic.close()
      this.mic.dispose()
      this.mic = null
    }
    if (this.audioElement) {
      this.audioElement.pause()
      this.audioElement.src = ''
      this.audioElement = null
    }
    if (this.micSource) {
      this.micSource.disconnect()
      this.micSource = null
    }
    if (this.fft) {
      this.fft.dispose()
      this.fft = null
    }
    if (this.waveformAnalyser) {
      this.waveformAnalyser.dispose()
      this.waveformAnalyser = null
    }
    this.analysis.on = false
  }

  /* ── Per-frame analysis (called from useRenderLoop) ────────── */
  analyse(sensitivity: number = 1.2): AudioAnalysis {
    if (!this.fft || !this.waveformAnalyser) {
      this.analysis.on = false
      return this.analysis
    }

    if (this.audioElement && this.audioElement.paused) {
      this.analysis.on = false
      this.analysis.bass = 0; this.analysis.mid = 0; this.analysis.treble = 0
      this.analysis.level = 0; this.analysis.sub = 0; this.analysis.lowmid = 0
      this.analysis.highmid = 0; this.analysis.air = 0
      this.analysis.beat = 0; this.analysis.flux = 0; this.analysis.centroid = 0
      this.analysis.dissonance = 0
      return this.analysis
    }

    this.analysis.on = true

    /* ── FFT (Tone.Analyser returns dB: -100..0) ── */
    const fftDB = this.fft.getValue() as Float32Array
    const n = fftDB.length
    const sampleRate = Tone.context.sampleRate
    const binHz = sampleRate / (this.fft.size)

    const freqToIdx = (f: number) => Math.min(n - 1, Math.max(0, Math.round(f / binHz)))
    const avg = (lo: number, hi: number) => {
      let s = 0, c = 0
      for (let i = freqToIdx(lo); i <= freqToIdx(hi) && i < n; i++) {
        s += normalizeDB(fftDB[i])
        c++
      }
      return c > 0 ? (s / c) * sensitivity : 0
    }

    /* ── 8-band extraction (ported from enthea) ── */
    const sub    = avg(20, 60)
    const bass   = avg(60, 250)
    const lowmid = avg(250, 500)
    const mid    = avg(500, 2000)
    const highmid = avg(2000, 4000)
    const treble = avg(4000, 8000)
    const air    = avg(8000, 16000)
    const level  = (sub + bass + mid + treble) / 4

    /* ── Spectral centroid ── */
    let cNum = 0, cDen = 0
    for (let i = 0; i < n; i++) {
      const v = normalizeDB(fftDB[i])
      if (v > 0) { cNum += v * i; cDen += v }
    }
    this.analysis.centroid = cDen > 0 ? cNum / cDen / n : 0.5

    /* ── Spectral flux (half-wave rectified) ── */
    let flux = 0
    for (let i = 0; i < n; i++) {
      const v = normalizeDB(fftDB[i])
      const d = v - this.specPrev[i]
      if (d > 0) flux += d
      this.specPrev[i] = v
    }
    flux /= n
    this.analysis.flux = flux

    /* ── Autocorrelation BPM estimation (ported from enthea) ── */
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
    const estimatedBPM = Math.round(3600 / Math.max(bestLag, 1))

    /* ── Chroma features + key detection (ported from enthea) ── */
    for (let i = 0; i < 12; i++) this.chroma[i] *= 0.85
    for (let i = 0; i < n; i++) {
      const freq = i * binHz
      if (freq < 65 || freq > 4200) continue
      const midi = 69 + 12 * Math.log2(freq / 440)
      const pitchClass = ((Math.round(midi) % 12) + 12) % 12
      this.chroma[pitchClass] += normalizeDB(fftDB[i])
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
      if (score > bestKeyScore) {
        bestKeyScore = score; bestKey = k
        this.isMinor = minorScore > majorScore
      }
    }
    this.detectedKey = bestKey

    /* ── Crest factor + ZCR (from waveform) ── */
    const waveRaw = this.waveformAnalyser.getValue() as Float32Array
    let rms = 0, peak = 0
    for (let i = 0; i < waveRaw.length; i++) {
      const v = Math.abs(waveRaw[i])
      rms += v * v
      if (v > peak) peak = v
    }
    rms = Math.sqrt(rms / waveRaw.length)
    this.analysis.crest = rms > 0.001 ? peak / rms : 1.0

    let zcr = 0
    for (let i = 1; i < waveRaw.length; i++) {
      if ((waveRaw[i] >= 0) !== (waveRaw[i - 1] >= 0)) zcr++
    }
    this.analysis.zcr = zcr / (waveRaw.length - 1)

    /* ── Spectral dissonance (roughness) ── */
    let diss = 0
    for (let i = 2; i < n; i++) {
      const a_ = normalizeDB(fftDB[i])
      const b_ = normalizeDB(fftDB[i - 2])
      diss += a_ * b_ * (a_ + b_) * 0.5
    }
    this.emaDissonance = ema(this.emaDissonance, Math.min(1, diss / n), 0.10, 0.02, this.analysis.on)
    this.analysis.dissonance = this.emaDissonance * sensitivity

    /* ── EMA smoothing (SOTA temporal coherence) ── */
    const on = this.analysis.on
    this.emaSub     = ema(this.emaSub, sub, 0.40, 0.06, on)
    this.emaBass    = ema(this.emaBass, bass, 0.35, 0.06, on)
    this.emaLowmid  = ema(this.emaLowmid, lowmid, 0.22, 0.04, on)
    this.emaMid     = ema(this.emaMid, mid, 0.20, 0.04, on)
    this.emaHighmid = ema(this.emaHighmid, highmid, 0.18, 0.03, on)
    this.emaTreble  = ema(this.emaTreble, treble, 0.15, 0.03, on)
    this.emaAir     = ema(this.emaAir, air, 0.12, 0.02, on)
    this.emaLevel   = ema(this.emaLevel, level, 0.25, 0.05, on)

    this.analysis.sub = this.emaSub
    this.analysis.bass = this.emaBass
    this.analysis.lowmid = this.emaLowmid
    this.analysis.mid = this.emaMid
    this.analysis.highmid = this.emaHighmid
    this.analysis.treble = this.emaTreble
    this.analysis.air = this.emaAir
    this.analysis.level = this.emaLevel

    /* ── Beat detection (peak + cooldown, ported from enthea) ── */
    const now = performance.now() / 1000
    this.bassSlow = this.bassSlow * 0.92 + bass * 0.08
    const beatHit = bass > this.bassSlow * 1.35 && bass > 0.18
    if (beatHit && now - this.lastBeatT > 0.18) {
      this.analysis.beat = 1.0
      this.analysis.phase = 0
      this.lastBeatT = now
    } else {
      this.analysis.beat = Math.max(0, this.analysis.beat - 0.06)
      this.analysis.phase = Math.min(1, (now - this.lastBeatT) / Math.max(0.3, 60 / estimatedBPM))
    }
    this.analysis.bpm = estimatedBPM

    /* ── Waveform (Tone.Analyser returns -1..1 floats) ── */
    this.analysis.waveform = waveRaw

    /* ── Spectrum (normalised dB for shaders) ── */
    for (let i = 0; i < n; i++) {
      this.analysis.spectrum[i] = normalizeDB(fftDB[i])
    }

    /* ── Chroma / key ── */
    this.analysis.detectedKey = this.detectedKey
    this.analysis.isMinor = this.isMinor
    this.analysis.chroma = this.chroma

    return this.analysis
  }
}

export const audioEngine = new AudioEngine()
