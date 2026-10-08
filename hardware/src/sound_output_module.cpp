#include <Arduino.h>
#include <LittleFS.h>
#include "Audio.h"
#include "sound_output_module.h"
#include "config.h"
#include "logger.h"
#include "nvs_store.h"
#include <driver/i2s.h> 
#include <freertos/FreeRTOS.h>
#include <freertos/semphr.h>

Audio audio;
static SemaphoreHandle_t g_audioMutex = nullptr;
static int s_currentVolume = DEFAULT_VOLUME;

static const char* TAG_AUDIO = "AUDIO";

static inline bool lockAudio(TickType_t timeout = pdMS_TO_TICKS(200)) {
    if (!g_audioMutex) return true;
    return xSemaphoreTake(g_audioMutex, timeout) == pdTRUE;
}

static inline void unlockAudio() {
    if (g_audioMutex) {
        xSemaphoreGive(g_audioMutex);
    }
}

static int clampSoundVolume(int vol) {
    if (vol < MIN_VOLUME) return MIN_VOLUME;
    if (vol > MAX_VOLUME) return MAX_VOLUME;
    return vol;
}

void initSoundOutput() {
    if (!g_audioMutex) {
        g_audioMutex = xSemaphoreCreateMutex();
    }

    audio.setPinout(I2S_BCLK, I2S_LRC, I2S_DOUT);
    setSoundVolume(nvsStoreLoadVolume());

    if(!LittleFS.begin(true)){ // true = format if failed
        LOG_E(TAG_AUDIO, "LittleFS Mount Failed");
    } else {
        LOG_I(TAG_AUDIO, "LittleFS Mount Success");
    }

    LOG_I(TAG_AUDIO, "Audio module initialized");
}

void playSpeechReply() {
    if (!lockAudio(pdMS_TO_TICKS(500))) return;
    if (LittleFS.exists("/reply.mp3")) {
        // Ensure standard I2S config before letting Audio lib take over
        // Because playSoundTone might have changed the sample rate.
        i2s_set_sample_rates(I2S_NUM_0, 44100); 
        
        audio.connecttoFS(LittleFS, "/reply.mp3");
    } else {
        LOG_W(TAG_AUDIO, "No reply file found");
    }
    unlockAudio();
}

void processSoundOutput() {
    if (!lockAudio(pdMS_TO_TICKS(20))) return;
    audio.loop();
    unlockAudio();
}

// 使用原生 ESP32 I2S API 生成方波，振幅跟随 currentVolume 动态缩放
void playSoundTone(int freq, int durationMs) {
    if (!lockAudio(pdMS_TO_TICKS(800))) return;
    audio.stopSong(); // 先停止 Audio 库的播放，释放资源

    size_t bytes_written;
    uint32_t sample_rate = 44100;
    
    // 重新设置 I2S 采样率 (Audio 库可能修改过)
    i2s_set_sample_rates(I2S_NUM_0, sample_rate);

    // 计算周期样本数
    uint32_t samples_per_cycle = sample_rate / freq;
    uint32_t half_cycle = samples_per_cycle / 2;
    
// 根据当前音量 (0-10) 动态缩放振幅
// MAX_VOLUME=10 时对应最大振幅 28000（留余量防止削波）
    int16_t amplitude  = (int16_t)((s_currentVolume * 28000L) / MAX_VOLUME);
    int16_t sample_high =  amplitude;
    int16_t sample_low  = -amplitude;

    int16_t *buf = (int16_t *)malloc(samples_per_cycle * 2 * sizeof(int16_t));
    if (!buf) {
        unlockAudio();
        return;
    }

    // 填充一个周期的方波
    for (uint32_t i = 0; i < samples_per_cycle; i++) {
        int16_t val = (i < half_cycle) ? sample_high : sample_low;
        buf[2*i]   = val; // 左声道
        buf[2*i+1] = val; // 右声道
    }

    // 播放指定时长（i2s_write 限制 200ms 超时，防止 DMA 异常时永久阻塞）
    unsigned long start = millis();
    while (millis() - start < durationMs) {
        i2s_write(I2S_NUM_0, buf, samples_per_cycle * 2 * sizeof(int16_t), &bytes_written, pdMS_TO_TICKS(200));
    }

    free(buf);

    // 播放结束后静音一点点，防止爆音
    int16_t silence[100] = {0};
    i2s_write(I2S_NUM_0, silence, sizeof(silence), &bytes_written, pdMS_TO_TICKS(200));
    unlockAudio();
}

// 分级报警音 - 区分度明显版本
void playAlarmSoundLevel(int severity) {
    if (severity >= 3) {
        // 紧急 (级别3)：高频警笛音 - 交替上升下降，营造紧迫感
        //LOG_W(TAG_AUDIO, "Alarm Level 3 (EMERGENCY) - Siren Pattern");
        for (int i = 0; i < 3; i++) {
            playSoundTone(2000, 100);  // 低音
            delay(30);
            playSoundTone(3000, 100);  // 高音
            delay(30);
            playSoundTone(2000, 100);  // 低音
            delay(30);
            playSoundTone(3000, 100);  // 高音
            delay(100);           // 循环间隔
        }
    } else if (severity == 2) {
        //警告 (级别2)：中频三连鸣 - 短短长节奏（摩尔斯码警示风格）
        //LOG_W(TAG_AUDIO, "Alarm Level 2 (WARNING) - Three-Beep Pattern");
        playSoundTone(1500, 150);   // 短
        delay(100);
        playSoundTone(1500, 150);   // 短
        delay(100);
        playSoundTone(1500, 500);   // 长
    } else {
        // 提示 (级别1)：低频单鸣 - 温和提示音
        //LOG_I(TAG_AUDIO, "Alarm Level 1 (INFO) - Single Beep");
        playSoundTone(600, 300);
    }
}

void playStartupSound() {
    playSoundTone(800, 500);
}

void playReadSuccessSound() {
    // 读卡提示音：短促双高音（轻快）
    playSoundTone(2500, 40);
    delay(30);
    playSoundTone(2500, 40);
}

void playWriteSuccessSound() {
    // 写卡成功音：低→中→高 上升三音阶，表示"写入完成"
    playSoundTone(800,  120);
    delay(40);
    playSoundTone(1200, 120);
    delay(40);
    playSoundTone(1800, 200);
}

int getSoundVolume() {
    return s_currentVolume;
}

void setSoundVolume(int vol) {
    if (!lockAudio(pdMS_TO_TICKS(100))) return;
    s_currentVolume = clampSoundVolume(vol);
    int hwVol = (s_currentVolume * AUDIO_MAX_VOLUME + (MAX_VOLUME / 2)) / MAX_VOLUME;
    if (hwVol < 0) hwVol = 0;
    if (hwVol > AUDIO_MAX_VOLUME) hwVol = AUDIO_MAX_VOLUME;
    audio.setVolume(hwVol);
    unlockAudio();
}

int changeSoundVolume(int delta) {
    int newVolume = clampSoundVolume(s_currentVolume + delta);
    if (newVolume != s_currentVolume) {
        setSoundVolume(newVolume);
        nvsStoreSaveVolume(newVolume);
    }
    return s_currentVolume;
}

void stopSoundOutput() {
    if (!lockAudio(pdMS_TO_TICKS(200))) return;
    audio.stopSong();
    unlockAudio();
}
