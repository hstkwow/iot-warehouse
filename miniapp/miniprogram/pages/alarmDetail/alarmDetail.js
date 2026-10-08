import { resolveAlarm } from '../../api/alarm.js';
import { getAllDevices } from '../../api/device.js';
import { getStockByMaterialId } from '../../api/stock.js';
import { getLocations } from '../../api/location.js';

Page({
  data: {
    alarm: {},
    deviceInfo: null, // 用于存储关联设备信息的对象
    stockZone: '', // 存储物资所在区域
    stockShelf: '', // 存储物资所在库位
    resolveRemark: '', // 用户输入的处理措施
    alarmDisplayTime: '',
    resolveDisplayTime: ''
  },

  async onLoad() {
    const alarm = wx.getStorageSync('currentAlarm');
    if (alarm && Object.keys(alarm).length > 0) {
      if (!alarm.shortTitle && alarm.alarmSource === 'stock') {
        alarm.shortTitle = (alarm.originalContent || alarm.content || '').split(' ')[0] || '库存物资';
      }
      this.setData({
        alarm,
        alarmDisplayTime: this.formatDateTime(alarm.createTime || alarm.happenTime),
        resolveDisplayTime: this.formatDateTime(alarm.resolveTime)
      });
      
      // 如果属于设备告警并包含 deviceId，联标查询设备信息
      if (alarm.deviceId) {
        try {
          const res = await getAllDevices();
          const list = Array.isArray(res) ? res : (res.data || []);
          const targetDevice = list.find(d => d.deviceId === alarm.deviceId);
          if (targetDevice) {
            this.setData({ deviceInfo: targetDevice });
          }
        } catch (e) {
          console.error('Failed to fetch device info for alarm detail:', e);
        }
      }

      // 如果属于库存预警并包含 relatedId（materialId），联标查询库存库位
      if (alarm.alarmSource === 'stock' && alarm.relatedId) {
        try {
          const [stockRes, locRes] = await Promise.all([
            getStockByMaterialId(alarm.relatedId),
            getLocations().catch(err => {
              console.error('Failed to fetch locations', err);
              return null;
            })
          ]);
          
          const list = Array.isArray(stockRes) ? stockRes : (stockRes.data || []);
          const allLocs = locRes ? (Array.isArray(locRes) ? locRes : (locRes.data || [])) : [];
          
          if (list && list.length > 0) {
            const locations = list.map(item => item.location).filter(Boolean);
            const uniqueLocations = [...new Set(locations)];
            
            let zones = [];
            let shelves = [];
            
            if (allLocs.length > 0) {
              uniqueLocations.forEach(locId => {
                const matched = allLocs.find(l => String(l.id) === String(locId));
                if (matched) {
                  const parent = allLocs.find(p => String(p.id) === String(matched.parentId));
                  if (parent && parent.name && parent.name !== '无') {
                    zones.push(parent.name);
                  }
                  shelves.push(matched.name);
                } else {
                  shelves.push(locId);
                }
              });
            } else {
              shelves = [...uniqueLocations];
            }
            
            const uniqueZones = [...new Set(zones)];
            const uniqueShelves = [...new Set(shelves)];
            
            this.setData({ 
              stockZone: uniqueZones.length > 0 ? uniqueZones.join('、') : '无区域信息',
              stockShelf: uniqueShelves.length > 0 ? uniqueShelves.join('、') : '未分配库位' 
            });
          } else {
            this.setData({ 
              stockZone: '无记录',
              stockShelf: '仓库已无该物资记录' 
            });
          }
        } catch (e) {
          console.error('Failed to fetch stock info for alarm detail:', e);
        }
      }
    } else {
      wx.showToast({ title: '加载失败', icon: 'error' });
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
    }
  },

  onShow() {
    // 每次显示时可以校验是否需要刷新数据，这里如果有详情接口也可以补充
  },

  // 绑定输入框
  handleInputRemark(e) {
    this.setData({ resolveRemark: e.detail.value });
  },

  // 跳转到相关业务页面
  navToTarget() {
    const { alarmSource } = this.data.alarm;
    
    if (alarmSource === 'stock') {
      wx.switchTab({ url: '/pages/stock/stock' });
    } else {
      const { deviceInfo } = this.data;
      if (deviceInfo) {
        wx.navigateTo({
          url: `/pages/deviceDetail/deviceDetail?device=${encodeURIComponent(JSON.stringify(deviceInfo))}`
        });
      } else {
        wx.switchTab({ url: '/pages/devices/devices' });
      }
    }
  },

  // 提交处理
  async handleResolve() {
    const { id } = this.data.alarm; // 确保取对的ID：id 或 alarmId
    const alarmId = id || this.data.alarm.alarmId; // 做下兼容
    
    if (!alarmId) {
      wx.showToast({ title: '缺失报警参数', icon: 'none' });
      return;
    }
    
    let remark = this.data.resolveRemark.trim();
    if (!remark) {
      wx.showToast({ title: '请填写处理记录', icon: 'none' });
      return;
    }
    
    try {
      wx.showLoading({ title: '正在提交...' });
      const res = await resolveAlarm(alarmId, remark);
      wx.hideLoading();
      
      if (res.code === 200 || res.code === 1 || res.success) {
        wx.showToast({ title: '记录成功', icon: 'success' });
        
        this.setData({ 
          'alarm.status': 1,
          'alarm.resolveRemark': remark,
          'alarm.resolveUser': wx.getStorageSync('user')?.nickname || wx.getStorageSync('user')?.username || '操作人',
          'alarm.resolveTime': '刚刚',
          resolveDisplayTime: '刚刚'
        }); // 乐观更新前端状态
        
        // 延迟返回上一页，体验更好
        setTimeout(() => {
          wx.navigateBack();
        }, 1500);
      } else {
        wx.showToast({ title: res.message || res.msg || '处理失败', icon: 'none' });
      }
    } catch (err) {
      wx.hideLoading();
      console.error('Resolve Alarm Err:', err);
      wx.showToast({ title: '网络异常', icon: 'none' });
    }
  },

  onUnload() {
    wx.removeStorageSync('currentAlarm');
  },

  formatDateTime(value) {
    if (!value) return '未知';
    if (Array.isArray(value)) {
      const [y, m, d, hh = 0, mm = 0, ss = 0] = value;
      return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')} ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
    }
    const text = String(value);
    if (text.includes('T')) return text.replace('T', ' ').slice(0, 19);
    return text;
  }
});
