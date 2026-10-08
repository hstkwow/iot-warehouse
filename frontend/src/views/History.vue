<template>
  <div class="history-page">
    <!-- 顶部控制栏 -->
    <div class="filter-container">
      <div class="page-header">
        <div class="page-title">历史趋势分析</div>
        <div class="page-desc">查看设备传感器的历史数据走势与统计分析</div>
      </div>
      <el-form :inline="true" :model="filters" class="filter-form" size="small">
        <el-form-item label="设备">
          <el-select v-model="selectedDeviceId" placeholder="请选择设备" @change="handleDeviceChange" style="width: 200px;">
            <el-option
              v-for="item in deviceList"
              :key="item.deviceId"
              :label="item.deviceName || item.deviceId"
              :value="item.deviceId">
            </el-option>
          </el-select>
        </el-form-item>
        <el-form-item label="监测指标">
          <el-select v-model="filters.type" placeholder="请选择" @change="fetchData" style="width: 140px;">
            <el-option label="温度 (°C)" value="temperature"></el-option>
            <el-option label="湿度 (%)" value="humidity"></el-option>
            <el-option label="气压 (hPa)" value="pressure"></el-option>
            <el-option label="烟雾 (PPM)" value="smokeDensity"></el-option>
            <el-option label="露点 (°C)" value="dewPoint"></el-option>
          </el-select>
        </el-form-item>
        <el-form-item label="时间范围">
          <el-radio-group v-model="filters.range" @change="fetchData">
            <el-radio-button label="1h">1小时</el-radio-button>
            <el-radio-button label="24h">24小时</el-radio-button>
            <el-radio-button label="7d">7天</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" icon="el-icon-refresh" @click="fetchData">刷新</el-button>
        </el-form-item>
      </el-form>
    </div>

    <!-- 统计卡片 -->
    <el-row :gutter="20" class="stat-row">
      <el-col :xs="12" :sm="12" :md="6" v-for="(stat, index) in stats" :key="index">
        <el-card shadow="hover" class="stat-card" :body-style="{ padding: '15px 20px' }">
          <div class="stat-content">
            <div class="stat-text">
              <div class="stat-label">{{ stat.label }}</div>
              <div class="stat-value" :style="{ color: stat.color || '#303133' }">
                {{ stat.value }} <span class="stat-unit">{{ currentUnit }}</span>
              </div>
            </div>
            <div class="stat-icon-bg" :style="{ backgroundColor: stat.bgColor }">
              <i :class="stat.icon" :style="{ color: stat.color }"></i>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 图表卡片 -->
    <el-card class="chart-card" shadow="always" v-loading="loading">
        <div slot="header" class="clearfix">
            <span style="font-weight: bold; font-size: 16px;">
                <i class="el-icon-data-line" style="margin-right: 8px;"></i>
                {{ chartTitle }}变化趋势
            </span>
            <span style="float: right; color: #909399; font-size: 12px;">
                设备ID: {{ selectedDeviceId }}
            </span>
        </div>
        <div id="mainChart" style="width: 100%; height: 450px;"></div>
    </el-card>
  </div>
</template>

<script>
import * as echarts from 'echarts'
import { getAllDevices, getSensorDataByRange, getDeviceConfig } from '@/api/device'

export default {
  name: 'HistoryView',
  data() {
    return {
      chart: null,
      filters: {
        type: 'temperature',
        range: '24h'
      },
      selectedDeviceId: '',
      deviceList: [],
      deviceConfig: null, // Check from server
      dataPoints: [], // Stores API result: [{reportTime: '...', temperature: 25, humidity: 60}, ...]
      loading: false
    }
  },
  computed: {
    currentUnit() {
      const map = {
        'temperature': '°C',
        'humidity': '%',
        'pressure': 'hPa',
        'smokeDensity': 'PPM',
        'dewPoint': '°C'
      }
      return map[this.filters.type] || ''
    },
    chartTitle() {
      const map = {
        'temperature': '温度',
        'humidity': '湿度',
        'pressure': '气压',
        'smokeDensity': '烟雾浓度',
        'dewPoint': '露点'
      }
      return map[this.filters.type] || this.filters.type;
    },
    // Calculate stats based on fetched data and selected type
    stats() {
      const type = this.filters.type;
      
      // Filter out null values for the selected type
      const values = this.dataPoints
        .map(p => p[type])
        .filter(v => v !== null && v !== undefined)
        .map(v => parseFloat(v));

      if (values.length === 0) {
        return [
          { label: '当前数值', value: '-', icon: 'el-icon-odometer', color: '#409EFF', bgColor: '#ecf5ff' },
          { label: '平均值', value: '-', icon: 'el-icon-data-analysis', color: '#E6A23C', bgColor: '#fdf6ec' },
          { label: '最高值', value: '-', icon: 'el-icon-top', color: '#F56C6C', bgColor: '#fef0f0' },
          { label: '最低值', value: '-', icon: 'el-icon-bottom', color: '#67C23A', bgColor: '#f0f9eb' }
        ]
      }

      const current = values[values.length - 1]
      const max = Math.max(...values)
      const min = Math.min(...values)
      const sum = values.reduce((a, b) => a + b, 0)
      const avg = (sum / values.length).toFixed(1)

      return [
        { label: '当前数值', value: current.toFixed(1), icon: 'el-icon-odometer', color: '#409EFF', bgColor: '#ecf5ff' },
        { label: '平均值', value: avg, icon: 'el-icon-data-analysis', color: '#E6A23C', bgColor: '#fdf6ec' },
        { label: '最高值', value: max.toFixed(1), icon: 'el-icon-top', color: '#F56C6C', bgColor: '#fef0f0' },
        { label: '最低值', value: min.toFixed(1), icon: 'el-icon-bottom', color: '#67C23A', bgColor: '#f0f9eb' }
      ]
    }
  },
  mounted() {
    window.addEventListener('resize', this.resizeChart)
    if (this.$route.query.type) {
      // Map query params if necessary, e.g. type=TEMP
      const typeMap = { 'TEMP': 'temperature', 'HUMI': 'humidity' };
      this.filters.type = typeMap[this.$route.query.type] || this.$route.query.type || 'temperature';
    }
    
    this.initChart();
    this.loadDevices();

    // Auto-refresh data every 3 seconds
    this.timer = setInterval(() => {
        if (this.selectedDeviceId) {
            this.fetchData(false); // false = silent refresh
        }
    }, 3000);
  },
  beforeDestroy() {
    window.removeEventListener('resize', this.resizeChart)
    if (this.timer) {
        clearInterval(this.timer);
        this.timer = null;
    }
    if (this.chart) {
      this.chart.dispose()
      this.chart = null
    }
  },
  methods: {
    resizeChart() {
      if (this.chart) this.chart.resize()
    },
    initChart() {
      const chartDom = document.getElementById('mainChart')
      if (!chartDom) return
      this.chart = echarts.init(chartDom)
    },
    
    handleDeviceChange() {
      this.deviceConfig = null;
      this.fetchData();
      this.loadDeviceConfig();
    },

    loadDevices() {
      getAllDevices().then(res => {
        if (res.code === 200 || res.code === 1) {
          this.deviceList = res.data || [];
          if (this.deviceList.length > 0) {
            this.selectedDeviceId = this.deviceList[0].deviceId;
            this.fetchData();
            this.loadDeviceConfig();
          }
        }
      });
    },

    loadDeviceConfig() {
      if (!this.selectedDeviceId) return;
      getDeviceConfig(this.selectedDeviceId).then(res => {
        if (res.code === 200 || res.code === 1) {
          this.deviceConfig = res.data;
          this.updateChart(); // Update chart to show new threshold
        }
      });
    },

    formatDate(date) {
        const y = date.getFullYear();
        const m = (date.getMonth() + 1).toString().padStart(2, '0');
        const d = date.getDate().toString().padStart(2, '0');
        const h = date.getHours().toString().padStart(2, '0');
        const min = date.getMinutes().toString().padStart(2, '0');
        const s = date.getSeconds().toString().padStart(2, '0');
        return `${y}-${m}-${d} ${h}:${min}:${s}`;
    },

    async fetchData(showLoading = true) {
      if (!this.selectedDeviceId) return;
      
      if (showLoading) {
        this.loading = true;
      }
      
      const end = new Date();
      const start = new Date();
      
      // Calculate start time based on range
      if (this.filters.range === '1h') {
          start.setTime(end.getTime() - 3600 * 1000);
      } else if (this.filters.range === '24h') {
          start.setTime(end.getTime() - 3600 * 1000 * 24);
      } else if (this.filters.range === '7d') {
          start.setTime(end.getTime() - 3600 * 1000 * 24 * 7);
      }
      
      const startStr = this.formatDate(start);
      const endStr = this.formatDate(end);

      try {
        const res = await getSensorDataByRange(this.selectedDeviceId, startStr, endStr);
        if (res.code === 200 || res.code === 1) {
            this.dataPoints = res.data || [];
            // Sort by time
            this.dataPoints.sort((a, b) => new Date(a.reportTime) - new Date(b.reportTime));
            this.updateChart();
        } else {
            this.$message.error(res.msg || '获取数据失败');
        }
      } catch (e) {
        console.error(e);
        this.$message.error('网络请求失败');
      } finally {
        this.loading = false;
      }
    },

    updateChart() {
      if (!this.chart) return
      
      const type = this.filters.type;
      
      // 统一传感器数据线颜色为蓝色 (#409EFF)
      const themeColor = '#409EFF';

      // Prepare data for chart
      const xData = this.dataPoints.map(p => {
        if (!p.reportTime) return '';
        const date = new Date(p.reportTime);
        const m = (date.getMonth() + 1).toString().padStart(2, '0');
        const d = date.getDate().toString().padStart(2, '0');
        const h = date.getHours().toString().padStart(2, '0');
        const min = date.getMinutes().toString().padStart(2, '0');
        const s = date.getSeconds().toString().padStart(2, '0');
        
        if (this.filters.range === '1h') {
             return `${h}:${min}:${s}`;
        } else if (this.filters.range === '24h') {
             return `${h}:${min}`;
        } else {
             return `${m}-${d} ${h}:${min}`;
        }
      });
      const yData = this.dataPoints.map(p => p[type]);

      // 获取阈值线
      const thresholdLine = this.getThresholdLine(type);

      // 计算 Y 轴范围，确保阈值线可见
      const numericData = yData.filter(v => v !== null && v !== undefined).map(Number);
      let yMin = null;
      let yMax = null;
      if (numericData.length > 0 && thresholdLine.data.length > 0) {
        const dataMin = Math.min(...numericData);
        const dataMax = Math.max(...numericData);
        const thresholdValues = thresholdLine.data.map(d => d.yAxis);
        const allMin = Math.min(dataMin, ...thresholdValues);
        const allMax = Math.max(dataMax, ...thresholdValues);
        const padding = (allMax - allMin) * 0.1 || 5;
        yMin = Math.floor(allMin - padding);
        yMax = Math.ceil(allMax + padding);
      }

      const option = {
        tooltip: {
          trigger: 'axis',
          backgroundColor: 'rgba(255, 255, 255, 0.9)',
          borderColor: '#eee',
          borderWidth: 1,
          textStyle: { color: '#333' },
          formatter: (params) => {
            const item = params[0]
            if (!item) return '';
            return `${item.axisValue}<br/>
                    <span style="display:inline-block;margin-right:5px;border-radius:50%;width:10px;height:10px;background-color:${item.color}"></span>
                    ${item.seriesName}: <b>${item.value}</b> ${this.currentUnit}`
          }
        },
        grid: {
          left: '2%', right: '3%', bottom: '2%', top: '10%',
          containLabel: true
        },
        xAxis: {
          type: 'category',
          boundaryGap: false,
          data: xData,
          axisLine: { lineStyle: { color: '#E4E7ED' } },
          axisLabel: { color: '#606266' },
          axisTick: { show: false }
        },
        yAxis: {
          type: 'value',
          min: yMin,
          max: yMax,
          axisLine: { show: false },
          axisTick: { show: false },
          splitLine: { lineStyle: { type: 'dashed', color: '#E4E7ED' } },
          axisLabel: { color: '#909399' }
        },
        series: [{
          name: this.chartTitle,
          data: yData,
          type: 'line',
          smooth: true,
          connectNulls: true,
          symbol: 'circle',
          symbolSize: 6,
          itemStyle: { color: themeColor, borderColor: '#fff', borderWidth: 2 },
          lineStyle: { width: 3, shadowColor: 'rgba(0,0,0,0.1)', shadowBlur: 10 },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: themeColor },
              { offset: 1, color: 'rgba(255, 255, 255, 0.1)' }
            ]),
            opacity: 0.2
          },
          markPoint: {
            data: [
              { type: 'max', name: 'Max' },
              { type: 'min', name: 'Min' }
            ]
          },
          markLine: thresholdLine
        }]
      }
      this.chart.setOption(option)
    },
    
    getThresholdLine(type) {
        if (!this.deviceConfig) return { data: [] };

        const cfg = this.deviceConfig;
        const lines = [];

        const makeLine = (value, label, color) => {
            if (value == null) return;
            lines.push({
                yAxis: value,
                label: {
                    show: true,
                    position: 'insideEndTop',
                    formatter: label,
                    color: color,
                    padding: [4, 8],
                    backgroundColor: 'rgba(255, 255, 255, 0.85)',
                    borderRadius: 4
                },
                lineStyle: { color: color, type: 'dashed', width: 2 }
            });
        };

        if (type === 'temperature') {
            makeLine(cfg.tempMax, '高温警戒 ' + cfg.tempMax + '°C', '#F56C6C');
            makeLine(cfg.tempMin, '低温警戒 ' + cfg.tempMin + '°C', '#409EFF');
        } else if (type === 'humidity') {
            makeLine(cfg.humidityMax, '高湿警戒 ' + cfg.humidityMax + '%', '#F56C6C');
        } else if (type === 'smokeDensity') {
            makeLine(cfg.smokeThreshold, '烟雾报警 ' + cfg.smokeThreshold, '#F56C6C');
        } else if (type === 'pressure') {
            makeLine(cfg.pressureMax, '气压报警 ' + cfg.pressureMax + ' hPa', '#F56C6C');
        } else if (type === 'dewPoint') {
            makeLine(cfg.dewPointMax, '露点报警 ' + cfg.dewPointMax + '°C', '#F56C6C');
        }

        return {
            symbol: ['none', 'none'],
            data: lines
        };
    }
  }
}
</script>

<style scoped>
.history-page {
  max-width: 1400px;
  margin: 0 auto;
}

/* Filter Container */
.filter-container {
  background: var(--bg-white);
  padding: 24px;
  border-radius: var(--radius-lg);
  margin-bottom: 24px;
  box-shadow: var(--shadow-card);
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 20px;
}

.page-header {
  flex: 1;
  min-width: 200px;
}

.page-title {
  font-size: 24px;
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1.2;
  margin: 0;
}

.page-desc {
  font-size: 14px;
  color: var(--text-secondary);
  margin: 8px 0 0;
}

.filter-form {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.filter-form >>> .el-form-item {
  margin-bottom: 0;
}

.filter-form >>> .el-form-item__label {
  color: var(--text-secondary);
}

.filter-form >>> .el-radio-button__inner {
  border-radius: var(--radius-md) !important;
  border: 1px solid var(--border-color) !important;
  margin: 0 4px;
}

.filter-form >>> .el-radio-button:first-child .el-radio-button__inner,
.filter-form >>> .el-radio-button:last-child .el-radio-button__inner {
  border-radius: var(--radius-md) !important;
}

/* Stat Row */
.stat-row {
  margin-bottom: 24px;
}

.stat-card {
  border: none !important;
  border-radius: var(--radius-lg) !important;
  box-shadow: var(--shadow-card) !important;
  transition: all var(--transition-fast) var(--ease-smooth) !important;
}

.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-card-hover) !important;
}

.stat-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.stat-text {
  display: flex;
  flex-direction: column;
}

.stat-label {
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 8px;
}

.stat-value {
  font-size: 28px;
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1;
}

.stat-unit {
  font-size: 13px;
  font-weight: normal;
  color: var(--text-secondary);
  margin-left: 4px;
}

.stat-icon-bg {
  width: 52px;
  height: 52px;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
}

/* Chart Card */
.chart-card {
  border: none !important;
  border-radius: var(--radius-lg) !important;
  box-shadow: var(--shadow-card) !important;
  overflow: hidden;
}

.chart-card >>> .el-card__header {
  background: var(--bg-container);
  padding: 16px 20px !important;
}

/* Responsive */
@media (max-width: 768px) {
  .filter-container {
    flex-direction: column;
  }
  
  .filter-form {
    width: 100%;
  }
  
  .page-title {
    font-size: 20px;
  }
}
</style>
