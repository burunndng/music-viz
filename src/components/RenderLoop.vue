<script setup lang="ts">
/**
 * RenderLoop — must be a child of <TresCanvas>.
 * TresCanvas provides its context in onMounted, so we defer useLoop
 * with nextTick to ensure the context exists.
 */
import { nextTick, onMounted } from 'vue'
import { useLoop } from '@tresjs/core'

const props = defineProps<{
  onFrame: (ctx: { delta: number }) => void
}>()

onMounted(async () => {
  // Wait for TresCanvas to finish its own onMounted (which provides the context)
  await nextTick()
  await nextTick()
  const { onBeforeRender } = useLoop()
  onBeforeRender((ctx) => {
    props.onFrame(ctx)
  })
})
</script>

<template>
  <!-- TresGroup is a no-op Three.js group — keeps this component in the Tres tree -->
  <TresGroup />
</template>
