#ifndef RFID_MODULE_H
#define RFID_MODULE_H

#include <Arduino.h>

// RFID 模块初始化
void initRfid();

// RFID 处理函数
void handleRfidOperation();
String readRfidUid();               // 读取卡片 UID
bool writeRfidData(const String& data);    // 写入数据到卡片
String readRfidDataBlock();         // 读取卡片数据块
void haltRfid();                    // 停止卡片通讯，防止重复读取

#endif
