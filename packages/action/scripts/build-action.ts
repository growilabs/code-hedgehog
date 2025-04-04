import * as esbuild from 'npm:esbuild@^0.25.1';
import { denoPlugins } from 'jsr:@luca/esbuild-deno-loader@^0.11.1';

const result = await esbuild.build({
  entryPoints: ['./src/index.ts'],
  bundle: true,
  outfile: './dist/index.js',
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  plugins: [...denoPlugins()],
  sourcemap: true,
  // The File class, which is a Web API used by Deno, is not included by default in the Node.js environment, so add it to globalThis.
  define: {
    File: 'globalThis.File',
  },
  banner: {
    js: `
      const { File } = require('node:buffer');
      globalThis.File = File;
    `,
  },
});

if (result.errors.length > 0) {
  console.error('Build failed:', result.errors);
  Deno.exit(1);
}

console.log('Build completed successfully');
esbuild.stop();
