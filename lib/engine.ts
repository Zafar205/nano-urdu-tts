import { BOUNDARY, PhoneMapper, normalize, withBoundaries, type Vocabulary } from "./urdu";

export const SAMPLE_RATE = 24_000;
const SENTENCE_GAP_SECONDS = 0.12;

export type Speech = {
  pcm: Float32Array;
  seconds: number;
  milliseconds: number;
  spoken: string;
};

type Reply = { id: number; error?: string; ipa?: string; pcm?: Float32Array; maxTokens?: number };

/** Text-to-speech running entirely in the browser (see public/tts-worker.js). */
export class Engine {
  private worker = new Worker("/tts-worker.js");
  private pending = new Map<number, { resolve: (reply: Reply) => void; reject: (error: Error) => void }>();
  private counter = 0;
  private mapper!: PhoneMapper;
  private maxTokens = 190;

  private constructor() {
    this.worker.onmessage = ({ data }: MessageEvent<Reply>) => {
      const waiting = this.pending.get(data.id);
      if (!waiting) return;
      this.pending.delete(data.id);
      if (data.error) waiting.reject(new Error(data.error));
      else waiting.resolve(data);
    };
    this.worker.onerror = (event) => {
      const error = new Error(event.message || "The voice engine crashed");
      for (const waiting of this.pending.values()) waiting.reject(error);
      this.pending.clear();
    };
  }

  static async create(): Promise<Engine> {
    const engine = new Engine();
    const [vocabulary, ready] = await Promise.all([
      fetch("/wasm/phones.json").then((response) => response.json() as Promise<Vocabulary>),
      engine.call({ type: "init" }),
    ]);
    engine.mapper = new PhoneMapper(vocabulary);
    engine.maxTokens = ready.maxTokens ?? 190;
    return engine;
  }

  private call(message: Record<string, unknown>, transfer: Transferable[] = []): Promise<Reply> {
    const id = ++this.counter;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.worker.postMessage({ id, ...message }, transfer);
    });
  }

  /** Split a word list into runs the voice can take in one go (it handles up to maxTokens phones). */
  private chunks(words: string[][]): string[][] {
    const limit = this.maxTokens - 2;
    const runs: string[][][] = [[]];
    let size = 1;
    for (const word of words) {
      const cost = word.length + 1;
      if (size + cost > limit && runs[runs.length - 1].length) {
        runs.push([]);
        size = 1;
      }
      runs[runs.length - 1].push(word);
      size += cost;
    }
    return runs.map(withBoundaries);
  }

  async speak(text: string): Promise<Speech> {
    const started = performance.now();
    const spoken = normalize(text);
    const sentences = spoken.split(/(?<=[۔.!?؟])\s*/).filter((part) => /\p{L}/u.test(part));
    const parts: Float32Array[] = [];
    const gap = new Float32Array(Math.round(SENTENCE_GAP_SECONDS * SAMPLE_RATE));
    for (const sentence of sentences) {
      const { ipa } = await this.call({ type: "phonemize", text: sentence });
      const words = this.mapper.words(ipa ?? "");
      for (const phones of this.chunks(words)) {
        const { pcm } = await this.call({
          type: "synth",
          ids: this.mapper.ids(phones),
          // Same noise seed as the Python tools: sha256 of the space-joined phones.
          seedText: phones.join(" "),
        });
        if (parts.length) parts.push(gap);
        parts.push(pcm!);
      }
    }
    const total = parts.reduce((sum, part) => sum + part.length, 0);
    const pcm = new Float32Array(total);
    let offset = 0;
    for (const part of parts) {
      pcm.set(part, offset);
      offset += part.length;
    }
    return { pcm, seconds: total / SAMPLE_RATE, milliseconds: performance.now() - started, spoken };
  }
}

/** 16-bit mono WAV of the samples, for playback and download. */
export function toWav(pcm: Float32Array): Blob {
  const view = new DataView(new ArrayBuffer(44 + pcm.length * 2));
  const write = (offset: number, text: string) =>
    [...text].forEach((char, i) => view.setUint8(offset + i, char.charCodeAt(0)));
  write(0, "RIFF");
  view.setUint32(4, 36 + pcm.length * 2, true);
  write(8, "WAVEfmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, SAMPLE_RATE * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  write(36, "data");
  view.setUint32(40, pcm.length * 2, true);
  pcm.forEach((sample, i) => view.setInt16(44 + i * 2, Math.round(Math.max(-1, Math.min(1, sample)) * 32767), true));
  return new Blob([view], { type: "audio/wav" });
}

export { BOUNDARY };
