<template>
  <div class="device-config-container">
    <div class="page-header">
      <h2 class="page-title">设备配置</h2>
      <p class="page-subtitle">管理设备的报警阈值，保存后将同步下发到硬件</p>
    </div>

    <el-row :gutter="20" v-loading="pageLoading">
      <!-- 左侧设备列表 -->
      <el-col :span="6">
        <el-card class="device-list-card">
          <div slot="header" class="card-header">
            <span><i class="el-icon-cpu" style="margin-right: 4px;"></i>我的设备</span>
            <el-tag size="mini" type="info">{{ devices.length }}</el-tag>
          </div>
          <div v-if="devices.length === 0" class="empty-list">
            <i class="el-icon-warning-outline"></i>
            <p>暂无可配置的设备</p>
          </div>
          <div class="device-select-list" v-else>
            <el-tooltip
              v-for="device in devices"
              :key="device.deviceId"
              :content="device.status !== 1 ? '设备离线，无法配置' : ''"
              :disabled="device.status === 1"
              placement="right">
              <div
                :class="['device-item', { active: selectedDeviceId === device.deviceId, 'device-item--offline': device.status !== 1 }]"
                @click="device.status === 1 && selectDevice(device)">
                <div class="device-item-top">
                  <span class="device-name">{{ device.deviceName || device.deviceId }}</span>
                  <span :class="['status-dot', device.status === 1 ? 'online' : 'offline']"></span>
                </div>
                <div class="device-meta">
                  {{ device.location || '未设置位置' }}
                </div>
              </div>
            </el-tooltip>
          </div>
        </el-card>
      </el-col>

      <!-- 右侧配置表单 -->
      <el-col :span="18">
        <div v-if="selectedDeviceId && configForm">

          <el-card class="config-panel" shadow="never">
            <!-- 面板头部 -->
            <div slot="header" class="config-panel-header">
              <div class="config-panel-title">
                <span :class="['status-dot', selectedDevice && selectedDevice.status === 1 ? 'online' : 'offline']" style="margin-right:8px;"></span>
                {{ selectedDeviceName }}
                <span class="config-panel-sub">阈值配置</span>
              </div>
              <el-button size="small" plain icon="el-icon-switch-button" @click="openControlDialog">设备控制</el-button>
            </div>

            <!-- 配置内容 -->
            <div class="config-form">

              <!-- 工作模式 -->
              <div class="form-section">
                <div class="form-section-title">工作模式</div>
                <div class="form-row">
                  <div class="form-field">
                    <el-radio-group v-model="configForm.workMode" size="small">
                      <el-radio-button label="inbound">入库</el-radio-button>
                      <el-radio-button label="outbound">出库</el-radio-button>
                    </el-radio-group>
                    <span class="field-tip">
                      <span v-if="configForm.workMode === 'inbound'">仅检测入库动作</span>
                      <span v-else>仅检测出库动作</span>
                    </span>
                  </div>
                </div>
              </div>

              <el-divider class="form-divider"></el-divider>

              <!-- 报警模式 -->
              <div class="form-section">
                <div class="form-section-title">报警模式</div>
                <div class="form-row">
                  <div class="form-field">
                    <el-radio-group v-model="configForm.alarmMode" size="small">
                      <el-radio-button label="auto">自动</el-radio-button>
                      <el-radio-button label="manual">手动</el-radio-button>
                    </el-radio-group>
                    <span class="field-tip">
                      <span v-if="configForm.alarmMode === 'auto'">根据阈值自动触发报警</span>
                      <span v-else>仅通过人工指令手动触发</span>
                    </span>
                  </div>
                </div>
              </div>

              <el-divider class="form-divider"></el-divider>

              <!-- 温度 -->
              <div class="form-section">
                <div class="form-section-title">
                  <span class="section-dot temp"></span>温度阈值
                </div>
                <div class="form-row">
                  <div class="form-field">
                    <label class="field-label">低温报警 (°C)</label>
                    <el-input-number v-model="configForm.tempMin" :min="-50" :max="configForm.tempMax - 1" :step="0.5" :precision="1" size="small" controls-position="right"></el-input-number>
                  </div>
                  <div class="form-field">
                    <label class="field-label">高温报警 (°C)</label>
                    <el-input-number v-model="configForm.tempMax" :min="configForm.tempMin + 1" :max="100" :step="0.5" :precision="1" size="small" controls-position="right"></el-input-number>
                  </div>
                  <div class="form-field range-field">
                    <label class="field-label">安全范围</label>
                    <div class="range-track">
                      <div class="range-danger-zone low" :style="{ width: tempMinPercent + '%' }"></div>
                      <div class="range-safe-zone" :style="{ left: tempMinPercent + '%', width: (tempMaxPercent - tempMinPercent) + '%' }"></div>
                      <div class="range-danger-zone high" :style="{ left: tempMaxPercent + '%', width: (100 - tempMaxPercent) + '%' }"></div>
                    </div>
                    <div class="range-labels"><span>-50°C</span><span class="range-safe-label">{{ configForm.tempMin }}°C ~ {{ configForm.tempMax }}°C</span><span>100°C</span></div>
                  </div>
                </div>
              </div>

              <el-divider class="form-divider"></el-divider>

              <!-- 湿度 -->
              <div class="form-section">
                <div class="form-section-title">
                  <span class="section-dot humi"></span>湿度阈值
                </div>
                <div class="form-row">
                  <div class="form-field">
                    <label class="field-label">高湿报警 (%)</label>
                    <el-input-number v-model="configForm.humidityMax" :min="10" :max="100" :step="1" :precision="0" size="small" controls-position="right"></el-input-number>
                    <span class="field-tip">超过 {{ configForm.humidityMax }}% 触发</span>
                  </div>
                </div>
              </div>

              <el-divider class="form-divider"></el-divider>

              <!-- 烟雾 -->
              <div class="form-section">
                <div class="form-section-title">
                  <span class="section-dot smoke"></span>烟雾阈值
                </div>
                <div class="form-row">
                  <div class="form-field">
                    <label class="field-label">浓度报警 (ADC)</label>
                    <el-input-number v-model="configForm.smokeThreshold" :min="100" :max="4095" :step="100" :precision="0" size="small" controls-position="right"></el-input-number>
                    <span class="field-tip">MQ-2 超过 {{ configForm.smokeThreshold }} 触发</span>
                  </div>
                </div>
              </div>

              <el-divider class="form-divider"></el-divider>

              <!-- 气压 -->
              <div class="form-section">
                <div class="form-section-title">
                  <span class="section-dot pres"></span>气压阈值
                </div>
                <div class="form-row">
                  <div class="form-field">
                    <label class="field-label">气压上限 (hPa)</label>
                    <el-input-number v-model="configForm.pressureMax" :min="900" :max="1100" :step="1" :precision="0" size="small" controls-position="right"></el-input-number>
                    <span class="field-tip">超过 {{ configForm.pressureMax }} hPa 触发</span>
                  </div>
                </div>
              </div>

              <el-divider class="form-divider"></el-divider>

              <!-- 露点 -->
              <div class="form-section">
                <div class="form-section-title">
                  <span class="section-dot dew"></span>露点阈值
                </div>
                <div class="form-row">
                  <div class="form-field">
                    <label class="field-label">露点上限 (°C)</label>
                    <el-input-number v-model="configForm.dewPointMax" :min="-20" :max="50" :step="0.5" :precision="1" size="small" controls-position="right"></el-input-number>
                    <span class="field-tip">超过 {{ configForm.dewPointMax }}°C 易结露</span>
                  </div>
                </div>
              </div>

              <el-divider class="form-divider"></el-divider>

              <!-- 光照 -->
              <div class="form-section">
                <div class="form-section-title">
                  <span class="section-dot lux"></span>光照阈值
                </div>
                <div class="form-row">
                  <div class="form-field">
                    <label class="field-label">光照上限 (Lux)</label>
                    <el-input-number v-model="configForm.luxMax" :min="100" :max="65535" :step="500" :precision="0" size="small" controls-position="right"></el-input-number>
                    <span class="field-tip">超过 {{ configForm.luxMax }} Lux 触发报警</span>
                  </div>
                </div>
              </div>

              <!-- 底部操作 -->
              <div class="form-footer">
                <el-button size="medium" icon="el-icon-refresh-left" @click="resetConfig">重置</el-button>
                <el-button type="primary" size="medium" icon="el-icon-upload2" @click="saveConfig" :loading="saving">
                  保存并下发到设备
                </el-button>
              </div>

            </div>
          </el-card>

        </div>

        <div v-else class="no-select">
          <i class="el-icon-setting"></i>
          <p>请从左侧选择一个设备进行配置</p>
        </div>
      </el-col>
    </el-row>

    <!-- 设备控制弹窗 -->
    <el-dialog
        :title="'设备控制 — ' + selectedDeviceName"
        :visible.sync="controlDialogVisible"
        width="460px"
        append-to-body
        custom-class="control-dialog">
        
        <div class="control-dialog-body" v-if="configForm">
            <!-- 离线提示 -->
            <el-alert
                v-if="!deviceOnline"
                title="设备当前离线，指令发送后将在设备上线时生效"
                type="warning"
                :closable="false"
                show-icon
                style="margin-bottom:14px;"
            ></el-alert>

            <!-- 设备状态 -->
            <div class="ctrl-device-bar">
                <span class="ctrl-device-name">当前设备：<b>{{ selectedDeviceName }}</b></span>
                <el-tag size="small" :type="deviceOnline ? 'success' : 'info'">
                    {{ deviceOnline ? '在线' : '离线' }}
                </el-tag>
            </div>

            <!-- 工作模式 -->
            <div class="ctrl-row">
                <span class="ctrl-label">工作模式</span>
                <el-radio-group v-model="configForm.workMode" size="small" :disabled="!deviceOnline" @change="handleWorkModeChange">
                    <el-radio-button label="inbound">入库</el-radio-button>
                    <el-radio-button label="outbound">出库</el-radio-button>
                </el-radio-group>
            </div>

            <!-- 报警模式 -->
            <div class="ctrl-row">
                <span class="ctrl-label">报警模式</span>
                <el-radio-group v-model="configForm.alarmMode" size="small" :disabled="!deviceOnline" @change="handleModeChange">
                    <el-radio-button label="auto"><i class="el-icon-cpu"></i> 自动托管</el-radio-button>
                    <el-radio-button label="manual"><i class="el-icon-thumb"></i> 手动控制</el-radio-button>
                </el-radio-group>
            </div>

            <!-- 自动模式提示 -->
            <div v-if="configForm.alarmMode === 'auto'" class="ctrl-auto-tip">
                <i class="el-icon-info-outline"></i>
                传感器将自动监测环境，当温度或烟雾超标时自动触发报警。手动开关已被锁定。
            </div>

            <el-divider style="margin: 16px 0;"></el-divider>

            <!-- 开关控制 -->
            <div class="ctrl-switches">
                <div class="ctrl-switch-item">
                    <div class="ctrl-switch-header">
                        <span>灯光控制</span>
                        <el-tag size="mini" type="warning" effect="plain">RGB</el-tag>
                    </div>
                    <div class="ctrl-switch-icon" :class="{ 'on': controlState.led }">
                        <i class="el-icon-sunny"></i>
                    </div>
                    <div class="ctrl-switch-toggle">
                        <span>关</span>
                        <el-switch v-model="controlState.led" :disabled="!deviceOnline" @change="val => sendControl('led', val)" active-color="#e6a23c"></el-switch>
                        <span>开</span>
                    </div>
                </div>

                <div class="ctrl-switch-item">
                    <div class="ctrl-switch-header">
                        <span>报警控制</span>
                        <el-tag size="mini" type="danger" effect="plain">Buzzer</el-tag>
                    </div>
                    <div class="ctrl-switch-icon" :class="{ 'on alarm': controlState.alarm }">
                        <i class="el-icon-bell"></i>
                    </div>
                    <div class="ctrl-switch-toggle">
                        <span>关</span>
                        <el-switch
                            v-model="controlState.alarm"
                            :disabled="!deviceOnline || configForm.alarmMode === 'auto'"
                            @change="val => sendControl('alarm', val)"
                            active-color="#f56c6c">
                        </el-switch>
                        <span>开</span>
                    </div>
                </div>
            </div>
        </div>

        <div slot="footer">
            <el-button @click="controlDialogVisible = false">关闭</el-button>
        </div>
    </el-dialog>
  </div>
</template>

<script>
import { getAllDevices, getDeviceConfig, saveDeviceConfig, getLatestSensorData, sendDeviceCommand } from '@/api/device'

// 与硬件 config.h 中 DEFAULT_* 保持一致的默认值
const HW_DEFAULTS = {
  tempMax: 30,
  tempMin: 0,
  humidityMax: 70,
  smokeThreshold: 2000,
  pressureMax: 1050,
  dewPointMax: 25,
  luxMax: 10000,
  workMode: 'both',
  alarmMode: 'auto' // new default
}

export default {
  name: 'DeviceConfig',
  data() {
    return {
      devices: [],
      selectedDeviceId: '',
      configForm: null,
      originalConfig: null,
      pageLoading: false,
      saving: false,
      
      // Control State
      controlDialogVisible: false,
      controlState: {
          led: false,
          alarm: false
      },
    }
  },
  computed: {
    selectedDeviceName() {
      const d = this.devices.find(d => d.deviceId === this.selectedDeviceId)
      return d ? (d.deviceName || d.deviceId) : ''
    },
    selectedDevice() {
        return this.devices.find(d => d.deviceId === this.selectedDeviceId);
    },
    deviceOnline() {
      return this.selectedDevice && this.selectedDevice.status === 1;
    },
    // 温度条百分比（-50 ~ 100 映射到 0 ~ 100%）
    tempMinPercent() {
      if (!this.configForm) return 0
      return ((this.configForm.tempMin + 50) / 150 * 100)
    },
    tempMaxPercent() {
      if (!this.configForm) return 100
      return ((this.configForm.tempMax + 50) / 150 * 100)
    }
  },
  mounted() {
    this.loadDevices()
  },
  methods: {
    openControlDialog() {
        if (!this.selectedDeviceId) {
            this.$message.warning('请先选择一个设备');
            return;
        }
        // 打开时仅拉取一次当前状态
        getLatestSensorData(this.selectedDeviceId).then(res => {
            if ((res.code === 200 || res.code === 1) && res.data) {
                try {
                    if (res.data.extraInfo) {
                        const extra = JSON.parse(res.data.extraInfo);
                        if (extra.led !== undefined) this.controlState.led = extra.led;
                        if (extra.alarm !== undefined) this.controlState.alarm = extra.alarm;
                    }
                } catch (e) { /* ignore */ }
            }
        });
        this.controlDialogVisible = true;
    },
    async handleWorkModeChange(val) {
        if (!this.selectedDeviceId) return;
        try {
            const res = await sendDeviceCommand(this.selectedDeviceId, { work_mode: val });
            if (res.code === 200 || res.code === 1) {
                this.$message.success(`已切换为${val === 'inbound' ? '入库' : '出库'}模式`);
            } else {
                this.$message.warning('工作模式指令发送失败');
            }
        } catch (e) {
            this.$message.error('网络错误，无法下发工作模式指令');
        }
    },

    async handleModeChange(val) {
        if (!this.selectedDeviceId) return;
        try {
            const res = await sendDeviceCommand(this.selectedDeviceId, { alarm_mode: val });
            if (res.code === 200 || res.code === 1) {
                this.$message.success(`已切换为${val === 'auto' ? '自动' : '手动'}模式`);
            } else {
                this.$message.warning('模式切换指令发送失败');
            }
        } catch (e) {
            this.$message.error('网络错误，无法下发模式指令');
        }
    },

    async sendControl(type, value) {
        if (!this.selectedDeviceId) return;
        
        const cmd = {};
        cmd[type] = value;

        try {
            const res = await sendDeviceCommand(this.selectedDeviceId, cmd);
            if (res.code === 200 || res.code === 1) {
                this.$message.success('指令已发送');
            } else {
                this.$message.error(res.message || '发送失败');
                // Revert UI if needed 
                this.controlState[type] = !value;
            }
        } catch (error) {
            this.$message.error('网络错误');
            this.controlState[type] = !value;
        }
    },

    async loadDevices() {
      this.pageLoading = true
      try {
        const res = await getAllDevices()
        if (res.code === 1 || res.code === 200) {
          this.devices = res.data || []
          // 不自动选中，由用户手动点击在线设备
        }
      } catch (e) {
        this.$message.error('加载设备列表失败')
      } finally {
        this.pageLoading = false
      }
    },

    async selectDevice(device) {
      if (this.selectedDeviceId === device.deviceId) return

      this.selectedDeviceId = device.deviceId
      this.configForm = null

      try {
        const res = await getDeviceConfig(this.selectedDeviceId)
        if (res.code === 200 || res.code === 1) {
          if (res.data) {
            this.configForm = { ...res.data }
          } else {
            // 无配置记录时，使用与硬件一致的默认值
            this.configForm = {
              deviceId: device.deviceId,
              ...HW_DEFAULTS
            }
          }
          this.originalConfig = JSON.parse(JSON.stringify(this.configForm))
        }
      } catch (e) {
        this.$message.error('加载设备配置失败')
      }
    },

    async saveConfig() {
      if (!this.configForm || !this.selectedDeviceId) return
      // 校验温度范围
      if (this.configForm.tempMin >= this.configForm.tempMax) {
        this.$message.warning('低温阈值必须小于高温阈值')
        return
      }
      this.saving = true
      try {
        this.configForm.deviceId = this.selectedDeviceId
        const res = await saveDeviceConfig(this.configForm)
        if (res.code === 1 || res.code === 200) {
          this.$message.success('配置已保存并下发到设备')
          this.originalConfig = JSON.parse(JSON.stringify(this.configForm))
          if (res.data) {
            this.configForm = { ...res.data }
            this.originalConfig = JSON.parse(JSON.stringify(this.configForm))
          }
        } else {
          this.$message.error(res.msg || '保存失败')
        }
      } catch (e) {
        this.$message.error('保存配置失败，请重试')
      } finally {
        this.saving = false
      }
    },

    resetConfig() {
      if (this.originalConfig) {
        this.configForm = JSON.parse(JSON.stringify(this.originalConfig))
        this.$message.info('已重置为上次保存的配置')
      }
    }
  }
}
</script>

<style scoped lang="css">
.device-config-container {
  animation: pageEnter 0.3s ease-out;
  max-width: 1400px;
  margin: 0 auto;
}

@keyframes pageEnter {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

.page-header { margin-bottom: 24px; }
.page-header h2 { margin: 0; font-size: 24px; font-weight: 700; color: var(--text-primary); }
.page-header p { margin: 8px 0 0; color: var(--text-secondary); font-size: 14px; }

/* 设备列表 */
.device-list-card { border-radius: var(--radius-lg); box-shadow: var(--shadow-sm); }
.device-list-card >>> .el-card__header { padding: 14px 16px; }

.device-select-list { display: flex; flex-direction: column; gap: 6px; }

.device-item {
  padding: 12px 14px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.25s ease;
  border: 1px solid transparent;
  background: var(--bg-secondary);
}
.device-item:hover { background: var(--primary-light-7); border-color: var(--primary-light-4); }
.device-item.active {
  background: var(--primary-light-6);
  border-color: var(--primary-color);
  box-shadow: 0 0 0 1px var(--primary-light-3);
}
.device-item--offline {
  opacity: 0.45;
  cursor: not-allowed !important;
}
.device-item--offline:hover { background: var(--bg-secondary) !important; border-color: transparent !important; }

.device-item-top { display: flex; justify-content: space-between; align-items: center; }
.device-name { font-weight: 600; font-size: 13px; color: var(--text-primary); }
.device-meta { font-size: 12px; color: var(--text-secondary); margin-top: 4px; }

.status-dot {
  width: 8px; height: 8px; border-radius: 50%;
  display: inline-block; flex-shrink: 0;
}
.status-dot.online { background: var(--success-color); box-shadow: 0 0 6px var(--success-color); }
.status-dot.offline { background: #c0c4cc; }

.empty-list { text-align: center; padding: 40px 0; color: var(--text-secondary); }
.empty-list i { font-size: 36px; opacity: 0.3; margin-bottom: 8px; display: block; }

/* 统一配置面板 */
.config-panel { border-radius: var(--radius-lg) !important; border: 1px solid #ebeef5 !important; }
.config-panel >>> .el-card__body { padding: 0; }
.config-panel >>> .el-card__header { padding: 14px 24px; border-bottom: 1px solid #f0f2f5; }

.config-panel-header {
  display: flex; justify-content: space-between; align-items: center;
}
.config-panel-title {
  display: flex; align-items: center; font-size: 15px; font-weight: 600; color: var(--text-primary);
}
.config-panel-sub { margin-left: 8px; font-size: 13px; font-weight: 400; color: var(--text-secondary); }

/* 配置表单 */
.config-form { padding: 24px; }

.form-section { margin-bottom: 4px; }
.form-section-title {
  font-size: 13px; font-weight: 600; color: var(--text-regular);
  display: flex; align-items: center; gap: 8px; margin-bottom: 16px;
  text-transform: uppercase; letter-spacing: 0.5px;
}
.section-dot {
  width: 10px; height: 10px; border-radius: 3px; display: inline-block;
}
.section-dot.temp  { background: #fa541c; }
.section-dot.humi  { background: #1890ff; }
.section-dot.smoke { background: #d46b08; }
.section-dot.pres  { background: #52c41a; }
.section-dot.dew   { background: #722ed1; }
.section-dot.lux   { background: #faad14; }

.form-row {
  display: flex; flex-wrap: wrap; gap: 24px; align-items: flex-start;
}
.form-field {
  display: flex; flex-direction: column; gap: 8px; flex: 1; min-width: 160px;
}
.range-field { flex: 2; min-width: 280px; }

.field-label {
  font-size: 13px; color: var(--text-regular); font-weight: 500;
}
.field-tip {
  font-size: 12px; color: var(--text-secondary);
}

.form-divider { margin: 20px 0 !important; }

/* 温度范围条 */
.range-track {
  height: 8px; border-radius: 4px; background: #f5f5f5;
  position: relative; overflow: hidden;
}
.range-danger-zone { position: absolute; top: 0; height: 100%; }
.range-danger-zone.low  { left: 0; background: rgba(24,144,255,0.25); border-radius: 4px 0 0 4px; }
.range-danger-zone.high { background: rgba(250,84,28,0.25); border-radius: 0 4px 4px 0; }
.range-safe-zone {
  position: absolute; top: 0; height: 100%;
  background: linear-gradient(90deg, rgba(19,222,185,0.4), rgba(19,222,185,0.2));
}
.range-labels {
  display: flex; justify-content: space-between; align-items: center;
  font-size: 11px; color: var(--text-secondary); margin-top: 5px;
}
.range-safe-label { color: var(--success-color); font-weight: 600; }

/* 底部操作 */
.form-footer {
  margin-top: 28px; padding-top: 20px;
  border-top: 1px solid #f0f2f5;
  display: flex; justify-content: flex-end; gap: 12px;
}

/* Card Header */
.card-header { display: flex; justify-content: space-between; align-items: center; }

/* 无选中 */
.no-select {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  min-height: 400px; color: var(--text-secondary);
  background: var(--bg-white); border-radius: var(--radius-lg); box-shadow: var(--shadow-sm);
}
.no-select i { font-size: 48px; margin-bottom: 12px; opacity: 0.3; }
.no-select p { font-size: 14px; }

/* Control Dialog */
.ctrl-device-bar {
  display: flex; justify-content: space-between; align-items: center;
  padding: 10px 14px; background: #f5f7fa; border-radius: 8px; margin-bottom: 20px;
}
.ctrl-device-name { font-size: 14px; color: #606266; }
.ctrl-device-name b { color: #303133; }

.ctrl-row {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 14px;
}
.ctrl-label { font-size: 14px; font-weight: 600; color: #303133; }

.ctrl-auto-tip {
  background: #f4f4f5; border-radius: 6px; padding: 10px 14px;
  font-size: 13px; color: #606266; line-height: 1.6;
  display: flex; gap: 8px;
}
.ctrl-auto-tip i { color: #909399; flex-shrink: 0; margin-top: 2px; }

.ctrl-switches { display: flex; gap: 16px; }
.ctrl-switch-item {
  flex: 1; background: #fafafa; border: 1px solid #ebeef5;
  border-radius: 10px; padding: 20px 12px;
  display: flex; flex-direction: column; align-items: center; gap: 14px;
}
.ctrl-switch-header { width: 100%; display: flex; justify-content: space-between; align-items: center; font-size: 13px; font-weight: 500; color: #303133; }
.ctrl-switch-icon {
  width: 56px; height: 56px; border-radius: 50%;
  background: #e4e7ed; color: #c0c4cc;
  display: flex; align-items: center; justify-content: center; font-size: 28px;
  transition: all 0.3s;
}
.ctrl-switch-icon.on { background: #fdf6ec; color: #e6a23c; box-shadow: 0 4px 14px rgba(230,162,60,0.3); }
.ctrl-switch-icon.on.alarm { background: #fef0f0; color: #f56c6c; box-shadow: 0 4px 14px rgba(245,108,108,0.3); }
.ctrl-switch-toggle { display: flex; align-items: center; gap: 10px; font-size: 13px; color: #909399; }

</style>
