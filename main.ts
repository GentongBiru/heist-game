// The Gilded Gallery — the hand-in program (Node 22, standard library only).
// It gathers the entry's pieces into the output directory the grader reads:
// the static game files, the screenshots, and dossier.json, the summary the
// judge reads, written by the vendored make.fun library from those same files.
//
// Run it outside the grader with MAKEFUN_OUTPUT_DIR standing in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Run it twice and the dossier bytes must come out identical both times.

import { cpSync, existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(outputDir, { recursive: true });
cpSync(join(repoRoot, 'game'), join(outputDir, 'game'), { recursive: true });
mkdirSync(join(outputDir, 'screenshots'), { recursive: true });
if (existsSync(join(repoRoot, 'screenshots'))) {
  cpSync(join(repoRoot, 'screenshots'), join(outputDir, 'screenshots'), { recursive: true });
}

// The caps are the gate's own: only text_max_bytes shapes the dossier's
// bytes; the rest refuse an entry the scorer would refuse anyway (too many
// screenshots, one too big, too many game files, game files too large, or a
// game path too long for the output's own entry cap).
writeFileSync(
  join(outputDir, 'dossier.json'),
  buildDossier(outputDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
console.log(`handed in the game to ${outputDir}`);
console.log(`dossier.json: ${statSync(join(outputDir, 'dossier.json')).size} bytes`);
