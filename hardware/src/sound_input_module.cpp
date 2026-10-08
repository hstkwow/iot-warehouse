#include "sound_input_module.h"
#include "config.h"
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <LittleFS.h>
#include "sound_output_module.h"
#include "network_module.h" // publishData, isAlarmOn, isLedOn
#include "nvs_store.h"
#include "sensor_module.h"
#include "rgb_module.h"     // controlRgbLed
#include "alarm_module.h"   // controlAlarm
#include "logger.h"
#include <driver/i2s.h>
#include <freertos/FreeRTOS.h>

static const char* TAG_VOICE = "VOICE";

static String baiduAccessToken = "";      // 模块内部缓存，外部不可访问
static unsigned long tokenExpiryTime = 0; // Token 过期时间戳

static void initVoiceRecorder() {
    i2s_config_t i2s_config = {
        .mode = (i2s_mode_t)(I2S_MODE_MASTER | I2S_MODE_RX),
        .sample_rate = 16000,
        .bits_per_sample = I2S_BITS_PER_SAMPLE_16BIT,
        .channel_format = I2S_CHANNEL_FMT_ONLY_LEFT,
        .communication_format = I2S_COMM_FORMAT_STAND_I2S,
        .intr_alloc_flags = ESP_INTR_FLAG_LEVEL1,
        .dma_buf_count = 8,
        .dma_buf_len = 1024,
        .use_apll = false,
        .tx_desc_auto_clear = false,
        .fixed_mclk = 0
    };

    i2s_pin_config_t pin_config = {
        .bck_io_num = I2S_MIC_SCK,
        .ws_io_num = I2S_MIC_WS,
        .data_out_num = -1,
        .data_in_num = I2S_MIC_SD
    };

    esp_err_t err = i2s_driver_install(I2S_NUM_1, &i2s_config, 0, NULL);
    if (err != ESP_OK && err != ESP_ERR_INVALID_STATE) {
        LOG_E(TAG_VOICE, "Recorder I2S driver install failed: %d", (int)err);
        return;
    }

    err = i2s_set_pin(I2S_NUM_1, &pin_config);
    if (err != ESP_OK) {
        LOG_E(TAG_VOICE, "Recorder I2S set pin failed: %d", (int)err);
        return;
    }

    LOG_I(TAG_VOICE, "Voice recorder initialized");
}

static uint8_t* recordVoiceAudio(int durationMs, size_t& outSize) {
    const size_t sampleRate = 16000;
    const size_t bytesPerSample = 2;
    size_t expectedBytes = (sampleRate * durationMs / 1000) * bytesPerSample;
    expectedBytes = (expectedBytes + 3) & ~((size_t)3);

    uint8_t* buffer = (uint8_t*)ps_malloc(expectedBytes);
    if (buffer == nullptr) {
        buffer = (uint8_t*)malloc(expectedBytes);
    }

    if (buffer == nullptr) {
        LOG_E(TAG_VOICE, "Record memory allocation failed");
        outSize = 0;
        return nullptr;
    }

    size_t bytesRead = 0;
    size_t totalRead = 0;
    i2s_zero_dma_buffer(I2S_NUM_1);

    unsigned long start = millis();
    while (millis() - start < (unsigned long)durationMs && totalRead < expectedBytes) {
        size_t bytesToRead = 1024;
        if (expectedBytes - totalRead < bytesToRead) {
            bytesToRead = expectedBytes - totalRead;
        }

        esp_err_t result = i2s_read(I2S_NUM_1, buffer + totalRead, bytesToRead, &bytesRead, portMAX_DELAY);
        if (result == ESP_OK) {
            totalRead += bytesRead;
        } else {
            LOG_W(TAG_VOICE, "I2S read failed: %d", (int)result);
            break;
        }
    }

    outSize = totalRead;
    LOG_I(TAG_VOICE, "Recording done, bytes=%u", (unsigned)totalRead);
    return buffer;
}

// 获取 Access Token
String requestBaiduToken() {
    if (WiFi.status() != WL_CONNECTED) return "";
    
    // 如果 token 还在有效期内（预留60秒余量），直接返回
    if (baiduAccessToken != "" && millis() < tokenExpiryTime) {
        return baiduAccessToken;
    }

    HTTPClient http;
    String url = "https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=";
    url += baidu_api_key;
    url += "&client_secret=";
    url += baidu_secret_key;

    http.begin(url);
    int httpCode = http.POST("");
    
    if (httpCode == HTTP_CODE_OK) {
        String payload = http.getString();
        DynamicJsonDocument doc(1024);
        deserializeJson(doc, payload);
        
        const char* token = doc["access_token"];
        int expiresIn = doc["expires_in"]; // 通常是 2592000 秒 (30天)
        
        baiduAccessToken = String(token);
        tokenExpiryTime = millis() + (expiresIn * 1000UL) - TOKEN_MARGIN;
        
        LOG_I(TAG_VOICE, "Token Success!");
    } else {
        LOG_E(TAG_VOICE, "Token Failed, Error: %s", http.errorToString(httpCode).c_str());
    }
    http.end();
    return baiduAccessToken;
}

// 语音识别 (Raw PCM -> Text)
String recognizeSpeech(uint8_t* audioData, size_t dataSize) {
    String token = requestBaiduToken();
    if (token == "") return "";

    HTTPClient http;
    String url = "http://vop.baidu.com/server_api?dev_pid=" + String(STT_DEV_PID)
              + "&cuid=" + g_deviceMAC + "&token=" + token;

    http.begin(url);
    http.addHeader("Content-Type", "audio/pcm;rate=16000");

    //LOG_I(TAG_VOICE, "Uploading Audio (%d bytes)", dataSize);
    int httpCode = http.POST(audioData, dataSize);

    String result = "";
    if (httpCode == HTTP_CODE_OK) {
        String payload = http.getString();
        
        DynamicJsonDocument doc(2048); // 调大一点
        deserializeJson(doc, payload); // 可能需要 filter 减少内存

        JsonArray res = doc["result"];
        if (res.size() > 0) {
            result = res[0].as<String>();
            LOG_I(TAG_VOICE, "STT Result: %s", result.c_str());
        } else {
            LOG_W(TAG_VOICE, "STT No Result");
        }
    } else {
        LOG_E(TAG_VOICE, "STT Error: %s", http.errorToString(httpCode).c_str());
    }
    http.end();
    return result;
}

// 语音合成 (Text -> /reply.mp3)
bool synthesizeSpeech(String text) {
    String token = requestBaiduToken();
    if (token == "") return false;
    
    HTTPClient http;
    String url = "http://tsn.baidu.com/text2audio";
    
    // 组装 POST 数据 (ESP32 String 内部是 UTF-8)
    String postData = "lan=zh&cuid=" + g_deviceMAC;
    postData += "&ctp=1";
    postData += "&tok=" + token;
    postData += "&per=" + String(TTS_PER);
    postData += "&spd=" + String(TTS_SPD);
    postData += "&tex=" + text;
    
    http.begin(url);
    http.addHeader("Content-Type", "application/x-www-form-urlencoded");
    
    int httpCode = http.POST(postData);
    
    bool success = false;
    if (httpCode == HTTP_CODE_OK) {
        WiFiClient *stream = http.getStreamPtr();
        
        // 等待数据到达
        unsigned long timeout = millis();
        while (stream->available() == 0) {
            if (millis() - timeout > TTS_TIMEOUT) {
                LOG_W(TAG_VOICE, "TTS Timeout");
                http.end();
                return false;
            }
            delay(10);
        }

        int firstByte = stream->peek();
        if (firstByte == '{') {
            LOG_E(TAG_VOICE, "TTS Error: %s", http.getString().c_str());
        } else {
            File file = LittleFS.open("/reply.mp3", "w");
            if (file) {
                 int len = http.writeToStream(&file);
                 file.close();
                 LOG_I(TAG_VOICE, "TTS saved (%d bytes)", len);
                 success = (len > 0);
            } else {
                 LOG_E(TAG_VOICE, "Failed to open /reply.mp3");
            }
        }
    } else {
       LOG_E(TAG_VOICE, "TTS HTTP Error: %s", http.errorToString(httpCode).c_str()); 
    }
    http.end();
    return success;
}

void initSoundInput() {
    initVoiceRecorder();
    // 预加载 Token
    requestBaiduToken();
    LOG_I(TAG_VOICE, "Voice module ready (energy detect + Baidu STT wake)");
}

String processSoundCommand(const String& text) {
    if (text.indexOf("开灯") != -1) {
        isLedOn = true; controlRgbLed(true);
        // LED 状态改变后发布完整传感器数据
        SensorData sensorData;
        readAllSensors(sensorData);
        publishData(sensorData.temperature, sensorData.humidity, sensorData.pressure, sensorData.lux, sensorData.smoke, sensorData.dewPoint, isAlarmOn, isLedOn);
        return "好的，灯已打开";
    } 
    else if (text.indexOf("关灯") != -1) {
        isLedOn = false; controlRgbLed(false);
        // LED 状态改变后发布完整传感器数据
        SensorData sensorData;
        readAllSensors(sensorData);
        publishData(sensorData.temperature, sensorData.humidity, sensorData.pressure, sensorData.lux, sensorData.smoke, sensorData.dewPoint, isAlarmOn, isLedOn);
        return "好的，灯已关闭";
    }
    else if (text.indexOf("大声") != -1 || text.indexOf("音量大") != -1 || text.indexOf("大点声") != -1) {
        int volume = changeSoundVolume(VOLUME_STEP);
        return "好的，音量调到了" + String(volume);
    }
    else if (text.indexOf("小声") != -1 || text.indexOf("音量小") != -1 || text.indexOf("小点声") != -1) {
        int volume = changeSoundVolume(-VOLUME_STEP);
        return "好的，音量调到了" + String(volume);
    }
    else {      // 未匹配到已知指令，简单回复原文本
        return "你说的是：" + text;
    }
}

// 处理语音控制 
void handleSoundInputControl(bool fromButton) {
    // 如果是按键触发，先检测按键并做消抖
    if (fromButton) {
        if (digitalRead(BTN_PIN) != LOW) return;
        // 按键消抖
        unsigned long pressStart = millis();
        while (millis() - pressStart < BTN_DEBOUNCE_TIME) {
            if (digitalRead(BTN_PIN) == HIGH) return;
            processSoundOutput();
            delay(5);
        }
    }

    // 开始语音流程
    stopSoundOutput();

    // 1. 录音开始提示音
    playSoundTone(600, 100);
    delay(100);

    // 2. 录音
    size_t audioSize = 0;
    uint8_t* audioData = recordVoiceAudio(RECORD_DURATION, audioSize);

    if (audioData != NULL && audioSize > 0) {
        playSoundTone(1000, 100); // 录音结束提示

        // 3. 语音识别 (STT)
        String text = recognizeSpeech(audioData, audioSize);
        free(audioData);        // 释放录音数据
        delay(50);

        if (text != "") {
            // 去除标点
            text.replace("，", "");
            text.replace("。", "");

            //指令处理
            String reply = processSoundCommand(text);
            LOG_I(TAG_VOICE, "Reply: %s", reply.c_str());

            // 5. 语音合成 (TTS) 并播放
            if (synthesizeSpeech(reply)) {
                playSpeechReply();
            }
        } else {
            LOG_W(TAG_VOICE, "No STT text received");
            playSoundTone(200, 300); // 识别失败音
        }
    }

    // 如果是按键触发，等待释放
    if (fromButton) {
        while (digitalRead(BTN_PIN) == LOW) {
            processSoundOutput();
            delay(10);
        }
    }
}
