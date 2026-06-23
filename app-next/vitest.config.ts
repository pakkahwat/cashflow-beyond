import { defineConfig } from 'vitest/config';

// The engine uses explicit ".js" import specifiers (NodeNext/bundler style) on
// files that are actually ".ts". Strip the ".js" from relative specifiers so
// Vite resolves them to the ".ts" source during tests.
export default defineConfig({
  resolve: {
    alias: [{ find: /^(\.{1,2}\/.*)\.js$/, replacement: '$1' }]
  },
  test: {
    include: ['engine/**/*.test.ts', 'data/**/*.test.ts', 'lib/**/*.test.ts'],
    environment: 'node'
  }
});
