#ifndef LOGGER_H
#define LOGGER_H

#include <Arduino.h>

enum LogLevel {
    LOG_DEBUG = 0,
    LOG_INFO  = 1,
    LOG_WARN  = 2,
    LOG_ERROR = 3
};

// 基础日志输出
void log_message(LogLevel level, const char* module, const char* format, ...);

// 调试增强输出（自动带 file:line）
void log_debug_trace(const char* module, const char* file, int line, const char* format, ...);

// 运行时配置
void log_set_level(LogLevel level);       // 设置最低输出级别
LogLevel log_get_level();
void log_set_enabled(bool enabled);       // 总开关
bool log_is_enabled();
void log_set_show_timestamp(bool enabled);// 是否显示 millis 时间戳
void log_set_show_thread(bool enabled);   // 是否显示任务名/核心ID

// 二进制调试
void log_hexdump(const char* module, const char* title, const uint8_t* data, size_t len);

// Macros for easier usage
#define LOG_I(module, format, ...) log_message(LOG_INFO, module, format, ##__VA_ARGS__)
#define LOG_W(module, format, ...) log_message(LOG_WARN, module, format, ##__VA_ARGS__)
#define LOG_E(module, format, ...) log_message(LOG_ERROR, module, format, ##__VA_ARGS__)
#define LOG_D(module, format, ...) log_message(LOG_DEBUG, module, format, ##__VA_ARGS__)
#define DBG(module, format, ...)   log_debug_trace(module, __FILE__, __LINE__, format, ##__VA_ARGS__)

#endif
