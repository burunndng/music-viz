<script setup lang="ts">
defineProps<{
  label: string
  modelValue: number
  min?: number
  max?: number
  step?: number
  accent?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: number]
}>()

function onInput(e: Event) {
  emit('update:modelValue', parseFloat((e.target as HTMLInputElement).value))
}
</script>

<template>
  <div class="flex flex-col gap-1 min-w-0 flex-1">
    <div class="flex justify-between items-baseline px-0.5">
      <span class="text-[10px] tracking-[0.12em] uppercase text-white/50 font-medium">
        {{ label }}
      </span>
      <span class="text-[10px] text-white/30 tabular-nums font-mono ml-1">
        {{ (step ?? 0.01) >= 1 ? Math.round(modelValue) : modelValue.toFixed(2) }}
      </span>
    </div>
    <div class="relative h-5 flex items-center group">
      <div class="absolute inset-x-0 h-[2px] rounded-full bg-white/[0.06]" />
      <div
        class="absolute left-0 h-[2px] rounded-full transition-all duration-75"
        :style="{
          width: `${((modelValue - (min ?? 0)) / ((max ?? 1) - (min ?? 0))) * 100}%`,
          background: accent
            ? 'linear-gradient(90deg, rgba(168,85,247,0.7), rgba(236,72,153,0.9))'
            : 'linear-gradient(90deg, rgba(255,255,255,0.15), rgba(255,255,255,0.35))',
        }"
      />
      <input
        type="range"
        :min="min ?? 0"
        :max="max ?? 1"
        :step="step ?? 0.01"
        :value="modelValue"
        @input="onInput"
        class="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
      />
      <div
        class="absolute w-3 h-3 rounded-full border border-white/20 shadow-lg transition-all duration-75 pointer-events-none group-hover:scale-125 group-hover:border-white/40"
        :style="{
          left: `calc(${((modelValue - (min ?? 0)) / ((max ?? 1) - (min ?? 0))) * 100}% - 6px)`,
          background: accent
            ? 'radial-gradient(circle, rgba(236,72,153,0.9), rgba(168,85,247,0.7))'
            : 'radial-gradient(circle, rgba(255,255,255,0.6), rgba(255,255,255,0.2))',
          boxShadow: accent
            ? '0 0 10px rgba(168,85,247,0.5)'
            : '0 0 6px rgba(255,255,255,0.15)',
        }"
      />
    </div>
  </div>
</template>
