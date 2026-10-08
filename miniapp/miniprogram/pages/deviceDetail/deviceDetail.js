import { getDeviceById, getLatestSensorData, sendDeviceCommand, updateDevice, getAssignedUsers, assignDevice, revokeAccess } from '../../api/device.js';
import { getLocations } from '../../api/location.js';
import { getAllUsers } from '../../api/sysUser.js';
import Toast from 'tdesign-miniprogram/toast/index';

Page({
  data: {
    device: {},
    isAdmin: false,
    latestData: null,
    loading: true,
    ledOn: false,
    alarmOn: false,
    alarmMode: 'auto',
    cmdSending: false,
    
    // 编辑设备
    editing: false,
    editForm: {},
    showLocationPicker: false,
    locationOptions: [],
    locationPickerValue: [],

    // 分配设备 (admin)
    showAssign: false,
    allUsers: [],
    assignedUserIds: [],
    assignLoading: false
  },

  onLoad(options) {
    const user = wx.getStorageSync('user') || {};
    this.setData({ isAdmin: user.role === 'admin' });

    if (options.device) {
      try {
        const device = JSON.parse(decodeURIComponent(options.device));
        this.setData({ 
          device,
          ledOn: device.ledStatus === 1 || device.ledStatus === true,
          alarmOn: device.alarmStatus === 1 || device.alarmStatus === true,
          alarmMode: device.alarmMode || 'auto'
        });
      } catch (e) {
        console.error('parse device error', e);
      }
    }
  },

  onShow() {
    if (!wx.getStorageSync('token')) {
      wx.reLaunch({ url: '/pages/login/login' });
      return;
    }
    if (this.data.device.deviceId && this.data.device.status === 1) {
      this.fetchDeviceState(); // 读取设备最新开关灯/报警状态
      this.fetchLatestData();  // 读取环境传感器信息
      this.startRefresh();
    }
  },

  onHide() {
    this.stopRefresh();
  },

  onUnload() {
    this.stopRefresh();
  },

  startRefresh() {
    this.stopRefresh();
    this._timer = setInterval(() => {
      this.fetchLatestData();
    }, 3000);
  },

  stopRefresh() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
  },


  async fetchDeviceState() {
    try {
      const res = await getDeviceById(this.data.device.deviceId);
      if (res && res.data) {
        const d = res.data;
        this.setData({
          device: d,
          ledOn: d.ledStatus === 1 || d.ledStatus === true,
          alarmOn: d.alarmStatus === 1 || d.alarmStatus === true,
          alarmMode: d.alarmMode || 'auto'
        });
      }
    } catch (e) {
      console.error('fetchDeviceState error', e);
    }
  },

  async fetchLatestData() {
    try {
      const res = await getLatestSensorData(this.data.device.deviceId);
      const d = res.data;
      if (d) {
        this.setData({
          loading: false,
          latestData: {
            temperature: d.temperature != null ? Number(d.temperature).toFixed(1) : null,
            humidity: d.humidity != null ? Number(d.humidity).toFixed(1) : null,
            pressure: d.pressure != null ? Number(d.pressure).toFixed(1) : null,
            smokeDensity: d.smokeDensity != null ? Number(d.smokeDensity).toFixed(0) : null,
            luminance: d.luminance != null ? Number(d.luminance).toFixed(0) : null,
            dewPoint: d.dewPoint != null ? Number(d.dewPoint).toFixed(1) : null
          },
          // Removed ledOn and alarmOn because IotSensorData does not contain them and they bounce the UI
        });
      } else {
        this.setData({ loading: false });
      }
    } catch (e) {
      console.error('fetchLatestData error', e);
      this.setData({ loading: false });
    }
  },

  async onToggleLed(e) {
    if (this.data.cmdSending) return;
    const value = e.detail.value;
    this.setData({ ledOn: value }); // 乐观更新UI
    try {
      await this.sendCmd({ led: value }, value ? 'LED 开启' : 'LED 关闭');
    } catch (err) {
      this.setData({ ledOn: !value }); // 失败回滚
    }
  },

  async onToggleAlarm(e) {
    if (this.data.cmdSending) return;
    const value = e.detail.value;
    this.setData({ alarmOn: value }); // 乐观更新UI
    try {
      await this.sendCmd({ alarm: value }, value ? '报警开启' : '报警关闭');
    } catch (err) {
      this.setData({ alarmOn: !value }); // 失败回滚
    }
  },

  async setAlarmMode(e) {
    const mode = e.currentTarget.dataset.mode;
    if (mode === this.data.alarmMode) return;
    await this.sendCmd({ alarm_mode: mode }, mode === 'auto' ? '切换自动模式' : '切换手动模式');
  },

  async sendCmd(command, label) {
    if (this.data.cmdSending) throw new Error('cmdSending');
    this.setData({ cmdSending: true });
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
    try {
      await sendDeviceCommand(this.data.device.deviceId, command);
      const update = {};
      if ('led' in command) update.ledOn = command.led;
      if ('alarm' in command) update.alarmOn = command.alarm;
      if ('alarm_mode' in command) update.alarmMode = command.alarm_mode;
      this.setData(update);
            Toast({ context: this, selector: '#t-toast', message: '指令已发送', theme: 'success', direction: 'column' });
    } catch (e) {
      console.error('sendCmd error', e);
            Toast({ context: this, selector: '#t-toast', message: '发送失败', theme: 'error', direction: 'column' });
      throw e;
    } finally {
      this.setData({ cmdSending: false });
    }
  },


  // ========== 编辑设备 ==========

  async startEdit() {
    const { device } = this.data;
    this.setData({
      editing: true,
      editForm: {
        deviceName: device.deviceName || '',
        deviceType: device.deviceType || '',
        location: device.location || ''
      }
    });
    // 加载库位列表
    try {
      const res = await getLocations();
      const locations = (res.data || []).filter(loc => loc.level === 1);
      const locationOptions = locations.map(loc => ({
        label: loc.name || loc.id,
        value: loc.name || loc.id
      }));
      const idx = locationOptions.findIndex(o => o.value === device.location);
      this.setData({
        locationOptions,
        locationPickerValue: idx >= 0 ? [locationOptions[idx].value] : []
      });
    } catch (e) {
      console.error('loadLocations error', e);
    }
  },

  cancelEdit() {
    this.setData({ editing: false, editForm: {}, showLocationPicker: false });
  },

  onEditInput(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({ [`editForm.${field}`]: e.detail.value });
  },

  onShowLocationPicker() {
    this.setData({ showLocationPicker: true });
  },

  onLocationConfirm(e) {
    const val = e.detail.value[0];
    this.setData({
      showLocationPicker: false,
      'editForm.location': val,
      locationPickerValue: [val]
    });
  },

  onLocationCancel() {
    this.setData({ showLocationPicker: false });
  },

  async saveEdit() {
    const { device, editForm } = this.data;
    try {
      await updateDevice({
        id: device.id,
        deviceId: device.deviceId,
        deviceName: editForm.deviceName,
        deviceType: editForm.deviceType,
        location: editForm.location
      });
      // 更新本地数据
      this.setData({
        editing: false,
        'device.deviceName': editForm.deviceName,
        'device.deviceType': editForm.deviceType,
        'device.location': editForm.location
      });
      Toast({ context: this, selector: '#t-toast', message: '保存成功', theme: 'success', direction: 'column' });
    } catch (e) {
      console.error('saveEdit error', e);
      Toast({ context: this, selector: '#t-toast', message: '保存失败', theme: 'error', direction: 'column' });
    }
  },

  // ========== 分配设备 (Admin) ==========

  openConfigPage() {
    if (!this.data.device.deviceId) return;
    wx.navigateTo({
      url: '/pages/deviceConfig/deviceConfig?deviceId=' + this.data.device.deviceId
    });
  },

  async openAssignPopup() {
    this.setData({ showAssignPopup: true, assignLoading: true });
    try {
      const [usersRes, assignedRes] = await Promise.all([
        getAllUsers(),
        getAssignedUsers(this.data.device.deviceId)
      ]);
      const allUsers = (usersRes.data || []).filter(u => u.role !== 'admin');
      const assignedIds = (assignedRes.data || []).map(id => Number(id));
      
      const assignedUsers = allUsers.filter(u => assignedIds.includes(u.userId));
      const unassignedUsers = allUsers.filter(u => !assignedIds.includes(u.userId));

      this.setData({ 
        allUsers,
        assignedUsers, 
        unassignedUsers, 
        assignLoading: false 
      });
    } catch (e) {
      console.error('openAssign error', e);
      this.setData({ assignLoading: false });
      Toast({ context: this, selector: '#t-toast', message: '加载失败', theme: 'error', direction: 'column' });
    }
  },

  closeAssignPopup() {
    this.setData({ showAssignPopup: false });
  },

  async onAssignUser(e) {
    const userId = Number(e.currentTarget.dataset.uid);
    try {
      await assignDevice(this.data.device.deviceId, userId);
      Toast({ context: this, selector: '#t-toast', message: '已分配', theme: 'success', direction: 'column' });
      this.openAssignPopup(); // refresh lists
    } catch (err) {
      Toast({ context: this, selector: '#t-toast', message: '操作失败', theme: 'error', direction: 'column' });
    }
  },

  async onUnassignUser(e) {
    const userId = Number(e.currentTarget.dataset.uid);
    try {
      await revokeAccess(this.data.device.deviceId, userId);
      Toast({ context: this, selector: '#t-toast', message: '已取消', theme: 'success', direction: 'column' });
      this.openAssignPopup(); // refresh lists
    } catch (err) {
      Toast({ context: this, selector: '#t-toast', message: '操作失败', theme: 'error', direction: 'column' });
    }
  }
});
