import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import eslintConfigPrettier from 'eslint-config-prettier';
import globals from 'globals';
import importPlugin from 'eslint-plugin-import';

export default tseslint.config(
  {
    ignores: ['build/', 'node_modules/', 'dist/', 'server/libs/db.old-sequelize-dont-use'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
  {
    files: ['__tests__/**', '__testHelpers__/**'],
    languageOptions: {
      globals: {
        ...globals.node,
        describe: 'readonly',
        test: 'readonly',
        it: 'readonly',
        expect: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        jest: 'readonly',
        vi: 'readonly',
      },
    },
  },
  {
    files: ['src/libs/db2/migrations/**', 'src/libs/db2/seeds/**'],
    languageOptions: {
      globals: {
        ...globals.node,
        exports: 'readonly',
        module: 'readonly',
        require: 'readonly',
      },
    },
  },
  eslintConfigPrettier,
  {
    plugins: {
      import: importPlugin,
    },
    rules: {
      '@typescript-eslint/ban-ts-comment': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-var-requires': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-undef': 'off',
      'no-import-assign': 'off',
      'no-constant-binary-expression': 'off',
      'import/prefer-default-export': 'off',
      'import/default': 'off',
      'import/namespace': 'off',
      'import/no-unresolved': 'off',
    },
  },
  {
    files: ['src/libs/db2/**'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  {
    files: ['scripts/**'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      'no-useless-catch': 'off',
    },
  },
);
