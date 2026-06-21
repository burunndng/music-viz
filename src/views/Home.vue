<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()
</script>

<template>
  <div class="min-h-screen bg-black text-white/70 flex flex-col">
    <!-- Nav -->
    <nav class="fixed top-0 inset-x-0 z-50 flex items-center justify-between px-6 py-4">
      <router-link to="/" class="text-[11px] tracking-[0.25em] uppercase text-white/30 hover:text-white/60 transition-colors duration-500">
        music-viz
      </router-link>
      <div class="flex items-center gap-8">
        <router-link
          to="/visualizer"
          class="text-[11px] tracking-[0.2em] uppercase text-white/30 hover:text-white/60 transition-colors duration-500"
        >
          Enter
        </router-link>
      </div>
    </nav>

    <!-- Hero -->
    <main class="flex-1 flex flex-col items-center justify-center px-6">
      <div class="max-w-lg text-center">
        <h1 class="text-[11px] tracking-[0.35em] uppercase text-white/20 mb-8">
          Reactive 3D Audio Visualizer
        </h1>

        <div class="w-8 h-px bg-white/10 mx-auto mb-10" />

        <p class="text-sm text-white/25 leading-relaxed mb-12 max-w-sm mx-auto">
          29 shader modes. Real-time audio analysis.
          <br />Vue + TresJS + Tone.js.
        </p>

        <button
          @click="router.push('/visualizer')"
          class="group relative px-8 py-3 border border-white/[0.08] rounded-full text-[11px] tracking-[0.2em] uppercase text-white/40 hover:text-white/70 hover:border-white/20 transition-all duration-700"
        >
          <span class="relative z-10">Launch</span>
          <div class="absolute inset-0 rounded-full bg-white/[0.02] group-hover:bg-white/[0.04] transition-colors duration-700" />
        </button>
      </div>
    </main>

    <!-- Footer -->
    <footer class="px-6 py-6 flex items-center justify-between">
      <span class="text-[10px] text-white/15 tracking-wider">
        Vue · TresJS · Tone.js · Three.js
      </span>
      <span class="text-[10px] text-white/15 tracking-wider">
        29 modes
      </span>
    </footer>
  </div>
</template>
