// AudioWorklet processor: passes audio through (so it is audible) and posts
// raw mono blocks to the main thread for a 4096-point FFT / onset analysis.
class AnalyzerProcessor extends AudioWorkletProcessor {
  constructor() {
    super()
  }

  process(inputs, outputs, _params) {
    const input = inputs[0]
    const output = outputs[0]
    if (input && input[0]) {
      const len = input[0].length
      // downmix to mono for analysis
      let mono
      if (input.length > 1) {
        mono = new Float32Array(len)
        for (let i = 0; i < len; i++) mono[i] = (input[0][i] + input[1][i]) * 0.5
      } else {
        mono = input[0]
      }
      // passthrough to all output channels
      if (output) {
        for (let c = 0; c < output.length; c++) {
          if (output[c]) output[c].set(mono)
        }
      }
      // post a copy (transferable) for the analyser
      const copy = new Float32Array(len)
      copy.set(mono)
      this.port.postMessage(copy, [copy.buffer])
    }
    return true
  }
}

registerProcessor('analyzer-processor', AnalyzerProcessor)
