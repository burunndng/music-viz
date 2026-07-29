<script setup lang="ts">
import { ref } from 'vue'
import {
  state, MODES, PALETTES, presets, SUBSTANCES,
  animateToPreset, applySubstance, actions,
} from '../lib/store'
import { audioEngine } from '../lib/audio'
import SliderControl from './SliderControl.vue'

const fileInput = ref<HTMLInputElement>()
const trackName = ref('')
const showModes = ref(false)
const showPalette = ref(false)
const showSettings = ref(false)
const minimized = ref(false)
const settingsTab = ref<'params' | 'presets' | 'vessels'>('params')

const sliders = [
  { key: 'symmetry', label: 'Symmetry', min: 2, max: 12, step: 1 },
  { key: 'reactivity', label: 'Reactivity', min: 0, max: 1, step: 0.01 },
  { key: 'sensitivity', label: 'Sensitivity', min: 0.1, max: 3, step: 0.05 },
  { key: 'hueShift', label: 'Hue Shift', min: 0, max: 3.14, step: 0.01 },
  { key: 'pulse', label: 'Pulse', min: 0, max: 1, step: 0.01 },
  { key: 'pulseRate', label: 'Pulse Rate', min: 0.5, max: 20, step: 0.5 },
  { key: 'voidness', label: 'Void', min: 0, max: 1, step: 0.01 },
  { key: 'tone', label: 'Tone', min: 0, max: 1, step: 0.01 },
  { key: 'chaos', label: 'Chaos', min: 0, max: 1, step: 0.01 },
  { key: 'wallScale', label: 'Wall Scale', min: 0.5, max: 8, step: 0.1 },
  { key: 'ascension', label: 'Ascension', min: 0, max: 1, step: 0.01, accent: true },
] as const

const toggles = [
  { key: 'journey', label: 'Auto' },
  { key: 'cinematic', label: 'Cine' },
  { key: 'scope', label: 'Scope' },
  { key: 'flicker', label: 'Flick' },
  { key: 'ray', label: 'Ray' },
  { key: 'choreo', label: 'Choreo' },
] as const

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
}
function setMode(i: number) {
  state.mode = i
  showModes.value = false
}
function setPalette(i: number) {
  state.palette = i
  showPalette.value = false
}
function pickSubstance(i: number) {
  const sub = SUBSTANCES[i]
  if (!sub) return
  applySubstance(sub)
}

function closeAll() {
  showModes.value = false
  showPalette.value = false
  showSettings.value = false
}
</script>

<template>
  <input ref="fileInput" type="file" accept="audio/*" class="hidden" @change="handleFile" />

  <!-- Minimized pill -->
  <button
    v-if="minimized"
    @click="minimized = false"
    class="fixed bottom-3 left-1/2 -translate-x-1/2 z-[70] px-4 py-2 rounded-full text-[10px] tracking-[0.2em] uppercase bg-black/60 backdrop-blur-xl border border-white/10 text-white/55 hover:text-white/90 transition-all"
  >
    Controls
  </button>

  <div v-else class="fixed inset-x-0 bottom-0 z-50 flex justify-center px-3 pb-3 pointer-events-none">
    <!-- Backdrop for any open overlay -->
    <div
      v-if="showModes || showSettings"
      class="fixed inset-0 z-[60] bg-black/40 backdrop-blur-[2px]"
      @click="closeAll"
    />

    <!-- Dock -->
    <div
      class="pointer-events-auto w-full max-w-5xl relative"
      :style="{
        borderColor: state.beatIntensity > 0.1
          ? `rgba(217, 70, 239, ${state.beatIntensity * 0.3})`
          : undefined,
        boxShadow: state.beatIntensity > 0.1
          ? `0 -4px 26px rgba(217, 70, 239, ${state.beatIntensity * 0.15})`
          : undefined,
      }"
    >
      <div class="flex items-center gap-2 px-3 py-2.5 rounded-2xl bg-black/65 backdrop-blur-2xl border border-white/[0.08]">
        <!-- Audio cluster -->
        <div class="flex items-center gap-1.5 shrink-0">
          <button @click="toggleMic" :class="[
            'w-9 h-9 rounded-xl flex items-center justify-center border transition-all duration-300',
            isMicActive() ? 'bg-fuchsia-500/25 border-fuchsia-400/40 text-fuchsia-200'
              : 'bg-white/[0.04] border-white/10 text-white/45 hover:text-white/80 hover:bg-white/[0.08]'
          ]" title="Microphone">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>
          </button>
          <button @click="fileInput?.click()" :class="[
            'w-9 h-9 rounded-xl flex items-center justify-center border transition-all duration-300',
            isFileActive() ? 'bg-pink-500/25 border-pink-400/40 text-pink-200'
              : 'bg-white/[0.04] border-white/10 text-white/45 hover:text-white/80 hover:bg-white/[0.08]'
          ]" title="Load track">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>
          </button>
          <button @click="togglePlay" :disabled="!isFileActive()" :class="[
            'w-9 h-9 rounded-xl flex items-center justify-center border transition-all duration-300',
            !isFileActive() ? 'bg-white/[0.02] border-white/[0.06] text-white/25 cursor-not-allowed'
              : state.trackPlaying ? 'bg-emerald-500/25 border-emerald-400/40 text-emerald-200'
              : 'bg-white/[0.04] border-white/10 text-white/45 hover:text-white/80'
          ]" title="Play / pause">
            <svg v-if="state.trackPlaying" width="13" height="13" viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>
            <svg v-else width="13" height="13" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M7 4.5v15a1 1 0 0 0 1.55.83l12-7.5a1 1 0 0 0 0-1.66l-12-7.5A1 1 0 0 0 7 4.5Z"/></svg>
          </button>
          <span v-if="trackName" class="hidden sm:block text-[10px] text-white/30 font-mono truncate max-w-[110px]">{{ trackName }}</span>
        </div>

        <div class="w-px h-7 bg-white/[0.08] shrink-0" />

        <!-- Capture cluster -->
        <div class="flex items-center gap-1.5 shrink-0">
          <button @click="actions.snapshot()" class="w-9 h-9 rounded-xl flex items-center justify-center border bg-white/[0.04] border-white/10 text-white/45 hover:text-white/80 hover:bg-white/[0.08] transition-all" title="Snapshot (PNG)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3Z"/><circle cx="12" cy="13" r="3"/></svg>
          </button>
          <button @click="actions.toggleRecord()" :class="[
            'w-9 h-9 rounded-xl flex items-center justify-center border transition-all',
            actions.isRecording() ? 'bg-red-500/30 border-red-400/50 text-red-300'
              : 'bg-white/[0.04] border-white/10 text-white/45 hover:text-white/80 hover:bg-white/[0.08]'
          ]" title="Record (WebM)">
            <span class="block w-2.5 h-2.5 rounded-full bg-current" />
          </button>
          <button @click="actions.initTab()" class="w-9 h-9 rounded-xl flex items-center justify-center border bg-white/[0.04] border-white/10 text-white/45 hover:text-white/80 hover:bg-white/[0.08] transition-all" title="Capture tab / system audio">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>
          </button>
        </div>

        <div class="w-px h-7 bg-white/[0.08] shrink-0" />

        <!-- Mode + palette -->
        <div class="flex items-center gap-1.5 shrink-0">
          <button @click="showSettings=false; showPalette=false; showModes=!showModes" :class="[
            'px-3 h-9 rounded-xl text-[10px] tracking-[0.15em] uppercase font-medium border transition-all',
            showModes ? 'bg-fuchsia-500/20 border-fuchsia-400/30 text-fuchsia-200'
              : 'bg-white/[0.06] border-white/12 text-white/85 hover:bg-white/[0.1]'
          ]">
            {{ MODES[state.mode]?.name?.split(' ')[0] || 'MODE' }}
          </button>
          <div class="relative">
            <button @click="showSettings=false; showModes=false; showPalette=!showPalette" :class="[
              'px-3 h-9 rounded-xl text-[10px] tracking-[0.15em] uppercase font-medium border transition-all',
              showPalette ? 'bg-fuchsia-500/20 border-fuchsia-400/30 text-fuchsia-200'
                : 'bg-white/[0.06] border-white/12 text-white/85 hover:bg-white/[0.1]'
            ]">
              {{ PALETTES[state.palette] }}
            </button>
            <div v-if="showPalette" class="absolute bottom-[52px] right-0 w-44 p-2 rounded-2xl bg-black/80 backdrop-blur-2xl border border-white/10 shadow-2xl grid grid-cols-3 gap-1.5">
              <button v-for="(p, i) in PALETTES" :key="p" @click="setPalette(i)" :class="[
                'px-1.5 py-2 rounded-lg text-[9px] tracking-wide uppercase transition-all border',
                i === state.palette ? 'bg-fuchsia-500/20 text-fuchsia-200 border-fuchsia-400/20'
                  : 'text-white/45 hover:bg-white/[0.06] hover:text-white/80 border-transparent'
              ]">{{ p }}</button>
            </div>
          </div>
        </div>

        <!-- Toggles -->
        <div class="hidden md:flex items-center gap-1 shrink-0">
          <button v-for="t in toggles" :key="t.key" @click="(state as any)[t.key] = !(state as any)[t.key]" :class="[
            'px-2.5 h-8 rounded-lg text-[9px] tracking-[0.15em] uppercase border transition-all',
            (state as any)[t.key] ? 'bg-white/[0.12] border-white/25 text-white/90'
              : 'bg-white/[0.03] border-white/[0.08] text-white/40 hover:text-white/70'
          ]">{{ t.label }}</button>
        </div>

        <!-- Settings + minimize -->
        <div class="ml-auto flex items-center gap-1.5 shrink-0">
          <button @click="showModes=false; showPalette=false; showSettings=!showSettings" :class="[
            'w-9 h-9 rounded-xl flex items-center justify-center border transition-all',
            showSettings ? 'bg-fuchsia-500/20 border-fuchsia-400/30 text-fuchsia-200'
              : 'bg-white/[0.04] border-white/10 text-white/45 hover:text-white/80 hover:bg-white/[0.08]'
          ]" title="Settings">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"/></svg>
          </button>
          <button @click="minimized = true" class="w-9 h-9 rounded-xl flex items-center justify-center border bg-white/[0.04] border-white/10 text-white/45 hover:text-white/80 hover:bg-white/[0.08] transition-all" title="Hide">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
        </div>
      </div>

      <!-- Audio stats -->
      <div v-if="audioEngine.analysis.on" class="flex items-center gap-3 px-3 pt-1.5 text-[10px] text-white/35 font-mono">
        <span>BPM <span class="text-white/65">{{ audioEngine.analysis.bpm || '—' }}</span></span>
        <span>BASS <span class="text-white/65">{{ audioEngine.analysis.bass.toFixed(2) }}</span></span>
        <span>MID <span class="text-white/65">{{ audioEngine.analysis.mid.toFixed(2) }}</span></span>
        <span>TREB <span class="text-white/65">{{ audioEngine.analysis.treble.toFixed(2) }}</span></span>
      </div>
    </div>

    <!-- Mode browser (bottom sheet) -->
    <transition name="sheet">
      <div v-if="showModes" class="fixed inset-x-0 bottom-0 z-[70] flex justify-center px-3 pb-3 pointer-events-none">
        <div class="pointer-events-auto w-full max-w-4xl max-h-[68vh] overflow-y-auto rounded-3xl bg-black/80 backdrop-blur-2xl border border-white/10 shadow-2xl p-4">
          <div class="flex items-center justify-between mb-3 px-1">
            <span class="text-[10px] tracking-[0.25em] uppercase text-white/40">Visual Modes</span>
            <button @click="showModes = false" class="text-white/40 hover:text-white/80 text-xs">✕</button>
          </div>
          <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            <button v-for="(m, i) in MODES" :key="m.id" @click="setMode(i)" :class="[
              'text-left p-3 rounded-2xl border transition-all group',
              i === state.mode ? 'bg-gradient-to-br from-fuchsia-500/25 to-violet-500/15 border-fuchsia-400/40'
                : 'bg-white/[0.03] border-white/[0.07] hover:bg-white/[0.07] hover:border-white/15'
            ]">
              <div class="flex items-baseline gap-2">
                <span class="text-[9px] font-mono text-white/30 tabular-nums">{{ String(i).padStart(2, '0') }}</span>
                <span :class="['text-[12px] font-semibold tracking-wide', i === state.mode ? 'text-fuchsia-100' : 'text-white/80']">{{ m.name }}</span>
              </div>
              <div class="text-[9px] text-white/35 mt-1 leading-snug">{{ m.sub }}</div>
            </button>
          </div>
        </div>
      </div>
    </transition>

    <!-- Settings drawer (right) -->
    <transition name="drawer">
      <div v-if="showSettings" class="fixed top-0 right-0 bottom-0 z-[70] w-[330px] max-w-[88vw] pointer-events-auto">
        <div class="h-full rounded-l-3xl bg-black/80 backdrop-blur-2xl border-l border-white/10 shadow-2xl flex flex-col">
          <div class="flex items-center justify-between px-4 py-3 border-b border-white/[0.07]">
            <span class="text-[10px] tracking-[0.25em] uppercase text-white/40">Settings</span>
            <button @click="showSettings = false" class="text-white/40 hover:text-white/80 text-xs">✕</button>
          </div>

          <!-- Tabs -->
          <div class="flex gap-1 px-3 pt-3">
            <button v-for="t in (['params','presets','vessels'] as const)" :key="t" @click="settingsTab = t" :class="[
              'flex-1 py-1.5 rounded-lg text-[9px] tracking-[0.15em] uppercase border transition-all',
              settingsTab === t ? 'bg-white/[0.1] border-white/20 text-white/85' : 'bg-white/[0.03] border-white/[0.07] text-white/40 hover:text-white/70'
            ]">{{ t }}</button>
          </div>

          <div class="flex-1 overflow-y-auto px-4 py-4">
            <!-- Params -->
            <div v-if="settingsTab === 'params'" class="space-y-2.5">
              <SliderControl
                v-for="s in sliders"
                :key="s.key"
                :label="s.label"
                v-model="(state as any)[s.key]"
                :min="s.min" :max="s.max" :step="s.step"
                :accent="(s as any).accent"
              />
              <button @click="stopAudio" v-if="audioEngine.analysis.on" class="w-full mt-2 py-2 rounded-xl text-[10px] tracking-[0.2em] uppercase bg-red-500/20 border border-red-400/40 text-red-300 hover:bg-red-500/30 transition-all">
                Stop Audio
              </button>
            </div>

            <!-- Presets -->
            <div v-else-if="settingsTab === 'presets'" class="grid grid-cols-1 gap-1.5">
              <button v-for="(p, i) in presets" :key="p.name" @click="applyPreset(i)" class="text-left px-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.07] hover:bg-white/[0.07] hover:border-white/15 transition-all">
                <div class="text-[12px] font-medium text-white/85">{{ p.name }}</div>
                <div class="text-[9px] text-white/35 mt-0.5">{{ MODES[p.params.mode as number]?.name }} · {{ PALETTES[p.params.palette as number] }}</div>
              </button>
            </div>

            <!-- Vessels -->
            <div v-else class="grid grid-cols-1 gap-1.5">
              <button v-for="(s, i) in SUBSTANCES" :key="s.name" @click="pickSubstance(i)" :class="[
                'text-left px-3 py-2.5 rounded-xl border transition-all',
                s.name === state.substance ? 'bg-fuchsia-500/15 border-fuchsia-400/30'
                  : 'bg-white/[0.03] border-white/[0.07] hover:bg-white/[0.07] hover:border-white/15'
              ]">
                <div class="flex items-center gap-2">
                  <span class="text-base">{{ s.glyph }}</span>
                  <div>
                    <div class="text-[12px] font-medium text-white/85">{{ s.name }}</div>
                    <div class="text-[9px] text-white/35 mt-0.5">{{ s.klass }} · {{ s.duration }}</div>
                  </div>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<style scoped>
.sheet-enter-active, .sheet-leave-active { transition: transform 0.28s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.28s; }
.sheet-enter-from, .sheet-leave-to { transform: translateY(24px); opacity: 0; }

.drawer-enter-active, .drawer-leave-active { transition: transform 0.3s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.3s; }
.drawer-enter-from, .drawer-leave-to { transform: translateX(40px); opacity: 0; }
</style>
