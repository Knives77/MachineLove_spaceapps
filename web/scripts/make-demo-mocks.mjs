// Genera mocks DEMO completos (2000–2026, 324 meses) con la forma exacta de
// docs/contracts/api.md, para maquetar sin backend. Los valores son INVENTADOS:
// solo sirven para ver la interfaz llena. La app real nunca usa este script.
//
//   node scripts/make-demo-mocks.mjs
//
// Reglas copiadas de docs/contracts/harmonization.md (banderas, línea base, status).
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { buildDemo } from '../src/mocks/demoCalendar.ts';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'mocks');

const PRESETS = [
  {
    id: 'qro-sierra-gorda', country: 'MX', area: 14790.2, k: 0.262, seed: 11, amp: 26,
    season: [0.03, 0.06, 0.16, 0.27, 0.25, 0.08, 0.03, 0.02, 0.01, 0.01, 0.03, 0.05],
    loyo: [0.147, 0.426, 0.388],
  },
  {
    id: 'qro-bajio', country: 'MX', area: 14140.6, k: 0.293, seed: 23, amp: 40,
    season: [0.06, 0.12, 0.2, 0.22, 0.17, 0.05, 0.02, 0.02, 0.02, 0.03, 0.04, 0.05],
    loyo: [0.068, 0.191, 0.297],
  },
  {
    id: 'qro-recuadro', country: 'MX', area: 31550.0, k: 0.293, seed: 37, amp: 66,
    season: [0.05, 0.1, 0.18, 0.24, 0.2, 0.06, 0.02, 0.02, 0.02, 0.03, 0.04, 0.04],
    loyo: [0.068, 0.161, 0.274],
  },
];

for (const p of PRESETS) {
  const file = join(OUT, `calendar.demo.${p.id}.json`);
  writeFileSync(file, JSON.stringify(buildDemo(p)) + '\n');
  console.log('escrito', file);
}
