import { getAllDevices, deleteDevice, getLatestSensorData, sendDeviceCommand, getDeviceConfig, saveDeviceConfig } from '../../api/device.js';
import Toast from 'tdesign-miniprogram/toast/index';

const HW_DEFAULTS = {
  tempMax: 30,
  tempMin: 0,
  humidityMax: 70,
  smokeThreshold: 2000,
  pressureMax: 1050,
  dewPointMax: 25,
  luxMax: 10000,
  workMode: 'inbound',
  alarmMode: 'auto'
};

Page({
  data: {
    statusBarHeight: wx.getWindowInfo().statusBarHeight || 44,

    activeTab: 0,

    // 设备列表
    devices: [],
    filteredDevices: [],
    filterType: 'all',
    onlineCount: 0,
    offlineCount: 0,
    loading: false,
    showDeleteDialog: false,
    deleteDeviceId: '',
    deleteDeviceName: '',

    // 设备控制 & 配置
    onlineDevices: [],
    controlDeviceId: '',
    controlDeviceName: '',
    latestData: null,
    ledOn: false,
    alarmOn: false,
    alarmMode: 'auto',
    cmdSending: false,
    cmdLog: [],

    // 阈值配置
    configForm: {
      workMode: 'inbound',
      alarmMode: 'auto',
      tempMin: 0,
      tempMax: 30,
      humidityMax: 70,
      smokeThreshold: 2000,
      pressureMax: 1050,
      dewPointMax: 25,
      luxMax: 10000
    },
    originalConfig: null,
    saving: false,
    controlDeviceOnline: false,
    tempMinPercent: 33.3,
    tempMaxPercent: 53.3
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().init();
    }

    if (!wx.getStorageSync('token')) {
      wx.reLaunch({ url: '/pages/login/login' });
      return;
    }
    this.loadDevices();
  },

  // ========== 设备列表 ==========

  async loadDevices() {
    this.setData({ loading: true });
    try {
      const res = await getAllDevices();
      const devices = res.data || [];
      const onlineCount = devices.filter(d => d.status === 1).length;
      const offlineCount = devices.length - onlineCount;
      const onlineDevices = devices.filter(d => d.status === 1);
      this.setData({ devices, onlineCount, offlineCount, onlineDevices, loading: false });
      this.applyFilter();
      // 若已选中设备，同步更新其在线状态
      if (this.data.controlDeviceId) {
        const cur = devices.find(d => d.deviceId === this.data.controlDeviceId);
        this.setData({ controlDeviceOnline: !!(cur && cur.status === 1) });
      }
    } catch (e) {
      console.error('loadDevices error', e);
      this.setData({ loading: false });
    }
  },

  switchFilter(e) {
    this.setData({ filterType: e.currentTarget.dataset.type });
    this.applyFilter();
  },

  applyFilter() {
    const { devices, filterType } = this.data;
    let filtered;
    if (filterType === 'online') {
      filtered = devices.filter(d => d.status === 1);
    } else if (filterType === 'offline') {
      filtered = devices.filter(d => d.status !== 1);
    } else {
      filtered = devices;
    }
    this.setData({ filteredDevices: filtered });
  },

  viewData(e) {
    const deviceId = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/data/data?deviceId=${deviceId}`
    });
  },

  onDeviceDetail(e) {
    const device = e.currentTarget.dataset.device;
    wx.navigateTo({
      url: `/pages/deviceDetail/deviceDetail?device=${encodeURIComponent(JSON.stringify(device))}`
    });
  },

  onDeleteDevice(e) {
    this.setData({
      showDeleteDialog: true,
      deleteDeviceId: e.currentTarget.dataset.id,
      deleteDeviceName: e.currentTarget.dataset.name
    });
  },

  cancelDelete() {
    this.setData({ showDeleteDialog: false, deleteDeviceId: '', deleteDeviceName: '' });
  },

  async confirmDelete() {
    const { deleteDeviceId } = this.data;
    this.setData({ showDeleteDialog: false });
    try {
      await deleteDevice(deleteDeviceId);
      Toast({
        context: this,
        selector: '#t-toast',
        message: '删除成功',
        theme: 'success',
        direction: 'column'
      });
      this.loadDevices();
    } catch (e) {
      console.error('deleteDevice error', e);
      Toast({
        context: this,
        selector: '#t-toast',
        message: '删除失败',
        theme: 'error',
        direction: 'column'
      });
    }
  },

  });
