import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Gera um único HTML (usado para a prévia online).
export default defineConfig({ plugins: [react(), viteSingleFile()], build: { outDir: 'dist-single' } });
