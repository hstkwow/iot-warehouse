#include "sensor_snapshot.h"
#include <math.h>
#include <freertos/FreeRTOS.h>
#include <freertos/semphr.h>

static SensorData g_snapshot = {0.0f, 0.0f, 0.0f, 0.0f, 0.0f, 0, false};
static SemaphoreHandle_t g_snapshotMutex = nullptr;

static inline float safeFloat(float v) {
  return isnan(v) ? 0.0f : v;
}

void sensorSnapshotInit() {
  if (!g_snapshotMutex) {
    g_snapshotMutex = xSemaphoreCreateMutex();
  }
}

void sensorSnapshotSet(const SensorData& sensorData) {
  if (!g_snapshotMutex) {
    sensorSnapshotInit();
  }
  if (g_snapshotMutex && xSemaphoreTake(g_snapshotMutex, pdMS_TO_TICKS(20)) == pdTRUE) {
    g_snapshot.temperature = safeFloat(sensorData.temperature);
    g_snapshot.humidity = safeFloat(sensorData.humidity);
    g_snapshot.pressure = safeFloat(sensorData.pressure);
    g_snapshot.lux = safeFloat(sensorData.lux);
    g_snapshot.smoke = sensorData.smoke;
    g_snapshot.dewPoint = safeFloat(sensorData.dewPoint);
    g_snapshot.valid = true;
    xSemaphoreGive(g_snapshotMutex);
  }
}

void sensorSnapshotSet(float temperature, float humidity, float pressure, float lux, int smoke, float dewPoint) {
  SensorData sensorData{temperature, humidity, pressure, lux, dewPoint, smoke, true};
  sensorSnapshotSet(sensorData);
}

bool sensorSnapshotGet(SensorData &out) {
  if (!g_snapshotMutex) {
    return false;
  }
  if (xSemaphoreTake(g_snapshotMutex, pdMS_TO_TICKS(20)) != pdTRUE) {
    return false;
  }
  const bool valid = g_snapshot.valid;
  if (valid) {
    out = g_snapshot;
  }
  xSemaphoreGive(g_snapshotMutex);
  return valid;
}
