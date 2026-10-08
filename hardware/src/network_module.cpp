#include "network_module.h"
#include <ArduinoJson.h>
#include <WiFiManager.h> // 引入 WiFiManager
#include "sensor_snapshot.h"
#include "data_payload.h"
#include "alarm_module.h"
#include "rgb_module.h" // 引入 RGB 模块
#include "config.h"
#include "logger.h"
#include "nvs_store.h"

// --- 动态绑定相关变量 ---
String g_deviceMAC = "";       // 设备 MAC 地址
String g_mqtt_topic_data = ""; // 动态数据主题: device/{MAC}/data
String g_mqtt_topic_cmd = "";  // 动态控制主题: device/{MAC}/cmd
String g_mqtt_will_payload = ""; // 遗嘱 payload

// 全局状态变量
String g_workMode = "both";   // 工作模式: inbound, outbound, both
String g_alarmMode = "auto";  // 报警模式: auto, manual

//外部访问状态
bool isAlarmOn = false;   
bool isLedOn = false;     

String pendingWriteData = ""; // 初始化待写入数据
AsyncMqttClient mqttClient;
static uint32_t s_pubAckCount = 0;
static unsigned long s_pubAckWindowStart = 0;
static unsigned long s_lastPeriodicPublishMs = 0;
static volatile bool s_immediatePublishRequested = false;   // 是否立即上传
static volatile uint8_t s_immediatePublishReason = 0;       // 立即上传原因
static bool s_mqttConnecting = false;                       // 是否正在连接 MQTT

// MQTT 分片组包相关静态变量
static String s_rxAssemblePayload = "";                     
static String s_rxAssembleTopic = "";
static size_t s_rxAssembleExpected = 0;   

enum ImmediateReason : uint8_t {
  REASON_NONE = 0,
  REASON_CMD_LED,
  REASON_CMD_ALARM,
  REASON_CMD_ALARM_MODE,
  REASON_CMD_WORK_MODE,
  REASON_CMD_CONFIG
};

static const char* reasonToString(uint8_t reason) {
  switch (reason) {
    case REASON_CMD_LED: return "cmd_led";
    case REASON_CMD_ALARM: return "cmd_alarm";
    case REASON_CMD_ALARM_MODE: return "cmd_alarm_mode";
    case REASON_CMD_WORK_MODE: return "cmd_work_mode";
    case REASON_CMD_CONFIG: return "cmd_config";
    default: return "unknown";
  }
}

static inline void requestImmediatePublish(uint8_t reason) {
  s_immediatePublishReason = reason;
  s_immediatePublishRequested = true;
}

static void handleMqttCommand(JsonDocument &doc) {
  // LED control
  if (doc.containsKey(DataPayload::Field::LED)) {
    bool ledState = doc[DataPayload::Field::LED];
    isLedOn = ledState;
    controlRgbLed(ledState);
    LOG_I("MQTT", "CMD led -> %s", ledState ? "ON" : "OFF");
    requestImmediatePublish(REASON_CMD_LED);
  }

  // Alarm control
  if (doc.containsKey(DataPayload::Field::ALARM)) {
    bool alarmState = doc[DataPayload::Field::ALARM];
    isAlarmOn = alarmState;
    if (!alarmState) {
      currentAlarmSeverity = 0;
    }
    LOG_I("MQTT", "CMD alarm -> %s", alarmState ? "ON" : "OFF");
    requestImmediatePublish(REASON_CMD_ALARM);
  }

  // Alarm mode
  if (doc.containsKey(DataPayload::Field::CMD_ALARM_MODE)) {
    String mode = doc[DataPayload::Field::CMD_ALARM_MODE].as<String>();
    if (mode == "manual") {
      g_alarmMode = "manual";
      isAlarmOn = false;
      currentAlarmSeverity = 0;
    } else {
      g_alarmMode = "auto";
    }
    LOG_I("MQTT", "CMD alarm_mode -> %s", g_alarmMode.c_str());
    saveThresholds();
    requestImmediatePublish(REASON_CMD_ALARM_MODE);
  }

  // Work mode
  if (doc.containsKey(DataPayload::Field::CMD_WORK_MODE)) {
    String mode = doc[DataPayload::Field::CMD_WORK_MODE].as<String>();
    if (mode == "inbound" || mode == "outbound") {
      g_workMode = mode;
      LOG_I("MQTT", "CMD work_mode -> %s", g_workMode.c_str());
      requestImmediatePublish(REASON_CMD_WORK_MODE);
    }
    saveThresholds();
  }

  // RFID write mode
  if (doc.containsKey(DataPayload::Field::CMD_RFID_WRITE)) {
    pendingWriteData = doc[DataPayload::Field::CMD_RFID_WRITE].as<String>();
    LOG_I("MQTT", "CMD rfid_write -> len=%u", (unsigned)pendingWriteData.length());
  }

  // Remote threshold config
  if (doc.containsKey(DataPayload::Field::CMD_CONFIG)) {
    JsonObject cfg = doc[DataPayload::Field::CMD_CONFIG];
    if (cfg.containsKey(DataPayload::Field::CFG_TEMP_MAX)) cfgTempMax = cfg[DataPayload::Field::CFG_TEMP_MAX].as<float>();
    if (cfg.containsKey(DataPayload::Field::CFG_TEMP_MIN)) cfgTempMin = cfg[DataPayload::Field::CFG_TEMP_MIN].as<float>();
    if (cfg.containsKey(DataPayload::Field::CFG_HUMIDITY_MAX)) cfgHumidityMax = cfg[DataPayload::Field::CFG_HUMIDITY_MAX].as<float>();
    if (cfg.containsKey(DataPayload::Field::CFG_SMOKE_THRESHOLD)) cfgSmokeThreshold = cfg[DataPayload::Field::CFG_SMOKE_THRESHOLD].as<float>();
    if (cfg.containsKey(DataPayload::Field::CFG_PRESSURE_MAX)) cfgPressureMax = cfg[DataPayload::Field::CFG_PRESSURE_MAX].as<float>();
    if (cfg.containsKey(DataPayload::Field::CFG_DEW_POINT_MAX)) cfgDewPointMax = cfg[DataPayload::Field::CFG_DEW_POINT_MAX].as<float>();
    if (cfg.containsKey(DataPayload::Field::CFG_LUX_MAX)) cfgLuxMax = cfg[DataPayload::Field::CFG_LUX_MAX].as<float>();
    if (cfg.containsKey(DataPayload::Field::WORK_MODE)) g_workMode = cfg[DataPayload::Field::WORK_MODE].as<String>();
    if (cfg.containsKey(DataPayload::Field::ALARM_MODE)) g_alarmMode = cfg[DataPayload::Field::ALARM_MODE].as<String>();

    saveThresholds();
    LOG_I("MQTT", "CMD config updated (Tmax=%.1f Tmin=%.1f Hmax=%.0f Smoke=%.0f Pmax=%.0f DPmax=%.1f Lux=%.0f)",
          cfgTempMax, cfgTempMin, cfgHumidityMax, cfgSmokeThreshold, cfgPressureMax, cfgDewPointMax, cfgLuxMax);
    requestImmediatePublish(REASON_CMD_CONFIG);
  }
}

void updateSensorSnapshot(const SensorData& sensorData) {
  sensorSnapshotSet(sensorData);
}

void updateSensorSnapshot(float temperature, float humidity, float pressure, float lux, int smoke, float dewPoint) {
  SensorData sensorData{temperature, humidity, pressure, lux, dewPoint, smoke, true};
  updateSensorSnapshot(sensorData);
}

static void publishStateSnapshotNow(const char* reason) {
  if (!mqttClient.connected()) return;

  SensorData sensorData;
  const bool hasSnapshot = sensorSnapshotGet(sensorData);
  String jsonData = hasSnapshot
                    ? DataPayload::buildStatePayload(&sensorData, isAlarmOn, isLedOn, g_workMode, g_alarmMode)
                    : DataPayload::buildStatePayload(nullptr, isAlarmOn, isLedOn, g_workMode, g_alarmMode);
  mqttClient.publish(g_mqtt_topic_data.c_str(), 1, false, jsonData.c_str());
  LOG_I("MQTT", "Immediate state published%s reason=%s",
        hasSnapshot ? "" : " (no-sensor)",
        reason ? reason : "unknown");
}

// 动态阈值变量（使用 config.h 中的默认值初始化）
float cfgTempMax = DEFAULT_TEMP_MAX;
float cfgTempMin = DEFAULT_TEMP_MIN;
float cfgHumidityMax = DEFAULT_HUMIDITY_MAX;
float cfgSmokeThreshold = DEFAULT_SMOKE_THRESHOLD;
float cfgPressureMax = DEFAULT_PRESSURE_MAX;
float cfgDewPointMax = DEFAULT_DEW_POINT_MAX;
float cfgLuxMax = DEFAULT_LUX_MAX;

// 写入 NVS
void saveThresholds() {
    NvsStoreData data;
    nvsStoreLoad(data); // 保留音量等其他持久化字段
    data.tempMax = cfgTempMax;
    data.tempMin = cfgTempMin;
    data.humidityMax = cfgHumidityMax;
    data.smokeThreshold = cfgSmokeThreshold;
    data.pressureMax = cfgPressureMax;
    data.dewPointMax = cfgDewPointMax;
    data.luxMax = cfgLuxMax;
    data.alarmMode = g_alarmMode;
    data.workMode = g_workMode;
    nvsStoreSave(data);
}

// 读取 NVS
void loadThresholds() {
    NvsStoreData data;
    nvsStoreLoad(data);
    cfgTempMax = data.tempMax;
    cfgTempMin = data.tempMin;
    cfgHumidityMax = data.humidityMax;
    cfgSmokeThreshold = data.smokeThreshold;
    cfgPressureMax = data.pressureMax;
    cfgDewPointMax = data.dewPointMax;
    cfgLuxMax = data.luxMax;
    g_alarmMode = data.alarmMode;
    g_workMode = data.workMode;
}

// MQTT 消息回调函数，处理分片组包和 JSON 解析
void onMqttMessage(char* topic, char* payload, AsyncMqttClientMessageProperties properties, size_t len, size_t index, size_t total) {
  LOG_D("MQTT", "Rx topic=%s len=%u idx=%u total=%u qos=%d retain=%d",
        topic, (unsigned)len, (unsigned)index, (unsigned)total,
        (int)properties.qos, (int)properties.retain);

  // 防止异常大包占满堆内存
  if (total > 4096) {
    LOG_W("MQTT", "Payload too large, drop topic=%s total=%u", topic, (unsigned)total);
    s_rxAssemblePayload = "";
    s_rxAssembleTopic = "";
    s_rxAssembleExpected = 0;
    return;
  }

  // 分片起始：重置组包上下文
  if (index == 0) {
    s_rxAssemblePayload = "";   // 清空之前的残留数据
    s_rxAssembleTopic = String(topic);    
    s_rxAssembleExpected = (total > 0 ? total : len);
    s_rxAssemblePayload.reserve(s_rxAssembleExpected + 8);
  }

  // 如果分片中途 topic 发生变化，直接丢弃，避免串包
  if (s_rxAssembleTopic.length() > 0 && s_rxAssembleTopic != String(topic)) {
    LOG_W("MQTT", "Topic changed during chunk assemble, drop old=%s new=%s",
          s_rxAssembleTopic.c_str(), topic);
    s_rxAssemblePayload = "";
    s_rxAssembleTopic = "";
    s_rxAssembleExpected = 0;
    return;
  }

  // 追加当前分片（payload 非 '\0' 结尾，不能直接 String(payload)）
  for (size_t i = 0; i < len; i++) {
    s_rxAssemblePayload += (char)payload[i];
  }

  // 未收完整包，等待后续分片
  if (index + len < (total > 0 ? total : len)) {
    return;
  }

  // 到达尾片后再做一次完整性检查
  if (s_rxAssembleExpected > 0 && s_rxAssemblePayload.length() != s_rxAssembleExpected) {
    LOG_W("MQTT", "Assemble length mismatch topic=%s expect=%u actual=%u",
          topic, (unsigned)s_rxAssembleExpected, (unsigned)s_rxAssemblePayload.length());
  }

  String message = s_rxAssemblePayload;
  s_rxAssemblePayload = "";
  s_rxAssembleTopic = "";
  s_rxAssembleExpected = 0;


  //Parse JSON
  DynamicJsonDocument doc(1024);
  DeserializationError error = deserializeJson(doc, message);

  // 解析错误
  if (error) {
    LOG_E("MQTT", "JSON Parse Error");
    return;
  }

  handleMqttCommand(doc);
}


void onMqttConnect(bool sessionPresent) {
  s_mqttConnecting = false;
  LOG_I("MQTT", "Connected (Session present:%d)", sessionPresent);
  
  // 订阅动态控制主题
  uint16_t packetIdSub = mqttClient.subscribe(g_mqtt_topic_cmd.c_str(), 1); // QoS 1 better for commands
  LOG_I("MQTT", "Subscribed to <%s> (ack:%d)", g_mqtt_topic_cmd.c_str(), packetIdSub);
  
  // 上线后发布 online 状态，retain=true 覆盖 Broker 中保留的遗嘱 offline 消息
  String onlineMsg = DataPayload::buildPresencePayload("online", g_deviceMAC);
  mqttClient.publish(g_mqtt_topic_data.c_str(), 1, true, onlineMsg.c_str());
  LOG_I("MQTT", "Presence online published");

}

void onMqttDisconnect(AsyncMqttClientDisconnectReason reason) {
  s_mqttConnecting = false;
  LOG_W("MQTT", "Disconnected (Reason:%d)", (int)reason);
  // 不要立即重连，交给 loop() 中的 checkNetwork() 处理，避免频繁请求被封禁
}

void onMqttPublish(uint16_t packetId) {
  LOG_I("MQTT", "数据上传成功! PacketID: %u", packetId);
  if (s_pubAckWindowStart == 0) {
    s_pubAckWindowStart = millis();
  }
  s_pubAckCount++;
}

void setupWiFi() {
  LOG_I("WiFi", "--- WiFi Setup (WiFiManager) ---");
  loadThresholds(); // 从 NVS 加载上次保存的阈值
  
  WiFiManager wm;
  
  // [重要] 第一次运行时取消注释下面这行，用于清除之前保存的 WiFi 密码
  // 烧录运行一次后，再次注释掉它，否则每次重启都要重新配网！
  // wm.resetSettings(); 

  // 设置配网超时（例如 3 分钟），超时后继续运行（可能没网）或者重启
  wm.setConfigPortalTimeout(180);
  wm.setConfigPortalBlocking(false);

  // 自动连接：
  // 1. 如果有保存的 WiFi，尝试连接
  // 2. 如果没保存或连接失败，开启 AP (热点名为 ESP32-Config)
  // 3. 阻塞等待用户通过 192.168.4.1 配置
  bool res = wm.autoConnect("ESP32-Config"); 
  if (!res) {
    // 非阻塞模式下需要持续调用 process
    while (wm.process()) {
      delay(10);
    }
  }

  if (!res) {
    LOG_E("WIFI", "Failed to connect");
    // 如果超时也没连上，可以选择重启或者继续运行（离线模式）
    // ESP.restart();
  } else {
    LOG_I("WIFI", "Connected! IP: %s", WiFi.localIP().toString().c_str());
    
    // 初始化设备 MAC 地址（保持冒号格式，统一与后端一致）
    g_deviceMAC = WiFi.macAddress();
    g_deviceMAC.toUpperCase();     // 转大写，保留冒号！
    
    // 初始化 MQTT 相关的 ID 和 Topic，继续使用带冒号的 g_deviceMAC
    g_mqtt_topic_data = "device/" + g_deviceMAC + "/data";
    g_mqtt_topic_cmd  = "device/" + g_deviceMAC + "/cmd";
    
    LOG_I("WIFI", "MAC: %s", g_deviceMAC.c_str());
    LOG_I("WIFI", "Topic Data: %s", g_mqtt_topic_data.c_str());
    LOG_I("WIFI", "Topic Cmd:  %s", g_mqtt_topic_cmd.c_str());
  }
}

void setupMQTT() {
  mqttClient.onConnect(onMqttConnect);
  mqttClient.onDisconnect(onMqttDisconnect);
  mqttClient.onPublish(onMqttPublish);
  mqttClient.onMessage(onMqttMessage);
  mqttClient.setServer(mqtt_server, mqtt_port);
  mqttClient.setKeepAlive(30);   
  
  // 确保我们在 WiFi 还没连上的情况下也能有一个默认 ID
  if (g_deviceMAC == "") {
      g_deviceMAC = WiFi.macAddress();
      g_deviceMAC.toUpperCase();     // 转大写
      g_deviceMAC.replace(":", "");  // 去除冒，保留冒号！
  }

  // 单独创建一个清理掉冒号的临时字符串给 Client ID 使用（防止被 Broker 拒绝）
  // 必须使用静态或全局变量保活该内存，因为底层库可能不会拷贝
  static String s_mqttClientId; 
  String cleanMacForClientId = g_deviceMAC;
  cleanMacForClientId.replace(":", "");
  s_mqttClientId = String(product_id) + "_" + cleanMacForClientId;
  
  mqttClient.setClientId(s_mqttClientId.c_str()); // 刚才不小心把这关键的连接配置代码删掉了!!
  LOG_I("MQTT", "Client ID set to: %s", s_mqttClientId.c_str());

  // 遗嘱消息（payload 必须用全局变量保活，局部 String 析构后 c_str() 会成悬空指针）
  g_mqtt_will_payload = DataPayload::buildPresencePayload("offline", g_deviceMAC);
  mqttClient.setWill(g_mqtt_topic_data.c_str(), 1, true, g_mqtt_will_payload.c_str());

  s_mqttConnecting = true;
  mqttClient.connect();
}


unsigned long lastReconnectAttempt = 0;  

void checkNetwork() {
  unsigned long now = millis();
  
  // 防止网络层挂死，连接超过 20 秒未响应则重置连接状态
  if (s_mqttConnecting && (now - lastReconnectAttempt > 20000)) {
     s_mqttConnecting = false;
  }
  
  if (!mqttClient.connected() && !s_mqttConnecting) {
    if (now - lastReconnectAttempt > 5000) { // 每5秒尝试一次重连
      lastReconnectAttempt = now;
      if (WiFi.isConnected()) {
        LOG_I("MQTT", "Attempting MQTT reconnect...");
        s_mqttConnecting = true;
        mqttClient.connect();
      } else {
        LOG_W("WIFI", "Disconnected, attempting reconnect...");
        WiFi.disconnect();
        // WiFiManager 已保存凭据，调用无参 begin() 使用存储的配置
        WiFi.begin();
      }
    }
  }
}

void processMqttPublish() {
  unsigned long now = millis();
  if (!mqttClient.connected()) return;

  // 每 5 秒汇总一次 PUBACK，避免逐条刷屏
  if (s_pubAckWindowStart > 0 && now - s_pubAckWindowStart >= 5000) {
    if (s_pubAckCount > 0) {
      LOG_I("MQTT", "PubAck summary: %u acks / 5s", (unsigned)s_pubAckCount);
    }
    s_pubAckCount = 0;
    s_pubAckWindowStart = now;
  }

  // 周期上报由 MQTT 线程统一触发：传感器线程只负责更新快照
  SensorData sensorData;
  const bool hasSnapshot = sensorSnapshotGet(sensorData);
  if (hasSnapshot && (now - s_lastPeriodicPublishMs >= MQTT_UPLOAD_INTERVAL)) {
    String jsonData = DataPayload::buildStatePayload(&sensorData, isAlarmOn, isLedOn, g_workMode, g_alarmMode);
    mqttClient.publish(g_mqtt_topic_data.c_str(), 0, false, jsonData.c_str());
    s_lastPeriodicPublishMs = now;
    LOG_D("MQTT", "Periodic snapshot published");
  }

  // 快速上报请求：从回调线程迁移到 MQTT 线程执行，避免回调里直接发包
  if (s_immediatePublishRequested) {
    uint8_t reason = s_immediatePublishReason;
    s_immediatePublishRequested = false;
    s_immediatePublishReason = REASON_NONE;
    publishStateSnapshotNow(reasonToString(reason));
  }
}

//传感器数据
void publishData(float temperature, float humidity, float pressure, float lux, int smoke, float dewPoint, bool alarm, bool ledState) {
  if (mqttClient.connected()) {
    updateSensorSnapshot(temperature, humidity, pressure, lux, smoke, dewPoint);

    SensorData sensorData;
    String jsonData = sensorSnapshotGet(sensorData)
                      ? DataPayload::buildStatePayload(&sensorData, alarm, ledState, g_workMode, g_alarmMode)
                      : DataPayload::buildStatePayload(nullptr, alarm, ledState, g_workMode, g_alarmMode);

    // 兼容旧逻辑：直接发一次状态包
    mqttClient.publish(g_mqtt_topic_data.c_str(), 0, false, jsonData.c_str());
    LOG_D("MQTT", "Legacy publishData sent");
  
  } else {
    LOG_W("MQTT", "Disconnected, skipping sensor publish");
  }
}

//RFID数据
void publishRfidData(String rawData, String cardId, String source) {
  if (mqttClient.connected()) {
    String jsonData = DataPayload::buildRfidPayload(rawData, cardId, source);

    // 使用动态 Topic
    mqttClient.publish(g_mqtt_topic_data.c_str(), 1, false, jsonData.c_str());
    LOG_I("MQTT", "RFID published uid=%s source=%s", cardId.c_str(), source.c_str());
    
  } else {
    LOG_W("MQTT", "Disconnected, skipping RFID publish");
  }
}

//报警事件
void publishAlarmEvent(const char* alarmType, int severity, const char* content) {
  if (mqttClient.connected()) {
    String jsonData = DataPayload::buildAlarmEventPayload(alarmType, severity, content);
    mqttClient.publish(g_mqtt_topic_data.c_str(), 1, false, jsonData.c_str());
    LOG_W("MQTT", "AlarmEvent type=%s severity=%d content=%s", alarmType, severity, content);
  }
}
