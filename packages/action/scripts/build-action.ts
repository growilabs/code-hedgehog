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
});

if (result.errors.length > 0) {
  console.error('Build failed:', result.errors);
  Deno.exit(1);
}

console.log('Build completed successfully');
esbuild.stop();
