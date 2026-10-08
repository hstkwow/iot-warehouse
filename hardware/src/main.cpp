#include <Arduino.h>
#include <esp_task_wdt.h>  
#include <freertos/FreeRTOS.h>
#include <freertos/task.h>
#include "config.h"
#include "logger.h"
#include "sensor_module.h"
#include "sensor_snapshot.h"
#include "display_module.h"
#include "network_module.h"
#include "rgb_module.h"
#include "sound_output_module.h"
#include "alarm_module.h"
#include "sound_input_module.h"
#include "rfid_module.h" 

// MQTT 任务
static void taskMqtt(void *param) {
  (void)param;
  static bool s_networkInited = false;
  if (!s_networkInited) {
    setupWiFi();
    setupMQTT();
    s_networkInited = true;
  }
  for (;;) {
    checkNetwork();        // 仅负责 MQTT/WiFi 保活与重连
    processMqttPublish();  // 独立处理周期上报与快速上报
    vTaskDelay(pdMS_TO_TICKS(200));
  }
}

// 传感器任务
static void taskSensor(void *param) {
  (void)param;
  unsigned long lastUpdateTime = 0;
  const unsigned long sampleInterval = SENSOR_SAMPLE_INTERVAL;

  for (;;) {
    unsigned long currentMillis = millis();
    if (currentMillis - lastUpdateTime >= sampleInterval) {
      lastUpdateTime = currentMillis;

      SensorData sensorData;
      if (readAllSensors(sensorData)) {
        checkAlarms(sensorData);
        updateSensorSnapshot(sensorData);
      }
    }

    vTaskDelay(pdMS_TO_TICKS(10));
  }
}

// RFID 任务
static void taskRfid(void *param) {
  (void)param;
  for (;;) {
    handleRfidOperation();
    vTaskDelay(pdMS_TO_TICKS(10));
  }
}

// 声音输出任务
static void taskSoundOutput(void *param) {
  (void)param;
  for (;;) {
    processSoundOutput();       // 处理声音输出缓冲和播放状态
    updateAlarmSound();         // 报警音统一放在语音线程，避免多线程抢音频
    vTaskDelay(pdMS_TO_TICKS(10));
  }
}

// 声音输入任务
static void taskSoundInput(void *param) {
  (void)param;
  for (;;) {
    handleSoundInputControl(true);
    vTaskDelay(pdMS_TO_TICKS(20));
  }
}

// 显示任务
static void taskDisplay(void *param) {
  (void)param;
  SensorData localSensorData;
  SensorData lastSensorData{};
  bool hasSnapshot = false;
  unsigned long lastDisplayUpdate = 0;

  for (;;) {
    const unsigned long nowMs = millis();
    bool configPressed = (digitalRead(CONFIG_PIN) == LOW);
    bool backPressed = (digitalRead(BACK_PIN) == LOW);
    displayHandleNavigation(configPressed, backPressed, 0, 0, nowMs);
    int8_t delta = displayConsumeEncoderDelta();
    displayApplyEncoderDelta(delta);

    if (nowMs - lastDisplayUpdate >= 16) {
      lastDisplayUpdate = nowMs;
      if (sensorSnapshotGet(localSensorData)) {
        lastSensorData = localSensorData;
        hasSnapshot = true;
      }
      if (hasSnapshot) {
        updateDisplay(
          lastSensorData.temperature,
          lastSensorData.humidity,
          lastSensorData.pressure,
          lastSensorData.lux,
          lastSensorData.smoke,
          lastSensorData.dewPoint
        );
      } else {
        updateDisplay(0.0f, 0.0f, 0.0f, 0.0f, 0, 0.0f);
      }
    }

    vTaskDelay(pdMS_TO_TICKS(10));
  }
}

// 初始化
void setup() {
  Serial.begin(115200);     // 初始化串口用于调试
  log_set_level(LOG_INFO);  // 默认输出 INFO/WARN/ERROR，调试时可改成 LOG_DEBUG
  log_set_show_timestamp(false);  // 串口默认短输出
  log_set_show_thread(false);     // 调试多任务时再打开

  sensorSnapshotInit();   

  pinMode(BTN_PIN, INPUT_PULLUP);
  pinMode(EC11_A_PIN, INPUT_PULLUP);
  pinMode(EC11_B_PIN, INPUT_PULLUP);
  pinMode(EC11_SW_PIN, INPUT_PULLUP);
  pinMode(CONFIG_PIN, INPUT_PULLUP);
  pinMode(BACK_PIN, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(EC11_A_PIN), displayOnEncoderEdge, CHANGE);
  attachInterrupt(digitalPinToInterrupt(EC11_B_PIN), displayOnEncoderEdge, CHANGE);

  initRGB();        // 初始化 RGB，方便指示状态
  initSensors();    // 传感器模块需要在网络模块之前初始化，以便在网络模块中读取传感器状态并显示
  initDisplay();    // 显示模块需要在网络模块之后初始化，以便显示网络状态
  
  initSoundOutput(); // 初始化声音输出
  initAlarm();      // 初始化报警模块
  initRfid();       // 初始化 RFID
  initSoundInput();  // 初始化声音输入和语音识别
  //playStartupSound(); // 开机提示音

  // 使用多任务架构：网络、采集、显示、RFID、声音输入/输出互不阻塞
  xTaskCreatePinnedToCore(taskMqtt,        "taskMqtt",        4096,  nullptr, 2, nullptr, 0);
  xTaskCreatePinnedToCore(taskSoundInput,  "taskSoundInput",  12288, nullptr, 1, nullptr, 0);
  xTaskCreatePinnedToCore(taskSensor,      "taskSensor",      4096,  nullptr, 1, nullptr, 1);
  xTaskCreatePinnedToCore(taskRfid,        "taskRfid",        4096,  nullptr, 2, nullptr, 1);
  xTaskCreatePinnedToCore(taskDisplay,     "taskDisplay",     4096,  nullptr, 2, nullptr, 1);
  xTaskCreatePinnedToCore(taskSoundOutput, "taskSoundOutput", 4096,  nullptr, 2, nullptr, 1);
}

void loop() {
  // 主循环留空，调度由 FreeRTOS 任务接管
  vTaskDelay(pdMS_TO_TICKS(1000));
}
