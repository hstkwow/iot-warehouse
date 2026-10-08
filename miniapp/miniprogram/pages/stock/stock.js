import { getStockSummary, getStockByMaterialId, updateStockItem, getAllStockItems } from '../../api/stock.js';
import { getAllIoRecords } from '../../api/io-record.js';
import { getLocations, addLocation, updateLocation, deleteLocation } from '../../api/location.js';
import { getAllCategories } from '../../api/category.js';
import { getAllMaterials, deleteMaterial } from '../../api/material.js';
import { getAlarms } from '../../api/alarm.js';

Page({
  data: {
    currentTab: 0,
    searchKeyword: '',
    stockList: [],
    filteredList: [],
    warningCount: 0,
    isRefreshing: false,
    
    // 统计用数据
    categoryStats: [],
    categoryStatsDisplay: [],
    categoryStatsExpanded: false,
    hasMoreCategoryStats: false,
    warningList: [],
    warningListDisplay: [],
    warningListExpanded: false,
    hasMoreWarningList: false,
    statsIoRecords: [],
    statsIoRecordsDisplay: [],
    statsIoRecordsExpanded: false,
    hasMoreStatsIoRecords: false,
    statsFoldCount: 5,
    
    // 明细弹窗数据
    showDetailModal: false,
    rfidList: [],
    currentMaterialName: '',
    
    // 编辑弹窗数据
    showEditModal: false,
    editItem: null,
    statusOptions: ['在库(IN_STOCK)', '出库(OUT_OF_STOCK)'],
    statusValues: ['IN_STOCK', 'OUT_OF_STOCK'],
    statusIndex: 0,
    
    // 库位用数据
    locationZones: [],
    locationStats: { total: 0, occupied: 0, free: 0, rate: '0%' },
    selectedLocation: null,
    showLocationDetail: false,
    locationStockList: [],
    // 添加/编辑库位弹窗
    showLocForm: false,
    locFormType: 1, // 1=区域, 2=库位
    locFormIsEdit: false,
    locFormName: '',
    locFormId: '',
    locFormParentId: '',
    locFormParentName: ''
  },

  onLoad(options) {
    // 初始加载将在 onShow 中完成，避免重复请求
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().init();
    }
    this.syncTabBarOverlay();

    // 每次页面展示时（例如从新增页、编辑页返回时）都会触发，保证数据总是最新
    const { currentTab } = this.data;
    if (currentTab === 0) {
      this.fetchStock();
    } else if (currentTab === 1) {
      this.generateStats();
    } else if (currentTab === 2) {
      this.fetchLocations();
    }
    // 另外两个基础列表也可以选择在后台静默刷新
    if (currentTab !== 0) Object.keys(this.data.stockList || {}).length === 0 && this.fetchStock();
    if (currentTab !== 2) (this.data.locationZones || []).length === 0 && this.fetchLocations();
  },

  onHide() {
    this.setTabBarOverlay(false);
  },

  onUnload() {
    this.setTabBarOverlay(false);
  },

  setTabBarOverlay(active) {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setOverlayActive(active);
    }
  },

  syncTabBarOverlay() {
    this.setTabBarOverlay(this.data.showLocationDetail || this.data.showLocForm);
  },

  onTabChange(e) {
    const idx = parseInt(e.detail.value);
    this.setData({ currentTab: idx });
    if (idx === 0) this.fetchStock();
    else if (idx === 1) this.generateStats();
    else if (idx === 2) this.fetchLocations();
  },

  onTabTap(e) {
    const idx = parseInt(e.currentTarget.dataset.idx);
    if (idx === this.data.currentTab) return;
    this.setData({ currentTab: idx });
    if (idx === 0) this.fetchStock();
    else if (idx === 1) this.generateStats();
    else if (idx === 2) this.fetchLocations();
  },

  async fetchLocations() {
    try {
      const [locRes, stockRes] = await Promise.all([getLocations(), getAllStockItems()]);
      const locations = locRes.data || [];
      const stockItems = (stockRes.data || []).filter(s => s.status === 1); // 只看在库

      // 构建 locationId -> stockItem 映射
      const occupiedMap = {};
      stockItems.forEach(item => {
        if (item.location) {
          if (!occupiedMap[item.location]) occupiedMap[item.location] = [];
          occupiedMap[item.location].push(item);
        }
      });

      // 按 level 分区域和库位
      const groups = {};
      locations.forEach(loc => {
        if (loc.level === 1) {
          groups[loc.id] = { id: loc.id, name: loc.name, sortOrder: loc.sortOrder || 0, bins: [] };
        }
      });

      let totalBins = 0, occupiedBins = 0;
      locations.forEach(loc => {
        if (loc.level === 2 && loc.parentId && groups[loc.parentId]) {
          const stockList = occupiedMap[loc.id] || [];
          const isOccupied = stockList.length > 0;
          if (isOccupied) occupiedBins++;
          totalBins++;
          groups[loc.parentId].bins.push({
            id: loc.id,
            name: loc.name,
            parentId: loc.parentId,
            parentName: groups[loc.parentId].name,
            sortOrder: loc.sortOrder || 0,
            isOccupied,
            materialName: isOccupied ? (stockList[0].materialName || '物资') : '',
            stockCount: stockList.length,
            stockList
          });
        }
      });

      // 排序
      const zones = Object.values(groups).sort((a, b) => {
        if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
        return a.name.localeCompare(b.name, 'zh-CN');
      });
      zones.forEach(z => {
        z.bins.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
      });

      const freeBins = totalBins - occupiedBins;
      const rate = totalBins > 0 ? Math.round((occupiedBins / totalBins) * 100) + '%' : '0%';

      this.setData({
        locationZones: zones,
        locationStats: { total: totalBins, occupied: occupiedBins, free: freeBins, rate }
      });
    } catch (e) {
      console.error(e);
    }
  },

  viewDetail(e) {
    const id = e.currentTarget.dataset.id;
    if (id) {
      wx.navigateTo({
        url: `/pages/materialDetail/materialDetail?id=${id}`
      });
    }
  },

  closeDetailModal() {
    this.setData({ showDetailModal: false });
  },

  editRfidStock(e) {
    const item = e.currentTarget.dataset.item;
    const idx = this.data.statusValues.indexOf(item.status);
    this.setData({
      showEditModal: true,
      editItem: { ...item },
      statusIndex: idx >= 0 ? idx : 0
    });
  },

  closeEditModal() {
    this.setData({ showEditModal: false });
  },

  onStatusChange(e) {
    this.setData({ statusIndex: e.detail.value });
  },

  onLocationInput(e) {
    this.setData({ 'editItem.location': e.detail.value });
  },

  async submitEditStock() {
    try {
      wx.showLoading({ title: '保存中...' });
      const { editItem, statusIndex, statusValues } = this.data;
      const payload = {
        id: editItem.id,
        materialId: editItem.materialId,
        rfid: editItem.rfid,
        status: statusValues[statusIndex],
        location: editItem.location
      };
      await updateStockItem(payload);
      wx.showToast({ title: '保存成功' });
      this.closeEditModal();
      
      const res = await getStockByMaterialId(editItem.materialId);
      this.setData({ rfidList: res.data || [] });
      this.fetchStock();
    } catch (e) {
      wx.showToast({ title: '保存失败', icon:'none' });
    }
  },

  async generateStats() {
    // 确保 stockList 已加载
    if (this.data.stockList.length === 0) {
      await this.fetchStock();
    }
    const list = this.data.stockList;
    
    // 分类占比
    const map = {};
    let globalTotalAmount = 0;
    list.forEach(item => {
      const c = item.categoryName || '未分类';
      if (!map[c]) map[c] = { count: 0, totalAmount: 0 };
      map[c].count++;
      const amt = item.amount || 0;
      map[c].totalAmount += amt;
      globalTotalAmount += amt;
    });
    
    const stats = Object.keys(map).map(k => ({
      name: k,
      count: map[k].count,
      totalAmount: map[k].totalAmount,
      percent: globalTotalAmount > 0 ? Math.round((map[k].totalAmount / globalTotalAmount) * 100) : 0
    })).sort((a,b) => b.totalAmount - a.totalAmount);
    
    // 预警列表 - 从后端告警接口拉取真实数据
    let warningList = [];
    try {
      const alarmRes = await getAlarms({ source: 'stock', status: 0 });
      const alarms = Array.isArray(alarmRes.data) ? alarmRes.data : (alarmRes.data?.records || alarmRes.data?.list || []);
      warningList = alarms.map(a => {
        // content格式: "ABC物资 当前库存 5件, 低于最低阈值 10件"
        const content = a.content || '';
        // 解析物资名(第一个空格前)
        const parts = content.split(' ');
        const materialName = parts[0] || '未知物资';
        // 解析当前库存: 尝试匹配刚加给后端的"当前仅剩 XXX"，如果没有再退而求其次找"报警时库存 XXX"
        let currentStock = '--';
        const currentLeftMatch = content.match(/当前仅剩:\s*([\d.]+\S*)/);
        if (currentLeftMatch) {
          currentStock = currentLeftMatch[1];
        } else {
          const currentMatch = content.match(/(?:当前|报警时|监测时|发生时)库存\s*([\d.]+\S*)/);
          currentStock = currentMatch ? currentMatch[1] : '--';
        }
        
        // 解析阈值: "低于最低阈值 10件" 或 "超出最高阈值 100件"
        const thresholdMatch = content.match(/阈值\s*([\d.]+\S*)/);
        const threshold = thresholdMatch ? thresholdMatch[1] : '--';
        return {
          materialName,
          currentStock,
          threshold,
          alertType: a.alarmType === '库存积压' ? 'over' : 'low',
          alarmId: a.alarmId,
          createTime: a.createTime ? a.createTime.replace('T', ' ').split('.')[0].substring(0, 10) : '--',
          originalData: a
        };
      });
    } catch(e) {
      console.error('获取库存告警失败:', e);
    }
    
    // 出入库记录
    try {
      const ioRes = await getAllIoRecords({ current: 1, size: 20 });
      const records = (ioRes.data?.records || ioRes.data?.list || ioRes.data || []).map(r => {
        const t = r.time ? r.time.replace('T', ' ').split('.')[0] : '';
        return { ...r, time: t, date: t ? t.substring(0, 10) : '--' };
      });
      this.setData({ statsIoRecords: records });
    } catch(e) {
      console.error('获取出入库记录失败:', e);
    }
    
    this.setData({ categoryStats: stats, warningList: warningList }, () => {
      this.refreshStatsDisplayLists();
    });
  },

  viewIoRecordDetail(e) {
    const record = e.currentTarget.dataset.record;
    if (record) {
      wx.navigateTo({
        url: `/pages/ioRecordDetail/ioRecordDetail?data=${encodeURIComponent(JSON.stringify(record))}`
      });
    }
  },

  viewAlarmDetail(e) {
    const alarmData = e.currentTarget.dataset.alarm;
    if (alarmData) {
      // 必须像首页那样把整条告警对象存入 storage 中，详情页才能提取并正确渲染
      wx.setStorageSync('currentAlarm', alarmData);
      wx.navigateTo({
        url: `/pages/alarmDetail/alarmDetail`
      });
    }
  },

  onLocationTap(e) {
    const bin = e.currentTarget.dataset.bin;
    if (bin) {
      this.setData({
        selectedLocation: bin,
        locationStockList: bin.stockList || [],
        showLocationDetail: true
      }, () => this.syncTabBarOverlay());
    }
  },

  closeLocationDetail() {
    this.setData({ showLocationDetail: false, selectedLocation: null }, () => this.syncTabBarOverlay());
  },

  onLocationDetailVisibleChange(e) {
    if (!e.detail || e.detail.visible === false) {
      this.closeLocationDetail();
    }
  },

  // ========= 库位 CRUD =========
  showAddZoneForm() {
    this.setData({ showLocForm: true, locFormType: 1, locFormIsEdit: false, locFormName: '', locFormId: '', locFormParentId: '', locFormParentName: '' }, () => this.syncTabBarOverlay());
  },

  showAddBinForm(e) {
    const zone = e.currentTarget.dataset.zone;
    this.setData({ showLocForm: true, locFormType: 2, locFormIsEdit: false, locFormName: '', locFormId: '', locFormParentId: zone.id, locFormParentName: zone.name }, () => this.syncTabBarOverlay());
  },

  showEditZoneForm(e) {
    const zone = e.currentTarget.dataset.zone;
    this.setData({ showLocForm: true, locFormType: 1, locFormIsEdit: true, locFormName: zone.name, locFormId: zone.id, locFormParentId: '', locFormSortOrder: zone.sortOrder || 0 }, () => this.syncTabBarOverlay());
  },

  showEditBinForm() {
    const loc = this.data.selectedLocation;
    if (!loc) return;
    this.setData({ showLocForm: true, locFormType: 2, locFormIsEdit: true, locFormName: loc.name, locFormId: loc.id, locFormParentId: loc.parentId, locFormParentName: loc.parentName, locFormSortOrder: loc.sortOrder || 0, showLocationDetail: false }, () => this.syncTabBarOverlay());
  },

  closeLocForm() {
    this.setData({ showLocForm: false }, () => this.syncTabBarOverlay());
  },

  onLocFormNameInput(e) {
    this.setData({ locFormName: e.detail.value });
  },

  async confirmLocForm() {
    const { locFormType, locFormIsEdit, locFormName, locFormId, locFormParentId, locFormSortOrder } = this.data;
    if (!locFormName.trim()) {
      wx.showToast({ title: '请输入名称', icon: 'none' });
      return;
    }
    try {
      if (locFormIsEdit) {
        await updateLocation({ 
          id: locFormId, 
          name: locFormName.trim(), 
          level: locFormType,
          parentId: locFormType === 2 ? locFormParentId : null,
          sortOrder: locFormSortOrder || 0
        });
        wx.showToast({ title: '修改成功', icon: 'success' });
      } else {
        const isZone = locFormType === 1;
        let autoId;
        if (isZone) {
          autoId = 'Z' + (Math.floor(Math.random() * 9000) + 1000);
        } else {
          autoId = locFormParentId + '-' + (Math.floor(Math.random() * 900) + 100);
        }
        await addLocation({ id: autoId, name: locFormName.trim(), parentId: isZone ? null : locFormParentId, level: locFormType, sortOrder: 100 });
        wx.showToast({ title: '添加成功', icon: 'success' });
      }
      this.setData({ showLocForm: false }, () => this.syncTabBarOverlay());
      this.fetchLocations();
    } catch (e) {
      console.error(e);
      wx.showToast({ title: '操作失败', icon: 'none' });
    }
  },

  onDeleteZone(e) {
    const zone = e.currentTarget.dataset.zone;
    
    // 检查区域下是否还有库位被占用
    const occupiedBins = zone.bins ? zone.bins.filter(b => b.isOccupied).length : 0;
    if (occupiedBins > 0) {
      wx.showToast({ title: `该区域下有 ${occupiedBins} 个库位中仍有物资，为保证库存数据安全，暂时无法删除`, icon: 'none', duration: 2500 });
      return;
    }
    
    const binCount = zone.bins ? zone.bins.length : 0;
    if (binCount > 0) {
       wx.showToast({ title: `该区域下还有 ${binCount} 个空闲库位，请先清空库位后再删除区域！`, icon: 'none', duration: 2500 });
       return;
    }

    const msg = `确认删除区域「${zone.name}」？`;
    wx.showModal({
      title: '删除区域',
      content: msg,
      confirmColor: '#FA896B',
      success: async (res) => {
        if (res.confirm) {
          try {
            await deleteLocation(zone.id);
            wx.showToast({ title: '删除成功', icon: 'success' });
            this.fetchLocations();
          } catch (e) {
            console.error(e);
            wx.showToast({ title: '删除失败', icon: 'none' });
          }
        }
      }
    });
  },

  onDeleteBin() {
    const loc = this.data.selectedLocation;
    if (!loc) return;
    
    if (loc.isOccupied) {
      wx.showToast({ title: '当前库位中仍存放有物资，请转移或出库后再删除库位！', icon: 'none', duration: 2500 });
      return;
    }

    wx.showModal({
      title: '删除库位',
      content: `确认删除空闲库位「${loc.name}」？`,
      confirmColor: '#FA896B',
      success: async (res) => {
        if (res.confirm) {
          try {
            await deleteLocation(loc.id);
            wx.showToast({ title: '删除成功', icon: 'success' });
            this.setData({ showLocationDetail: false, selectedLocation: null }, () => this.syncTabBarOverlay());
            this.fetchLocations();
          } catch (e) {
            console.error(e);
            wx.showToast({ title: '删除失败', icon: 'none' });
          }
        }
      }
    });
  },

  onPullDownRefresh() {
    this.setData({ isRefreshing: true });
    this.fetchStock().then(() => {
      wx.stopPullDownRefresh();
      this.setData({ isRefreshing: false });
    });
  },

  onSearchInput(e) {
    const val = e.detail.value === undefined ? e.detail : e.detail.value;
    this.setData({ searchKeyword: val }, () => {
      this.filterLocal();
    });
  },

  clearSearch() {
    this.setData({ searchKeyword: '' });
    this.filterLocal();
  },

  // 分类管理跳转
  navToCategory() {
    wx.navigateTo({
      url: '/pages/category/category'
    });
  },

  // 进入物资详情(库存详情)页
  navToDetail(e) {
    const id = e.currentTarget.dataset.id;
    if (id) {
      wx.navigateTo({ url: `/pages/materialDetail/materialDetail?id=${id}` });
    } else {
      wx.showToast({ title: '物资数据异常', icon: 'none' });
    }
  },

  // 新增物资跳转
  navToAddMaterial() {
    wx.navigateTo({ url: '/pages/materialAdd/materialAdd' });
  },

  handleDeleteStockItem(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '提示',
      content: '确定要删除该物资吗？删除后不可恢复。',
      confirmColor: '#FA896B',
      success: async (res) => {
        if (res.confirm) {
          try {
            wx.showLoading({ title: '删除中...' });
            await deleteMaterial(id);
            wx.hideLoading();
            wx.showToast({ title: '删除成功', icon: 'success' });
            this.fetchStock();
          } catch (err) {
            wx.hideLoading();
            console.error(err);
            wx.showToast({ title: '删除失败', icon: 'error' });
          }
        }
      }
    });
  },

  filterLocal() {
    const k = this.data.searchKeyword.toLowerCase();
    if (!k) {
      this.setData({ filteredList: this.data.stockList });
      return;
    }
    const filtered = this.data.stockList.filter(item => {
      return item.materialName && item.materialName.toLowerCase().includes(k);
    });
    this.setData({ filteredList: filtered });
  },

  async fetchStock() {
    try {
      const res = await getStockSummary({ page: 1, pageSize: 100 });
      console.log('--- RAW STOCK LIST FROM BACKEND ---', res);
      const rawList = res.data?.records || res.data?.list || res.data || [];
      const lowStockCount = res.data?.lowStockCount || 0;
      const overStockCount = res.data?.overStockCount || 0;
      
      let calcWarningCount = 0;

      const processedList = rawList.map(item => {
        const q = item.quantity || 0;
        const min = item.minStock || 0;
        
        let max = item.maxStock || 0;
        if (!max || max === 0) {
          max = q > 0 ? (min > 0 ? Math.max(min * 2, q) : q * 2) : 100;
        }

        let pct = (q / max) * 100;
        if (pct > 100) pct = 100;

        let pClass = 'progress-safe';
        let tClass = 'text-success';
        let sText = '库存充足';

        if (q < min) {
          pClass = 'progress-danger';
          tClass = 'text-danger';
          sText = `库存不足(低于${min})`;
          pct = Math.max(pct, 5); 
          calcWarningCount++;
        } else if (max > 0 && q > max) {
          pClass = 'progress-warn';
          tClass = 'text-warning';
          sText = `库存积压(超出${max})`;
          calcWarningCount++;
        } else if (pct < 20) {
          pClass = 'progress-warn';
          tClass = 'text-warning';
          sText = '库存偏低';
        }

        return {
          ...item,
          quantity: q, 
          progressPct: pct,
          progressClass: pClass,
          textClass: tClass,
          statusText: sText,
          // 抹除原本可能有影响渲染的外网假图，后续对接真正的 OSS 地址
          image: (item.imageUrl || item.image) && String(item.imageUrl || item.image).includes('tdesign') ? '' : (item.imageUrl || item.image),
          amount: q, // 为了适配新的 wxml 绑定的量词
          name: item.materialName || '未知',
          categoryName: item.categoryName || '未分类'
        };
      });

      const map = {};
      processedList.forEach(item => {
        const c = item.categoryName || '未分类';
        if (!map[c]) map[c] = 0;
        map[c]++;
      });

            
      let totalStockCount = processedList.length;
      if (res && res.data && res.data.total !== undefined) {
        totalStockCount = res.data.total;
      }
      
      // 获取真实物资种类总数
      let realMaterialTotal = totalStockCount; 
      try {
        const matRes = await getAllMaterials({ page: 1, pageSize: 1 });
        if (matRes && matRes.data && matRes.data.total !== undefined) {
          realMaterialTotal = matRes.data.total;
        }
      } catch (e) {}

      // 获取真实分类总数
      let realCategoryCount = Object.keys(map).length;
      try {
        const catRes = await getAllCategories();
        if (catRes && (catRes.data || Array.isArray(catRes))) {
          const list = Array.isArray(catRes.data) ? catRes.data : (Array.isArray(catRes) ? catRes : (catRes.data.records || []));
          if (list.length > 0) realCategoryCount = list.length;
        }
      } catch (e) {}

      this.setData({
        stockList: processedList,
        filteredList: processedList,
        categoryCount: realCategoryCount,
        warningCount: (lowStockCount + overStockCount) || calcWarningCount,
        totalStockCount: realMaterialTotal
      });
    } catch (err) {
      console.error('获取库存失败:', err);
    }
  },

  refreshStatsDisplayLists() {
    const fold = this.data.statsFoldCount || 5;
    const categoryAll = this.data.categoryStats || [];
    const warningAll = this.data.warningList || [];
    const ioAll = this.data.statsIoRecords || [];

    this.setData({
      categoryStatsDisplay: this.data.categoryStatsExpanded ? categoryAll : categoryAll.slice(0, fold),
      warningListDisplay: this.data.warningListExpanded ? warningAll : warningAll.slice(0, fold),
      statsIoRecordsDisplay: this.data.statsIoRecordsExpanded ? ioAll : ioAll.slice(0, fold),
      hasMoreCategoryStats: categoryAll.length > fold,
      hasMoreWarningList: warningAll.length > fold,
      hasMoreStatsIoRecords: ioAll.length > fold
    });
  },

  toggleCategoryStatsFold() {
    this.setData({
      categoryStatsExpanded: !this.data.categoryStatsExpanded
    }, () => this.refreshStatsDisplayLists());
  },

  toggleWarningListFold() {
    this.setData({
      warningListExpanded: !this.data.warningListExpanded
    }, () => this.refreshStatsDisplayLists());
  },

  toggleIoRecordsFold() {
    this.setData({
      statsIoRecordsExpanded: !this.data.statsIoRecordsExpanded
    }, () => this.refreshStatsDisplayLists());
  }
});
