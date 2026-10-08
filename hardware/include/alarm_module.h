#ifndef ALARM_MODULE_H
#define ALARM_MODULE_H

#include <Arduino.h>
#include "sensor_snapshot.h"

// 当前报警级别（外部可访问，用于手动关闭时重置）
extern int currentAlarmSeverity;

//初始化报警模块
void initAlarm();          

// 检查所有传感器报警条件，自动管理报警状态和音效
void checkAlarms(const SensorData& sensorData);
void checkAlarms(float temperature, float humidity, float pressure, float lux,
                 int smoke, float dewPoint);

// 更新报警音效：每2秒播放一次报警音（非阻塞）
void updateAlarmSound();

// 报警弹窗
typedef struct AlarmPopup {
  char title[16];
  char message[64];
  unsigned long timestamp;
  bool active;
} AlarmPopup;

bool alarmPopupPeek(AlarmPopup* out);
void alarmPopupClear();
void alarmPopupPush(const AlarmPopup* in);

#endif
