#include "alarm_module.h"
#include "config.h"
#include "logger.h"
#include "network_module.h"
#include "sound_output_module.h"  

static const char* TAG_ALARM = "ALARM";

// 每种传感器独立追踪报警状态，独立发送告警事件
// 条件恢复后自动重置标记，下次超标可再次触发
static uint16_t alarmFlags = 0;
enum AlarmFlag : uint16_t {
    ALARM_TEMP_HIGH = 1 << 0,
    ALARM_TEMP_LOW  = 1 << 1,
    ALARM_HUMI      = 1 << 2,
    ALARM_SMOKE     = 1 << 3,
    ALARM_PRESSURE  = 1 << 4,
    ALARM_DEWPOINT  = 1 << 5,
    ALARM_LUX       = 1 << 6,
};
static unsigned long lastBeepTime = 0;  // 记录上次播放报警音的时间
int currentAlarmSeverity = 0;    // 当前最高报警级别 (外部可访问，用于手动关闭时重置)
static AlarmPopup s_alarmQueue[3];
static uint8_t s_alarmQHead = 0;
static uint8_t s_alarmQTail = 0;
static uint8_t s_alarmQCount = 0;

static void setAlarmPopup(const char* title, const char* msg) {
    AlarmPopup ap{};
    strncpy(ap.title, title, sizeof(ap.title) - 1);
    ap.title[sizeof(ap.title) - 1] = '\0';
    strncpy(ap.message, msg, sizeof(ap.message) - 1);
    ap.message[sizeof(ap.message) - 1] = '\0';
    ap.timestamp = millis();
    ap.active = true;
    alarmPopupPush(&ap);
}

void initAlarm() {
    lastBeepTime = 0;  // 初始化报警音计时器
    s_alarmQHead = s_alarmQTail = s_alarmQCount = 0;
    LOG_I(TAG_ALARM, "Alarm module initialized");
}



void checkAlarms(const SensorData& sensorData) {
    if (g_alarmMode != "auto") return;  //不是自动模式，不处理
    
    bool anyAlarm = false;
    int  maxSeverity = 0; // 本轮最高级别
    char buf[120];

    // 1) 温度过高 (紧急)
    if (sensorData.temperature > cfgTempMax) {
        anyAlarm = true; if (maxSeverity < 3) maxSeverity = 3;
        if (!(alarmFlags & ALARM_TEMP_HIGH)) {
            alarmFlags |= ALARM_TEMP_HIGH;
            snprintf(buf, sizeof(buf), "报警时%.1f°C, 超过上限%.0f°C", sensorData.temperature, cfgTempMax);
            publishAlarmEvent("温度过高", 3, buf);
            setAlarmPopup("温度过高", buf);
        }
    } else { alarmFlags &= ~ALARM_TEMP_HIGH; }

    // 2) 温度过低 (紧急)
    if (sensorData.temperature < cfgTempMin) {
        anyAlarm = true; if (maxSeverity < 3) maxSeverity = 3;
        if (!(alarmFlags & ALARM_TEMP_LOW)) {
            alarmFlags |= ALARM_TEMP_LOW;
            snprintf(buf, sizeof(buf), "报警时%.1f°C, 低于下限%.0f°C", sensorData.temperature, cfgTempMin);
            publishAlarmEvent("温度过低", 3, buf);
            setAlarmPopup("温度过低", buf);
        }
    } else { alarmFlags &= ~ALARM_TEMP_LOW; }

    // 3) 湿度过高 (紧急)
    if (sensorData.humidity > cfgHumidityMax) {
        anyAlarm = true; if (maxSeverity < 3) maxSeverity = 3;
        if (!(alarmFlags & ALARM_HUMI)) {
            alarmFlags |= ALARM_HUMI;
            snprintf(buf, sizeof(buf), "报警时%.1f%%, 超过上限%.0f%%", sensorData.humidity, cfgHumidityMax);
            publishAlarmEvent("湿度异常", 3, buf);
            setAlarmPopup("湿度异常", buf);
        }
    } else { alarmFlags &= ~ALARM_HUMI; }

    // 4) 烟雾超标 (紧急)
    if (sensorData.smoke > (int)cfgSmokeThreshold) {
        anyAlarm = true; if (maxSeverity < 3) maxSeverity = 3;
        if (!(alarmFlags & ALARM_SMOKE)) {
            alarmFlags |= ALARM_SMOKE;
            snprintf(buf, sizeof(buf), "报警时%d, 超过阈值%d", sensorData.smoke, (int)cfgSmokeThreshold);
            publishAlarmEvent("烟雾报警", 3, buf);
            setAlarmPopup("烟雾报警", buf);
        }
    } else { alarmFlags &= ~ALARM_SMOKE; }

    // 5) 气压过高 (紧急)
    if (sensorData.pressure > cfgPressureMax) {
        anyAlarm = true; if (maxSeverity < 3) maxSeverity = 3;
        if (!(alarmFlags & ALARM_PRESSURE)) {
            alarmFlags |= ALARM_PRESSURE;
            snprintf(buf, sizeof(buf), "报警时%.0fhPa, 超过上限%.0fhPa", sensorData.pressure, cfgPressureMax);
            publishAlarmEvent("气压异常", 3, buf);
            setAlarmPopup("气压异常", buf);
        }
    } else { alarmFlags &= ~ALARM_PRESSURE; }

    // 6) 露点过高 (紧急)
    if (sensorData.dewPoint > cfgDewPointMax) {
        anyAlarm = true; if (maxSeverity < 3) maxSeverity = 3;
        if (!(alarmFlags & ALARM_DEWPOINT)) {
            alarmFlags |= ALARM_DEWPOINT;
            snprintf(buf, sizeof(buf), "报警时%.1f°C, 超过上限%.0f°C, 物品易结露", sensorData.dewPoint, cfgDewPointMax);
            publishAlarmEvent("露点异常", 3, buf);
            setAlarmPopup("露点异常", buf);
        }
    } else { alarmFlags &= ~ALARM_DEWPOINT; }

    // 7) 光照过高 (紧急)
    if (sensorData.lux > cfgLuxMax) {
        anyAlarm = true; if (maxSeverity < 3) maxSeverity = 3;
        if (!(alarmFlags & ALARM_LUX)) {
            alarmFlags |= ALARM_LUX;
            snprintf(buf, sizeof(buf), "报警时%.0fLux, 超过上限%.0fLux", sensorData.lux, cfgLuxMax);
            publishAlarmEvent("光照异常", 3, buf);
            setAlarmPopup("光照异常", buf);
        }
    } else { alarmFlags &= ~ALARM_LUX; }

    // 只要有任一项超标就设置报警标志
    if (anyAlarm && !isAlarmOn) {
        isAlarmOn = true;
    }
    
    // 更新当前最高级别（用于分级报警音）
    // 一旦触发报警，级别不会因为数据恢复而降低，保持最高级别直到手动关闭
    if (anyAlarm && maxSeverity > currentAlarmSeverity) {
        currentAlarmSeverity = maxSeverity;
    }
    // 传感器报警：一旦触发就持续报警，不会因为数据恢复而自动关闭

    // 注意：传感器标志位仍会自动重置，以便下次超标能再次上报到后端
}

void checkAlarms(float temperature, float humidity, float pressure, float lux,
                 int smoke, float dewPoint) {
    SensorData sensorData{temperature, humidity, pressure, lux, dewPoint, smoke, true};
    checkAlarms(sensorData);
}

bool alarmPopupPeek(AlarmPopup* out) {
    if (!out) return false;
    if (s_alarmQCount == 0) return false;
    *out = s_alarmQueue[s_alarmQHead];
    return true;
}

void alarmPopupClear() {
    if (s_alarmQCount == 0) return;
    s_alarmQHead = (s_alarmQHead + 1) % 3;
    s_alarmQCount--;
}

void alarmPopupPush(const AlarmPopup* in) {
    if (!in) return;
    if (s_alarmQCount >= 3) {
        s_alarmQHead = (s_alarmQHead + 1) % 3;
        s_alarmQCount--;
    }
    s_alarmQueue[s_alarmQTail] = *in;
    s_alarmQTail = (s_alarmQTail + 1) % 3;
    s_alarmQCount++;
}

// 更新报警音效（按 severity 分级）
void updateAlarmSound() {
    unsigned long currentMillis = millis();
    
    if (isAlarmOn) {
        unsigned long interval = (currentAlarmSeverity >= 3) ? 1500 : 3000;
        if (currentMillis - lastBeepTime > interval) {
            lastBeepTime = currentMillis;
            playAlarmSoundLevel(currentAlarmSeverity);
        }
    }
}
