import { resolve } from 'path';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

export default defineConfig({
    plugins: [
        dts({
            tsconfigPath: resolve(__dirname, './tsconfig-build.json'),
        }),
    ],
    root: 'src',
    build: {
        lib: {
            entry: resolve(__dirname, 'src/index.ts'),
            formats: ['es'],
            name: 'rendure',
            fileName: 'rendure',
        },
        outDir: resolve(__dirname, 'dist'),
        emptyOutDir: true,
        sourcemap: true,
    },
    server: {
        port: 3000,
        open: true,
    },
    resolve: {
        alias: {
            '@': resolve(__dirname, 'src'),
        },
    },
});
