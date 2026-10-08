#include "data_payload.h"

namespace {
String jsonEscape(const String& value) {
  String escaped;
  escaped.reserve(value.length() + 8);
  for (size_t i = 0; i < value.length(); i++) {
    char c = value.charAt(i);
    if (c == '"' || c == '\\') {
      escaped += '\\';
    }
    escaped += c;
  }
  return escaped;
}

void appendStringField(String& json, const char* key, const String& value, bool comma = true) {
  json += "\"";
  json += key;
  json += "\":\"";
  json += jsonEscape(value);
  json += "\"";
  if (comma) json += ",";
}

void appendBoolField(String& json, const char* key, bool value, bool comma = true) {
  json += "\"";
  json += key;
  json += "\":";
  json += value ? "true" : "false";
  if (comma) json += ",";
}
}

namespace DataPayload {
String buildStatePayload(const SensorData* sensorData, bool alarmState, bool ledState,
                         const String& workMode, const String& alarmMode) {
  String json = "{";
  if (sensorData && sensorData->valid) {
    json += "\""; json += Field::TEMPERATURE; json += "\":"; json += String(sensorData->temperature, 1); json += ",";
    json += "\""; json += Field::HUMIDITY; json += "\":"; json += String(sensorData->humidity, 1); json += ",";
    json += "\""; json += Field::PRESSURE; json += "\":"; json += String(sensorData->pressure, 0); json += ",";
    json += "\""; json += Field::LUX; json += "\":"; json += String((int)sensorData->lux); json += ",";
    json += "\""; json += Field::SMOKE; json += "\":"; json += String(sensorData->smoke); json += ",";
    json += "\""; json += Field::DEW_POINT; json += "\":"; json += String(sensorData->dewPoint, 1); json += ",";
  }
  appendBoolField(json, Field::LED, ledState);
  appendBoolField(json, Field::ALARM, alarmState);
  appendStringField(json, Field::WORK_MODE, workMode);
  appendStringField(json, Field::ALARM_MODE, alarmMode, false);
  json += "}";
  return json;
}

String buildRfidPayload(const String& rawData, const String& cardId, const String& source) {
  String json = "{";
  appendStringField(json, Field::CARD_ID, cardId);
  appendStringField(json, Field::RAW_DATA, rawData);
  appendStringField(json, Field::SOURCE, source, false);
  json += "}";
  return json;
}

String buildAlarmEventPayload(const char* alarmType, int severity, const char* content) {
  String json = "{";
  appendBoolField(json, Field::ALARM_EVENT, true);
  appendStringField(json, Field::ALARM_TYPE, String(alarmType));
  json += "\""; json += Field::SEVERITY; json += "\":"; json += String(severity); json += ",";
  appendStringField(json, Field::CONTENT, String(content), false);
  json += "}";
  return json;
}

String buildPresencePayload(const char* status, const String& mac) {
  String json = "{";
  appendStringField(json, Field::STATUS, String(status));
  appendStringField(json, Field::MAC, mac, false);
  json += "}";
  return json;
}
}
