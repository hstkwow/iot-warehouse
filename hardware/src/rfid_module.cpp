#include "rfid_module.h"
#include "network_module.h"
#include "sound_output_module.h"
#include "alarm_module.h"
#include "logger.h"
#include <SPI.h>
#include <MFRC522.h>
#include "config.h"

// RC522 器件定义
MFRC522 mfrc522(SS_PIN, RST_PIN);
MFRC522::MIFARE_Key key;

static const char* TAG_RFID = "RFID";       // RFID 模块日志标签
static unsigned long lastRfidTime = 0;
static const unsigned long RFID_POLL_INTERVAL = 400; //  检测一次，响应更快

// 防抖与重复刷卡冷却设置
static String lastReadUid = "";
static unsigned long lastUidReadTime = 0;
static const unsigned long RFID_COOLDOWN_MS = 3000; // 同一张卡冷却3秒，防连续触发

void initRfid() {
    // RC522 最大支持 10MHz SPI，限制到 4MHz 提高传输可靠性
    SPI.begin(SPI_SCK, SPI_MISO, SPI_MOSI, SS_PIN);
    SPI.setFrequency(4000000);
    mfrc522.PCD_Init();
    delay(50);
    mfrc522.PCD_SetAntennaGain(MFRC522::RxGain_max);

    for (byte i = 0; i < 6; i++) {
        key.keyByte[i] = 0xFF;
    }

    byte ver  = mfrc522.PCD_ReadRegister(MFRC522::VersionReg);
    byte gain = mfrc522.PCD_GetAntennaGain();
    LOG_I(TAG_RFID, "RC522 initialized, firmware=0x%02X, gain=0x%02X", ver, gain);
}

// ---- 基础操作 ----

// 检测并选中一张新卡，返回 UID 字符串；无卡或失败返回 ""
String readRfidUid() {
    if (!mfrc522.PICC_IsNewCardPresent()) return "";
    if (!mfrc522.PICC_ReadCardSerial()) return "";

    String content = "";
    for (byte i = 0; i < mfrc522.uid.size; i++) {
        content.concat(String(mfrc522.uid.uidByte[i] < 0x10 ? " 0" : " "));
        content.concat(String(mfrc522.uid.uidByte[i], HEX));
    }
    content.toUpperCase();
    return content.substring(1);
}

void haltRfid() {       // 停止卡片通讯，防止重复读取
    mfrc522.PICC_HaltA();
    mfrc522.PCD_StopCrypto1();
}

bool writeRfidData(const String& dataStr) {
    byte blockAddr    = 4;
    byte trailerBlock = 7;
    byte buffer[16];

    memset(buffer, ' ', sizeof(buffer));
    size_t len = min((size_t)dataStr.length(), sizeof(buffer));
    memcpy(buffer, dataStr.c_str(), len);

    mfrc522.PCD_StopCrypto1();
    MFRC522::StatusCode status = mfrc522.PCD_Authenticate(
        MFRC522::PICC_CMD_MF_AUTH_KEY_A, trailerBlock, &key, &(mfrc522.uid));
    if (status != MFRC522::STATUS_OK) return false;

    for (int attempt = 0; attempt < 3; attempt++) {
        if (attempt > 0) delay(20);
        status = mfrc522.MIFARE_Write(blockAddr, buffer, 16);
        if (status == MFRC522::STATUS_OK) return true;
    }
    return false;
}

String readRfidDataBlock() {
    byte blockAddr    = 4;
    byte trailerBlock = 7;
    MFRC522::StatusCode status;
    byte buffer[18];
    byte size = sizeof(buffer);

    mfrc522.PCD_StopCrypto1();
    status = mfrc522.PCD_Authenticate(
        MFRC522::PICC_CMD_MF_AUTH_KEY_A, trailerBlock, &key, &(mfrc522.uid));
    if (status != MFRC522::STATUS_OK) return "";

    status = mfrc522.MIFARE_Read(blockAddr, buffer, &size);
    if (status != MFRC522::STATUS_OK) return "";

    String data = "";
    for (byte i = 0; i < 16; i++) {
        if (buffer[i] >= 32 && buffer[i] <= 126) data += (char)buffer[i];
    }
    data.trim();
    return data.length() > 0 ? data : "";
}

void handleRfidOperation() {
    if (millis() - lastRfidTime < RFID_POLL_INTERVAL) return;
    lastRfidTime = millis();
    
    //写入数据
    if (pendingWriteData != "") {
        for (int attempt = 1; attempt <= 10; attempt++) {
            // 每次都重新复位 RC522，让卡片回到干净状态
            mfrc522.PCD_StopCrypto1();
            mfrc522.PCD_Init();
            delay(10);
            mfrc522.PCD_SetAntennaGain(MFRC522::RxGain_max);

            // 选卡
            if (!mfrc522.PICC_IsNewCardPresent() || !mfrc522.PICC_ReadCardSerial()) {
                if (attempt == 1) {
                    LOG_D(TAG_RFID, "Waiting card for write...");
                }
                continue;
            }

            // 读 UID
            String uid = "";
            for (byte i = 0; i < mfrc522.uid.size; i++) {
                uid.concat(String(mfrc522.uid.uidByte[i] < 0x10 ? " 0" : " "));
                uid.concat(String(mfrc522.uid.uidByte[i], HEX));
            }
            uid.toUpperCase();
            uid = uid.substring(1);

            // 写入
            if (writeRfidData(pendingWriteData)) {
                LOG_I(TAG_RFID, "Write Succcess");
                publishRfidData(pendingWriteData, uid, "write"); // source=write
                
                // 写完后强制进入冷却期，避免紧接着的 400ms 后立刻触发一个读取（入库）事件，因为新写完的卡还在机器上！
                lastReadUid = uid;
                lastUidReadTime = millis();
                
                pendingWriteData = "";
                haltRfid();
                playWriteSuccessSound();
                return;
            }

            LOG_W(TAG_RFID, "Write attempt %d failed for uid=%s", attempt, uid.c_str());
        }
        LOG_E(TAG_RFID, "Write failed after retries, pending len=%u", (unsigned)pendingWriteData.length());
    }else { // 读取数据
        String uid = readRfidUid();
        
        // 当没有卡或者读卡失败时退出
        if (uid == "") {
            // 如果卡已移开超过冷却时间，允许立刻复位最后一次读到的卡，从而提高连续扫同一张卡（拿起再放下）的灵敏度
            if (millis() - lastUidReadTime > RFID_COOLDOWN_MS) {
                lastReadUid = "";
            }
            return;
        }

        // 防连抖过滤：如果短时间内刷了同一张卡，直接休眠并跳过
        if (uid == lastReadUid && (millis() - lastUidReadTime < RFID_COOLDOWN_MS)) {
            LOG_D(TAG_RFID, "Cooldown skip uid=%s", uid.c_str());
            lastUidReadTime = millis(); // 如果卡一直停留在刷卡区，那么只要卡不拿走，就不触发下一次，并且刷新冷却时间
            haltRfid();
            return;
        }

        // 记下新成功读取的时间与UID，给下一次判定用
        lastReadUid = uid;
        lastUidReadTime = millis();

        String rawData = readRfidDataBlock();
        if (rawData == "") rawData = "null";

        LOG_I(TAG_RFID, "Card read: uid = %s data=%s mode=%s", uid.c_str(), rawData.c_str(), g_workMode.c_str());
        publishRfidData(rawData, uid, g_workMode); // action = inbound / outbound
        haltRfid();
        playReadSuccessSound();
    }
}
