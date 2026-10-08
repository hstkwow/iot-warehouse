#include "nvs_store.h"

#include <Preferences.h>

#include "config.h"
#include "logger.h"

static const char* TAG_NVS = "NVS";

static int clampVolume(int volume) {
  if (volume < MIN_VOLUME) return MIN_VOLUME;
  if (volume > MAX_VOLUME) return MAX_VOLUME;
  return volume;
}

static String normalizeAlarmMode(const String& mode) {
  return mode == "manual" ? "manual" : "auto";
}

static String normalizeWorkMode(const String& mode) {
  if (mode == "inbound" || mode == "outbound" || mode == "both") {
    return mode;
  }
  return "inbound";
}

NvsStoreData nvsStoreDefaults() {
  NvsStoreData data;
  data.tempMax = DEFAULT_TEMP_MAX;
  data.tempMin = DEFAULT_TEMP_MIN;
  data.humidityMax = DEFAULT_HUMIDITY_MAX;
  data.smokeThreshold = DEFAULT_SMOKE_THRESHOLD;
  data.pressureMax = DEFAULT_PRESSURE_MAX;
  data.dewPointMax = DEFAULT_DEW_POINT_MAX;
  data.luxMax = DEFAULT_LUX_MAX;
  data.alarmMode = "auto";
  data.workMode = "inbound";
  data.volume = DEFAULT_VOLUME;
  return data;
}

bool nvsStoreLoad(NvsStoreData& data) {
  data = nvsStoreDefaults();

  Preferences preferences;
  if (!preferences.begin(NvsStoreKeys::NAMESPACE, true)) {
    LOG_E(TAG_NVS, "Open namespace failed: %s", NvsStoreKeys::NAMESPACE);
    return false;
  }

  data.tempMax = preferences.getFloat(NvsStoreKeys::TEMP_MAX, data.tempMax);
  data.tempMin = preferences.getFloat(NvsStoreKeys::TEMP_MIN, data.tempMin);
  data.humidityMax = preferences.getFloat(NvsStoreKeys::HUMIDITY_MAX, data.humidityMax);
  data.smokeThreshold = preferences.getFloat(NvsStoreKeys::SMOKE_THRESHOLD, data.smokeThreshold);
  data.pressureMax = preferences.getFloat(NvsStoreKeys::PRESSURE_MAX, data.pressureMax);
  data.dewPointMax = preferences.getFloat(NvsStoreKeys::DEW_POINT_MAX, data.dewPointMax);
  data.luxMax = preferences.getFloat(NvsStoreKeys::LUX_MAX, data.luxMax);
  data.alarmMode = normalizeAlarmMode(preferences.getString(NvsStoreKeys::ALARM_MODE, data.alarmMode));
  data.workMode = normalizeWorkMode(preferences.getString(NvsStoreKeys::WORK_MODE, data.workMode));
  data.volume = clampVolume(preferences.getInt(NvsStoreKeys::VOLUME, data.volume));
  preferences.end();

  LOG_I(TAG_NVS, "Loaded: TMax=%.1f TMin=%.1f HMax=%.0f Smoke=%.0f PMax=%.0f DPMax=%.1f LuxMax=%.0f Mode=%s Alarm=%s Vol=%d",
        data.tempMax, data.tempMin, data.humidityMax, data.smokeThreshold,
        data.pressureMax, data.dewPointMax, data.luxMax,
        data.workMode.c_str(), data.alarmMode.c_str(), data.volume);
  return true;
}

bool nvsStoreSave(const NvsStoreData& input) {
  NvsStoreData data = input;
  data.alarmMode = normalizeAlarmMode(data.alarmMode);
  data.workMode = normalizeWorkMode(data.workMode);
  data.volume = clampVolume(data.volume);

  Preferences preferences;
  if (!preferences.begin(NvsStoreKeys::NAMESPACE, false)) {
    LOG_E(TAG_NVS, "Open namespace failed: %s", NvsStoreKeys::NAMESPACE);
    return false;
  }

  bool ok = true;
  ok &= preferences.putFloat(NvsStoreKeys::TEMP_MAX, data.tempMax) > 0;
  ok &= preferences.putFloat(NvsStoreKeys::TEMP_MIN, data.tempMin) > 0;
  ok &= preferences.putFloat(NvsStoreKeys::HUMIDITY_MAX, data.humidityMax) > 0;
  ok &= preferences.putFloat(NvsStoreKeys::SMOKE_THRESHOLD, data.smokeThreshold) > 0;
  ok &= preferences.putFloat(NvsStoreKeys::PRESSURE_MAX, data.pressureMax) > 0;
  ok &= preferences.putFloat(NvsStoreKeys::DEW_POINT_MAX, data.dewPointMax) > 0;
  ok &= preferences.putFloat(NvsStoreKeys::LUX_MAX, data.luxMax) > 0;
  ok &= preferences.putString(NvsStoreKeys::ALARM_MODE, data.alarmMode) > 0;
  ok &= preferences.putString(NvsStoreKeys::WORK_MODE, data.workMode) > 0;
  ok &= preferences.putInt(NvsStoreKeys::VOLUME, data.volume) > 0;
  preferences.end();

  if (ok) {
    LOG_I(TAG_NVS, "Saved config");
  } else {
    LOG_W(TAG_NVS, "Saved config with partial write warning");
  }
  return ok;
}

int nvsStoreLoadVolume() {
  NvsStoreData data;
  nvsStoreLoad(data);
  return data.volume;
}

bool nvsStoreSaveVolume(int volume) {
  NvsStoreData data;
  nvsStoreLoad(data);
  data.volume = clampVolume(volume);
  return nvsStoreSave(data);
}
