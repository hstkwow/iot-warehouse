#ifndef SENSOR_SNAPSHOT_H
#define SENSOR_SNAPSHOT_H

#include <Arduino.h>

struct SensorData {
  float temperature;
  float humidity;
  float pressure;
  float lux;
  float dewPoint;
  int smoke;
  bool valid;
};

void sensorSnapshotInit();
void sensorSnapshotSet(const SensorData& sensorData);
void sensorSnapshotSet(float temperature, float humidity, float pressure, float lux, int smoke, float dewPoint);
bool sensorSnapshotGet(SensorData &out);

#endif
