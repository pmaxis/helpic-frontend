import js from '@eslint/js'
import pluginVue from 'eslint-plugin-vue'
import { defineConfigWithVueTs, vueTsConfigs } from '@vue/eslint-config-typescript'
import globals from 'globals'

export default defineConfigWithVueTs(
  { ignores: ['dist/**', 'coverage/**', 'public/**'] },

  js.configs.recommended,
  pluginVue.configs['flat/recommended'],
  vueTsConfigs.recommended,

  {
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      // How templates are laid out is the code's own style, not a lint:
      // these would rewrap nearly every template.
      'vue/max-attributes-per-line': 'off',
      'vue/singleline-html-element-content-newline': 'off',
      'vue/multiline-html-element-content-newline': 'off',
      'vue/html-indent': 'off',
      'vue/html-closing-bracket-newline': 'off',
      'vue/html-self-closing': 'off',
      // The UI kit's one-word names.
      'vue/multi-word-component-names': ['error', { ignores: ['Modal', 'Pagination', 'Sparkline'] }],
      // Optional props without a default are undefined on purpose.
      'vue/require-default-prop': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
    },
  },

  {
    files: ['vite.config.ts', 'vitest.config.ts', 'eslint.config.ts'],
    languageOptions: {
      globals: globals.node,
    },
  },
)
