/* WebAssembly entry points for the Nano Urdu int8 voice (sanoTTS runtime, MIT).
 *
 * The voice blobs are embedded into the module's virtual file system at build
 * time (/voice/front_q8.bin, /voice/model_q8.bin); their shapes are compiled in
 * from voice/nano_q8_meta.h.
 */
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include <emscripten/emscripten.h>

#include "nano_q8_meta.h"
#include "snt_nano.h"

static void *front_blob, *decoder_blob;
static float *pcm;
static int pcm_length, pcm_capacity;

static void *read_aligned(const char *path) {
    FILE *file = fopen(path, "rb");
    if (!file) return NULL;
    fseek(file, 0, SEEK_END);
    long size = ftell(file);
    fseek(file, 0, SEEK_SET);
    void *data = aligned_alloc(16, ((size_t)size + 15) & ~(size_t)15);
    if (data && fread(data, 1, (size_t)size, file) != (size_t)size) {
        free(data);
        data = NULL;
    }
    fclose(file);
    return data;
}

static int collect(const float *samples, int count, void *user) {
    (void)user;
    if (pcm_length + count > pcm_capacity) {
        int capacity = (pcm_length + count) * 2;
        float *grown = realloc(pcm, (size_t)capacity * sizeof(float));
        if (!grown) return -1;
        pcm = grown;
        pcm_capacity = capacity;
    }
    memcpy(pcm + pcm_length, samples, (size_t)count * sizeof(float));
    pcm_length += count;
    return 0;
}

/* 0 on success. */
EMSCRIPTEN_KEEPALIVE int nu_init(void) {
    if (front_blob && decoder_blob) return 0;
    front_blob = read_aligned("/voice/front_q8.bin");
    decoder_blob = read_aligned("/voice/model_q8.bin");
    return front_blob && decoder_blob ? 0 : -1;
}

EMSCRIPTEN_KEEPALIVE int nu_max_tokens(void) { return NANO_DUR_MAX_TOKENS; }

EMSCRIPTEN_KEEPALIVE void *nu_alloc(int bytes) { return malloc((size_t)bytes); }

EMSCRIPTEN_KEEPALIVE void nu_free(void *pointer) { free(pointer); }

/* Phoneme ids -> 24 kHz float PCM (read with nu_pcm / nu_pcm_length).
 * The noise seed is sha256(seed_text)[:8], as speak.py uses the joined phones. */
EMSCRIPTEN_KEEPALIVE int nu_synthesize(const int32_t *ids, int count, const char *seed_text) {
    uint64_t seed;
    if (snt_nano_sha256_seed(seed_text, &seed) != 0) return -100;
    size_t arena_size = 1024 * 1024 + 1024 * (size_t)count * NANO_DUR_MAX_DURATION;
    arena_size = (arena_size + 15) & ~(size_t)15;
    void *arena = aligned_alloc(16, arena_size);
    if (!arena) return -101;
    snt_nano_config config = {front_blob, decoder_blob, arena, arena_size, NULL, seed};
    pcm_length = 0;
    int status = snt_nano_synthesize(&config, ids, count, collect, NULL, NULL);
    free(arena);
    return status;
}

EMSCRIPTEN_KEEPALIVE float *nu_pcm(void) { return pcm; }

EMSCRIPTEN_KEEPALIVE int nu_pcm_length(void) { return pcm_length; }
