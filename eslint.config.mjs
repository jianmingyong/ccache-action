import eslint from '@eslint/js'
import prettier from 'eslint-config-prettier'
import jest from 'eslint-plugin-jest'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default [
  {
    ignores: ['lib/', 'dist/', 'node_modules/', 'coverage/']
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      globals: {
        ...globals.node
      },
      parserOptions: {
        project: 'tsconfig.eslint.json'
      }
    }
  },
  {
    files: ['**/*.js', '**/*.mjs', '**/*.cjs'],
    ...tseslint.configs.disableTypeChecked
  },
  {
    files: ['__tests__/**'],
    ...jest.configs['flat/recommended']
  },
  prettier
]
