#ifndef SENSOR_MODULE_H
#define SENSOR_MODULE_H

#include <Arduino.h>
#include <Adafruit_AHTX0.h>
#include <Adafruit_BMP280.h>
#include <BH1750.h>
#include "config.h"
#include "sensor_snapshot.h"

extern Adafruit_AHTX0 aht;
extern Adafruit_BMP280 bmp;
extern BH1750 lightMeter;

void initSensors();

float readTemperature();    // 读取温度
float readHumidity();       // 读取湿度
float readPressure();       // 读取气压
float readLux();            // 读取光照
int readSmoke();            // 读取烟雾（MQ2）
float calculateDewPoint(float temp, float hum); // 计算露点

//传感器读取
bool readAllSensors(SensorData& sensorData);
bool readAllSensors(float &temperature, float &humidity, float &pressure,
                    float &lux, float &dewPoint, int &smoke);

#endif
