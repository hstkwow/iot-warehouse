import { getDeviceConfig, saveDeviceConfig } from '../../api/device.js';
import Toast from 'tdesign-miniprogram/toast/index';

Page({
  data: {
    deviceId: '',
    status: 1, // device status (1: online)
    loading: true,
    configForm: {
      workMode: 'inbound',
      alarmMode: 'auto',
      tempMin: 0,
      tempMax: 30,
      humidityMax: 70,
      lightMin: 200,
      luxMax: 10000,
      gasMax: 2000,
      smokeThreshold: 2000,
      pressureMax: 1050,
      dewPointMax: 25
    },
    originalConfig: null
  },

  async onLoad(options) {
    if (options.deviceId) {
      this.setData({ 
        deviceId: options.deviceId,
        status: parseInt(options.status || '1', 10)
      });
      await this.loadDeviceConfig();
    }
  },

  async loadDeviceConfig() {
    try {
      this.setData({ loading: true });
      const res = await getDeviceConfig(this.data.deviceId);
      const conf = res.data;
      if (conf) {
        this.setData({
          configForm: { ...this.data.configForm, ...conf },
          originalConfig: conf
        });
      }
    } catch(e) {
      console.error('Failed to load device config:', e);
      Toast({ context: this, selector: '#t-toast', message: '获取配置失败', theme: 'error' });
    } finally {
      this.setData({ loading: false });
    }
  },

  
  onSegmentChange(e) {
    const field = e.currentTarget.dataset.field;
    const value = e.currentTarget.dataset.value;
    this.setData({ [`configForm.${field}`]: value });
  },

  onConfigSliderChange(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({ [`configForm.${field}`]: e.detail.value });
  },

  onConfigRangeChange(e) {
    const minfield = e.currentTarget.dataset.minfield;
    const maxfield = e.currentTarget.dataset.maxfield;
    const val = e.detail.value; // expected [min, max]
    if (Array.isArray(val) && val.length === 2) {
      this.setData({
        [`configForm.${minfield}`]: val[0],
        [`configForm.${maxfield}`]: val[1]
      });
    }
  },

  onConfigRadioChange(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({ [`configForm.${field}`]: e.detail.value });
  },

  async saveDeviceConfigAction() {
    if (this.data.status !== 1) {
      Toast({ context: this, selector: '#t-toast', message: '当前设备离线，配置无法下发', theme: 'warning', direction: 'column' });
      return;
    }
    if (this.data.saving) return;
    
    try {
      this.setData({ saving: true });
      wx.showLoading({ title: '保存中...', mask: true });
      
      const payload = {
        deviceId: this.data.deviceId,
        ...this.data.configForm
      };
      await saveDeviceConfig(payload);
      
      wx.hideLoading();
      
      Toast({ context: this, selector: '#t-toast', message: '下发配置成功', theme: 'success', direction: 'column' });
      
      // Update originalConfig and notify previous page
      this.setData({ originalConfig: { ...this.data.configForm } });
      const pages = getCurrentPages();
      const prevPage = pages[pages.length - 2];
      if (prevPage && prevPage.refreshDevice) {
        prevPage.refreshDevice(); // Refresh detail page data if needed
      }
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
    } catch(e) {
      wx.hideLoading();
      console.error('Failed to save config:', e);
      Toast({ context: this, selector: '#t-toast', message: '下发配置失败', theme: 'error', direction: 'column' });
    } finally {
      this.setData({ saving: false });
    }
  }
});