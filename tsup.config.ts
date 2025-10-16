import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  minify: false,
  splitting: false,
  external: ['next', 'zod'],
  treeshake: true,
  target: 'es2022',
  outDir: 'dist',
  banner: {
    js: '/* next-router - Spring Framework-style route wrapper for Next.js 15 */',
  },
});