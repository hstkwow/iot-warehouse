#ifndef SOUND_OUTPUT_MODULE_H
#define SOUND_OUTPUT_MODULE_H

#include <Arduino.h>
#include "Audio.h" // 引入 Audio 库定义

// 暴露全局 audio 对象，以便 main.cpp 检查 isRunning()
extern Audio audio; 

void initSoundOutput();
void processSoundOutput();

void playSpeechReply();              // 播放回复音（如果存在 reply.mp3）

void playAlarmSoundLevel(int severity); // 分级报警音: 3=紧急(烟雾), 2=警告(环境), 1=故障
void playStartupSound();        // 播放开机音
void playReadSuccessSound();    // 读卡成功音（短促双高音）
void playWriteSuccessSound();   // 写卡成功音（上升三音阶，区别于读卡）
int getSoundVolume();
void setSoundVolume(int vol);   // 设置音量 0-10
int changeSoundVolume(int delta);
void stopSoundOutput();         // 停止所有音频播放
void playSoundTone(int freq, int durationMs);   // 生成指定频率和持续时间的方波

#endif
