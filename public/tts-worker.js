/* Runs both WebAssembly modules off the main thread.
 *   phonemize: Urdu text -> IPA   (eSpeak NG, Urdu data only)
 *   synth:     phoneme ids -> PCM (Nano Urdu int8 voice, 24 kHz)
 * The modules are built by wasm/build.sh into /wasm/. */
const base = new URL("./wasm/", self.location.href).href;
importScripts(base + "espeak-ur.js", base + "nano.js");

const locate = (file) => base + file;
let ready;

function init() {
  ready ??= (async () => {
    const [espeak, nano] = await Promise.all([
      createEspeak({ locateFile: locate }),
      createNano({ locateFile: locate }),
    ]);
    if (espeak._es_init() !== 0) throw new Error("eSpeak failed to start");
    if (nano._nu_init() !== 0) throw new Error("The voice failed to load");
    return { espeak, nano, maxTokens: nano._nu_max_tokens() };
  })();
  return ready;
}

function phonemize({ espeak }, text) {
  const input = espeak.stringToNewUTF8(text);
  const output = espeak._es_phonemize(input);
  const ipa = output ? espeak.UTF8ToString(output).trim() : "";
  espeak._free(input);
  return ipa;
}

function synth({ nano }, ids, seedText) {
  const idsPointer = nano._nu_alloc(ids.length * 4);
  new Int32Array(nano.HEAPU8.buffer, idsPointer, ids.length).set(ids);
  const seedPointer = nano.stringToNewUTF8(seedText);
  const status = nano._nu_synthesize(idsPointer, ids.length, seedPointer);
  nano._nu_free(idsPointer);
  nano._nu_free(seedPointer);
  if (status !== 0) throw new Error(`synthesis failed (${status})`);
  const length = nano._nu_pcm_length();
  return new Float32Array(nano.HEAPU8.buffer, nano._nu_pcm(), length).slice();
}

self.onmessage = async ({ data }) => {
  const { id, type } = data;
  try {
    const engine = await init();
    if (type === "init") {
      self.postMessage({ id, maxTokens: engine.maxTokens });
    } else if (type === "phonemize") {
      self.postMessage({ id, ipa: phonemize(engine, data.text) });
    } else if (type === "synth") {
      const pcm = synth(engine, data.ids, data.seedText);
      self.postMessage({ id, pcm }, [pcm.buffer]);
    }
  } catch (error) {
    self.postMessage({ id, error: String(error?.message ?? error) });
  }
};
