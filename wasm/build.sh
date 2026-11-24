#!/usr/bin/env bash
# Build the two WebAssembly modules the site loads from public/wasm/:
#   espeak-ur.js/.wasm  eSpeak NG 1.52.0 with only the Urdu data (GPL-3.0-or-later)
#   nano.js/.wasm       the Nano Urdu int8 voice on the sanoTTS runtime (MIT)
# Requires Emscripten (brew install emscripten).
set -euo pipefail
cd "$(dirname "$0")"
HERE=$PWD
OUT=$HERE/../public/wasm
CACHE=$HERE/.cache
ESPEAK_VERSION=1.52.0
ESPEAK=$CACHE/espeak-ng-$ESPEAK_VERSION
mkdir -p "$OUT" "$CACHE"

if [ ! -d "$ESPEAK" ]; then
  curl -fsSL "https://github.com/espeak-ng/espeak-ng/archive/refs/tags/$ESPEAK_VERSION.tar.gz" \
    | tar -xz -C "$CACHE"
fi

# Compiled Urdu data. eSpeak's dictionaries are built by the native tool, so
# take them from a native install of the same version.
DATA_SRC=${ESPEAK_DATA:-$(espeak-ng --version | sed -n 's/.*Data at: //p')}
case "$(espeak-ng --version)" in *"$ESPEAK_VERSION"*) ;; *) echo "native espeak-ng must be $ESPEAK_VERSION" >&2; exit 1;; esac
DATA=$CACHE/espeak-ng-data
rm -rf "$DATA" && mkdir -p "$DATA/lang/inc"
cp "$DATA_SRC"/{phontab,phonindex,phondata,intonations,ur_dict} "$DATA/"
cp "$DATA_SRC/lang/inc/ur" "$DATA/lang/inc/"

mkdir -p "$CACHE/config"
cat > "$CACHE/config/config.h" <<EOF
#define HAVE_MKSTEMP 1
#define USE_ASYNC 0
#define USE_KLATT 0
#define USE_LIBPCAUDIO 0
#define USE_LIBSONIC 0
#define USE_MBROLA 0
#define USE_SPEECHPLAYER 0
#define PACKAGE_VERSION "$ESPEAK_VERSION"
EOF

LIB=$ESPEAK/src/libespeak-ng
UCD=$ESPEAK/src/ucd-tools/src
COMMON=(-O3 -sMODULARIZE=1 -sALLOW_MEMORY_GROWTH=1 -sENVIRONMENT=web,worker,node
        -sEXPORTED_RUNTIME_METHODS=UTF8ToString,stringToNewUTF8,HEAPU8)

emcc "${COMMON[@]}" -sEXPORT_NAME=createEspeak \
  -sEXPORTED_FUNCTIONS=_es_init,_es_phonemize,_malloc,_free \
  -DLIBESPEAK_NG_EXPORT=1 -DPATH_ESPEAK_DATA='"/espeak-ng-data"' -fwrapv -Wno-everything \
  -I"$CACHE/config" -I"$ESPEAK/src/include" -I"$UCD/include" -I"$LIB" \
  "$HERE/espeak_glue.c" \
  "$LIB"/{common,mnemonics,error,ieee80,compiledata,compiledict,dictionary,encoding,intonation,langopts,numbers,phoneme,phonemelist,readclause,setlengths,soundicon,spect,ssml,synthdata,synthesize,tr_languages,translate,translateword,voices,wavegen,speech,espeak_api}.c \
  "$UCD"/{case,categories,ctype,proplist,scripts,tostring}.c \
  --embed-file "$DATA@/espeak-ng-data" \
  -o "$OUT/espeak-ur.js"

emcc "${COMMON[@]}" -sEXPORT_NAME=createNano \
  -sEXPORTED_FUNCTIONS=_nu_init,_nu_max_tokens,_nu_alloc,_nu_free,_nu_synthesize,_nu_pcm,_nu_pcm_length \
  -std=c99 -DFSD_FAST_MATH -D_POSIX_C_SOURCE=200809L \
  -I"$HERE/runtime/include" -I"$HERE/runtime/src" -I"$HERE/voice" \
  "$HERE/nano_glue.c" "$HERE"/runtime/src/{snt_nano,snt_kernels_ref,snt_port_host}.c \
  --embed-file "$HERE/voice/front_q8.bin@/voice/front_q8.bin" \
  --embed-file "$HERE/voice/model_q8.bin@/voice/model_q8.bin" \
  -o "$OUT/nano.js"

cp "$HERE/voice/phones.json" "$OUT/phones.json"
ls -la "$OUT"
