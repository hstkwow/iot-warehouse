#include "display_module.h"
#include <Wire.h>
#include <WiFi.h>
#include "network_module.h"
#include "logger.h"
#include <math.h>
#include "sound_output_module.h"
#include "alarm_module.h"
#include "esp_timer.h"
#include "driver/gpio.h"

#ifndef SSD1306_WHITE
#define SSD1306_WHITE 1
#endif
#ifndef SSD1306_BLACK
#define SSD1306_BLACK 0
#endif

extern bool isAlarmOn;

const unsigned char PROGMEM icon_warn[] = {
  0x00, 0x00, 0x01, 0x80, 0x01, 0x80, 0x02, 0x40, 0x02, 0x40, 0x04, 0x20, 0x04, 0x20, 0x08, 0x10,
  0x08, 0x10, 0x10, 0x08, 0x10, 0x08, 0x20, 0x04, 0x20, 0x04, 0x40, 0x02, 0x7F, 0xFE, 0x00, 0x00
};

enum DisplayView : uint8_t {
  VIEW_MENU = 0,
  VIEW_ENV,
  VIEW_SYSTEM,
  VIEW_ALERT
};

Adafruit_SH1106G display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire1, OLED_RESET);
static DisplayView s_view = VIEW_MENU;
static DisplayView s_prevView = VIEW_MENU;
static uint8_t s_menuIndex = 0;
static float s_menuHighlightY = 16.0f;
static uint8_t s_envIndex = 0;
static float s_envScrollY = 0.0f;
static float s_envBoxY = 19.0f;
static float s_envBoxW = 40.0f;
static uint8_t s_sysIndex = 0;
static float s_sysScrollY = 0.0f;
static float s_sysBoxY = 19.0f;
static float s_sysBoxW = 40.0f;
static bool s_netPopupVisible = false;
static float s_netPopupY = 64.0f;
static float s_netPopupTargetY = 64.0f;
static bool s_volPopupVisible = false;
static float s_volPopupY = 64.0f;
static float s_volPopupTargetY = 64.0f;
static unsigned long s_lastVolBeepMs = 0;
static float s_alarmPopupY = 64.0f;
static float s_alarmPopupTargetY = 64.0f;
static AlarmPopup s_alarmPopupCache;
static bool s_alarmPopupHasCache = false;
static bool s_isTransitioning = false;
static int s_transitionDir = 0;
static unsigned long s_transitionStart = 0;
static const unsigned long TRANSITION_MS = 180;
static unsigned long s_lastAnimMs = 0;
static float s_animDtMs = 16.0f;
static uint8_t s_encLastAB = 0x03;
static int8_t s_encAccum = 0;
static unsigned long s_encLastStepAt = 0;
static bool s_lastConfigPressed = false;
static bool s_lastBackPressed = false;
static unsigned long s_lastConfigChange = 0;
static unsigned long s_lastBackChange = 0;
static const int8_t s_encTable[16] = {
  0, -1,  1,  0,
  1,  0,  0, -1,
 -1,  0,  0,  1,
  0,  1, -1,  0
};
static const int8_t ENC_STEP_THRESHOLD = 4;
static const unsigned long ENC_STEP_DEBOUNCE_MS = 6;
static volatile int8_t s_encDelta = 0;
static uint8_t s_encIsrLastAB = 0x03;
static int64_t s_encIsrLastStepUs = 0;

static void animateFloat(float &value, float target, float tauMs) {
  if (value == target) return;
  float dt = s_animDtMs;
  if (dt < 1.0f) dt = 1.0f;
  float alpha = 1.0f - expf(-dt / tauMs);
  if (alpha > 1.0f) alpha = 1.0f;
  value += (target - value) * alpha;
  if (fabsf(value - target) < 0.15f) value = target;
}

static void beginViewTransition(DisplayView nextView, int direction) {
  if (nextView == s_view) return;
  s_prevView = s_view;
  s_view = nextView;
  s_transitionDir = direction;
  s_transitionStart = millis();
  s_isTransitioning = true;
}

static void drawWifiBars(int xOffset = 0) {
  if (WiFi.status() != WL_CONNECTED) {
    display.setCursor(xOffset + 110, 2);
    display.setTextColor(SSD1306_BLACK);
    display.print("OFF");
    display.setTextColor(SSD1306_WHITE);
    return;
  }

  int32_t rssi = WiFi.RSSI();
  int bars = 1;
  if (rssi > -60) bars = 3;
  else if (rssi > -80) bars = 2;

  for (int i = 0; i < bars; i++) {
    display.fillRect(xOffset + 112 + (i * 4), 8 - (i * 2), 2, 3 + (i * 2), SSD1306_BLACK);
  }
}

static void drawHeader(const char* title, int xOffset = 0) {
  display.fillRect(xOffset, 0, 128, 12, SSD1306_WHITE);
  display.setTextColor(SSD1306_BLACK);
  display.setTextSize(1);
  display.setCursor(xOffset + 4, 2);
  display.print(title);
  display.setTextColor(SSD1306_WHITE);
  drawWifiBars(xOffset);
  if (isAlarmOn) {
    display.fillCircle(xOffset + 124, 2, 2, SSD1306_BLACK);
  }
}

static void drawHintBar(const char* left, const char* center, const char* right, int xOffset = 0) {
  display.drawLine(xOffset, 54, xOffset + 128, 54, SSD1306_WHITE);
  display.setTextSize(1);
  display.setCursor(xOffset + 2, 57);
  display.print(left);
  display.setCursor(xOffset + 50, 57);
  display.print(center);
  display.setCursor(xOffset + 104, 57);
  display.print(right);
}

static void drawMenuItem(int xOffset, int y, const char* title, bool selected) {
  display.setTextColor(selected ? SSD1306_BLACK : SSD1306_WHITE);
  display.setCursor(xOffset + 10, y + 3);
  display.print(title);
  display.setTextColor(SSD1306_WHITE);
}

static void drawMenuPage(int xOffset = 0) {
  static const char* items[2] = {"Environment", "System Status"};
  float targetY = 18.0f + (14.0f * s_menuIndex);
  animateFloat(s_menuHighlightY, targetY, 120.0f);

  drawHeader("MENU", xOffset);
  display.fillRoundRect(xOffset + 6, (int)s_menuHighlightY, 116, 10, 3, SSD1306_WHITE);
  drawMenuItem(xOffset, 16, items[0], s_menuIndex == 0);
  drawMenuItem(xOffset, 30, items[1], s_menuIndex == 1);
  // no hint bar
}

static void drawSystemPage(float humidity, int smoke, float dewPoint, int xOffset = 0) {
  drawHeader("STATUS", xOffset);
  if (s_netPopupVisible || s_volPopupVisible) {
    // 弹窗显示期间暂停列表绘制，减少视觉冲突与负载
    display.setTextColor(SSD1306_WHITE);
  } else {
  char lines[5][24];
  snprintf(lines[0], sizeof(lines[0]), "VOL   %d", getSoundVolume());
  snprintf(lines[1], sizeof(lines[1]), "MODE  %s", g_workMode.c_str());
  snprintf(lines[2], sizeof(lines[2]), "ALARM %s", g_alarmMode.c_str());
  snprintf(lines[3], sizeof(lines[3]), "NET   %s", WiFi.status() == WL_CONNECTED ? "ON" : "OFF");
  snprintf(lines[4], sizeof(lines[4]), "SAFE  %s", (smoke > 2500 || humidity > 85) ? "WATCH" : "OK");
  const int itemCount = 5;
  const int visibleCount = 3;
  const float lineHeight = 11.0f;
  int startIndex = 0;
  if (s_sysIndex > 1) startIndex = s_sysIndex - 1;
  if (startIndex > itemCount - visibleCount) startIndex = itemCount - visibleCount;
  const float listTarget = startIndex * lineHeight;
  const float boxTargetY = 19.0f + s_sysIndex * lineHeight - listTarget;
  animateFloat(s_sysScrollY, listTarget, 140.0f);
  animateFloat(s_sysBoxY, boxTargetY, 110.0f);
  int16_t bx1 = 0, by1 = 0;
  uint16_t bw = 0, bh = 0;
  display.getTextBounds(lines[s_sysIndex], 0, 0, &bx1, &by1, &bw, &bh);
  float boxTargetW = (float)bw + 16.0f;
  if (boxTargetW > 116.0f) boxTargetW = 116.0f;
  if (boxTargetW < 40.0f) boxTargetW = 40.0f;
  animateFloat(s_sysBoxW, boxTargetW, 140.0f);
  display.fillRoundRect(xOffset + 6, (int)(s_sysBoxY - 1.0f), (int)s_sysBoxW, 10, 3, SSD1306_WHITE);
  for (int i = 0; i < itemCount; i++) {
    int y = (int)(19 + i * lineHeight - s_sysScrollY);
    if (y < 17 || y > 47) continue;
    display.setTextColor(i == s_sysIndex ? SSD1306_BLACK : SSD1306_WHITE);
    display.setCursor(xOffset + 10, y);
    display.print(lines[i]);
  }
    display.setTextColor(SSD1306_WHITE);
  }
  if (s_volPopupVisible || s_volPopupY < 63.0f) {
    animateFloat(s_volPopupY, s_volPopupTargetY, 120.0f);
    int popupY = (int)s_volPopupY;
    if (popupY < 54) {
      display.fillRoundRect(xOffset + 10, popupY, 108, 28, 3, SSD1306_WHITE);
      display.setTextColor(SSD1306_BLACK);
      display.setTextSize(1);
      display.setCursor(xOffset + 16, popupY + 6);
      display.print("Volume");
      display.setCursor(xOffset + 16, popupY + 16);
      display.print(getSoundVolume());
      display.setTextColor(SSD1306_WHITE);
    }
  }
  if (s_netPopupVisible || s_netPopupY < 63.0f) {
    animateFloat(s_netPopupY, s_netPopupTargetY, 120.0f);
    int popupY = (int)s_netPopupY;
    if (popupY < 54) {
      display.fillRoundRect(xOffset + 10, popupY, 108, 28, 3, SSD1306_WHITE);
      display.setTextColor(SSD1306_BLACK);
      display.setTextSize(1);
      display.setCursor(xOffset + 16, popupY + 6);
      display.print("WiFi");
      display.setCursor(xOffset + 16, popupY + 16);
      display.print(WiFi.status() == WL_CONNECTED ? "ONLINE" : "OFFLINE");
      display.setTextColor(SSD1306_WHITE);
    }
  }
  // no hint bar
}

static void drawAlertPage(int smoke, int xOffset = 0) {
  drawHeader("ALERT", xOffset);
  display.drawRoundRect(xOffset + 6, 16, 116, 36, 4, SSD1306_WHITE);
  display.drawBitmap(xOffset + 14, 26, icon_warn, 16, 16, SSD1306_WHITE);
  display.setTextSize(2);
  display.setCursor(xOffset + 36, 22);
  display.print("WARN");
  display.setTextSize(1);
  display.setCursor(xOffset + 18, 44);
  if (smoke > 2500) {
    display.print("Smoke threshold exceeded");
  } else {
    display.print("Alarm mode active");
  }
  // no hint bar
}

static void drawAlarmPopupOverlay(int xOffset = 0) {
  unsigned long nowMs = millis();
  if (!s_alarmPopupHasCache) {
    if (!alarmPopupPeek(&s_alarmPopupCache) || !s_alarmPopupCache.active) {
      return;
    }
    s_alarmPopupHasCache = true;
    s_alarmPopupTargetY = 22.0f;
  }

  if (nowMs - s_alarmPopupCache.timestamp > 4000) {
    alarmPopupClear();
    s_alarmPopupHasCache = false;
    s_alarmPopupTargetY = 64.0f;
    return;
  }

  animateFloat(s_alarmPopupY, s_alarmPopupTargetY, 120.0f);
  int popupY = (int)s_alarmPopupY;
  if (popupY < 54) {
    display.fillRoundRect(xOffset + 8, popupY, 112, 30, 3, SSD1306_WHITE);
    display.setTextColor(SSD1306_BLACK);
    display.setTextSize(1);
    display.setCursor(xOffset + 14, popupY + 6);
    display.print(s_alarmPopupCache.title);
    display.setCursor(xOffset + 14, popupY + 18);
    const char* msg = s_alarmPopupCache.message;
    size_t len = strlen(msg);
    if (len > 18) {
      static char scrollBuf[24];
      int shift = (nowMs / 200) % (int)len;
      for (int i = 0; i < 18; ++i) {
        scrollBuf[i] = msg[(shift + i) % len];
      }
      scrollBuf[18] = '\0';
      display.print(scrollBuf);
    } else {
      display.print(msg);
    }
    display.setTextColor(SSD1306_WHITE);
  }
}

void initDisplay() {
  Wire1.begin(OLED_SDA, OLED_SCL);
  Wire1.setClock(1000000);
  if (!display.begin(0x3C, true) && !display.begin(0x3D, true)) {
    LOG_E("Display", "SH1106 allocation failed");
    for (;;) {}
  }
  LOG_I("Display", "SH1106 initialized");
  display.clearDisplay();
  display.display();
}

void renderDisplayIdle(const char* title, const char* subtitle) {
  display.clearDisplay();
  drawHeader(title ? title : "START");
  display.drawRoundRect(10, 18, 108, 30, 4, SSD1306_WHITE);
  display.setTextSize(2);
  display.setCursor(24, 24);
  display.print("Wouo");
  display.setTextSize(1);
  display.setCursor(18, 40);
  display.print(subtitle ? subtitle : "Waiting data");
  // no hint bar
  display.display();
}

void displayPrevPage() {
  if (s_view == VIEW_MENU) {
    if (s_menuIndex > 0) s_menuIndex--;
    return;
  }
  if (s_view == VIEW_ENV) {
    if (s_envIndex > 0) s_envIndex--;
    return;
  }
  if (s_view == VIEW_SYSTEM) {
    if (s_sysIndex > 0) s_sysIndex--;
    return;
  }
}

void displayNextPage() {
  if (s_view == VIEW_MENU) {
    if (s_menuIndex < 1) s_menuIndex++;
    return;
  }
  if (s_view == VIEW_ENV) {
    if (s_envIndex < 5) s_envIndex++;
    return;
  }
  if (s_view == VIEW_SYSTEM) {
    if (s_sysIndex < 4) s_sysIndex++;
    return;
  }
}

void displayConfirm() {
  if (s_view == VIEW_ALERT) {
    beginViewTransition(VIEW_MENU, -1);
    return;
  }
  if (s_view == VIEW_MENU) {
    if (s_menuIndex == 0) {
      s_envIndex = 0;
      s_envScrollY = 0.0f;
      beginViewTransition(VIEW_ENV, 1);
    } else {
      s_sysIndex = 0;
      s_sysScrollY = 0.0f;
      beginViewTransition(VIEW_SYSTEM, 1);
    }
  } else {
    if (s_view == VIEW_SYSTEM && s_sysIndex == 0) {
      s_volPopupVisible = !s_volPopupVisible;
      s_volPopupTargetY = s_volPopupVisible ? 22.0f : 64.0f;
      if (s_volPopupVisible) {
        s_netPopupVisible = false;
        s_netPopupTargetY = 64.0f;
      }
      return;
    }
    if (s_view == VIEW_SYSTEM && s_sysIndex == 3) {
      s_netPopupVisible = !s_netPopupVisible;
      s_netPopupTargetY = s_netPopupVisible ? 22.0f : 64.0f;
      if (s_netPopupVisible) {
        s_volPopupVisible = false;
        s_volPopupTargetY = 64.0f;
      }
      return;
    }
    beginViewTransition(VIEW_MENU, -1);
  }
}

void displayBack() {
  if (s_view == VIEW_ALERT) {
    beginViewTransition(VIEW_MENU, -1);
    return;
  }
  if (s_volPopupVisible) {
    s_volPopupVisible = false;
    s_volPopupTargetY = 64.0f;
    return;
  }
  if (s_netPopupVisible) {
    s_netPopupVisible = false;
    s_netPopupTargetY = 64.0f;
    return;
  }
  AlarmPopup popup;
  if (alarmPopupPeek(&popup) && popup.active) {
    alarmPopupClear();
    s_alarmPopupTargetY = 64.0f;
    return;
  }
  if (s_view != VIEW_MENU) {
    beginViewTransition(VIEW_MENU, -1);
  }
}

void displayHandleNavigation(bool configPressed, bool backPressed, uint8_t encA, uint8_t encB, unsigned long nowMs) {
  if (configPressed != s_lastConfigPressed && (nowMs - s_lastConfigChange) > BTN_DEBOUNCE_TIME) {
    s_lastConfigChange = nowMs;
    s_lastConfigPressed = configPressed;
    if (configPressed) {
      displayConfirm();
    }
  }

  if (backPressed != s_lastBackPressed && (nowMs - s_lastBackChange) > BTN_DEBOUNCE_TIME) {
    s_lastBackChange = nowMs;
    s_lastBackPressed = backPressed;
    if (backPressed) {
      displayBack();
    }
  }
}

void IRAM_ATTR displayOnEncoderEdge() {
  uint8_t a = gpio_get_level((gpio_num_t)EC11_A_PIN) ? 1 : 0;
  uint8_t b = gpio_get_level((gpio_num_t)EC11_B_PIN) ? 1 : 0;
  uint8_t currAB = (a << 1) | b;
  if (currAB != s_encIsrLastAB) {
    uint8_t idx = (s_encIsrLastAB << 2) | currAB;
    s_encAccum += s_encTable[idx];
    s_encIsrLastAB = currAB;
    int64_t nowUs = esp_timer_get_time();
    if (s_encAccum >= ENC_STEP_THRESHOLD) {
      if (nowUs - s_encIsrLastStepUs > (int64_t)ENC_STEP_DEBOUNCE_MS * 1000) {
        s_encIsrLastStepUs = nowUs;
        s_encAccum = 0;
        if (s_encDelta < 127) s_encDelta++;
      }
    } else if (s_encAccum <= -ENC_STEP_THRESHOLD) {
      if (nowUs - s_encIsrLastStepUs > (int64_t)ENC_STEP_DEBOUNCE_MS * 1000) {
        s_encIsrLastStepUs = nowUs;
        s_encAccum = 0;
        if (s_encDelta > -127) s_encDelta--;
      }
    }
  }
}

int8_t displayConsumeEncoderDelta() {
  int8_t delta = s_encDelta;
  s_encDelta = 0;
  return delta;
}

void displayApplyEncoderDelta(int8_t delta) {
  if (delta == 0) return;
  if (s_view == VIEW_SYSTEM && s_volPopupVisible) {
    int step = (delta > 0) ? 1 : -1;
    int oldVol = getSoundVolume();
    int newVol = changeSoundVolume(step);
    if (newVol != oldVol) {
      unsigned long nowMs = millis();
      if (nowMs - s_lastVolBeepMs > 60) {
        s_lastVolBeepMs = nowMs;
        playSoundTone(1800, 30);
      }
    }
    return;
  }

  if (delta > 0) {
    displayNextPage();
  } else if (delta < 0) {
    displayPrevPage();
  }
}

static void drawEnvPageData(float temperature, float humidity, float pressure, float lux, int smoke, float dewPoint, int xOffset) {
  drawHeader("SENSORS", xOffset);
  char lines[6][28];
  snprintf(lines[0], sizeof(lines[0]), "TEMP  %.1f C", temperature);
  snprintf(lines[1], sizeof(lines[1]), "HUMI  %.0f %%", humidity);
  snprintf(lines[2], sizeof(lines[2]), "PRES  %.0f hPa", pressure);
  snprintf(lines[3], sizeof(lines[3]), "LUX   %d", (int)lux);
  snprintf(lines[4], sizeof(lines[4]), "SMOKE %d", smoke);
  snprintf(lines[5], sizeof(lines[5]), "DEW   %.1f C", dewPoint);
  const int itemCount = 6;
  const int visibleCount = 3;
  const float lineHeight = 11.0f;
  int startIndex = 0;
  if (s_envIndex > 1) startIndex = s_envIndex - 1;
  if (startIndex > itemCount - visibleCount) startIndex = itemCount - visibleCount;
  const float listTarget = startIndex * lineHeight;
  const float boxTargetY = 19.0f + s_envIndex * lineHeight - listTarget;
  animateFloat(s_envScrollY, listTarget, 140.0f);
  animateFloat(s_envBoxY, boxTargetY, 110.0f);
  int16_t bx1 = 0, by1 = 0;
  uint16_t bw = 0, bh = 0;
  display.getTextBounds(lines[s_envIndex], 0, 0, &bx1, &by1, &bw, &bh);
  float boxTargetW = (float)bw + 16.0f;
  if (boxTargetW > 116.0f) boxTargetW = 116.0f;
  if (boxTargetW < 40.0f) boxTargetW = 40.0f;
  animateFloat(s_envBoxW, boxTargetW, 140.0f);
  display.fillRoundRect(xOffset + 6, (int)(s_envBoxY - 1.0f), (int)s_envBoxW, 10, 3, SSD1306_WHITE);
  for (int i = 0; i < itemCount; i++) {
    int y = (int)(19 + i * lineHeight - s_envScrollY);
    if (y < 17 || y > 47) continue;
    display.setTextColor(i == s_envIndex ? SSD1306_BLACK : SSD1306_WHITE);
    display.setCursor(xOffset + 10, y);
    display.print(lines[i]);
  }
  display.setTextColor(SSD1306_WHITE);
  // no hint bar
}

static void drawView(DisplayView view, float temperature, float humidity, float pressure, float lux, int smoke, float dewPoint, int xOffset) {
  if (view == VIEW_MENU) {
    drawMenuPage(xOffset);
  } else if (view == VIEW_ENV) {
    drawEnvPageData(temperature, humidity, pressure, lux, smoke, dewPoint, xOffset);
  } else if (view == VIEW_SYSTEM) {
    drawSystemPage(humidity, smoke, dewPoint, xOffset);
  } else {
    drawAlertPage(smoke, xOffset);
  }
}

void updateDisplay(float temperature, float humidity, float pressure, float lux, int smoke, float dewPoint) {
  unsigned long nowMs = millis();
  if (s_lastAnimMs == 0) {
    s_animDtMs = 16.0f;
  } else {
    s_animDtMs = (float)(nowMs - s_lastAnimMs);
    if (s_animDtMs < 1.0f) s_animDtMs = 1.0f;
  }
  s_lastAnimMs = nowMs;

  display.clearDisplay();

  if (s_view == VIEW_ALERT) {
    s_view = VIEW_MENU;
  }

  if (s_isTransitioning) {
    unsigned long elapsed = millis() - s_transitionStart;
    if (elapsed >= TRANSITION_MS) {
      s_isTransitioning = false;
      drawView(s_view, temperature, humidity, pressure, lux, smoke, dewPoint, 0);
    } else {
      float progress = (float)elapsed / (float)TRANSITION_MS;
      int incomingX = (int)((1.0f - progress) * 128.0f * s_transitionDir);
      int outgoingX = incomingX - (128 * s_transitionDir);
      drawView(s_prevView, temperature, humidity, pressure, lux, smoke, dewPoint, outgoingX);
      drawView(s_view, temperature, humidity, pressure, lux, smoke, dewPoint, incomingX);
    }
  } else {
    drawView(s_view, temperature, humidity, pressure, lux, smoke, dewPoint, 0);
  }

  drawAlarmPopupOverlay(0);

  display.display();
}
