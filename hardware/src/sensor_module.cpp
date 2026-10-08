#include "sensor_module.h"
#include "logger.h"
#include <Wire.h>

Adafruit_AHTX0 aht;
Adafruit_BMP280 bmp; // I2C
BH1750 lightMeter;

void initSensors() {
  // --- I2C 总线 0 (Wire) ---
  // 用于: AHT20, BMP280, BH1750
  Wire.begin(I2C_SDA, I2C_SCL);

  // --- I2C 总线 1 (Wire1) ---
  // 保留给 OLED (38,39)

  pinMode(MQ_PIN, INPUT); // MQ2 模拟输入
  
  if (!aht.begin()) {
    LOG_E("Sensor", "Could not find AHT? Check wiring (SDA=%d, SCL=%d)", I2C_SDA, I2C_SCL);
  } else {
    LOG_I("Sensor", "AHT10/20 found");
  }

  // BMP280 初始化，尝试地址 0x77 或 0x76
  if (!bmp.begin(0x76) && !bmp.begin(0x77)) {
    LOG_E("Sensor", "Could not find BMP280, check wiring (SDA=%d, SCL=%d)!", I2C_SDA, I2C_SCL);
  } else {
    LOG_I("Sensor", "BMP280 found");
    /* Default settings from datasheet. */
    bmp.setSampling(Adafruit_BMP280::MODE_NORMAL,     /* Operating Mode. */
                    Adafruit_BMP280::SAMPLING_X2,     /* Temp. oversampling */
                    Adafruit_BMP280::SAMPLING_X16,    /* Pressure oversampling */
                    Adafruit_BMP280::FILTER_X16,      /* Filtering. */
                    Adafruit_BMP280::STANDBY_MS_500); /* Standby time. */
  }

  // BH1750 初始化 (使用 Wire)，尝试 0x23 / 0x5C
  if (lightMeter.begin(BH1750::CONTINUOUS_HIGH_RES_MODE, 0x23, &Wire)) {
    LOG_I("Sensor", "BH1750 initialized on Wire (SDA=%d,SCL=%d) addr=0x23", I2C_SDA, I2C_SCL);
  } else if (lightMeter.begin(BH1750::CONTINUOUS_HIGH_RES_MODE, 0x5C, &Wire)) {
    LOG_I("Sensor", "BH1750 initialized on Wire (SDA=%d,SCL=%d) addr=0x5C", I2C_SDA, I2C_SCL);
  } else {
    LOG_E("Sensor", "Error initialising BH1750 (addr 0x23/0x5C)");
  }
  
  LOG_I("Sensor", "Sensors initialized!");
}

//单一传感器读取函数
float readTemperature() {
  sensors_event_t tempEvent;
  aht.getEvent(nullptr, &tempEvent);
  return tempEvent.temperature;
}

float readHumidity() {
  sensors_event_t humidityEvent;
  aht.getEvent(&humidityEvent, nullptr);
  return humidityEvent.relative_humidity;
}

float readPressure() {
  return bmp.readPressure() / 100.0F; // Pa 转 hPa
}

float readLux() {
  return lightMeter.readLightLevel();
}

int readSmoke() {
  return analogRead(MQ_PIN); // MQ2 烟雾传感器
}

// 露点计算 (Magnus 公式)
// 露点温度是空气中的水蒸气达到饱和而开始凝结成液态水的温度。
// 当物体表面温度低于露点时，就会结露（生锈、发霉的根源）。
float calculateDewPoint(float temp, float hum) {
    if (hum <= 0) return temp; // 防止 log(0)
    
    // 常数 (适用于 -45°C ~ +60°C)
    float a = 17.625;
    float b = 243.04;
    
    // 计算 alpha: ln(RH/100) + a*T/(b+T)
    float alpha = log(hum / 100.0) + (a * temp) / (b + temp);
    
    // 计算露点: (b * alpha) / (a - alpha)
    float dewPoint = (b * alpha) / (a - alpha);
    
    return dewPoint;
}

//综合传感器读取：包含数据校验、露点计算、烟雾读取、结露风险检查
bool readAllSensors(SensorData& sensorData) {
  //逐个读取各传感器
  sensorData.temperature = readTemperature();
  sensorData.humidity = readHumidity();
  sensorData.pressure = readPressure();
  sensorData.lux = readLux();
  sensorData.smoke = readSmoke();
  
  //数据校验，防止 NaN 导致掉线
  if (isnan(sensorData.temperature)) sensorData.temperature = 0.0;
  if (isnan(sensorData.humidity)) sensorData.humidity = 0.0;
  if (isnan(sensorData.pressure)) sensorData.pressure = 0.0;
  if (isnan(sensorData.lux)) sensorData.lux = 0.0;
  
  // 计算露点
  sensorData.dewPoint = calculateDewPoint(sensorData.temperature, sensorData.humidity);
  if (isnan(sensorData.dewPoint)) sensorData.dewPoint = 0.0;
  sensorData.valid = true;
  
  // 露点结露风险检查
  if ((sensorData.temperature - sensorData.dewPoint) < 3.0) {
    LOG_W("ENV", "High Risk of Condensation (DewPoint=%.1f°C)", sensorData.dewPoint);
  }
  
  return true;
}

bool readAllSensors(float &temperature, float &humidity, float &pressure,
                    float &lux, float &dewPoint, int &smoke) {
  SensorData sensorData;
  if (!readAllSensors(sensorData)) {
    return false;
  }
  temperature = sensorData.temperature;
  humidity = sensorData.humidity;
  pressure = sensorData.pressure;
  lux = sensorData.lux;
  dewPoint = sensorData.dewPoint;
  smoke = sensorData.smoke;
  return true;
}
