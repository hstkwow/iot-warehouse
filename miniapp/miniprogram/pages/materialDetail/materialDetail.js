import Toast from 'tdesign-miniprogram/toast/index';
import { UPLOAD_IMAGE_URL } from '../../util/config.js';
import Dialog from 'tdesign-miniprogram/dialog/index';
import { getMaterialDetail, updateMaterial, deleteMaterial } from '../../api/material.js';
import { getAllCategories } from '../../api/category.js';
import { prepareRfidWrite, getStockPendingByMaterial } from '../../api/stock.js';
import { getLocations } from '../../api/location.js';
import { getAllDevices, sendDeviceCommand } from '../../api/device.js';

Page({
  data: {
    statusBarHeight: 20, // 默认值
    materialId: null,
    material: {},
    
    // RFID Write
    rfidDialogVisible: false,
    rfidForm: {
      quantity: 1,
      batchNo: '',
      expiryDate: ''
    },
    
    areaPickerVisible: false,
    areaOptions: [],
    currentAreaId: [],
    selectedAreaName: '',
    
    locationPickerVisible: false,
    locationOptions: [],
    currentLocationId: [],
    selectedLocationName: '',
    rawLocations: [],
    
    // Date picker
    datePickerVisible: false,
    currentDate: '',
    
    // Device picker
    devicePickerVisible: false,
    deviceOptions: [],
    currentDeviceId: [],
    categoryPickerVisible: false,
    categoryOptions: [],
    rawCategoryList: [],
    fileList: []
  },

  navBack() {
    wx.navigateBack();
  },

  handleDelete() {
    wx.showModal({
      title: '危险操作',
      content: '删除此物资会同步销毁所有关联的库存与预警，确认继续？',
      confirmColor: '#FF3B30',
      success: async (res) => {
        if (res.confirm) {
          try {
            wx.showLoading({ title: '删除中...' });
            await deleteMaterial(this.data.materialId);
            wx.hideLoading();
            wx.showToast({ title: '已删除', icon: 'success' });
            setTimeout(() => {
              this.navBack();
            }, 1000);
          } catch (e) {
            wx.hideLoading();
            wx.showToast({ title: '删除失败', icon: 'error' });
          }
        }
      }
    });
  },

  onLoad(options) {
    const sysInfo = wx.getWindowInfo();
    this.setData({
      statusBarHeight: sysInfo.statusBarHeight || 44
    });

    if (options.id) {
      this.setData({ materialId: options.id });
      this.fetchDetail(options.id);
      this.fetchCategories();
    } else {
      Toast({ context: this, selector: '#t-toast', message: '参数错误', theme: 'error' });
    }
  },

  
  async fetchCategories() {
    try {
      const res = await getAllCategories();
      let list = Array.isArray(res.data) ? res.data : (Array.isArray(res) ? res : (res && res.data && Array.isArray(res.data.records) ? res.data.records : []));
      
      const options = list.map(item => ({
        label: item.categoryName,
        value: item.categoryId.toString()
      }));

      this.setData({
        rawCategoryList: list,
        categoryOptions: options
      });
    } catch (e) {
      console.error(e);
    }
  },

  showCategoryPicker() {
    if (this.data.categoryOptions.length === 0) {
      return Toast({ context: this, selector: '#t-toast', message: '分类没拉取到数据', theme: 'warning' });
    }
    this.setData({ categoryPickerVisible: true });
  },

  onCategoryPickerCancel() {
    this.setData({ categoryPickerVisible: false });
  },

  onCategoryPickerConfirm(e) {
    const val = e.detail.value[0];
    const target = this.data.categoryOptions.find(o => o.value === val);
    if (target) {
      this.setData({
        'material.categoryId': parseInt(val),
        'material.categoryName': target.label,
        categoryPickerVisible: false
      });
    }
  },

async fetchDetail(id) {
    try {
      wx.showLoading({ title: '加载中' });
      const res = await getMaterialDetail(id);
      if (res && res.data) {
        const mat = res.data;
        if (mat.createTime) mat.createTime = mat.createTime.replace('T', ' ').split('.')[0];
        if (mat.updateTime) mat.updateTime = mat.updateTime.replace('T', ' ').split('.')[0];
        const fl = mat.imageUrl ? [{ url: mat.imageUrl, status: 'done' }] : [];
        this.setData({ material: mat, fileList: fl });
      }
      wx.hideLoading();
    } catch (e) {
      wx.hideLoading();
      console.error('Fetch material detail error:', e);
      Toast({ context: this, selector: '#t-toast', message: '加载详情失败', theme: 'error' });
    }
  },

  onFieldChange(e) {
    const field = e.currentTarget.dataset.field;
    let value = e.detail.value;
    if (value === undefined) {
      value = e.detail; // Fallback for some component variants
    }
    this.setData({
      [`material.${field}`]: value
    });
  },

  async handleSave() {
    const { material } = this.data;
    if (!material.name) {
      return Toast({ context: this, selector: '#t-toast', message: '物资名称不能为空', theme: 'warning' });
    }
    
    // Convert to proper types if valid
    const payload = { ...material };
    // 时间字段由后端自动管理，不要回传（格式化后的字符串无法被Jackson反序列化）
    delete payload.createTime;
    delete payload.updateTime;
    if (payload.minStock !== null && payload.minStock !== '') payload.minStock = parseFloat(payload.minStock);
    if (payload.maxStock !== null && payload.maxStock !== '') payload.maxStock = parseFloat(payload.maxStock);
    if (payload.expiryWarningDays !== null && payload.expiryWarningDays !== '') payload.expiryWarningDays = parseInt(payload.expiryWarningDays);
    
    try {
      wx.showLoading({ title: '保存中' });
      const res = await updateMaterial(payload);
      wx.hideLoading();
      
      if (!res || (res.code === 200 || res.code === 0 || res.code === 1)) {
        Toast({ context: this, selector: '#t-toast', message: '修改成功', theme: 'success' });
        setTimeout(() => {
          wx.navigateBack();
        }, 1500);
      } else {
        Toast({ context: this, selector: '#t-toast', message: res.msg || '保存失败', theme: 'error' });
      }
    } catch (e) {
      wx.hideLoading();
      console.error('Update fail:', e);
      Toast({ context: this, selector: '#t-toast', message: '服务异常', theme: 'error' });
    }
  },

  // ---- 图片上传 ----
  handleChangeImage() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempFilePath = res.tempFiles[0].tempFilePath;
        wx.showLoading({ title: '上传中...' });

        const token = wx.getStorageSync('token');
        let header = {};
        if (token) {
          header['Authorization'] = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
        }

        wx.uploadFile({
          url: UPLOAD_IMAGE_URL,
          filePath: tempFilePath,
          name: 'file', // 关键：后端通常期望表单字段名为 file
          header: header,
          success: (uploadRes) => {
            wx.hideLoading();
            if (uploadRes.statusCode === 200) {
              const resData = JSON.parse(uploadRes.data);
              if (resData.code === 200 || resData.code === 1 || resData.code === 0) {
                // 兼容不同后端返回格式
                const newUrl = resData.data && resData.data.url ? resData.data.url : (resData.data || resData.url || resData.fileName);
                this.setData({
                  'material.imageUrl': newUrl
                });
                wx.showToast({
                  title: '上传成功',
                  icon: 'success'
                });
              } else {
                wx.showToast({
                  title: resData.msg || '上传失败',
                  icon: 'none'
                });
              }
            } else {
              wx.showToast({
                title: '网络错误 ' + uploadRes.statusCode,
                icon: 'none'
              });
            }
          },
          fail: () => {
            wx.hideLoading();
            wx.showToast({
              title: '上传失败',
              icon: 'none'
            });
          }
        });
      }
    });
  },

  handleAddFile(e) {
    const { files } = e.detail;
    const file = files[0];
    this.setData({
      fileList: [{ url: file.url, status: 'loading', message: '上传中...' }]
    });

    const token = wx.getStorageSync('token');
    let header = {};
    if (token) {
      header['Authorization'] = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
    }

    wx.uploadFile({
      url: UPLOAD_IMAGE_URL,
      filePath: file.url,
      name: 'file',
      header: header,
      success: (res) => {
        try {
          const data = JSON.parse(res.data);
          if (data.code === 200 || data.code === 1 || data.code === 0) {
            const url = data.data && data.data.url ? data.data.url : (data.data || data.url || data.fileName);
            this.setData({
              'material.imageUrl': url,
              fileList: [{ url: url, status: 'done' }]
            });
            Toast({ context: this, selector: '#t-toast', message: '图片上传成功', theme: 'success' });
          } else {
            throw new Error(data.msg || '上传失败');
          }
        } catch (err) {
          console.error('上传解析失败', err);
          this.setData({ fileList: [{ url: file.url, status: 'failed', message: '上传失败' }] });
        }
      },
      fail: () => {
        this.setData({ fileList: [{ url: file.url, status: 'failed', message: '网络异常' }] });
      }
    });
  },

  handleRemoveFile() {
    this.setData({
      fileList: [],
      'material.imageUrl': ''
    });
  },

  // ---- RFID 写卡逻辑 ----
  async showRfidDialog() {
    this.setData({ rfidDialogVisible: true });
    this.fetchDevicesList(); // 后台静默加载设备
    this.fetchLocationsList(); // 后台静默加载库位信息
  },

  async fetchLocationsList() {
    try {
      const res = await getLocations();
      let list = res.data || res;
      // 提取区域 (parentId为空 或 level === 1)
      const areas = list.filter(item => item.level === 1 || !item.parentId);
      const opts = areas.map(a => ({ label: a.name || a.id, value: a.id }));
      this.setData({
        rawLocations: list,
        areaOptions: opts,
      });
    } catch(e) {
      console.error('获取库位列表失败', e);
    }
  },

  onOpenAreaPicker() {
    if (!this.data.areaOptions || this.data.areaOptions.length === 0) {
      return Toast({ context: this, selector: '#t-toast', message: '暂无可用区域', theme: 'warning' });
    }
    this.setData({ 
      areaPickerVisible: true,
      currentAreaId: this.data.currentAreaId && this.data.currentAreaId.length ? this.data.currentAreaId : [this.data.areaOptions[0].value]
    });
  },
  
  onAreaPickerChange(e) {
    this.setData({ currentAreaId: e.detail.value });
  },

  onAreaPickerConfirm(e) {
    const val = e.detail.value[0];
    const label = e.detail.label[0];
    
    // 若选择了不同的区域，清空已选的子库位
    let resetLocation = {};
    if (this.data.currentAreaId[0] !== val) {
      resetLocation = {
        selectedLocationName: '',
        currentLocationId: []
      };
    }
    
    this.setData({
      currentAreaId: [val],
      selectedAreaName: label,
      areaPickerVisible: false,
      ...resetLocation
    });
  },

  onAreaPickerCancel() {
    this.setData({ areaPickerVisible: false });
  },

  onOpenLocationPicker() {
    const parentAreaId = this.data.currentAreaId[0];
    if (!parentAreaId) {
      return Toast({ context: this, selector: '#t-toast', message: '请先选择区域', theme: 'warning' });
    }
    
    const locations = this.data.rawLocations.filter(loc => loc.parentId === parentAreaId);
    if (!locations.length) {
      return Toast({ context: this, selector: '#t-toast', message: '该区域下暂无库位', theme: 'warning' });
    }
    
    const opts = locations.map(l => ({ label: l.name || l.id, value: l.id }));
    this.setData({ 
      locationOptions: opts,
      locationPickerVisible: true,
      currentLocationId: this.data.currentLocationId && this.data.currentLocationId.length ? this.data.currentLocationId : [opts[0].value]
    });
  },
  
  onLocationPickerChange(e) {
    this.setData({ currentLocationId: e.detail.value });
  },

  onLocationPickerConfirm(e) {
    const val = e.detail.value[0];
    const label = e.detail.label[0];
    this.setData({
      currentLocationId: [val],
      selectedLocationName: label,
      locationPickerVisible: false
    });
  },

  onLocationPickerCancel() {
    this.setData({ locationPickerVisible: false });
  },

  onOpenDatePicker() {
    let defaultDate = this.data.rfidForm.expiryDate;
    if (!defaultDate) {
      const now = new Date();
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const dd = String(now.getDate()).padStart(2, '0');
      defaultDate = `${yyyy}-${mm}-${dd}`;
    }
    
    this.setData({ 
      datePickerVisible: true,
      currentDate: defaultDate
    });
  },

  onDatePickerConfirm(e) {
    this.setData({
      'rfidForm.expiryDate': e.detail.value,
      datePickerVisible: false
    });
  },

  onDatePickerCancel() {
    this.setData({ datePickerVisible: false });
  },

  async fetchDevicesList() {
    try {
      const res = await getAllDevices();
      let list = [];
      if (res && res.data) list = res.data;
      else if (Array.isArray(res)) list = res;
      
      const opts = list
        .filter(d => d.status === 1) // 仅保留在线设备
        .map(d => ({
          label: `${d.deviceName || d.deviceId} [在线]`,
          value: d.deviceId
        }));
      
      this.setData({ deviceOptions: opts });
    } catch(e) {
      console.error('获取设备列表失败', e);
    }
  },

  onCancelRfidPrepare() {
    this.setData({ rfidDialogVisible: false });
  },

  onVisibleChangeRfidPrepare(e) {
    this.setData({ rfidDialogVisible: e.detail.visible });
  },

  onRfidFieldChange(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({
      [`rfidForm.${field}`]: e.detail.value
    });
  },

  onOpenDevicePicker() {
    if (!this.data.deviceOptions || this.data.deviceOptions.length === 0) {
      return Toast({ context: this, selector: '#t-toast', message: '暂无在线的写入设备可供选择', theme: 'warning' });
    }
    this.setData({ 
      devicePickerVisible: true,
      currentDeviceId: this.data.currentDeviceId && this.data.currentDeviceId.length ? this.data.currentDeviceId : [this.data.deviceOptions[0].value]
    });
  },

  onDevicePickerChange(e) {
    this.setData({ currentDeviceId: e.detail.value });
  },

  onDevicePickerConfirm(e) {
    const val = e.detail.value;
    const label = e.detail.label;
    this.setData({
      currentDeviceId: val,
      selectedDeviceName: label[0],
      devicePickerVisible: false
    });
  },

  onDevicePickerCancel() {
    this.setData({ devicePickerVisible: false });
  },

  async onConfirmRfIdWriteFull() {
    const { materialId, rfidForm, currentDeviceId, material } = this.data;
    
    if (!currentDeviceId || !currentDeviceId[0]) {
      return Toast({ context: this, selector: '#t-toast', message: '请选择写入设备', theme: 'warning' });
    }
    if (!rfidForm.quantity) {
      return Toast({ context: this, selector: '#t-toast', message: '请输入数量', theme: 'warning' });
    }
    
    // Web 端存储的是库位 ID（如果不选具体库位则存储区域 ID）
    let targetLocationId = '';
    if (this.data.currentLocationId && this.data.currentLocationId[0]) {
      targetLocationId = this.data.currentLocationId[0];
    } else if (this.data.currentAreaId && this.data.currentAreaId[0]) {
      targetLocationId = this.data.currentAreaId[0];
    }
    
    try {
      // 立即进入等待状态，关闭底部表单并唤起感应提示
      this.setData({ 
        rfidDialogVisible: false,
        writingDialogVisible: true,
        writingCountdown: 7
      });

      const prepRes = await prepareRfidWrite({
        materialId: parseInt(materialId),
        quantity: parseFloat(rfidForm.quantity),
        location: targetLocationId,
        batchNo: rfidForm.batchNo,
        expiryDate: rfidForm.expiryDate
      });
      
      // 直接下发写卡指令
      await sendDeviceCommand(currentDeviceId[0], { rfid_write: material.materialCode });
      
      let pollCount = 0;
      
      this.rfidWaitTimer = setInterval(async () => {
        pollCount++;
        const remaining = 7 - Math.floor(pollCount / 2);
        
        if (remaining < 0) {
          clearInterval(this.rfidWaitTimer);
          this.setData({ writingDialogVisible: false });
          Toast({ context: this, selector: '#t-toast', message: '设备响应超时', theme: 'error' });
          return;
        }
        
        this.setData({ writingCountdown: remaining });
        
        try {
          const checkRes = await getStockPendingByMaterial(materialId);
          const item = (checkRes && checkRes.itemId) ? checkRes : (checkRes && checkRes.data && checkRes.data.itemId ? checkRes.data : null);
          
          // 只要查到了记录，说明设备已写入且后端已保存，立刻停止计时并关闭弹窗
          if (item) {
            clearInterval(this.rfidWaitTimer);
            this.setData({ writingDialogVisible: false });
            Toast({ context: this, selector: '#t-toast', message: 'RFID写入成功并将生效', theme: 'success' });
            return;
          }
        } catch(e) {
          console.warn('轮询异常...', e);
        }
      }, 500);
      
    } catch (err) {
      this.setData({ writingDialogVisible: false });
      console.error(err);
      Toast({ context: this, selector: '#t-toast', message: '操作失败：' + (err.message || err.msg || '网络异常'), theme: 'error' });
    }
  },

  onCancelWriting() {
    if (this.rfidWaitTimer) {
      clearInterval(this.rfidWaitTimer);
    }
    this.setData({ writingDialogVisible: false });
    Toast({ context: this, selector: '#t-toast', message: '已取消等待设备响应' });
  }
});
