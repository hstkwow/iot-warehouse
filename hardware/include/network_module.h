#ifndef NETWORK_MODULE_H
#define NETWORK_MODULE_H

#include <WiFi.h>
#include <AsyncMQTTClient.h>
#include "config.h"
#include "sensor_snapshot.h"

extern AsyncMqttClient mqttClient;
extern String g_deviceMAC;     // 设备 MAC 地址
extern String g_workMode;      // 工作模式 (inbound, outbound, both)
extern String g_alarmMode;     // 报警模式 (auto, manual)

//外部访问状态
extern bool isAlarmOn;
extern bool isLedOn;
// extern bool isAlarmAuto; // 使用 g_alarmMode == "auto" 判断
extern String pendingWriteData;

// 动态阈值变量（可通过 MQTT 远程配置）
extern float cfgTempMax;
extern float cfgTempMin;
extern float cfgHumidityMax;
extern float cfgSmokeThreshold;
extern float cfgPressureMax;
extern float cfgDewPointMax;
extern float cfgLuxMax;

void loadThresholds(); // 从 NVS 加载阈值
void saveThresholds(); // 将当前阈值写入NVS
void setupWiFi();
void setupMQTT();
void checkNetwork();
void processMqttPublish();
void updateSensorSnapshot(const SensorData& sensorData);
void updateSensorSnapshot(float temperature, float humidity, float pressure, float lux, int smoke, float dewPoint);
void publishData(float temperature, float humidity, float pressure, float lux, int smoke, float dewPoint, bool alarm, bool ledState);
void publishRfidData(String rawData, String cardId, String source = "read"); // 整合卡号和物资数据上报
void publishAlarmEvent(const char* alarmType, int severity, const char* content); // 上报报警事件

#endif
