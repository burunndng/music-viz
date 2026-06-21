<script setup lang="ts">
import { ref } from 'vue'
import { state, MODES, PALETTES, presets, SUBSTANCES, animateToPreset, applySubstance } from '../lib/store'
import { audioEngine } from '../lib/audio'
import SliderControl from './SliderControl.vue'
import gsap from 'gsap'

const fileInput = ref<HTMLInputElement>()
const trackName = ref('')
const showModes = ref(false)
const showSettings = ref(false)
const showPresets = ref(false)
const showSubstances = ref(false)

function isMicActive() {
  return audioEngine.analysis.on && !trackName.value
}

function isFileActive() {
  return audioEngine.analysis.on && !!trackName.value
}

async function toggleMic() {
  if (isMicActive()) {
    audioEngine.stop()
    trackName.value = ''
    state.audioOn = false
  } else {
    trackName.value = ''
    await audioEngine.initMic()
    state.audioOn = true
  }
}

async function handleFile(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  trackName.value = file.name
  await audioEngine.loadFile(file)
  state.audioOn = true
  state.trackPlaying = true
}

function togglePlay() {
  audioEngine.togglePlay()
  state.trackPlaying = audioEngine.isPlaying
}

function stopAudio() {
  audioEngine.stop()
  trackName.value = ''
  state.audioOn = false
  state.trackPlaying = false
}

function applyPreset(index: number) {
  const p = presets[index]
  if (!p) return
  animateToPreset(p.params)
  showPresets.value = false
}

function setMode(i: number) {
  state.mode = i
  showModes.value = false
}

function setPalette(i: number) {
  state.palette = i
}

function pickSubstance(i: number) {
  const sub = SUBSTANCES[i]
  if (!sub) return
  applySubstance(sub)
  showSubstances.value = false
}
</script>

<template>
  <input ref="fileInput" type="file" accept="audio/*" class="hidden" @change="handleFile" />

  <div class="fixed bottom-0 inset-x-0 z-50 pointer-events-none">
    <div class="h-8 bg-gradient-to-t from-black/80 via-black/30 to-transparent pointer-events-none" />

    <div
      class="bg-black/60 backdrop-blur-xl border-t border-white/[0.06] pointer-events-auto transition-all duration-150"
      :style="{
        borderColor: state.beatIntensity > 0.1
          ? `rgba(168, 132, 247, ${state.beatIntensity * 0.3})`
          : undefined,
        boxShadow: state.beatIntensity > 0.1
          ? `0 -4px 20px rgba(168, 132, 247, ${state.beatIntensity * 0.15})`
          : undefined,
      }"
    >
      <div class="flex items-center gap-2 px-3 py-2">
        <!-- Audio trio -->
        <button
          @click="toggleMic"
          :class="[
            'w-8 h-8 rounded-full flex items-center justify-center border transition-all duration-300 shrink-0',
            isMicActive()
              ? 'bg-purple-500/25 border-purple-400/40 text-purple-300'
              : 'bg-white/[0.04] border-white/10 text-white/40 hover:text-white/70'
          ]"
          title="Toggle microphone"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" x2="12" y1="19" y2="22" />
          </svg>
        </button>

        <button
          @click="fileInput?.click()"
          :class="[
            'w-8 h-8 rounded-full flex items-center justify-center border transition-all duration-300 shrink-0',
            isFileActive()
              ? 'bg-pink-500/25 border-pink-400/40 text-pink-300'
              : 'bg-white/[0.04] border-white/10 text-white/40 hover:text-white/70'
          ]"
          title="Upload track"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" x2="12" y1="3" y2="15" />
          </svg>
        </button>

        <button
          @click="togglePlay"
          :disabled="!isFileActive()"
          :class="[
            'w-8 h-8 rounded-full flex items-center justify-center border transition-all duration-300 shrink-0',
            !isFileActive()
              ? 'bg-white/[0.02] border-white/[0.06] text-white/25 cursor-not-allowed'
              : state.trackPlaying
                ? 'bg-emerald-500/25 border-emerald-400/40 text-emerald-300'
                : 'bg-white/[0.04] border-white/10 text-white/40 hover:text-white/70'
          ]"
          :title="!isFileActive() ? 'Upload a track first' : state.trackPlaying ? 'Pause' : 'Play'"
        >
          <svg v-if="state.trackPlaying" width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="none">
            <rect x="6" y="5" width="4" height="14" rx="1" />
            <rect x="14" y="5" width="4" height="14" rx="1" />
          </svg>
          <svg v-else width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="none">
            <path d="M7 4.5v15a1 1 0 0 0 1.55.83l12-7.5a1 1 0 0 0 0-1.66l-12-7.5A1 1 0 0 0 7 4.5Z" />
          </svg>
        </button>

        <span v-if="trackName" class="text-[10px] text-white/30 font-mono truncate max-w-[120px]">
          {{ trackName }}
        </span>

        <!-- Core sliders -->
        <div class="flex-1 flex items-center gap-3 overflow-x-auto pl-1">
          <SliderControl label="Dose" v-model="state.dose" :accent="true" />
          <SliderControl label="Speed" v-model="state.speed" :min="0.1" :max="3" :step="0.05" />
          <SliderControl label="Complex" v-model="state.complexity" />
          <SliderControl label="Trail" v-model="state.trail" />
        </div>

        <!-- Mode -->
        <div class="relative shrink-0">
          <button
            @click.stop="showModes = !showModes; showSettings = false; showPresets = false; showSubstances = false"
            class="px-2.5 py-1.5 rounded-full text-[10px] tracking-wider uppercase font-medium border transition-all duration-300 backdrop-blur-sm bg-white/[0.12] border-white/25 text-white/90"
          >
            {{ MODES[state.mode]?.name?.split(' ')[0] || 'MODE' }}
          </button>
        </div>

        <!-- Palette -->
        <div class="relative shrink-0">
          <button
            @click.stop="showSettings = !showSettings; showModes = false; showPresets = false; showSubstances = false"
            class="px-2.5 py-1.5 rounded-full text-[10px] tracking-wider uppercase font-medium border transition-all duration-300 backdrop-blur-sm bg-white/[0.12] border-white/25 text-white/90"
          >
            {{ PALETTES[state.palette] }}
          </button>
        </div>

        <!-- Presets -->
        <div class="relative shrink-0">
          <button
            @click.stop="showPresets = !showPresets; showModes = false; showSettings = false; showSubstances = false"
            class="px-2.5 py-1.5 rounded-full text-[10px] tracking-wider uppercase font-medium border transition-all duration-300 backdrop-blur-sm bg-white/[0.12] border-white/25 text-white/90"
          >
            Presets
          </button>
        </div>

        <!-- Substance -->
        <div class="relative shrink-0">
          <button
            @click.stop="showSubstances = !showSubstances; showModes = false; showSettings = false; showPresets = false"
            :class="[
              'px-2.5 py-1.5 rounded-full text-[10px] tracking-wider uppercase font-medium border transition-all duration-300 backdrop-blur-sm',
              state.substance
                ? 'bg-purple-500/20 border-purple-400/30 text-purple-200'
                : 'bg-white/[0.12] border-white/25 text-white/90'
            ]"
          >
            {{ state.substance || 'Vessel' }}
          </button>
        </div>
      </div>

      <!-- Audio stats -->
      <div v-if="audioEngine.analysis.on" class="flex items-center gap-3 px-3 pb-1.5 text-[10px] text-white/35 font-mono">
        <span>BPM <span class="text-white/60">{{ audioEngine.analysis.bpm || '—' }}</span></span>
        <span>Bass <span class="text-white/60">{{ audioEngine.analysis.bass.toFixed(2) }}</span></span>
        <span>Mid <span class="text-white/60">{{ audioEngine.analysis.mid.toFixed(2) }}</span></span>
        <span>Treble <span class="text-white/60">{{ audioEngine.analysis.treble.toFixed(2) }}</span></span>
      </div>
    </div>
  </div>

  <!-- Backdrop -->
  <div v-if="showModes || showSettings || showPresets || showSubstances" class="fixed inset-0 z-[60]" @click="showModes = false; showSettings = false; showPresets = false; showSubstances = false" />

  <!-- Mode dropdown -->
  <div v-if="showModes" class="fixed bottom-[76px] right-3 bg-black/90 backdrop-blur-2xl border border-white/10 shadow-2xl rounded-xl p-1.5 w-56 z-[61] max-h-[60vh] overflow-y-auto" @click.stop>
    <button
      v-for="(m, i) in MODES"
      :key="m.id"
      @click="setMode(i)"
      :class="[
        'w-full text-left px-3 py-2 rounded-lg text-[11px] transition-all',
        i === state.mode
          ? 'bg-purple-500/20 text-purple-200 border border-purple-400/20'
          : 'text-white/50 hover:bg-white/[0.06] hover:text-white/80 border border-transparent'
      ]"
    >
      <div class="font-medium tracking-wide">{{ m.name }}</div>
      <div class="text-[9px] text-white/30 mt-0.5">{{ m.sub }}</div>
    </button>
  </div>

  <!-- Presets dropdown -->
  <div v-if="showPresets" class="fixed bottom-[76px] right-3 bg-black/90 backdrop-blur-2xl border border-white/10 shadow-2xl rounded-xl p-2 w-56 z-[61]" @click.stop>
    <button
      v-for="(p, i) in presets"
      :key="p.name"
      @click="applyPreset(i)"
      class="w-full text-left px-3 py-2 rounded-lg text-[11px] text-white/60 hover:bg-white/[0.06] hover:text-white/90 transition-all border border-transparent"
    >
      <div class="font-medium tracking-wide">{{ p.name }}</div>
      <div class="text-[9px] text-white/30 mt-0.5">
        {{ MODES[p.params.mode as number]?.name }} · {{ PALETTES[p.params.palette as number] }}
      </div>
    </button>
  </div>

  <!-- Substance dropdown -->
  <div v-if="showSubstances" class="fixed bottom-[76px] right-3 bg-black/90 backdrop-blur-2xl border border-white/10 shadow-2xl rounded-xl p-2 w-60 z-[61] max-h-[60vh] overflow-y-auto" @click.stop>
    <div class="px-2 py-1 text-[9px] tracking-wider uppercase text-white/30 mb-1">Vessel</div>
    <button
      v-for="(s, i) in SUBSTANCES"
      :key="s.name"
      @click="pickSubstance(i)"
      :class="[
        'w-full text-left px-3 py-2 rounded-lg text-[11px] transition-all border',
        s.name === state.substance
          ? 'bg-purple-500/20 text-purple-200 border-purple-400/20'
          : 'text-white/50 hover:bg-white/[0.06] hover:text-white/80 border-transparent'
      ]"
    >
      <div class="flex items-center gap-2">
        <span class="text-base">{{ s.glyph }}</span>
        <div>
          <div class="font-medium tracking-wide">{{ s.name }}</div>
          <div class="text-[9px] text-white/30 mt-0.5">{{ s.klass }} · {{ s.duration }}</div>
        </div>
      </div>
    </button>
  </div>

  <!-- Settings dropdown -->
  <div v-if="showSettings" class="fixed bottom-[76px] right-3 bg-black/90 backdrop-blur-2xl border border-white/10 shadow-2xl rounded-xl p-3 w-60 z-[61] max-h-[60vh] overflow-y-auto" @click.stop>
    <div class="mb-3">
      <div class="text-[9px] tracking-wider uppercase text-white/30 mb-1">Palette</div>
      <div class="grid grid-cols-3 gap-0.5">
        <button
          v-for="(p, i) in PALETTES"
          :key="p"
          @click="setPalette(i)"
          :class="[
            'px-2 py-1 rounded-lg text-[9px] tracking-wider uppercase transition-all text-center',
            i === state.palette
              ? 'bg-purple-500/20 text-purple-200 border border-purple-400/20'
              : 'text-white/40 hover:bg-white/[0.06] hover:text-white/70 border border-transparent'
          ]"
        >
          {{ p }}
        </button>
      </div>
    </div>

    <div class="space-y-1 mb-3">
      <SliderControl label="Symmetry" v-model="state.symmetry" :min="2" :max="12" :step="1" />
      <SliderControl label="Reactivity" v-model="state.reactivity" />
      <SliderControl label="Sensitivity" v-model="state.sensitivity" :min="0.1" :max="3" :step="0.05" />
      <SliderControl label="Hue Shift" v-model="state.hueShift" :min="0" :max="3.14" :step="0.01" />
      <SliderControl label="Pulse" v-model="state.pulse" />
      <SliderControl label="Pulse Rate" v-model="state.pulseRate" :min="0.5" :max="20" :step="0.5" />
      <SliderControl label="Void" v-model="state.voidness" />
      <SliderControl label="Tone" v-model="state.tone" />
      <SliderControl label="Chaos" v-model="state.chaos" />
      <SliderControl label="Wall Scale" v-model="state.wallScale" :min="0.5" :max="8" :step="0.1" />
      <SliderControl label="Ascension" v-model="state.ascension" :accent="true" />
    </div>

    <div class="flex items-center gap-1.5 flex-wrap">
      <button
        @click="state.journey = !state.journey"
        :class="[
          'px-2 py-1 rounded-full text-[9px] tracking-wider uppercase font-medium border transition-all',
          state.journey ? 'bg-white/[0.12] border-white/25 text-white/90' : 'bg-white/[0.03] border-white/[0.08] text-white/40'
        ]"
      >Journey</button>

      <button
        @click="state.flicker = !state.flicker"
        :class="[
          'px-2 py-1 rounded-full text-[9px] tracking-wider uppercase font-medium border transition-all',
          state.flicker ? 'bg-white/[0.12] border-white/25 text-white/90' : 'bg-white/[0.03] border-white/[0.08] text-white/40'
        ]"
      >Flicker</button>

      <button
        @click="state.cinematic = !state.cinematic"
        :class="[
          'px-2 py-1 rounded-full text-[9px] tracking-wider uppercase font-medium border transition-all',
          state.cinematic ? 'bg-white/[0.12] border-white/25 text-white/90' : 'bg-white/[0.03] border-white/[0.08] text-white/40'
        ]"
      >Cine</button>

      <button
        @click="state.scope = !state.scope"
        :class="[
          'px-2 py-1 rounded-full text-[9px] tracking-wider uppercase font-medium border transition-all',
          state.scope ? 'bg-white/[0.12] border-white/25 text-white/90' : 'bg-white/[0.03] border-white/[0.08] text-white/40'
        ]"
      >Scope</button>

      <button
        @click="state.ray = !state.ray"
        :class="[
          'px-2 py-1 rounded-full text-[9px] tracking-wider uppercase font-medium border transition-all',
          state.ray ? 'bg-white/[0.12] border-white/25 text-white/90' : 'bg-white/[0.03] border-white/[0.08] text-white/40'
        ]"
      >Ray</button>

      <button
        @click="state.choreo = !state.choreo"
        :class="[
          'px-2 py-1 rounded-full text-[9px] tracking-wider uppercase font-medium border transition-all',
          state.choreo ? 'bg-white/[0.12] border-white/25 text-white/90' : 'bg-white/[0.03] border-white/[0.08] text-white/40'
        ]"
      >Choreo</button>

      <button
        v-if="state.audioOn"
        @click="stopAudio"
        class="px-2 py-1 rounded-full text-[9px] tracking-wider uppercase font-medium border transition-all bg-red-500/20 border-red-400/40 text-red-300"
      >Stop Audio</button>
    </div>
  </div>
</template>
