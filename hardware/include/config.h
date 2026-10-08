#ifndef CONFIG_H
#define CONFIG_H

#include <Arduino.h>

// 定义引脚

// 语音按键
#define BTN_PIN EC11_SW_PIN
// EC11 旋转编码器
#define EC11_A_PIN 47      // 旋转 A 相，接GND触发
#define EC11_B_PIN 21      // 旋转 B 相，接GND触发
#define EC11_SW_PIN 45     // 编码器按压，接GND触发
#define CONFIG_PIN 20      // 确认/进入开关，接GND触发
#define BACK_PIN 19        // 返回开关，接GND触发

#define DHT_PIN 4          // DHT11 数据引脚

#define MQ_PIN 14          // MQ-2 模拟引脚
// I2C 总线引脚
#define I2C_SDA 15         // 传感器 I2C SDA
#define I2C_SCL 16         // 传感器 I2C SCL
#define OLED_SDA 38        // OLED I2C SDA (Wire1)
#define OLED_SCL 39        // OLED I2C SCL (Wire1)
// SPI 总线引脚 (RC522)
#define SPI_SCK 12
#define SPI_MISO 13
#define SPI_MOSI 11
// RGB
#define RGB_BUILTIN_PIN 48

// I2S 音频 (MAX98357A)
#define I2S_BCLK   6       
#define I2S_LRC    7       
#define I2S_DOUT   17      

// I2S 麦克风 (INMP441)
#define I2S_MIC_SCK 42
#define I2S_MIC_WS  41
#define I2S_MIC_SD  40

// RC522 RFID 引脚
#define RST_PIN  1  // 复位引脚
#define SS_PIN   2  // 片选引脚 (SDA)
#define OLED_RESET -1           // OLED 重置引脚 (-1 表示无)
#define SCREEN_WIDTH 128        // OLED 宽度, in pixels
#define SCREEN_HEIGHT 64        // OLED 高度, in pixels


// WiFi 和 MQTT 设置
const char* const mqtt_server = "broker.emqx.io"; // 公共 MQTT Broker
const int mqtt_port = 1883;
const char* const product_id = "esp32";  // 产品 ID

// 百度智能云配置 (语音识别/合成)
const char* const baidu_app_id = "";
const char* const baidu_api_key = "";    
const char* const baidu_secret_key = "";

// 百度语音 STT/TTS 参数
#define STT_DEV_PID 1537           // 语音识别模型 (1537=普通话输入法)
#define TTS_PER 4                  // 发音人 (0=女声, 1=男声, 3=情感男, 4=情感女)
#define TTS_SPD 5                  // 语速 (0-15, 默认5)
#define TTS_TIMEOUT 5000           // TTS 响应超时 (毫秒)
#define TOKEN_MARGIN 60000         // Token 过期提前刷新余量 (毫秒)

// 系统运行参数配置
#define DEFAULT_VOLUME 5           // 默认音量 (0-10)
#define MAX_VOLUME 10              // 最大音量 (UI 10 档)
#define MIN_VOLUME 0               // 最小音量
#define VOLUME_STEP 1              // 语音调节音量步长
#define AUDIO_MAX_VOLUME 21        // 底层音频库最大音量
#define SENSOR_SAMPLE_INTERVAL 500 // 传感器采集间隔 (毫秒)
#define MQTT_UPLOAD_INTERVAL 500   // MQTT 周期上报间隔 (毫秒)
#define BTN_DEBOUNCE_TIME 100      // 按键消抖时间 (毫秒)
#define RECORD_DURATION 3000       // 录音时长 (毫秒)

// 报警阈值默认值 (可通过 MQTT 动态更新)
#define DEFAULT_TEMP_MAX 30.0
#define DEFAULT_TEMP_MIN 0.0
#define DEFAULT_HUMIDITY_MAX 70.0
#define DEFAULT_SMOKE_THRESHOLD 2000.0
#define DEFAULT_PRESSURE_MAX 1050.0
#define DEFAULT_DEW_POINT_MAX 25.0
#define DEFAULT_LUX_MAX 10000.0

#endif

