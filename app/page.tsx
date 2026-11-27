import Tts from "@/components/Tts";

const FACTS = [
  { value: "443,402", label: "parameters" },
  { value: "≈ 500 KB", label: "int8 voice file" },
  { value: "0", label: "servers — runs on your device" },
];

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
      <header>
        <a
          href="https://unityalgo.com"
          className="mb-8 inline-flex items-center gap-3 rounded-full border border-line bg-card py-1.5 pr-4 pl-1.5 transition hover:border-accent"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/unityalgo-logo.png" alt="" width={32} height={32} className="rounded-full" />
          <span className="text-sm font-semibold tracking-wide">UnityAlgo</span>
        </a>
        <p className="text-sm font-medium tracking-wide text-accent uppercase">Open experiment</p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">Nano Urdu TTS</h1>
        <p className="mt-4 max-w-2xl text-lg text-muted">
          A very small Urdu voice. The whole model is about 500 KB, and it speaks right here in your
          browser — your text never leaves this page.
        </p>
        <dl className="mt-6 flex flex-wrap gap-x-10 gap-y-3">
          {FACTS.map((fact) => (
            <div key={fact.label}>
              <dt className="sr-only">{fact.label}</dt>
              <dd>
                <span className="text-xl font-semibold">{fact.value}</span>{" "}
                <span className="text-sm text-muted">{fact.label}</span>
              </dd>
            </div>
          ))}
        </dl>
      </header>

      <div className="mt-10">
        <Tts />
      </div>

      <section className="mt-14 space-y-4 text-muted">
        <h2 className="text-xl font-semibold text-foreground">How it works</h2>
        <p>
          Your text is cleaned and numbers are spelled out in Urdu words. eSpeak NG (compiled to
          WebAssembly) turns the words into sounds. Then three small networks — a duration model, an
          acoustic model and a GAN-trained decoder, 443,402 parameters together — turn the sounds
          into a 24 kHz waveform, using int8 weights.
        </p>
        <p>
          The voice was trained by distillation: it copies the voice of Meta&apos;s MMS-TTS Urdu
          model (about 36 million parameters, so roughly 80× larger), speaking sentences from the
          UrduTTS corpus. It can only be as natural as that teacher.
        </p>
        <p>
          It is a research prototype. Very long text is read sentence by sentence, and unusual
          loanwords may be pronounced with the nearest Urdu sound.
        </p>
      </section>

      <footer className="mt-14 border-t border-line pt-6 text-sm text-muted">
        <p className="mb-6 font-medium text-foreground">
          Built by <span className="text-accent">UnityAlgo</span>
        </p>
        <h2 className="font-semibold text-foreground">Licences and credits — non-commercial use only</h2>
        <ul className="mt-3 list-disc space-y-1 pl-5">
          <li>
            Voice trained from Meta&apos;s{" "}
            <a className="underline" href="https://huggingface.co/facebook/mms-tts-urd-script_arabic">
              MMS-TTS Urdu
            </a>{" "}
            and the{" "}
            <a className="underline" href="https://huggingface.co/datasets/kaab4321/UrduTTS">
              UrduTTS
            </a>{" "}
            corpus, both CC BY-NC 4.0. Please do not use this voice commercially.
          </li>
          <li>
            Inference runtime from{" "}
            <a className="underline" href="https://github.com/ampixa/sanoTTS">
              sanoTTS
            </a>{" "}
            (MIT). Pronunciation by{" "}
            <a className="underline" href="https://github.com/espeak-ng/espeak-ng">
              eSpeak NG
            </a>{" "}
            (GPL-3.0-or-later), served here as WebAssembly together with its source build script.
          </li>
        </ul>
      </footer>
    </main>
  );
}
