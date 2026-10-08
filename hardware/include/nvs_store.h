#ifndef NVS_STORE_H
#define NVS_STORE_H

#include <Arduino.h>

struct NvsStoreData {
  float tempMax;
  float tempMin;
  float humidityMax;
  float smokeThreshold;
  float pressureMax;
  float dewPointMax;
  float luxMax;
  String alarmMode;
  String workMode;
  int volume;
};

namespace NvsStoreKeys {
  static constexpr const char* NAMESPACE = "thresholds";
  static constexpr const char* TEMP_MAX = "tempMax";
  static constexpr const char* TEMP_MIN = "tempMin";
  static constexpr const char* HUMIDITY_MAX = "humiMax";
  static constexpr const char* SMOKE_THRESHOLD = "smoke";
  static constexpr const char* PRESSURE_MAX = "pressMax";
  static constexpr const char* DEW_POINT_MAX = "dewMax";
  static constexpr const char* LUX_MAX = "luxMax";
  static constexpr const char* ALARM_MODE = "alarmMode";
  static constexpr const char* WORK_MODE = "workMode";
  static constexpr const char* VOLUME = "volume";
}

NvsStoreData nvsStoreDefaults();
bool nvsStoreLoad(NvsStoreData& data);
bool nvsStoreSave(const NvsStoreData& data);
int nvsStoreLoadVolume();
bool nvsStoreSaveVolume(int volume);

#endif
