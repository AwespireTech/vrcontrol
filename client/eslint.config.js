import js from '@eslint/js'
import tsParser from '@typescript-eslint/parser'
import tsPlugin from '@typescript-eslint/eslint-plugin'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'

export default [
  {
    ignores: ['dist/**', 'node_modules/**', '**/*.{js,mjs,cjs}'],
  },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      // Base JS rules can be overly strict/incorrect for TS code.
      'no-undef': 'off',

      ...tsPlugin.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,

      // Common Vite + React pattern
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
]
