#include "logger.h"
#include <stdarg.h>
#include <stdio.h>
#include <string.h>
#include <freertos/FreeRTOS.h>
#include <freertos/semphr.h>
#include <freertos/task.h>

static LogLevel g_minLevel = LOG_INFO;
static bool g_enabled = true;
static bool g_showTimestamp = false;
static bool g_showThread = false;
static SemaphoreHandle_t g_logMutex = nullptr;

static void ensure_log_mutex() {
    if (!g_logMutex) {
        g_logMutex = xSemaphoreCreateMutex();
    }
}

static const char* level_to_text(LogLevel level) {
    switch (level) {
        case LOG_DEBUG: return "D";
        case LOG_INFO:  return "I";
        case LOG_WARN:  return "W";
        case LOG_ERROR: return "E";
        default:        return "?";
    }
}

static void log_vmessage(LogLevel level, const char* module, const char* format, va_list args) {
    if (!g_enabled || level < g_minLevel) return;
    if (!module) module = "SYS";
    if (!format) format = "";

    char msgBuf[256];
    char* msg = msgBuf;

    va_list argsCopy;
    va_copy(argsCopy, args);
    int need = vsnprintf(msgBuf, sizeof(msgBuf), format, argsCopy);
    va_end(argsCopy);
    if (need < 0) return;

    if ((size_t)need >= sizeof(msgBuf)) {
        msg = (char*)malloc((size_t)need + 1);
        if (!msg) return;
        vsnprintf(msg, (size_t)need + 1, format, args);
    }

    ensure_log_mutex();
    if (g_logMutex) xSemaphoreTake(g_logMutex, portMAX_DELAY);

    if (g_showTimestamp) {
        Serial.printf("%lu ", (unsigned long)millis());
    }
    Serial.printf("%s/%s", level_to_text(level), module);
    if (g_showThread) {
        const char* taskName = pcTaskGetName(nullptr);
        BaseType_t coreId = xPortGetCoreID();
        Serial.printf("[%s:%d]", taskName ? taskName : "?", (int)coreId);
    }
    Serial.printf(": %s\n", msg);

    if (g_logMutex) xSemaphoreGive(g_logMutex);
    if (msg != msgBuf) {
        free(msg);
    }
}

void log_message(LogLevel level, const char* module, const char* format, ...) {
    va_list args;
    va_start(args, format);
    log_vmessage(level, module, format, args);
    va_end(args);
}

void log_debug_trace(const char* module, const char* file, int line, const char* format, ...) {
    if (!g_enabled || LOG_DEBUG < g_minLevel) return;
    if (!module) module = "DBG";
    if (!file) file = "?";
    if (!format) format = "";

    const char* fileName = strrchr(file, '/');
    fileName = fileName ? fileName + 1 : file;

    char prefixBuf[96];
    snprintf(prefixBuf, sizeof(prefixBuf), "%s:%d | ", fileName, line);

    char msgBuf[256];
    va_list args;
    va_start(args, format);
    vsnprintf(msgBuf, sizeof(msgBuf), format, args);
    va_end(args);

    char finalBuf[384];
    snprintf(finalBuf, sizeof(finalBuf), "%s%s", prefixBuf, msgBuf);
    log_message(LOG_DEBUG, module, "%s", finalBuf);
}

void log_set_level(LogLevel level) {
    g_minLevel = level;
}

LogLevel log_get_level() {
    return g_minLevel;
}

void log_set_enabled(bool enabled) {
    g_enabled = enabled;
}

bool log_is_enabled() {
    return g_enabled;
}

void log_set_show_timestamp(bool enabled) {
    g_showTimestamp = enabled;
}

void log_set_show_thread(bool enabled) {
    g_showThread = enabled;
}

void log_hexdump(const char* module, const char* title, const uint8_t* data, size_t len) {
    if (!g_enabled || LOG_DEBUG < g_minLevel || !data || len == 0) return;
    if (!title) title = "hex";

    log_message(LOG_DEBUG, module, "%s (len=%u)", title, (unsigned)len);

    char line[96];
    for (size_t i = 0; i < len; i += 16) {
        int p = snprintf(line, sizeof(line), "%04u: ", (unsigned)i);
        for (size_t j = 0; j < 16; j++) {
            if (i + j < len) {
                p += snprintf(line + p, sizeof(line) - (size_t)p, "%02X ", data[i + j]);
            } else {
                p += snprintf(line + p, sizeof(line) - (size_t)p, "   ");
            }
        }
        snprintf(line + p, sizeof(line) - (size_t)p, "| ");
        size_t asciiPos = strlen(line);
        for (size_t j = 0; j < 16 && i + j < len; j++) {
            uint8_t c = data[i + j];
            line[asciiPos + j] = (c >= 32 && c <= 126) ? (char)c : '.';
        }
        line[asciiPos + ((len - i) > 16 ? 16 : (len - i))] = '\0';
        log_message(LOG_DEBUG, module, "%s", line);
    }
}
