import eslint from '@eslint/js'
import eslintConfigPrettier from 'eslint-config-prettier'
import eslintPluginJest from 'eslint-plugin-jest'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  {
    ignores: ['lib/', 'dist/', 'node_modules/', 'coverage/']
  },
  {
    languageOptions: {
      globals: globals.node,
      parserOptions: {
        project: '.github/linters/tsconfig.json'
      }
    }
  },
  {
    files: ['**/*.{js,cjs,mjs}'],
    ...tseslint.configs.disableTypeChecked
  },
  {
    files: ['__tests__/**'],
    ...eslintPluginJest['flat/recommended']
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  eslintConfigPrettier
)
