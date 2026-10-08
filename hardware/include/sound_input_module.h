#ifndef SOUND_INPUT_MODULE_H
#define SOUND_INPUT_MODULE_H

#include <Arduino.h>

void initSoundInput();          // 声音输入和语音模块初始化
String requestBaiduToken();     // 获取百度 Access Token，内部会自动管理过期和刷新

String recognizeSpeech(uint8_t* audioData, size_t dataSize); // STT
bool synthesizeSpeech(String text); // TTS 

// 语音控制入口：fromButton=true 按键触发，false 唤醒词触发
void handleSoundInputControl(bool fromButton = true);
// 语音指令处理
String processSoundCommand(const String& text);

#endif
