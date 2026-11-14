import type { Status } from '../types';

// Sonificación: un tono por nivel (la API ya trae el nivel en `status`; aquí no se calcula nada).
// Más agudo = más actividad. Extremo suena dos veces; "sin dato" es un golpe grave y corto.
const TONES: Partial<Record<Status, { hz: number; beeps: number; dur: number }>> = {
  below: { hz: 262, beeps: 1, dur: 0.16 },
  normal: { hz: 392, beeps: 1, dur: 0.16 },
  above: { hz: 587, beeps: 1, dur: 0.16 },
  critical: { hz: 880, beeps: 2, dur: 0.12 },
  insufficient_baseline: { hz: 330, beeps: 1, dur: 0.08 },
  no_data: { hz: 110, beeps: 1, dur: 0.1 },
};

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null; // navegador sin Web Audio
  }
}

/** Toca el tono del nivel. `null` = mes que no viene en la respuesta (silencio). */
export function playStatus(status: Status | null) {
  const tone = status ? TONES[status] : undefined;
  const ac = tone && audio();
  if (!tone || !ac) return;
  const start = ac.currentTime;
  for (let i = 0; i < tone.beeps; i++) {
    const t0 = start + i * (tone.dur + 0.05);
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = status === 'no_data' ? 'square' : 'triangle';
    osc.frequency.value = tone.hz;
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(0.18, t0 + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + tone.dur);
    osc.connect(gain).connect(ac.destination);
    osc.start(t0);
    osc.stop(t0 + tone.dur + 0.02);
  }
}
