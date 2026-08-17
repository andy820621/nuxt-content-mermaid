import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    maxWorkers: 2,
    exclude: [
      '**/node_modules/**',
      '**/.git/**',
      '**/.agents/**',
      '**/.worktrees/**',
      'website/**',
    ],
  },
})
