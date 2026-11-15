// Todos los mocks en un solo módulo que se carga bajo demanda (solo si VITE_API_URL está vacío):
// con la API real, estos ~480 kB de JSON no se descargan ni se analizan.
import demoBajio from './calendar.demo.qro-bajio.json';
import demoRecuadro from './calendar.demo.qro-recuadro.json';
import demoSierra from './calendar.demo.qro-sierra-gorda.json';
import viirsBajio from './calendar.viirs.qro-bajio.json';
import viirsRecuadro from './calendar.viirs.qro-recuadro.json';
import viirsSierra from './calendar.viirs.qro-sierra-gorda.json';
import presetsMock from './presets.response.json';

export { buildDemo } from './demoCalendar';

export const PRESETS: unknown = presetsMock;

export const DEMO: Record<string, unknown> = {
  'qro-sierra-gorda': demoSierra,
  'qro-bajio': demoBajio,
  'qro-recuadro': demoRecuadro,
};

// Mismos presets con `basis = viirs_primary` ("Simular fin de MODIS"), también copiados de la API real.
export const DEMO_VIIRS: Record<string, unknown> = {
  'qro-sierra-gorda': viirsSierra,
  'qro-bajio': viirsBajio,
  'qro-recuadro': viirsRecuadro,
};
