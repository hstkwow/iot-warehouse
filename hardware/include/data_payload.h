#ifndef DATA_PAYLOAD_H
#define DATA_PAYLOAD_H

#include <Arduino.h>
#include "sensor_snapshot.h"

namespace DataPayload {
namespace Field {
  static constexpr const char* TEMPERATURE = "temperature";
  static constexpr const char* HUMIDITY = "humidity";
  static constexpr const char* PRESSURE = "pressure";
  static constexpr const char* LUX = "lux";
  static constexpr const char* SMOKE = "smoke";
  static constexpr const char* DEW_POINT = "dewPoint";
  static constexpr const char* LED = "led";
  static constexpr const char* ALARM = "alarm";
  static constexpr const char* WORK_MODE = "workMode";
  static constexpr const char* ALARM_MODE = "alarmMode";

  static constexpr const char* CARD_ID = "cardId";
  static constexpr const char* RAW_DATA = "rawData";
  static constexpr const char* SOURCE = "source";

  static constexpr const char* ALARM_EVENT = "alarm_event";
  static constexpr const char* ALARM_TYPE = "alarmType";
  static constexpr const char* SEVERITY = "severity";
  static constexpr const char* CONTENT = "content";

  static constexpr const char* STATUS = "status";
  static constexpr const char* MAC = "mac";

  static constexpr const char* CMD_ALARM_MODE = "alarm_mode";
  static constexpr const char* CMD_WORK_MODE = "work_mode";
  static constexpr const char* CMD_RFID_WRITE = "rfid_write";
  static constexpr const char* CMD_CONFIG = "config";
  static constexpr const char* CFG_TEMP_MAX = "tempMax";
  static constexpr const char* CFG_TEMP_MIN = "tempMin";
  static constexpr const char* CFG_HUMIDITY_MAX = "humidityMax";
  static constexpr const char* CFG_SMOKE_THRESHOLD = "smokeThreshold";
  static constexpr const char* CFG_PRESSURE_MAX = "pressureMax";
  static constexpr const char* CFG_DEW_POINT_MAX = "dewPointMax";
  static constexpr const char* CFG_LUX_MAX = "luxMax";
}

String buildStatePayload(const SensorData* sensorData, bool alarmState, bool ledState,
                         const String& workMode, const String& alarmMode);
String buildRfidPayload(const String& rawData, const String& cardId, const String& source);
String buildAlarmEventPayload(const char* alarmType, int severity, const char* content);
String buildPresencePayload(const char* status, const String& mac);
}

#endif
