<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()
</script>

<template>
  <div
    class="min-h-screen bg-[#1a0f05] flex flex-col items-center justify-center cursor-pointer"
    @click="router.push('/visualizer')"
  >
    <div class="scarab-wrap">
      <svg
        viewBox="0 0 512 512"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        class="scarab"
      >
        <!-- Diamond frame -->
        <path
          d="M256 40 L472 256 L256 472 L40 256 Z"
          stroke="#bfa36f"
          stroke-width="2"
          stroke-opacity="0.55"
          fill="none"
        />

        <!-- Outer stars -->
        <path
          d="M256 92 l4 10 l10 4 l-10 4 l-4 10 l-4 -10 l-10 -4 l10 -4 z"
          fill="#c4a86b"
          fill-opacity="0.8"
        />
        <path
          d="M256 388 l4 10 l10 4 l-10 4 l-4 10 l-4 -10 l-10 -4 l10 -4 z"
          fill="#c4a86b"
          fill-opacity="0.8"
        />

        <!-- Left wing -->
        <path
          d="M248 256
             C220 180, 140 140, 100 180
             C80 200, 90 260, 120 300
             C100 320, 110 360, 150 370
             C190 380, 230 320, 248 280"
          stroke="#c4a86b"
          stroke-width="2.5"
          stroke-opacity="0.75"
          fill="none"
        />
        <path
          d="M248 256
             C210 190, 150 170, 130 210
             C120 230, 140 270, 160 290
             C150 310, 160 340, 190 345
             C220 350, 240 300, 248 270"
          stroke="#bfa36f"
          stroke-width="2"
          stroke-opacity="0.5"
          fill="none"
        />
        <path
          d="M248 256
             C225 210, 185 200, 175 225
             C170 240, 185 265, 200 275
             C195 290, 205 310, 225 310
             C240 310, 248 280, 248 260"
          stroke="#bfa36f"
          stroke-width="1.5"
          stroke-opacity="0.4"
          fill="none"
        />

        <!-- Right wing (mirrored) -->
        <path
          d="M264 256
             C292 180, 372 140, 412 180
             C432 200, 422 260, 392 300
             C412 320, 402 360, 362 370
             C322 380, 282 320, 264 280"
          stroke="#c4a86b"
          stroke-width="2.5"
          stroke-opacity="0.75"
          fill="none"
        />
        <path
          d="M264 256
             C302 190, 362 170, 382 210
             C392 230, 372 270, 352 290
             C362 310, 352 340, 322 345
             C292 350, 272 300, 264 270"
          stroke="#bfa36f"
          stroke-width="2"
          stroke-opacity="0.5"
          fill="none"
        />
        <path
          d="M264 256
             C287 210, 327 200, 337 225
             C342 240, 327 265, 312 275
             C317 290, 307 310, 287 310
             C272 310, 264 280, 264 260"
          stroke="#bfa36f"
          stroke-width="1.5"
          stroke-opacity="0.4"
          fill="none"
        />

        <!-- Sun disk above beetle -->
        <ellipse
          cx="256"
          cy="175"
          rx="28"
          ry="36"
          fill="#c4a86b"
          fill-opacity="0.85"
        />

        <!-- Beetle body -->
        <ellipse
          cx="256"
          cy="270"
          rx="42"
          ry="52"
          stroke="#c4a86b"
          stroke-width="2.5"
          stroke-opacity="0.9"
          fill="none"
        />

        <!-- Beetle shell segments -->
        <line x1="230" y1="245" x2="282" y2="245" stroke="#c4a86b" stroke-width="1.5" stroke-opacity="0.6" />
        <line x1="222" y1="265" x2="290" y2="265" stroke="#c4a86b" stroke-width="1.5" stroke-opacity="0.6" />
        <line x1="222" y1="285" x2="290" y2="285" stroke="#c4a86b" stroke-width="1.5" stroke-opacity="0.6" />
        <line x1="230" y1="305" x2="282" y2="305" stroke="#c4a86b" stroke-width="1.5" stroke-opacity="0.6" />
        <line x1="256" y1="218" x2="256" y2="322" stroke="#c4a86b" stroke-width="1.5" stroke-opacity="0.6" />

        <!-- Beetle head -->
        <path
          d="M232 220
             C232 200, 280 200, 280 220
             C280 235, 232 235, 232 220"
          stroke="#c4a86b"
          stroke-width="2"
          stroke-opacity="0.85"
          fill="none"
        />

        <!-- Antennae / horns -->
        <path
          d="M238 208 C230 180, 215 165, 205 155"
          stroke="#c4a86b"
          stroke-width="2"
          stroke-opacity="0.8"
          fill="none"
        />
        <path
          d="M274 208 C282 180, 297 165, 307 155"
          stroke="#c4a86b"
          stroke-width="2"
          stroke-opacity="0.8"
          fill="none"
        />

        <!-- Legs left -->
        <path
          d="M220 245 C190 235, 170 250, 160 270"
          stroke="#c4a86b"
          stroke-width="2"
          stroke-opacity="0.7"
          fill="none"
        />
        <path
          d="M215 275 C185 275, 165 295, 158 315"
          stroke="#c4a86b"
          stroke-width="2"
          stroke-opacity="0.7"
          fill="none"
        />
        <path
          d="M220 305 C195 315, 180 335, 175 350"
          stroke="#c4a86b"
          stroke-width="2"
          stroke-opacity="0.7"
          fill="none"
        />

        <!-- Legs right -->
        <path
          d="M292 245 C322 235, 342 250, 352 270"
          stroke="#c4a86b"
          stroke-width="2"
          stroke-opacity="0.7"
          fill="none"
        />
        <path
          d="M297 275 C327 275, 347 295, 354 315"
          stroke="#c4a86b"
          stroke-width="2"
          stroke-opacity="0.7"
          fill="none"
        />
        <path
          d="M292 305 C317 315, 332 335, 337 350"
          stroke="#c4a86b"
          stroke-width="2"
          stroke-opacity="0.7"
          fill="none"
        />
      </svg>
    </div>
  </div>
</template>

<style scoped>
.scarab-wrap {
  width: min(70vw, 420px);
  height: min(70vw, 420px);
  filter: drop-shadow(0 0 18px rgba(196, 168, 107, 0.35))
          drop-shadow(0 0 42px rgba(196, 168, 107, 0.15));
  transition: filter 0.7s ease, transform 0.7s ease;
}

.scarab-wrap:hover {
  filter: drop-shadow(0 0 28px rgba(196, 168, 107, 0.55))
          drop-shadow(0 0 64px rgba(196, 168, 107, 0.25));
  transform: scale(1.03);
}

.scarab {
  width: 100%;
  height: 100%;
}
</style>
