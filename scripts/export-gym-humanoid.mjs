import { build } from 'vite'
import { copyFile } from 'node:fs/promises'
const gym = process.argv[2]
if (!gym) throw new Error('Usage: node scripts/export-gym-humanoid.mjs /path/to/Room/gym')
await build({ configFile: false, build: {
  outDir: `${gym}/assets/humanoid-runtime`, emptyOutDir: true,
  lib: { entry: 'src/viewer/gym-humanoid-entry.ts', formats: ['es'], fileName: () => 'humanoid.js' },
  rollupOptions: { external: id => id === 'three' || id.startsWith('three/'), output: { paths: id => id.replace('three/examples/jsm/', 'three/addons/') } },
}})
await copyFile('public/models/human.glb', `${gym}/assets/human.glb`)
