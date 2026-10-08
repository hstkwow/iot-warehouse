#include "rgb_module.h"
#include "logger.h"

// 建立 NeoPixel 对象
Adafruit_NeoPixel rgbLed(RGB_LED_COUNT, RGB_BUILTIN_PIN, NEO_GRB + NEO_KHZ800);

void initRGB() {
  rgbLed.begin();
  rgbLed.setBrightness(50); // 设置亮度 (0-255)
  rgbLed.show(); // 初始化时关闭
  LOG_I("Rgb", "Built-in RGB LED initialized on Pin 48");
}

void setRgbColor(uint8_t r, uint8_t g, uint8_t b) {
  rgbLed.setPixelColor(0, rgbLed.Color(r, g, b));
  rgbLed.show();
}

void controlRgbLed(bool state) {
  if (state) {
    // 开启状态：显示绿色 (R=0, G=255, B=0)
    setRgbColor(0, 255, 0); 
  } else {
    // 关闭状态：熄灭
    setRgbColor(0, 0, 0);
  }
}
