<script setup lang="ts">
/**
 * RenderLoop — lives INSIDE <TresCanvas> so useLoop() has access to TresContext.
 * Receives the render callback via provide/inject.
 */
import { inject } from 'vue'
import { useLoop } from '@tresjs/core'

const onFrame = inject<(ctx: { delta: number }) => void>('renderLoop')
const { onBeforeRender } = useLoop()

onBeforeRender((ctx) => {
  onFrame?.(ctx)
})
</script>

<template>
  <primitive />
</template>
