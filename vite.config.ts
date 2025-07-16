import { resolve } from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
    root: 'src',
    build: {
        lib: {
            entry: resolve(__dirname, 'src/index.ts'),
            formats: ['es'],
        },
        outDir: '../dist',
        emptyOutDir: true,
        sourcemap: true,
    },
    server: {
        port: 3000,
        open: true,
    },
    resolve: {
        alias: {
            '@': '/src',
        },
    },
});
