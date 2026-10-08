// 引入你拷贝过来的 api
import { getDashboardStats } from '../../api/stats.js';
import { getStockSummary } from '../../api/stock.js';
import { getAlarms } from '../../api/alarm.js';
import { getAllDevices, getLatestSensorData } from '../../api/device.js';

Page({
  data: {
    userInfo: {},
    isOnline: false,
    stats: {
      temperature: '--',
      humidity: '--',
      pressure: '--',
      smokeDensity: '--',
      dewPoint: '--',
      luminance: '--',
      totalStock: '--',
      onlineDevices: '--'
    },
    stockAlarms: [],
    stockAlarmsDisplay: [],
    stockAlarmExpanded: false,
    stockAlarmFoldCount: 3,
    hasMoreStockAlarms: false,
    deviceAlarms: [],
    deviceAlarmsDisplay: [],
    alarmStatus: 0 // 0: 待处理, 1: 已处理
  },

  onLoad() {
    this.checkLoginStatus();
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().init();
    }

    this.checkLoginStatus();
    if (wx.getStorageSync('token')) {
      this.fetchDashboardData();
      this.startAutoRefresh();
    } else {
      // 如果没有 token，等待页面初始化完毕后跳转到登录
      setTimeout(() => {
        wx.reLaunch({ url: '/pages/login/login' });
      }, 500);
    }
  },

  onHide() {
    this.stopAutoRefresh();
  },

  onUnload() {
    this.stopAutoRefresh();
  },

  startAutoRefresh() {
    this.stopAutoRefresh();
    // 每 1 秒 (1000ms) 后台拉取一次最新数据
    this.refreshTimer = setInterval(() => {
      this.fetchDashboardData();
    }, 1000);
  },

  stopAutoRefresh() {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  },

  onPullDownRefresh() {
    this.fetchDashboardData().then(() => {
      wx.stopPullDownRefresh(); 
    });
  },

  checkLoginStatus() {
    const user = wx.getStorageSync('user');
    if (user) {
      this.setData({ userInfo: user });
    }
  },

  async fetchDashboardData() {
    let backendConnected = false;
    try {
      // 1. 获取面板基本统计 (设备数量等)
      let onlineCount = '--';
      try {
        const statsRes = await getDashboardStats();
        backendConnected = true; // 只要接口有返回，说明后端已启动并可访问
        if (statsRes.code === 1 || statsRes.code === 200) {
          onlineCount = statsRes.data.onlineDevices;
        }
      } catch (e) {
        console.error("fetch stats error", e);
      }

      // 2. 获取库存总数
      let stockTotal = '--';
      try {
        const stockRes = await getStockSummary({ page: 1, pageSize: 1 });
        if (stockRes.code === 1 || stockRes.code === 200) {
          stockTotal = stockRes.data.total;
        }
      } catch (e) {
        console.error("fetch stock error", e);
      }

      // 3. 联合获取报警信息与全部设备信息
      let stockAlarms = [];
      let deviceAlarms = [];
      let devices = [];
      try {
        const [alarmRes, devRes] = await Promise.all([
          getAlarms({ status: this.data.alarmStatus }),
          getAllDevices().catch(e => { console.error('dev error', e); return []; })
        ]);
        
        devices = Array.isArray(devRes) ? devRes : ((devRes && devRes.data) || []);
        
        const list = Array.isArray(alarmRes) ? alarmRes : ((alarmRes && alarmRes.data) || []); // list: IotAlarm[]
        if (list.length > 0) {
          // 由于后端 listAll 接口在处理 status=1 时直接返回了带权限所有混杂的（包含 0 和 1），在这里强制依据前端 status 二次过滤确保结果纯净
          const filteredList = list.filter(a => a.status === this.data.alarmStatus);
          
          stockAlarms = filteredList.filter(a => a.alarmSource === 'stock').map(a => {
            // 备份原始content供详情页展示
            a.originalContent = a.content;
            if(a.content) a.content = a.content.replace(/当前/g, '发生时');
            if(a.msg) a.msg = a.msg.replace(/当前/g, '发生时');
            // 只提取物资名称（空格前的第一个词），或者默认为“库存物资”
            a.shortTitle = (a.content || '').split(' ')[0] || '库存物资';
            // 只显示报警原因（报警类型）
            a.shortDesc = a.alarmType || '库存预警';
            
            let rawTime = a.createTime || a.happenTime;
            if (Array.isArray(rawTime) && rawTime.length >= 3) {
              a.shortTime = rawTime.slice(0, 3).map(n => n.toString().padStart(2, '0')).join('-');
            } else {
              a.shortTime = String(rawTime || '').split('T')[0].split(' ')[0] || '刚刚';
            }

            return a;
          });
          
          deviceAlarms = filteredList.filter(a => a.alarmSource === 'device').map(a => {
            // 备份原始content供详情页展示
            a.originalContent = a.content;
            if(a.content) a.content = a.content.replace(/当前/g, '监测时');
            if(a.msg) a.msg = a.msg.replace(/当前/g, '监测时');
            
            // 联表获取设备名称，找不到则降级显示MAC地址
            let targetDeviceName = a.deviceId;
            if (a.deviceId && devices.length > 0) {
              const matchedDev = devices.find(d => d.deviceId === a.deviceId);
              if (matchedDev && matchedDev.deviceName) {
                targetDeviceName = matchedDev.deviceName;
              }
            }
            
            // 环境告警显示设备名称，或者“监控节点”
            a.shortTitle = targetDeviceName || '监控节点';
            // 显示报警原因
            a.shortDesc = a.alarmType || '设备告警';
            
            let rawTime = a.createTime || a.happenTime;
            if (Array.isArray(rawTime) && rawTime.length >= 3) {
              a.shortTime = rawTime.slice(0, 3).map(n => n.toString().padStart(2, '0')).join('-');
            } else {
              a.shortTime = String(rawTime || '').split('T')[0].split(' ')[0] || '刚刚';
            }

            return a;
          });
        }
      } catch (e) {
        console.error("fetch alarm error", e);
      }

      // 4. 获取全部环境数据 (优先找包含温湿度等环境数据的设备)
      let temp = '--', hum = '--', press = '--', smoke = '--', dew = '--', lum = '--';
      try {
        let hasData = false;
        // 把在线设备排前面，离线排后面
        let sortedDevices = [...devices].sort((a, b) => {
          let aOnline = (a.status === 1 || a.status === 'online') ? 1 : 0;
          let bOnline = (b.status === 1 || b.status === 'online') ? 1 : 0;
          return bOnline - aOnline;
        });

        // 遍历所有设备，找到第一个包含实际环境数据的设备
        for (let targetDevice of sortedDevices) {
          try {
            const sensorRes = await getLatestSensorData(targetDevice.id || targetDevice.deviceId);
            const sData = sensorRes.data || sensorRes;
            if (sData && (sData.temperature != null || sData.humidity != null || sData.pressure != null || sData.smokeDensity != null)) {
              if (sData.temperature != null) temp = Number(sData.temperature).toFixed(1);
              if (sData.humidity != null) hum = Number(sData.humidity).toFixed(1);
              if (sData.pressure != null) press = Number(sData.pressure).toFixed(1);
              if (sData.smokeDensity != null) smoke = Number(sData.smokeDensity).toFixed(1);
              if (sData.dewPoint != null) dew = Number(sData.dewPoint).toFixed(1);
              if (sData.luminance != null) lum = Number(sData.luminance).toFixed(1);
              hasData = true;
              break; // 找到真实数据后跳出循环
            }
          } catch (err) {
            console.error(`fetch sensor for ${targetDevice.deviceId} error`, err);
          }
        }
      } catch (e) {
        console.error("fetch sensor loop error", e);
      }

      // 5. 将拼装好的真实数据推给 UI
      this.setData({
        isOnline: backendConnected,
        'stats.onlineDevices': onlineCount,
        'stats.totalStock': stockTotal,
        'stats.temperature': temp,
        'stats.humidity': hum,
        'stats.pressure': press,
        'stats.smokeDensity': smoke,
        'stats.dewPoint': dew,
        'stats.luminance': lum,
        stockAlarms,
        deviceAlarms
      }, () => {
        this.refreshAlarmDisplay();
      });

    } catch (e) {
      console.log('数据大盘整体拉取失败:', e);
      wx.showToast({ title: '数据获取失败', icon: 'none' });
      this.setData({ isOnline: false });
    }
  },

  setMockData() {
      this.setData({
        isOnline: false,
      stats: {
        temperature: '24.5',
        humidity: '55',
        pressure: '1013.2',
        smokeDensity: '0',
        dewPoint: '12.0',
        luminance: '450',
        totalStock: '1,280',
        onlineDevices: '3'
      },
      stockAlarms: [
        { alarmType: '库存不足', content: '矿泉水 库存不足，报警时仅剩余 20 件', createTime: '2026-04-05 10:00:00', shortTime: '2026-04-05', shortTitle: '矿泉水', shortDesc: '库存不足' }
      ],
      deviceAlarms: [
        { alarmType: '温度告警', content: 'B区温度超过 28℃', createTime: '2026-04-05 11:30:00', shortTime: '2026-04-05', shortTitle: 'B区', shortDesc: '温度告警' },
        { alarmType: '设备离线', content: '3号网络摄像头掉线', createTime: '2026-04-05 12:00:00', shortTime: '2026-04-05', shortTitle: '3号网络摄像头', shortDesc: '设备离线' }
      ]
    }, () => {
      this.refreshAlarmDisplay();
    });
  },

  handleScan() {
    wx.scanCode({
      success: (res) => {
        wx.showToast({ title: '扫描结果: ' + res.result, icon: 'none' });
      }
    });
  },

  navToDevices() {
    wx.switchTab({ url: '/pages/devices/devices' });
  },

  handleRefresh() {
    wx.showNavigationBarLoading();
    this.fetchDashboardData().then(() => {
      wx.hideNavigationBarLoading();
      wx.showToast({ title: '数据已刷新', icon: 'success' });
    });
  },

  goToAlarmDetail(e) {
    const { type, index, item: oldItem } = e.currentTarget.dataset;
    let item = oldItem;
    
    if (type === 'deviceAlarms') {
      item = this.data.deviceAlarms[index];
    } else if (type === 'deviceAlarmsDisplay') {
      item = this.data.deviceAlarmsDisplay[index];
    } else if (type === 'stockAlarms') {
      item = this.data.stockAlarms[index];
    } else if (type === 'stockAlarmsDisplay') {
      item = this.data.stockAlarmsDisplay[index];
    }
    
    if (!item) {
      wx.showToast({ title: '参数丢失', icon: 'error' });
      return;
    }

    // 将报警数据存入 storage，方便详情页直接读取展示，避免 URL 传参导致长度超限问题
    wx.setStorageSync('currentAlarm', item);
    wx.navigateTo({
      url: '/pages/alarmDetail/alarmDetail'
    });
  },

  goToAlarms() {
    wx.switchTab({ url: '/pages/alarms/alarms' });
  },

  goToEnvData() {
    wx.navigateTo({ url: '/pages/envData/envData' }); // 如果没有此页面可忽略或创建
  },

  scanCode() {
    wx.scanCode({
      success: (res) => {
        wx.showToast({ title: '扫描结果: ' + res.result, icon: 'none' });
      }
    });
  },

  switchAlarmStatus(e) {
    const status = parseInt(e.currentTarget.dataset.status, 10);
    if (this.data.alarmStatus !== status) {
      this.setData({ alarmStatus: status });
      // 切换后重新拉取数据
      wx.showNavigationBarLoading();
      this.fetchDashboardData().then(() => {
        wx.hideNavigationBarLoading();
      });
    }
  },

  refreshAlarmDisplay() {
    const all = this.data.stockAlarms || [];
    const deviceAll = this.data.deviceAlarms || [];
    const foldCount = this.data.stockAlarmFoldCount || 3;
    const expanded = !!this.data.stockAlarmExpanded;
    const display = expanded ? all : all.slice(0, foldCount);
    this.setData({
      deviceAlarmsDisplay: deviceAll.slice(0, 3),
      stockAlarmsDisplay: display,
      hasMoreStockAlarms: all.length > foldCount
    });
  },

  toggleStockAlarms() {
    this.setData({
      stockAlarmExpanded: !this.data.stockAlarmExpanded
    }, () => {
      this.refreshAlarmDisplay();
    });
  }
});
