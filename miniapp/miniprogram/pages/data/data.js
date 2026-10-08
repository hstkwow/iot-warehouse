import { getAllDevices, getSensorDataByRange, getSensorHistory } from '../../api/device.js';
import { getAllCategories } from '../../api/category.js';
import { getAllMaterials } from '../../api/material.js';
import { getAllIoRecords } from '../../api/io-record.js';
import * as echarts from '../../components/ec-canvas/echarts';

Page({
  data: {
    statusBarHeight: wx.getWindowInfo().statusBarHeight || 44,
    activeTab: 0,

    // 历史记录
    devices: [],
    deviceOptions: [],
    devicePickerValue: [],
    showDevicePicker: false,
    selectedDeviceId: '',
    selectedDeviceName: '',
    metrics: [
      { key: 'temperature', label: '温度', icon: 'celsius', unit: '℃' },
      { key: 'humidity', label: '湿度', icon: 'cloudy-rain', unit: '%' },
      { key: 'pressure', label: '气压', icon: 'dashboard', unit: 'hPa' },
      { key: 'smokeDensity', label: '烟雾', icon: 'fog', unit: 'PPM' },
      { key: 'luminance', label: '光照', icon: 'sunny', unit: 'Lux' },
      { key: 'dewPoint', label: '露点', icon: 'rain-light', unit: '℃' }
    ],
    selectedMetric: 'temperature',
    selectedMetricLabel: '温度',
    metricUnit: '℃',
    showAllMetrics: false,
    timeRanges: [
      { label: '1小时', value: 1 },
      { label: '24小时', value: 24 },
      { label: '7天', value: 168 },
      { label: '30天', value: 720 },
      { label: '自定义', value: -1 }
    ],
    selectedTimeRange: 1,
    selectedTimeRangeLabel: '1小时',
    showDatePicker: false,
    customStartDate: '',
    customEndDate: '',
    sensorData: [],
    recentRecords: [],
    currentValue: '无',
    avgValue: '无',
    maxValue: '无',
    minValue: '无',
    loading: false,
    ecOption: {
      lazyLoad: true,
      disableTouch: false
    },

    // 数据报表
    reportLoading: false,
    reportCategories: [],
    reportMaterials: [],
    reportRecords: [],
    reportFilteredRecords: [],
    reportCategoryOptions: [],
    reportMaterialOptions: [],
    reportCategoryIndex: 0,
    reportMaterialIndex: 0,
    reportCategoryLabel: '全部分类',
    reportMaterialLabel: '全部物资',
    reportSelectedCategoryId: null,
    reportSelectedMaterialValue: '__CATEGORY_ALL__',
    reportTimeRanges: [
      { label: '近一周', value: 'week' },
      { label: '近一月', value: 'month' },
      { label: '近一年', value: 'year' },
      { label: '自定义', value: 'custom' }
    ],
    reportSelectedRange: 'week',
    reportCustomStartDate: '',
    reportCustomEndDate: '',
    reportInboundCount: 0,
    reportOutboundCount: 0,
    reportNetFlow: 0
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
    this.initReportData();
    this.startAutoRefresh();
  },

  onHide() {
    this.stopAutoRefresh();
  },

  onUnload() {
    this.stopAutoRefresh();
  },

  startAutoRefresh() {
    this.stopAutoRefresh();
    this._refreshTimer = setInterval(() => {
      const { selectedDeviceId, selectedTimeRange, activeTab } = this.data;
      // 只在趋势分析 Tab、已选设备、非自定义时间范围时自动刷新
      if (activeTab === 0 && selectedDeviceId && selectedTimeRange > 0) {
        this.fetchSensorData(true);
      }
    }, 1000);
  },

  stopAutoRefresh() {
    if (this._refreshTimer) {
      clearInterval(this._refreshTimer);
      this._refreshTimer = null;
    }
  },

  // ========== Tab 切换 ==========
  onTabTap(e) {
    const val = Number(e.currentTarget.dataset.idx);
    this.setData({ activeTab: val });
    if (val === 1) {
      this.initReportData();
    }
  },

  // ========== 数据报表逻辑 ==========
  async initReportData() {
    if (this.data.reportLoading) return;
    try {
      this.setData({ reportLoading: true });
      const [catRes, matRes, ioRes] = await Promise.all([
        getAllCategories(),
        getAllMaterials({ page: 1, pageSize: 2000 }),
        getAllIoRecords({ page: 1, pageSize: 5000 })
      ]);

      const categories = Array.isArray(catRes?.data) ? catRes.data : [];
      const materials = Array.isArray(matRes?.data?.records)
        ? matRes.data.records
        : (Array.isArray(matRes?.data) ? matRes.data : []);
      const records = Array.isArray(ioRes?.data?.records)
        ? ioRes.data.records
        : (Array.isArray(ioRes?.data) ? ioRes.data : []);

      const defaultCategory = categories.length > 0 ? categories[0].categoryId : null;
      this.setData({
        reportCategories: categories,
        reportMaterials: materials,
        reportRecords: records,
        reportSelectedCategoryId: defaultCategory
      }, () => {
        this.buildReportCategoryOptions();
        this.buildReportMaterialOptions();
        this.refreshReportView();
      });
    } catch (e) {
      console.error('init report data error', e);
    } finally {
      this.setData({ reportLoading: false });
    }
  },

  buildReportCategoryOptions() {
    const options = [{ label: '全部分类', value: null }];
    (this.data.reportCategories || []).forEach(c => {
      options.push({ label: c.categoryName, value: c.categoryId });
    });
    let idx = options.findIndex(o => String(o.value) === String(this.data.reportSelectedCategoryId));
    if (idx < 0) idx = 0;
    this.setData({
      reportCategoryOptions: options,
      reportCategoryIndex: idx,
      reportSelectedCategoryId: options[idx].value,
      reportCategoryLabel: options[idx].label
    });
  },

  buildReportMaterialOptions() {
    const categoryId = this.data.reportSelectedCategoryId;
    const allMaterials = this.data.reportMaterials || [];
    const pool = categoryId === null
      ? allMaterials
      : allMaterials.filter(m => String(m.categoryId) === String(categoryId));

    const options = [];
    if (categoryId !== null) {
      options.push({ label: '该类全部物资', value: '__CATEGORY_ALL__' });
    } else {
      options.push({ label: '全部物资', value: '__ALL__' });
    }
    pool.forEach(m => options.push({ label: m.name || m.materialName || m.materialCode, value: m.materialId }));

    let selected = this.data.reportSelectedMaterialValue;
    if (!options.some(o => String(o.value) === String(selected))) {
      selected = options[0].value;
    }
    let idx = options.findIndex(o => String(o.value) === String(selected));
    if (idx < 0) idx = 0;

    this.setData({
      reportMaterialOptions: options,
      reportMaterialIndex: idx,
      reportSelectedMaterialValue: options[idx].value,
      reportMaterialLabel: options[idx].label
    });
  },

  onReportCategoryChange(e) {
    const idx = Number(e.detail.value);
    const selected = this.data.reportCategoryOptions[idx];
    this.setData({
      reportCategoryIndex: idx,
      reportSelectedCategoryId: selected ? selected.value : null,
      reportCategoryLabel: selected ? selected.label : '全部分类'
    }, () => {
      this.buildReportMaterialOptions();
      this.refreshReportView();
    });
  },

  onReportMaterialChange(e) {
    const idx = Number(e.detail.value);
    const selected = this.data.reportMaterialOptions[idx];
    this.setData({
      reportMaterialIndex: idx,
      reportSelectedMaterialValue: selected ? selected.value : '__CATEGORY_ALL__',
      reportMaterialLabel: selected ? selected.label : '全部物资'
    }, () => this.refreshReportView());
  },

  onSelectReportRange(e) {
    const range = e.currentTarget.dataset.value;
    this.setData({ reportSelectedRange: range }, () => this.refreshReportView());
  },

  onReportStartDateChange(e) {
    this.setData({ reportCustomStartDate: e.detail.value }, () => this.refreshReportView());
  },

  onReportEndDateChange(e) {
    this.setData({ reportCustomEndDate: e.detail.value }, () => this.refreshReportView());
  },

  refreshReportView() {
    const materials = this.data.reportMaterials || [];
    const materialMapById = {};
    materials.forEach(m => { materialMapById[String(m.materialId)] = m; });

    const categoryId = this.data.reportSelectedCategoryId;
    const selectedMaterialValue = this.data.reportSelectedMaterialValue;

    const { start, end } = this.getReportRangeBounds();

    let filtered = (this.data.reportRecords || []).filter(r => {
      const t = this.parseDateTime(r.time);
      return t && t >= start && t <= end;
    });

    if (selectedMaterialValue && selectedMaterialValue !== '__ALL__' && selectedMaterialValue !== '__CATEGORY_ALL__') {
      const m = materialMapById[String(selectedMaterialValue)];
      const code = m ? String(m.materialCode || '') : '';
      const name = m ? String(m.name || m.materialName || '') : '';
      filtered = filtered.filter(r =>
        (code && String(r.materialCode || '') === code) ||
        (name && String(r.materialName || '') === name)
      );
    } else if (selectedMaterialValue === '__CATEGORY_ALL__' && categoryId !== null) {
      const pool = materials.filter(m => String(m.categoryId) === String(categoryId));
      const codeSet = new Set(pool.map(m => String(m.materialCode || '')));
      const nameSet = new Set(pool.map(m => String(m.name || m.materialName || '')));
      filtered = filtered.filter(r =>
        codeSet.has(String(r.materialCode || '')) || nameSet.has(String(r.materialName || ''))
      );
    }

    filtered = filtered.slice().sort((a, b) => {
      const ta = this.parseDateTime(a.time);
      const tb = this.parseDateTime(b.time);
      return (tb ? tb.getTime() : 0) - (ta ? ta.getTime() : 0);
    }).map(item => ({
      ...item,
      _ioTypeNum: Number(item.ioType),
      _typeText: Number(item.ioType) === 1 ? '入库' : '出库',
      _timeText: this.formatRecordTime(item.time),
      _dateText: this.formatRecordDate(item.time),
      _zoneText: item.zoneName || '--',
      _qtyText: this.formatRecordQty(item.quantity),
      _locationText: this.formatRecordLocation(item)
    }));

    const inbound = filtered.filter(i => i._ioTypeNum === 1).length;
    const outbound = filtered.filter(i => i._ioTypeNum === 2).length;
    this.setData({
      reportFilteredRecords: filtered,
      reportInboundCount: inbound,
      reportOutboundCount: outbound,
      reportNetFlow: inbound - outbound
    });
  },

  getReportRangeBounds() {
    const range = this.data.reportSelectedRange;
    const now = new Date();
    if (range === 'week') {
      return { start: new Date(now.getTime() - 7 * 24 * 3600 * 1000), end: now };
    }
    if (range === 'month') {
      return { start: new Date(now.getTime() - 30 * 24 * 3600 * 1000), end: now };
    }
    if (range === 'year') {
      return { start: new Date(now.getTime() - 365 * 24 * 3600 * 1000), end: now };
    }
    const s = this.data.reportCustomStartDate;
    const e = this.data.reportCustomEndDate;
    if (s && e) {
      const start = new Date(`${String(s).replace(/-/g, '/')} 00:00:00`);
      const end = new Date(`${String(e).replace(/-/g, '/')} 23:59:59`);
      if (start <= end) return { start, end };
    }
    return { start: new Date(now.getTime() - 7 * 24 * 3600 * 1000), end: now };
  },

  parseDateTime(value) {
    if (!value) return null;
    if (Array.isArray(value)) {
      const [y, m, d, hh = 0, mm = 0, ss = 0] = value;
      return new Date(y, Number(m) - 1, d, hh, mm, ss);
    }
    const raw = String(value).trim();
    if (!raw) return null;

    // iOS 兼容：避免直接 new Date('yyyy-MM-dd HH:mm:ss')
    // 1) 带 T 的 ISO 字符串直接交给 Date
    if (raw.includes('T')) {
      const iso = raw.includes('+') || raw.endsWith('Z') ? raw : raw.split('.')[0];
      const d = new Date(iso);
      return Number.isNaN(d.getTime()) ? null : d;
    }

    // 2) 空格分隔的日期时间转换为 yyyy/MM/dd HH:mm:ss
    const normalized = raw.split('.')[0].replace(/-/g, '/');
    const d = new Date(normalized);
    return Number.isNaN(d.getTime()) ? null : d;
  },

  formatRecordTime(value) {
    if (!value) return '--';
    if (Array.isArray(value)) {
      const [y, m, d, hh = 0, mm = 0, ss = 0] = value;
      return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')} ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
    }
    return String(value).replace('T', ' ').split('.')[0];
  },

  formatRecordDate(value) {
    const t = this.formatRecordTime(value);
    if (!t || t === '--') return '--';
    return t.split(' ')[0] || t;
  },

  formatRecordQty(value) {
    if (value === null || value === undefined || value === '') return '--';
    const n = Number(value);
    return Number.isNaN(n) ? String(value) : n.toFixed(2);
  },

  formatRecordLocation(item) {
    const zone = item.zoneName || '';
    const loc = item.locationName || item.location || '';
    if (zone && loc) return `${zone}/${loc}`;
    return loc || '--';
  },

  onReportRecordTap(e) {
    const record = e.currentTarget.dataset.record;
    if (!record) return;
    wx.navigateTo({
      url: `/pages/ioRecordDetail/ioRecordDetail?data=${encodeURIComponent(JSON.stringify(record))}`
    });
  },

  // ========== 历史记录逻辑 ==========
  async loadDevices() {
    try {
      const res = await getAllDevices();
      const list = res.data || [];
      this.setData({
        devices: list,
        deviceOptions: list.map(d => ({ label: d.deviceName || d.deviceId, value: d.deviceId }))
      });
      // 只有一个设备时自动选中
      if (list.length === 1 && !this.data.selectedDeviceId) {
        const d = list[0];
        this.setData({
          selectedDeviceId: d.deviceId,
          selectedDeviceName: d.deviceName || d.deviceId,
          devicePickerValue: [d.deviceId]
        });
        this.fetchSensorData();
      }
    } catch (e) {
      console.error('load devices error', e);
    }
  },

  onShowDevicePicker() {
    this.chartInstance = null;
    this._forceRebuildChart = true;
    this.setData({ showDevicePicker: true });
  },

  onDeviceCancel() {
    this.setData({ showDevicePicker: false });
    setTimeout(() => this.drawChart(this.data.sensorData), 200);
  },

  onDeviceConfirm(e) {
    const { value } = e.detail;
    const deviceId = value[0];
    const device = this.data.devices.find(d => d.deviceId === deviceId);
    this.setData({
      showDevicePicker: false,
      devicePickerValue: value,
      selectedDeviceId: deviceId,
      selectedDeviceName: device ? (device.deviceName || device.deviceId) : deviceId
    }, () => {
      this.fetchSensorData();
    });
  },

  restoreChartAfterPickerClose() {
    // 现已支持同层渲染，不再需要销毁与重建画布。此函数保留为空以防御可能的遗留调用。
  },

  buildRenderSignature(sensorData, metricKey, timeRange) {
    const data = sensorData || [];
    const first = data[0];
    const last = data[data.length - 1];
    return [
      metricKey,
      timeRange,
      data.length,
      first ? `${first.timeStr}:${first.value}` : '',
      last ? `${last.timeStr}:${last.value}` : ''
    ].join('|');
  },

  onSelectMetric(e) {
    const key = e.currentTarget.dataset.key;
    const metric = this.data.metrics.find(m => m.key === key);
    this.setData({
      selectedMetric: key,
      selectedMetricLabel: metric ? metric.label : '',
      metricUnit: metric ? metric.unit : ''
    });
    if (this.data.selectedDeviceId) {
      this.fetchSensorData();
    }
  },

  onSelectTimeRange(e) {
    const value = Number(e.currentTarget.dataset.value);
    const selectedRange = this.data.timeRanges.find(item => item.value === value);
    if (value === -1) {
      this.chartInstance = null;
      this._forceRebuildChart = true;
      this.setData({
        showDatePicker: true,
        selectedTimeRange: -1,
        selectedTimeRangeLabel: selectedRange ? selectedRange.label : '自定义'
      });
      return;
    }
    this.setData({
      selectedTimeRange: value,
      selectedTimeRangeLabel: selectedRange ? selectedRange.label : '',
      showDatePicker: false,
      customStartDate: '',
      customEndDate: ''
    });
    if (this.data.selectedDeviceId) {
      this.fetchSensorData();
    }
  },

  onStartDateChange(e) {
    this.setData({ customStartDate: e.detail.value });
  },

  onEndDateChange(e) {
    this.setData({ customEndDate: e.detail.value });
  },

  onCustomDateConfirm() {
    const { customStartDate, customEndDate } = this.data;
    if (!customStartDate || !customEndDate) {
      wx.showToast({ title: '请选择起止日期', icon: 'none' });
      return;
    }
    if (customStartDate > customEndDate) {
      wx.showToast({ title: '开始日期不能晚于结束日期', icon: 'none' });
      return;
    }
    this.setData({
      showDatePicker: false,
      selectedTimeRangeLabel: `${customStartDate} 至 ${customEndDate}`
    });
    this.fetchSensorData();
  },

  onCustomDateVisibleChange(e) {
    if (!e.detail.visible && e.detail.trigger) {
      // 通过点击遮罩层或右上角关闭按钮手动关闭了弹窗，放弃自定义选择
      this.setData({
        showDatePicker: false,
        selectedTimeRange: 1,
        selectedTimeRangeLabel: '1小时',
        customStartDate: '',
        customEndDate: ''
      });
      this.fetchSensorData();
    }
  },

  // ----- 手动点击取消或遮罩层等 -----
  onCustomDateCancel() {
    this.setData({
      showDatePicker: false,
      selectedTimeRange: 1,
      selectedTimeRangeLabel: '1小时',
      customStartDate: '',
      customEndDate: ''
    });
    this.fetchSensorData();
  },

  async fetchSensorData(silent = false) {
    const { selectedDeviceId, selectedTimeRange, selectedMetric, customStartDate, customEndDate } = this.data;
    if (!selectedDeviceId) return;

    if (!silent) {
      this.setData({ loading: true });
    }

    const fmt = (d) => {
      const pad = (n) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    };

    let startStr, endStr;
    if (selectedTimeRange === -1 && customStartDate && customEndDate) {
      startStr = customStartDate + ' 00:00:00';
      endStr = customEndDate + ' 23:59:59';
    } else {
      const now = new Date();
      const start = new Date(now.getTime() - selectedTimeRange * 3600 * 1000);
      startStr = fmt(start);
      endStr = fmt(now);
    }

    try {
      const [res, historyRes] = await Promise.all([
        getSensorDataByRange(selectedDeviceId, startStr, endStr),
        getSensorHistory(selectedDeviceId, 5)
      ]);
      const rawList = res.data || [];
      const historyList = historyRes.data || [];

      // 提取指标值并格式化时间
      const sensorData = rawList.map(item => {
        const val = item[selectedMetric];
        const t = new Date(item.reportTime);
          const hm = `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`;
          const md = `${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
          const timeStr = (selectedTimeRange === 1 || selectedTimeRange === 24) ? hm : `${md} ${hm}`;
          
          return {
            id: item.id,
            value: val != null ? Number(val) : null,
            displayValue: val != null ? Number(val).toFixed(1) : '无',
            timeStr
          };
        }).filter(d => d.value !== null);

        // 计算统计值
        const values = sensorData.map(d => d.value);
        const current = values.length > 0 ? values[values.length - 1].toFixed(1) : '无';
        const avg = values.length > 0 ? (values.reduce((a, b) => a + b, 0) / values.length).toFixed(1) : '无';
        const max = values.length > 0 ? Math.max(...values).toFixed(1) : '无';
        const min = values.length > 0 ? Math.min(...values).toFixed(1) : '无';

        // 独立获取最近5条动态
        const recentRecords = historyList.map(item => {
          const val = item[selectedMetric];
          const t = new Date(item.reportTime);
          const hm = `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`;
          const md = `${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
          return {
            id: item.id,
            displayValue: val != null ? Number(val).toFixed(1) : '无',
            timeStr: `${md} ${hm}`
          };
        });

        this.setData({
          sensorData,
          recentRecords,
          currentValue: current,
          avgValue: avg,
          maxValue: max,
          minValue: min,
          loading: false
        }, () => {
          const signature = this.buildRenderSignature(sensorData, selectedMetric, selectedTimeRange);

        // 仅在必要时重建，避免定时刷新导致持续重绘闪烁
        if (this._forceRebuildChart || !this.chartInstance) {
          this.chartInstance = null;
          setTimeout(() => this.drawChart(sensorData), 100);
        } else if (signature !== this._lastRenderSignature) {
          this.chartInstance.setOption(this.buildChartOption(sensorData), true);
        }
        this._lastRenderSignature = signature;
        this._forceRebuildChart = false;
      });
    } catch (e) {
      console.error('fetch sensor data error', e);
      this.setData({
        loading: false,
        sensorData: [],
        recentRecords: [],
        currentValue: '无',
        avgValue: '无',
        maxValue: '无',
        minValue: '无'
      }, () => {
        if (this.chartInstance) {
          this.chartInstance.setOption(this.buildChartOption([]), true);
          this._lastRenderSignature = 'empty';
        }
      });
    }
  },

  buildChartOption(data) {
    const { metricUnit, selectedTimeRange, customStartDate, customEndDate } = this.data;
    let labels = data.map(d => d.timeStr);
    let values = data.map(d => d.value);

    // 空数据时，生成时间区间的极值作为横坐标骨架
    if (labels.length === 0) {
      if (selectedTimeRange > 0) {
        const now = new Date();
        const start = new Date(now.getTime() - selectedTimeRange * 3600 * 1000);
        const fmt = (t) => {
          const hm = `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`;
          const md = `${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
          return (selectedTimeRange === 1 || selectedTimeRange === 24) ? hm : `${md} ${hm}`;
        };
        
        const segments = 6;
        labels = [];
        values = [];
        const step = (now.getTime() - start.getTime()) / segments;
        for (let i = 0; i <= segments; i++) {
          labels.push(fmt(new Date(start.getTime() + step * i)));
          values.push('-');
        }
      } else {
        const fmtCustom = (str) => str ? str.substring(5).replace('-', '-') : '';
        labels = [fmtCustom(customStartDate) || '开始', fmtCustom(customEndDate) || '结束'];
        values = ['-', '-'];
      }
    }

    return {
      tooltip: {
        trigger: 'axis',
        formatter: (params) => {
          const p = params[0];
          if (p.value === '-' || p.value == null) return `${p.name}\n无数据`;
          return p.name + '\n' + p.value + ' ' + metricUnit;
        }
      },
      grid: {
        left: 50,
        right: 16,
        top: 20,
        bottom: 32
      },
      xAxis: {
        type: 'category',
        data: labels,
        axisLabel: {
          fontSize: 10,
          color: '#909399',
          rotate: 0,
          interval: Math.max(0, Math.floor(labels.length / 5) - 1)
        },
        axisLine: { lineStyle: { color: '#E4E7ED' } },
        axisTick: { show: false }
      },
      yAxis: {
        type: 'value',
        axisLabel: {
          fontSize: 10,
          color: '#909399'
        },
        splitLine: { lineStyle: { color: '#F0F0F0' } },
        axisLine: { show: false },
        axisTick: { show: false }
      },
      series: [{
        type: 'line',
        data: values,
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        lineStyle: { color: '#007AFF', width: 2 },
        itemStyle: { color: '#007AFF' },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(93,135,255,0.3)' },
            { offset: 1, color: 'rgba(93,135,255,0.02)' }
          ])
        }
      }]
    };
  },

  drawChart(data) {
    const chartComponent = this.selectComponent('#trendChart');
    if (!chartComponent) return;

    // Retry safely up to 3 times to prevent TypeError (node of null)
    let retries = 0;
    const safeInit = () => {
      chartComponent.init((canvas, width, height, dpr) => {
        if (!canvas) {
          if (retries < 3) {
            retries++;
            setTimeout(safeInit, 200);
          }
          return;
        }
        try {
          const chart = echarts.init(canvas, null, {
            width: width,
            height: height,
            devicePixelRatio: dpr
          });
          chart.setOption(this.buildChartOption(data || []));
          this.chartInstance = chart;
          return chart;
        } catch (err) {
          console.error('Echarts init error:', err);
        }
      });
    };
    safeInit();
  }
});
