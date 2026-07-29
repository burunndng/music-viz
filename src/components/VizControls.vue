<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref } from 'vue'
import {
  state, MODES, PALETTES, presets, SUBSTANCES,
  animateToPreset, applySubstance, actions, animateParam,
} from '../lib/store'
import { audioEngine } from '../lib/audio'
import SliderControl from './SliderControl.vue'

const fileInput = ref<HTMLInputElement>()
const trackName = ref('')
const minimized = ref(false)
const sheet = ref<'none' | 'mode' | 'palette' | 'more'>('none')
const moreTab = ref<'mix' | 'rites' | 'presets' | 'vessel'>('mix')
const recording = ref(false)

const isMic = computed(() => audioEngine.analysis.on && !trackName.value)
const isFile = computed(() => audioEngine.analysis.on && !!trackName.value)
const modeShort = computed(() =>
  (MODES[state.mode]?.name || 'MODE').split(' ').slice(0, 2).join(' '))

const coreSliders = [
  { key: 'dose', label: 'Dose', min: 0, max: 1, step: 0.01, accent: true },
  { key: 'speed', label: 'Tempo', min: 0.1, max: 3, step: 0.05 },
  { key: 'complexity', label: 'Complex', min: 0, max: 1, step: 0.01 },
  { key: 'trail', label: 'Trail', min: 0, max: 1, step: 0.01 },
] as const

const mixSliders = [
  { key: 'symmetry', label: 'Symmetry', min: 2, max: 12, step: 1 },
  { key: 'reactivity', label: 'React', min: 0, max: 1, step: 0.01 },
  { key: 'sensitivity', label: 'Sense', min: 0.1, max: 3, step: 0.05 },
  { key: 'hueShift', label: 'Hue', min: 0, max: 3.14, step: 0.01 },
  { key: 'pulse', label: 'Pulse', min: 0, max: 1, step: 0.01 },
  { key: 'pulseRate', label: 'Pulse Hz', min: 0.5, max: 20, step: 0.5 },
  { key: 'voidness', label: 'Void', min: 0, max: 1, step: 0.01 },
  { key: 'tone', label: 'Tone', min: 0, max: 1, step: 0.01 },
  { key: 'ascension', label: 'Ascend', min: 0, max: 1, step: 0.01, accent: true },
  { key: 'wallScale', label: 'Wall dens.', min: 0.5, max: 8, step: 0.1 },
  { key: 'flickerHz', label: 'Flick Hz', min: 1, max: 30, step: 1 },
] as const

const rites = [
  { key: 'journey', label: 'Auto', tip: 'Autopilot VJ · A' },
  { key: 'cinematic', label: 'Cine', tip: 'Cinematic FX · C' },
  { key: 'scope', label: 'Scope', tip: 'CRT / scope · V' },
  { key: 'flicker', label: 'Flick', tip: 'Flicker drive · K' },
  { key: 'ray', label: 'Ray', tip: '3D raymarch · R' },
  { key: 'choreo', label: 'Choreo', tip: 'Beat blooms' },
] as const

const walls = [
  { id: 0, label: 'Off' },
  { id: 1, label: 'pmm' },
  { id: 2, label: 'p4m' },
  { id: 3, label: 'p6m' },
  { id: 4, label: 'cm' },
  { id: 5, label: 'p3' },
]

function btnCls(on: boolean) {
  return on
    ? 'w-9 h-9 shrink-0 rounded-xl flex items-center justify-center border transition-all active:scale-95 bg-fuchsia-500/25 border-fuchsia-400/40 text-fuchsia-100'
    : 'w-9 h-9 shrink-0 rounded-xl flex items-center justify-center border transition-all active:scale-95 bg-white/[0.04] border-white/10 text-white/50 hover:text-white/85 hover:bg-white/[0.08]'
}
function chipCls(on: boolean) {
  return on
    ? 'h-8 sm:h-9 px-2 sm:px-2.5 shrink-0 rounded-xl text-[9px] sm:text-[10px] tracking-[0.12em] uppercase font-medium border transition-all bg-fuchsia-500/20 border-fuchsia-400/35 text-fuchsia-100'
    : 'h-8 sm:h-9 px-2 sm:px-2.5 shrink-0 rounded-xl text-[9px] sm:text-[10px] tracking-[0.12em] uppercase font-medium border transition-all bg-white/[0.06] border-white/12 text-white/85 hover:bg-white/[0.1]'
}
function chipSmCls(on: boolean) {
  return on
    ? 'h-7 px-2 shrink-0 rounded-lg text-[8px] tracking-[0.12em] uppercase border transition-all bg-fuchsia-500/20 border-fuchsia-400/35 text-fuchsia-100'
    : 'h-7 px-2 shrink-0 rounded-lg text-[8px] tracking-[0.12em] uppercase border transition-all bg-white/[0.03] border-white/[0.08] text-white/40 hover:text-white/70'
}

function close() { sheet.value = 'none' }
function open(s: typeof sheet.value) { sheet.value = sheet.value === s ? 'none' : s }

async function toggleMic() {
  if (isMic.value) {
    audioEngine.stop(); trackName.value = ''; state.audioOn = false
  } else {
    trackName.value = ''
    await audioEngine.initMic()
    state.audioOn = true
  }
}
async function handleFile(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]
  if (!f) return
  trackName.value = f.name
  await audioEngine.loadFile(f)
  state.audioOn = true
  state.trackPlaying = true
}
function togglePlay() {
  audioEngine.togglePlay()
  state.trackPlaying = audioEngine.isPlaying
}
function stopAudio() {
  audioEngine.stop(); trackName.value = ''; state.audioOn = false; state.trackPlaying = false
}
function setMode(i: number) { state.mode = i; close() }
function setPalette(i: number) { state.palette = i; close() }
function applyP(i: number) { animateToPreset(presets[i].params) }
function applyS(i: number) { applySubstance(SUBSTANCES[i]); moreTab.value = 'mix' }
function onRec() {
  actions.toggleRecord()
  recording.value = actions.isRecording()
}
function onFs() {
  const el = document.documentElement
  if (!document.fullscreenElement) el.requestFullscreen?.()
  else document.exitFullscreen?.()
}
function cycleMode(dir: 1 | -1) {
  const n = MODES.length
  state.mode = (state.mode + dir + n) % n
}
function nudge(key: string, d: number, min = 0, max = 1) {
  const cur = (state as any)[key] as number
  animateParam(key, Math.max(min, Math.min(max, cur + d)))
}
function toggleRite(key: string) {
  ;(state as any)[key] = !(state as any)[key]
}

function onKey(e: KeyboardEvent) {
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
  const k = e.key.toLowerCase()
  if (k === ' ') { e.preventDefault(); cycleMode(1) }
  else if (k === 'a') state.journey = !state.journey
  else if (k === 'k') state.flicker = !state.flicker
  else if (k === 'm') toggleMic()
  else if (k === 'v') state.scope = !state.scope
  else if (k === 'c') state.cinematic = !state.cinematic
  else if (k === 'r') state.ray = !state.ray
  else if (k === 'f') onFs()
  else if (k === 's' && !e.metaKey && !e.ctrlKey) actions.snapshot()
  else if (k === 'arrowup') nudge('dose', 0.05)
  else if (k === 'arrowdown') nudge('dose', -0.05)
  else if (k === 'arrowleft') cycleMode(-1)
  else if (k === 'arrowright') cycleMode(1)
  else if (k === 'escape') {
    if (sheet.value !== 'none') close()
    else minimized.value = !minimized.value
  }
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <input ref="fileInput" type="file" accept="audio/*" class="hidden" @change="handleFile" />

  <!-- TOP chrome -->
  <div class="fixed top-0 inset-x-0 z-[55] pointer-events-none p-2 sm:p-3 flex items-start justify-between gap-2">
    <router-link
      to="/"
      class="pointer-events-auto px-2.5 py-1.5 rounded-full text-[9px] sm:text-[10px] tracking-[0.18em] uppercase text-white/35 hover:text-white/70 bg-black/40 border border-white/[0.07] backdrop-blur-md transition-colors"
    >← exit</router-link>

    <div class="pointer-events-auto flex items-center gap-1.5">
      <div
        v-if="audioEngine.analysis.on"
        class="hidden sm:flex items-center gap-2 px-2.5 py-1.5 rounded-full bg-black/45 border border-white/[0.07] backdrop-blur-md text-[9px] font-mono text-white/40"
      >
        <span>{{ audioEngine.analysis.bpm || '—' }}<span class="text-white/25"> bpm</span></span>
        <span class="w-px h-2.5 bg-white/10" />
        <span>b {{ audioEngine.analysis.bass.toFixed(2) }}</span>
        <span>m {{ audioEngine.analysis.mid.toFixed(2) }}</span>
        <span>t {{ audioEngine.analysis.treble.toFixed(2) }}</span>
      </div>
      <button
        v-if="minimized"
        @click="minimized = false"
        class="px-3 py-1.5 rounded-full text-[9px] sm:text-[10px] tracking-[0.18em] uppercase bg-black/55 backdrop-blur-xl border border-white/10 text-white/55 hover:text-white/90 transition-all"
      >menu</button>
    </div>
  </div>

  <div
    v-if="sheet !== 'none' && !minimized"
    class="fixed inset-0 z-[60] bg-black/45 backdrop-blur-[2px]"
    @click="close"
  />

  <!-- DOCK -->
  <div
    v-if="!minimized"
    class="fixed inset-x-0 bottom-0 z-50 flex justify-center pointer-events-none"
    :style="{
      paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))',
      paddingLeft: 'max(0.5rem, env(safe-area-inset-left))',
      paddingRight: 'max(0.5rem, env(safe-area-inset-right))',
    }"
  >
    <div
      class="pointer-events-auto w-full max-w-3xl mx-auto"
      :style="{
        boxShadow: state.beatIntensity > 0.12
          ? `0 -6px 28px rgba(217,70,239,${state.beatIntensity * 0.22})`
          : '0 -8px 32px rgba(0,0,0,0.45)',
      }"
    >
      <Transition name="sheet">
        <!-- MODE browser -->
        <div
          v-if="sheet === 'mode'"
          key="mode"
          class="mb-2 max-h-[55vh] overflow-y-auto rounded-2xl sm:rounded-3xl bg-black/82 backdrop-blur-2xl border border-white/10 p-3 sm:p-4"
          @click.stop
        >
          <div class="flex items-center justify-between mb-2 px-0.5">
            <span class="text-[9px] tracking-[0.22em] uppercase text-white/40">Modes · {{ MODES.length }}</span>
            <button @click="close" class="text-white/40 hover:text-white/80 text-xs w-7 h-7">✕</button>
          </div>
          <div class="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
            <button
              v-for="(m, i) in MODES" :key="m.id"
              @click="setMode(i)"
              :class="[
                'text-left p-2.5 rounded-xl border transition-all active:scale-[0.98]',
                i === state.mode
                  ? 'bg-gradient-to-br from-fuchsia-500/30 to-violet-500/15 border-fuchsia-400/45'
                  : 'bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.07]',
              ]"
            >
              <div class="flex items-baseline gap-1.5">
                <span class="text-[8px] font-mono text-white/30">{{ String(i).padStart(2,'0') }}</span>
                <span :class="['text-[11px] font-semibold tracking-wide leading-tight', i===state.mode ? 'text-fuchsia-100' : 'text-white/85']">{{ m.name }}</span>
              </div>
              <div class="text-[8px] text-white/35 mt-0.5 leading-snug line-clamp-2">{{ m.sub }}</div>
            </button>
          </div>
        </div>

        <!-- PALETTE -->
        <div
          v-else-if="sheet === 'palette'"
          key="palette"
          class="mb-2 rounded-2xl sm:rounded-3xl bg-black/82 backdrop-blur-2xl border border-white/10 p-3 sm:p-4"
          @click.stop
        >
          <div class="flex items-center justify-between mb-2">
            <span class="text-[9px] tracking-[0.22em] uppercase text-white/40">Palette · OKLab</span>
            <button @click="close" class="text-white/40 hover:text-white/80 text-xs w-7 h-7">✕</button>
          </div>
          <div class="grid grid-cols-3 gap-1.5">
            <button
              v-for="(p, i) in PALETTES" :key="p"
              @click="setPalette(i)"
              :class="[
                'px-2 py-2.5 rounded-xl text-[10px] tracking-[0.08em] uppercase transition-all border',
                i === state.palette
                  ? 'bg-fuchsia-500/25 text-fuchsia-100 border-fuchsia-400/35'
                  : 'bg-white/[0.03] text-white/55 border-white/[0.06] hover:bg-white/[0.08]',
              ]"
            >{{ p }}</button>
          </div>
        </div>

        <!-- MORE -->
        <div
          v-else-if="sheet === 'more'"
          key="more"
          class="mb-2 max-h-[60vh] overflow-y-auto rounded-2xl sm:rounded-3xl bg-black/82 backdrop-blur-2xl border border-white/10"
          @click.stop
        >
          <div class="sticky top-0 z-10 flex gap-1 p-2 bg-black/70 backdrop-blur-md border-b border-white/[0.06]">
            <button
              v-for="t in (['mix','rites','presets','vessel'] as const)"
              :key="t"
              @click="moreTab = t"
              :class="[
                'flex-1 py-2 rounded-lg text-[9px] tracking-[0.14em] uppercase border transition-all',
                moreTab === t
                  ? 'bg-white/[0.12] border-white/20 text-white/90'
                  : 'bg-white/[0.03] border-white/[0.06] text-white/40',
              ]"
            >{{ t }}</button>
            <button @click="close" class="w-9 rounded-lg text-white/40 hover:text-white/80 border border-white/[0.06]">✕</button>
          </div>

          <div class="p-3 sm:p-4">
            <div v-if="moreTab === 'mix'" class="space-y-2.5">
              <SliderControl
                v-for="s in mixSliders" :key="s.key"
                :label="s.label"
                v-model="(state as any)[s.key]"
                :min="s.min" :max="s.max" :step="s.step"
                :accent="(s as any).accent"
              />
              <div class="pt-1">
                <div class="text-[9px] tracking-[0.18em] uppercase text-white/35 mb-1.5">Wallpaper lens</div>
                <div class="flex flex-wrap gap-1">
                  <button
                    v-for="w in walls" :key="w.id"
                    @click="state.wall = w.id"
                    :class="[
                      'px-2.5 py-1.5 rounded-lg text-[9px] tracking-wider uppercase border transition-all',
                      state.wall === w.id
                        ? 'bg-white/[0.14] border-white/25 text-white/90'
                        : 'bg-white/[0.03] border-white/[0.06] text-white/40',
                    ]"
                  >{{ w.label }}</button>
                </div>
              </div>
              <button
                v-if="audioEngine.analysis.on"
                @click="stopAudio"
                class="w-full mt-1 py-2.5 rounded-xl text-[10px] tracking-[0.18em] uppercase bg-red-500/20 border border-red-400/40 text-red-300"
              >Stop audio</button>
              <div class="text-[8px] text-white/25 font-mono leading-relaxed pt-1">
                space cycle · A auto · K flick · M mic · V scope · C cine · R ray · F full · S snap · ↑↓ dose · esc hide
              </div>
            </div>

            <div v-else-if="moreTab === 'rites'" class="grid grid-cols-2 gap-1.5">
              <button
                v-for="r in rites" :key="r.key"
                @click="toggleRite(r.key)"
                :class="[
                  'text-left p-3 rounded-xl border transition-all active:scale-[0.98]',
                  (state as any)[r.key]
                    ? 'bg-gradient-to-br from-fuchsia-500/25 to-violet-500/10 border-fuchsia-400/40'
                    : 'bg-white/[0.03] border-white/[0.06]',
                ]"
              >
                <div :class="['text-[12px] font-semibold tracking-wide', (state as any)[r.key] ? 'text-fuchsia-100' : 'text-white/80']">{{ r.label }}</div>
                <div class="text-[9px] text-white/35 mt-0.5">{{ r.tip }}</div>
              </button>
              <div class="col-span-2 mt-1 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                <div class="text-[9px] tracking-[0.16em] uppercase text-white/40 mb-1">Drop flash</div>
                <div class="text-[10px] text-white/55 leading-snug">
                  build <span class="text-white/80 font-mono">{{ (audioEngine.analysis.build ?? 0).toFixed(2) }}</span>
                  · drop <span class="text-white/80 font-mono">{{ (audioEngine.analysis.drop ?? 0).toFixed(2) }}</span>
                  · live composite lens
                </div>
              </div>
            </div>

            <div v-else-if="moreTab === 'presets'" class="grid grid-cols-1 gap-1">
              <button
                v-for="(p, i) in presets" :key="p.name"
                @click="applyP(i)"
                class="text-left px-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.07] active:scale-[0.99] transition-all"
              >
                <div class="text-[12px] font-medium text-white/85">{{ p.name }}</div>
                <div class="text-[9px] text-white/35 mt-0.5">
                  {{ MODES[p.params.mode as number]?.name }} · {{ PALETTES[p.params.palette as number] }}
                </div>
              </button>
            </div>

            <div v-else class="space-y-3">
              <div class="grid grid-cols-3 gap-1.5">
                <button @click="actions.snapshot()" class="py-2.5 rounded-xl text-[10px] tracking-[0.12em] uppercase bg-white/[0.05] border border-white/10 text-white/70 active:bg-white/[0.1]">Snap</button>
                <button @click="onRec" :class="['py-2.5 rounded-xl text-[10px] tracking-[0.12em] uppercase border active:scale-[0.98]', recording ? 'bg-red-500/30 border-red-400/50 text-red-200' : 'bg-white/[0.05] border-white/10 text-white/70']">{{ recording ? 'Stop' : 'Rec' }}</button>
                <button @click="onFs" class="py-2.5 rounded-xl text-[10px] tracking-[0.12em] uppercase bg-white/[0.05] border border-white/10 text-white/70">Full</button>
              </div>
              <div class="text-[9px] tracking-[0.18em] uppercase text-white/35">Substance signature</div>
              <div class="grid grid-cols-1 gap-1">
                <button
                  v-for="(s, i) in SUBSTANCES" :key="s.name"
                  @click="applyS(i)"
                  :class="[
                    'text-left px-3 py-2.5 rounded-xl border transition-all',
                    s.name === state.substance
                      ? 'bg-fuchsia-500/15 border-fuchsia-400/30'
                      : 'bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.07]',
                  ]"
                >
                  <div class="flex items-center gap-2">
                    <span class="text-base">{{ s.glyph }}</span>
                    <div>
                      <div class="text-[12px] font-medium text-white/85">{{ s.name }}</div>
                      <div class="text-[9px] text-white/35">{{ s.klass }} · {{ s.duration }}</div>
                    </div>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      </Transition>

      <!-- glass bar -->
      <div class="rounded-2xl sm:rounded-3xl bg-black/70 backdrop-blur-2xl border border-white/[0.09] overflow-hidden">
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-x-3 gap-y-1 px-3 pt-2.5 pb-1.5">
          <SliderControl
            v-for="s in coreSliders" :key="s.key"
            :label="s.label"
            v-model="(state as any)[s.key]"
            :min="s.min" :max="s.max" :step="s.step"
            :accent="(s as any).accent"
          />
        </div>

        <div class="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 pb-2.5 pt-1 border-t border-white/[0.05]">
          <button @click="toggleMic" :class="btnCls(isMic)" title="Mic (M)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>
          </button>
          <button @click="fileInput?.click()" :class="btnCls(isFile)" title="File">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>
          </button>
          <button @click="actions.initTab()" :class="btnCls(false)" title="Tab audio">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>
          </button>
          <button
            @click="togglePlay"
            :disabled="!isFile"
            :class="[btnCls(state.trackPlaying && isFile), !isFile && 'opacity-30 cursor-not-allowed']"
            title="Play/pause"
          >
            <svg v-if="state.trackPlaying && isFile" width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>
            <svg v-else width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5v15a1 1 0 0 0 1.55.83l12-7.5a1 1 0 0 0 0-1.66l-12-7.5A1 1 0 0 0 7 4.5Z"/></svg>
          </button>

          <div class="w-px h-5 bg-white/10 mx-0.5 shrink-0" />

          <button @click="open('mode')" :class="chipCls(sheet==='mode')" class="min-w-0">
            <span class="truncate max-w-[4.5rem] sm:max-w-[7rem]">{{ modeShort }}</span>
          </button>
          <button @click="open('palette')" :class="chipCls(sheet==='palette')">
            <span class="truncate max-w-[3.5rem] sm:max-w-[6rem]">{{ PALETTES[state.palette] }}</span>
          </button>

          <div class="hidden md:flex items-center gap-1 ml-0.5">
            <button
              v-for="r in rites.slice(0,4)" :key="r.key"
              @click="toggleRite(r.key)"
              :class="chipSmCls((state as any)[r.key])"
              :title="r.tip"
            >{{ r.label }}</button>
          </div>

          <div class="flex-1 min-w-0" />

          <button @click="actions.snapshot()" :class="btnCls(false)" title="Snapshot (S)" class="hidden sm:flex">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3Z"/><circle cx="12" cy="13" r="3"/></svg>
          </button>
          <button @click="onRec" :class="btnCls(recording)" title="Record" class="hidden sm:flex">
            <span class="block w-2 h-2 rounded-full bg-current" />
          </button>

          <button @click="open('more')" :class="btnCls(sheet==='more')" title="More">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>
          </button>
          <button @click="minimized = true" :class="btnCls(false)" title="Hide (Esc)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.sheet-enter-active, .sheet-leave-active {
  transition: transform 0.28s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.22s ease;
}
.sheet-enter-from, .sheet-leave-to {
  transform: translateY(18px);
  opacity: 0;
}
</style>
