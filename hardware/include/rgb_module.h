#ifndef RGB_MODULE_H
#define RGB_MODULE_H

#include <Adafruit_NeoPixel.h>
#include "config.h"

// ESP32-S3 DevKitC-1 内置 RGB 灯通常在 GPIO 48 (见 config.h)
#define RGB_LED_COUNT 1

extern Adafruit_NeoPixel rgbLed;

void initRGB();
void setRgbColor(uint8_t r, uint8_t g, uint8_t b); // 设置颜色
void controlRgbLed(bool state); // 简单的开关控制 (开=绿色, 关=灭)

#endif
