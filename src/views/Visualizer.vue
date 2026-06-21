<script setup lang="ts">
import VizCanvas from '../components/VizCanvas.vue'
import VizControls from '../components/VizControls.vue'
</script>

<template>
  <div class="fixed inset-0 bg-black">
    <VizCanvas />
    <VizControls />

    <!-- Minimal back link -->
    <router-link
      to="/"
      class="fixed top-4 left-5 z-[70] text-[10px] tracking-[0.2em] uppercase text-white/20 hover:text-white/50 transition-colors duration-500"
    >
      ← exit
    </router-link>
  </div>
</template>
