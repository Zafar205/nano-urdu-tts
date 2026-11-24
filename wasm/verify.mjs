// Checks the WebAssembly build against reference audio from the Python pipeline.
//   node wasm/verify.mjs <reference dir>
// The reference dir holds cases.json and N.f32 written by the Python tools
// (urdu_frontend.phones_for + speak.render with the same noise seed).
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { PhoneMapper, normalize, withBoundaries } from "../lib/urdu.ts";

const here = dirname(fileURLToPath(import.meta.url));
const wasm = join(here, "../public/wasm");
const require = createRequire(import.meta.url);
const reference = process.argv[2];
if (!reference) throw new Error("usage: verify.mjs <reference dir>");

const espeak = await require(join(wasm, "espeak-ur.js"))({ locateFile: (file) => join(wasm, file) });
const nano = await require(join(wasm, "nano.js"))({ locateFile: (file) => join(wasm, file) });
if (espeak._es_init() !== 0 || nano._nu_init() !== 0) throw new Error("init failed");

const mapper = new PhoneMapper(JSON.parse(readFileSync(join(wasm, "phones.json"), "utf8")));
const cases = JSON.parse(readFileSync(join(reference, "cases.json"), "utf8"));

function phonemize(text) {
  const input = espeak.stringToNewUTF8(text);
  const ipa = espeak.UTF8ToString(espeak._es_phonemize(input)).trim();
  espeak._free(input);
  return ipa;
}

function synth(ids, seedText) {
  const pointer = nano._nu_alloc(ids.length * 4);
  new Int32Array(nano.HEAPU8.buffer, pointer, ids.length).set(ids);
  const seed = nano.stringToNewUTF8(seedText);
  const status = nano._nu_synthesize(pointer, ids.length, seed);
  nano._nu_free(pointer);
  nano._nu_free(seed);
  if (status !== 0) throw new Error(`synth status ${status}`);
  return new Float32Array(nano.HEAPU8.buffer, nano._nu_pcm(), nano._nu_pcm_length()).slice();
}

let failures = 0;
cases.forEach((expected, index) => {
  const spoken = normalize(expected.text);
  const ipa = phonemize(spoken);
  const phones = withBoundaries(mapper.words(ipa));
  const checks = {
    spoken: spoken === expected.spoken,
    ipa: ipa === expected.ipa,
    phones: JSON.stringify(phones) === JSON.stringify(expected.phones),
  };
  const pcm = synth(mapper.ids(phones), phones.join(" "));
  const raw = readFileSync(join(reference, `${index}.f32`));
  const target = new Float32Array(raw.buffer, raw.byteOffset, raw.byteLength / 4);
  let worst = Infinity;
  if (pcm.length === target.length) {
    worst = 0;
    for (let i = 0; i < pcm.length; i++) worst = Math.max(worst, Math.abs(pcm[i] - target[i]));
  }
  checks.audio = worst < 1e-4;
  const ok = Object.values(checks).every(Boolean);
  if (!ok) failures++;
  console.log(
    `${ok ? "PASS" : "FAIL"} #${index} samples ${pcm.length}/${target.length} max|diff| ${worst.toExponential(2)}`,
    ok ? "" : JSON.stringify(checks),
  );
  if (!ok && !checks.ipa) console.log("  ipa  wasm:", ipa, "\n  ipa  py  :", expected.ipa);
  if (!ok && !checks.spoken) console.log("  spoken wasm:", spoken, "\n  spoken py  :", expected.spoken);
});
console.log(failures ? `${failures} case(s) FAILED` : "all cases match the Python pipeline");
process.exit(failures ? 1 : 0);
