#ifndef DISPLAY_MODULE_H
#define DISPLAY_MODULE_H

#include <Adafruit_SH110X.h>
#include <Adafruit_GFX.h>
#include "config.h"

extern Adafruit_SH1106G display;

void initDisplay();
void renderDisplayIdle(const char* title = "START", const char* subtitle = "Waiting data");
void displayPrevPage();
void displayNextPage();
void displayConfirm();
void displayBack();
void displayHandleNavigation(bool configPressed, bool backPressed, uint8_t encA, uint8_t encB, unsigned long nowMs);
void displayApplyEncoderDelta(int8_t delta);
void updateDisplay(float temperature, float humidity, float pressure, float lux, int smoke, float dewPoint);

// EC11 interrupt-driven navigation
void displayOnEncoderEdge();
int8_t displayConsumeEncoderDelta();

#endif
