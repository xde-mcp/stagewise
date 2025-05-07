# Vue + TypeScript + Vite

This template provides a minimal setup to get Vue working in Vite with HMR and some ESLint rules.

Currently, one official plugin is available:

- [@vitejs/plugin-vue](https://github.com/vitejs/vite/tree/main/packages/plugin-vue) uses Vue Single File Components and offers great performance.

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules and Vue-specific linting with [eslint-plugin-vue](https://eslint.vuejs.org/):

```js
export default tseslint.config({
  extends: [
    // Remove ...tseslint.configs.recommended and replace with this
    ...tseslint.configs.recommendedTypeChecked,
    // Alternatively, use this for stricter rules
    ...tseslint.configs.strictTypeChecked,
    // Optionally, add this for stylistic rules
    ...tseslint.configs.stylisticTypeChecked,
  ],
  languageOptions: {
    // other options...
    parserOptions: {
      project: ['./tsconfig.node.json', './tsconfig.app.json'],
      tsconfigRootDir: import.meta.dirname,
      parser: '@typescript-eslint/parser', // If using <script lang="ts">
    },
  },
})
```

You can also install [eslint-plugin-vue](https://eslint.vuejs.org/) for Vue-specific lint rules:

```js
// eslint.config.js
import vuePlugin from 'eslint-plugin-vue'

export default tseslint.config({
  plugins: {
    vue: vuePlugin,
  },
  rules: {
    // ...other rules
    // Enable Vue recommended rules
    ...vuePlugin.configs.recommended.rules,
  },
  languageOptions: {
    // ...other options
    parserOptions: {
      // ...other options
      parser: '@typescript-eslint/parser', // If using <script lang="ts">
    },
  },
})
```
