/**
 * Urdu text -> phoneme ids for the Nano Urdu voice.
 *
 * A line-for-line port of the training project's `urdu_frontend.py` and
 * `phones.py`, so the browser feeds the voice exactly what the Python tools do.
 * eSpeak NG (compiled to WebAssembly, see wasm/) turns the normalized text into
 * IPA; everything else is here.
 */

const CARDINALS = `
صفر ایک دو تین چار پانچ چھ سات آٹھ نو
دس گیارہ بارہ تیرہ چودہ پندرہ سولہ سترہ اٹھارہ انیس
بیس اکیس بائیس تئیس چوبیس پچیس چھبیس ستائیس اٹھائیس انتیس
تیس اکتیس بتیس تینتیس چونتیس پینتیس چھتیس سینتیس اڑتیس انتالیس
چالیس اکتالیس بیالیس تینتالیس چوالیس پینتالیس چھیالیس سینتالیس اڑتالیس انچاس
پچاس اکیاون باون ترپن چوّن پچپن چھپن ستاون اٹھاون انسٹھ
ساٹھ اکسٹھ باسٹھ تریسٹھ چونسٹھ پینسٹھ چھیاسٹھ سڑسٹھ اڑسٹھ انہتر
ستر اکہتر بہتر تہتر چوہتر پچہتر چھہتر ستتر اٹھہتر اناسی
اسی اکیاسی بیاسی تراسی چوراسی پچاسی چھیاسی ستاسی اٹھاسی نواسی
نوے اکانوے بانوے ترانوے چورانوے پچانوے چھیانوے ستانوے اٹھانوے ننانوے
`
  .split(/\s+/)
  .filter(Boolean);

const SCALES: [number, string][] = [
  [1e12, "کھرب"],
  [1e9, "ارب"],
  [1e7, "کروڑ"],
  [1e5, "لاکھ"],
  [1000, "ہزار"],
  [100, "سو"],
];

// Eastern-Arabic digits, Arabic kaf/yeh and a few symbols -> the forms the voice's text pipeline expects.
const DIGIT_FROM = "۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩كي−٫٬٪";
const DIGIT_TO = "01234567890123456789کی-.,%";
const DIGIT_MAP = new Map([...DIGIT_FROM].map((char, i) => [char, [...DIGIT_TO][i]]));

const NUMBER = /[+-]?[0-9]+(?:,[0-9]+)*(?:\.[0-9]+)?(?:[ \t]*%)?/g;
const GROUPING = /^(?:[0-9]{1,3}(?:,[0-9]{3})+|[0-9]{1,2}(?:,[0-9]{2})+,[0-9]{3})$/;
const PUNCTUATION = new Set([..."۔،؛؟!?.,:;…()«»\"'“”–—-"]);

function cardinal(value: number): string {
  const words: string[] = [];
  for (const [scale, name] of SCALES) {
    const units = Math.floor(value / scale);
    value %= scale;
    if (units) words.push(CARDINALS[units], name);
  }
  if (value || !words.length) words.push(CARDINALS[value]);
  return words.join(" ");
}

const spellDigits = (digits: string) =>
  [...digits].map((digit) => CARDINALS[Number(digit)]).join(" ");

function speakNumber(token: string): string {
  const sign = ({ "-": "منفی", "+": "مثبت" } as Record<string, string>)[token[0]];
  const percent = token.endsWith("%");
  let unsigned = token.replace(/^[+-]+/, "");
  if (percent) unsigned = unsigned.slice(0, -1);
  unsigned = unsigned.trim();
  const dot = unsigned.indexOf(".");
  let integer = dot < 0 ? unsigned : unsigned.slice(0, dot);
  const fraction = dot < 0 ? "" : unsigned.slice(dot + 1);
  if (integer.includes(",") && !GROUPING.test(integer)) {
    throw new Error(`Invalid digit grouping in "${token}". Use spaces between separate numbers.`);
  }
  integer = integer.replaceAll(",", "");
  const words = [
    integer.length > 14 || (integer.length > 1 && integer.startsWith("0"))
      ? spellDigits(integer)
      : cardinal(Number(integer)),
  ];
  if (sign) words.unshift(sign);
  if (fraction) words.push("اعشاریہ", spellDigits(fraction));
  if (percent) words.push("فیصد");
  return ` ${words.join(" ")} `;
}

/** Clean Urdu-script text and spell out numbers. Throws a readable Error for unsupported input. */
export function normalize(input: string): string {
  let text = [...input.normalize("NFKC")].map((char) => DIGIT_MAP.get(char) ?? char).join("");
  text = text.replace(/\p{Cf}/gu, "").replaceAll("ـ", "");
  text = text.replace(/[0-9]+(?:،[0-9]+)+/g, (match) => {
    const grouped = match.replaceAll("،", ",");
    return GROUPING.test(grouped) ? grouped : match;
  });
  if (/[0-9]\s*[:/–—-]\s*[0-9]/.test(text)) {
    throw new Error("Write times, fractions, dates, and ranges out in Urdu words.");
  }
  text = text.replace(NUMBER, (match) => speakNumber(match)).trim();
  for (const char of text) {
    if (/\s/u.test(char) || PUNCTUATION.has(char)) continue;
    if (!/^[\p{L}\p{M}]$/u.test(char) || !/\p{Script=Arabic}/u.test(char)) {
      throw new Error(`Use Urdu script and numbers. Unsupported character "${char}".`);
    }
  }
  if (!/\p{L}/u.test(text)) throw new Error("Enter some Urdu text or a number.");
  return text.replace(/\s+/g, " ");
}

/* ---- IPA -> phones ------------------------------------------------------ */

export const BOUNDARY = "|";
const LENGTH = "ː";
const VOWELS = "aeiouɛɔəɪʊʌɐ";
// Nearest sounds for symbols eSpeak can emit (mostly in loanwords) that the voice
// never saw in training; used only when the voice lacks the symbol.
const NEAREST: Record<string, string> = {
  ʒ: "z", g: "ɡ", ŋ: "n", ɲ: "n", ɳ: "n", ɭ: "l", v: "ʋ", ɦ: "h", χ: "x", ʁ: "ɣ",
  ɑ: "aː", "ɑː": "aː", æ: "ɛ", ɒ: "ɔ",
};

export type Vocabulary = Record<string, number>;

function phoneAliases(vocabulary: Vocabulary): Record<string, string> {
  const aliases: Record<string, string> = {};
  for (const [source, target] of Object.entries(NEAREST)) {
    if (!(source in vocabulary) && target in vocabulary) aliases[source] = target;
  }
  for (const vowel of VOWELS) {
    for (const base of [vowel, vowel + "̃"]) {
      const short = base.normalize("NFC");
      const long = (base + LENGTH).normalize("NFC");
      if (!(short in vocabulary) && long in vocabulary) aliases[short] = long;
      else if (!(long in vocabulary) && short in vocabulary) aliases[long] = short;
    }
  }
  return aliases;
}

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function phonePattern(symbols: Iterable<string>): RegExp {
  const sorted = [...symbols]
    .filter((phone) => phone && !phone.startsWith("<") && phone !== BOUNDARY)
    .sort((a, b) => [...b].length - [...a].length || (a < b ? -1 : a > b ? 1 : 0));
  if (!sorted.length) throw new Error("The phone inventory is empty.");
  return new RegExp(sorted.map(escapeRegExp).join("|"), "y");
}

function tokenizeWords(ipa: string, pattern: RegExp): string[][] {
  const clean = ipa.normalize("NFC").replace(/[ˈˌ͜͡‌‍]/g, "");
  const words: string[][] = [];
  for (const word of clean.split(/[\s.,:;!?،؛؟۔…“”|]+/)) {
    const phones: string[] = [];
    let offset = 0;
    while (offset < word.length) {
      pattern.lastIndex = offset;
      const match = pattern.exec(word);
      if (match === null) {
        const symbol = word[offset];
        if (symbol === LENGTH && phones.length) {
          phones.push(phones[phones.length - 1]); // geminate: hold the previous phone twice as long
          offset += 1;
          continue;
        }
        if (/\p{Mn}/u.test(symbol)) {
          offset += 1; // an unsupported diacritic
          continue;
        }
        throw new Error(`The voice cannot say the sound "${word.slice(offset)}".`);
      }
      phones.push(match[0]);
      offset = pattern.lastIndex;
    }
    if (phones.length) words.push(phones);
  }
  return words;
}

export function withBoundaries(words: string[][]): string[] {
  const sequence = [BOUNDARY];
  for (const word of words) sequence.push(...word, BOUNDARY);
  return sequence;
}

export class PhoneMapper {
  readonly vocabulary: Vocabulary;
  private readonly aliases: Record<string, string>;
  private readonly pattern: RegExp;

  constructor(vocabulary: Vocabulary) {
    this.vocabulary = vocabulary;
    this.aliases = phoneAliases(vocabulary);
    this.pattern = phonePattern([...Object.keys(vocabulary), ...Object.keys(this.aliases)]);
  }

  /** IPA from eSpeak -> words, each a list of phones the voice knows. */
  words(ipa: string): string[][] {
    const words = tokenizeWords(ipa, this.pattern).map((word) =>
      word.map((phone) => this.aliases[phone] ?? phone),
    );
    if (!words.length) throw new Error("The phonemizer produced no usable phones.");
    return words;
  }

  ids(phones: string[]): number[] {
    return phones.map((phone) => this.vocabulary[phone]);
  }
}
