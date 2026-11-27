"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Engine, SAMPLE_RATE, toWav, type Speech } from "@/lib/engine";

const EXAMPLES = [
  {
    label: "زندگی",
    text: "زندگی ایک ایسا سفر ہے جس میں ہر قدم پر نئے تجربات اور سبق ملتے ہیں۔ کبھی حالات ہموار ہوتے ہیں اور کبھی مشکلات کا سامنا کرنا پڑتا ہے، لیکن حوصلہ اور محنت انسان کو آگے بڑھنے کی طاقت دیتے ہیں۔ اگر ہم اپنے وقت کی قدر کریں، دوسروں کے ساتھ بھلائی کریں اور سیکھنے کا عمل جاری رکھیں تو ہر چیلنج کو ایک موقع میں بدل سکتے ہیں۔ علم، صبر اور مثبت سوچ نہ صرف ہماری اپنی زندگی کو سنوارتے ہیں بلکہ معاشرے میں بھی روشنی پھیلاتے ہیں۔",
  },
  {
    label: "ٹیکنالوجی",
    text: "آج کے دور میں ٹیکنالوجی نے ہماری روزمرہ زندگی کو بہت آسان بنا دیا ہے۔ ہم چند لمحوں میں دنیا کے کسی بھی کونے سے معلومات حاصل کر سکتے ہیں اور اپنے پیاروں سے رابطہ کر سکتے ہیں۔ لیکن اس کے ساتھ ساتھ یہ بھی ضروری ہے کہ ہم ٹیکنالوجی کو سمجھداری سے استعمال کریں اور اپنا قیمتی وقت صرف مفید کاموں میں لگائیں۔ جو لوگ نئی مہارتیں سیکھنے کے لیے تیار رہتے ہیں، وہی آنے والے کل کی دنیا میں کامیاب ہوتے ہیں۔",
  },
  {
    label: "پاکستان",
    text: "پاکستان ایک خوبصورت ملک ہے جہاں بلند پہاڑ، سرسبز وادیاں، وسیع صحرا اور گہرے سمندر سب ایک ساتھ ملتے ہیں۔ یہاں کے لوگ اپنی مہمان نوازی، محبت اور سادگی کے لیے مشہور ہیں۔ اگر ہم سب مل کر ایمانداری اور محنت سے اپنا کام کریں اور تعلیم کو اپنی ترجیح بنائیں تو یہ ملک ترقی کی نئی منزلیں طے کر سکتا ہے۔ ہمارے نوجوان اس ملک کا سب سے بڑا سرمایہ ہیں اور ان کی صلاحیتیں ہمارے روشن مستقبل کی ضمانت ہیں۔",
  },
];

type Status = "loading" | "ready" | "speaking" | "failed";

export default function Tts() {
  const [text, setText] = useState(EXAMPLES[0].text);
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ speech: Speech; url: string } | null>(null);
  const engine = useRef<Engine | null>(null);
  const audio = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    let cancelled = false;
    Engine.create().then(
      (created) => {
        if (cancelled) return;
        engine.current = created;
        setStatus("ready");
      },
      (reason: Error) => {
        if (cancelled) return;
        setError(reason.message);
        setStatus("failed");
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => () => { if (result) URL.revokeObjectURL(result.url); }, [result]);

  const speak = useCallback(async (input: string) => {
    if (!engine.current) return;
    setStatus("speaking");
    setError("");
    try {
      const speech = await engine.current.speak(input);
      const url = URL.createObjectURL(toWav(speech.pcm));
      setResult({ speech, url });
      requestAnimationFrame(() => audio.current?.play().catch(() => {}));
    } catch (reason) {
      setResult(null); // don't leave the previous sentence's audio next to the error
      setError(reason instanceof Error ? reason.message : String(reason));
    }
    setStatus("ready");
  }, []);

  const busy = status !== "ready";
  const realtime = result ? result.speech.seconds / (result.speech.milliseconds / 1000) : 0;

  return (
    <section aria-label="Text to speech" className="rounded-2xl border border-line bg-card p-5 shadow-sm sm:p-7">
      <label htmlFor="urdu-text" className="mb-2 block text-sm font-medium text-muted">
        Urdu text
      </label>
      <textarea
        id="urdu-text"
        dir="rtl"
        lang="ur"
        rows={7}
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder="یہاں اردو لکھیں…"
        className="font-urdu w-full resize-y rounded-xl border border-line bg-field p-4 text-xl leading-[2.2] sm:text-2xl outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
      />

      <div className="mt-3 flex flex-wrap gap-2" aria-label="Example sentences">
        {EXAMPLES.map((example) => (
          <button
            key={example.label}
            type="button"
            onClick={() => setText(example.text)}
            className="font-urdu rounded-full border border-line px-4 py-1 text-lg text-muted transition hover:border-accent hover:text-accent"
          >
            {example.label}
          </button>
        ))}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-4">
        <button
          type="button"
          disabled={busy || !text.trim()}
          onClick={() => speak(text)}
          className="rounded-full bg-accent px-7 py-3 font-medium text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {status === "loading" ? "Loading voice…" : status === "speaking" ? "Speaking…" : "Speak"}
        </button>
        <p className="text-sm text-muted" role="status">
          {status === "loading" && "Downloading the 500 KB voice and the pronunciation engine…"}
          {status === "failed" && "The voice could not start in this browser."}
        </p>
      </div>

      {error && (
        <p role="alert" className="mt-4 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      )}

      {result && (
        <div className="mt-6 border-t border-line pt-5">
          <audio ref={audio} controls src={result.url} className="w-full" />
          <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted">
            <span>{result.speech.seconds.toFixed(1)} s of audio</span>
            <span>made in {(result.speech.milliseconds / 1000).toFixed(2)} s on your device</span>
            <span>{realtime.toFixed(1)}× faster than real time</span>
            <a
              href={result.url}
              download="nano-urdu.wav"
              className="ml-auto font-medium text-accent underline-offset-4 hover:underline"
            >
              Download WAV ({SAMPLE_RATE / 1000} kHz)
            </a>
          </div>
        </div>
      )}
    </section>
  );
}
