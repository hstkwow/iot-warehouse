import Toast from 'tdesign-miniprogram/toast/index';
import { addMaterial } from '../../api/material.js';
import { getAllCategories } from '../../api/category.js';
import { UPLOAD_IMAGE_URL } from '../../util/config.js';

Page({
  data: {
    form: {
      materialName: '',
      categoryId: null,
      categoryName: '',
      model: '',
      unit: '',
      minStock: '',
      maxStock: '',
      expiryAlertDays: '',
      imageUrl: ''
    },
    fileList: [],
    
    pickerVisible: false,
    currentPickerValue: '',
    categoryOptions: [],
    rawCategoryList: []
  },

  onLoad() {
    this.fetchCategories();
  },

  async fetchCategories() {
    try {
      const res = await getAllCategories();
      let list = [];
      if (Array.isArray(res.data)) {
        list = res.data;
      } else if (Array.isArray(res)) {
        list = res;
      } else if (res && res.data && Array.isArray(res.data.records)) {
        list = res.data.records;
      }
      
      const options = list.map(item => ({
        label: item.categoryName,
        value: item.categoryId.toString()
      }));

      this.setData({
        rawCategoryList: list,
        categoryOptions: options,
        currentPickerValue: options.length > 0 ? options[0].value : ''
      });

    } catch (e) {
      console.error(e);
      Toast({ context: this, selector: '#t-toast', message: '分类加载失败', theme: 'error' });
    }
  },

  showCategoryPicker() {
    if (this.data.categoryOptions.length === 0) {
      Toast({ context: this, selector: '#t-toast', message: '请先添加分类', theme: 'warning' });
      return;
    }
    this.setData({ pickerVisible: true });
  },

  onPickerChange(e) {
    this.setData({ currentPickerValue: e.detail.value[0] });
  },

  onPickerConfirm(e) {
    const val = e.detail.value[0];
    const target = this.data.categoryOptions.find(o => o.value === val);
    if (target) {
      this.setData({
        'form.categoryId': parseInt(val),
        'form.categoryName': target.label,
        pickerVisible: false
      });
    }
  },

  onPickerCancel() {
    this.setData({ pickerVisible: false });
  },

  onNameChange(e) { this.setData({ 'form.materialName': e.detail.value }); },
  onModelChange(e) { this.setData({ 'form.model': e.detail.value }); },
  onUnitChange(e) { this.setData({ 'form.unit': e.detail.value }); },
  onMinStockChange(e) { this.setData({ 'form.minStock': e.detail.value }); },
  onMaxStockChange(e) { this.setData({ 'form.maxStock': e.detail.value }); },
  onExpiryAlertChange(e) { this.setData({ 'form.expiryAlertDays': e.detail.value }); },

  handleAddFile(e) {
    const { files } = e.detail;
    const file = files[0]; // t-upload is limited to 1 file in wxml
    
    // immediate visual feedback
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
              'form.imageUrl': url,
              fileList: [{ url: url, status: 'done' }]
            });
          } else {
             throw new Error(data.msg || '上传失败');
          }
        } catch (err) {
          console.error('上传解析失败', err);
          this.setData({ fileList: [{ url: file.url, status: 'failed', message: '上传失败' }] });
          wx.showToast({ title: '图片上传失败', icon: 'error' });
        }
      },
      fail: (err) => {
        console.error('上传接口失败', err);
        this.setData({ fileList: [{ url: file.url, status: 'failed', message: '网络异常' }] });
        wx.showToast({ title: '网络连接失败', icon: 'error' });
      }
    });
  },

  handleRemoveFile(e) {
    this.setData({
      fileList: [],
      'form.imageUrl': ''
    });
  },

  async handleSubmit() {
    const f = this.data.form;
    
    if (!f.materialName.trim()) {
      return Toast({ context: this, selector: '#t-toast', message: '物资名称不能为空', theme: 'warning' });
    }
    if (!f.categoryId) {
      return Toast({ context: this, selector: '#t-toast', message: '请选择物资分类', theme: 'warning' });
    }
    if (!f.unit.trim()) {
      return Toast({ context: this, selector: '#t-toast', message: '需指定计量单位', theme: 'warning' });
    }

    const payload = {
      imageUrl: f.imageUrl || '',
      name: f.materialName,
      categoryId: f.categoryId,
      spec: f.model || '',
      unit: f.unit,
      minStock: f.minStock && f.minStock !== '' ? parseFloat(f.minStock) : 0,
      maxStock: f.maxStock && f.maxStock !== '' ? parseFloat(f.maxStock) : null,
      expiryWarningDays: f.expiryAlertDays && f.expiryAlertDays !== '' ? parseInt(f.expiryAlertDays) : null
    };

    try {
      wx.showLoading({ title: '保存中...', mask: true });
      const res = await addMaterial(payload);
      wx.hideLoading();
      
      if (!res || (res.code === 200 || res.code === 1 || res.code === 0)) {
        Toast({ context: this, selector: '#t-toast', message: '新增成功', theme: 'success' });
        setTimeout(() => {
          // 清除上一个页面的缓存状态或者刷新上一页面(可选)
          wx.navigateBack();
        }, 1500);
      } else {
        Toast({ context: this, selector: '#t-toast', message: (res && res.msg) || '保存失败', theme: 'error' });
      }
    } catch (e) {
      console.error(e);
      wx.hideLoading();
      Toast({ context: this, selector: '#t-toast', message: '网络或服务异常', theme: 'error' });
    }
  }
});
