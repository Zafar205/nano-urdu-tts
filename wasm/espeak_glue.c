/* WebAssembly entry points for Urdu phonemization with eSpeak NG (GPL-3.0-or-later).
 *
 * Mirrors `espeak-ng -q --ipa -v ur --stdin`, the exact front end the voice was
 * trained with: the IPA comes from the phoneme trace written while eSpeak runs
 * its (discarded) synthesis, not from espeak_TextToPhonemes, whose output differs.
 */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include <emscripten/emscripten.h>
#include <espeak-ng/espeak_ng.h>
#include <espeak-ng/speak_lib.h>

static char *result;

static int discard(short *wave, int samples, espeak_EVENT *events) {
    (void)wave; (void)samples; (void)events;
    return 0;
}

/* 0 on success. */
EMSCRIPTEN_KEEPALIVE int es_init(void) {
    espeak_ng_ERROR_CONTEXT context = NULL;
    espeak_ng_InitializePath("/espeak-ng-data");
    if (espeak_ng_Initialize(&context) != ENS_OK) return -1;
    if (espeak_ng_InitializeOutput(ENOUTPUT_MODE_SYNCHRONOUS, 0, NULL) != ENS_OK) return -2;
    espeak_SetSynthCallback(discard);
    if (espeak_ng_SetVoiceByName("ur") != ENS_OK) return -3;
    return 0;
}

/* UTF-8 Urdu text -> IPA string (owned by this module until the next call). */
EMSCRIPTEN_KEEPALIVE const char *es_phonemize(const char *text) {
    char *buffer = NULL;
    size_t length = 0;
    FILE *trace = open_memstream(&buffer, &length);
    if (!trace) return NULL;
    size_t size = strlen(text);
    char *input = malloc(size + 2);  /* the CLI feeds the text plus a newline */
    memcpy(input, text, size);
    input[size] = '\n';
    input[size + 1] = '\0';
    espeak_SetPhonemeTrace(espeakPHONEMES_IPA, trace);
    espeak_Synth(input, size + 2, 0, POS_CHARACTER, 0,
                 espeakCHARS_AUTO | espeakPHONEMES | espeakENDPAUSE, NULL, NULL);
    espeak_ng_Synchronize();
    espeak_SetPhonemeTrace(0, NULL);
    fclose(trace);
    free(input);
    free(result);
    result = buffer;
    return result;
}
