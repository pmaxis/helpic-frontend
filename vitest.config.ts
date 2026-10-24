import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config'

// The app's own Vite config (Vue, the @ alias), with the tests kept apart in tests/.
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      include: ['tests/**/*.test.ts'],
      setupFiles: ['tests/setup.ts'],
      restoreMocks: true,
      coverage: {
        // istanbul, not v8: v8 counts a .vue file covered as soon as it's imported.
        provider: 'istanbul',
        include: ['src/**'],
        // Types and the messages' wording are no code to run.
        exclude: ['src/types/**', 'src/i18n/messages/**', 'src/admin/messages.ts', 'src/env.d.ts'],
        reporter: ['text-summary', 'html'],
        // A little under where it stands, so it can't quietly slide.
        thresholds: { lines: 94, statements: 92, functions: 87, branches: 84 },
      },
    },
  }),
)
