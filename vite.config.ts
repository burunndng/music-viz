import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { templateCompilerOptions } from '@tresjs/core'

export default defineConfig({
  plugins: [
    vue({
      template: {
        compilerOptions: templateCompilerOptions.template.compilerOptions,
      },
    }),
    tailwindcss(),
  ],
})
