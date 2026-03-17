import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@non-turn/shared': path.resolve(__dirname, '../shared/types.ts'),
    },
  },
  test: {
    globals: true,
  },
});
