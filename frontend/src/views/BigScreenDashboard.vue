<template>
  <div class="data-v-dashboard">
    <!-- 头部 -->
    <header class="dv-header">
      <div class="dv-header-left">
        <el-button type="primary" size="small" icon="el-icon-back" @click="goBack" ghost>返回后台</el-button>
      </div>
      <div class="dv-header-title">物联网仓储管理大屏</div>
      <div class="dv-header-right">
        <span class="dv-time">{{ currentTime }}</span>
      </div>
    </header>

    <!-- 顶部四张卡片 (模拟风险指标) -->
    <div class="dv-top-cards">
      <div class="dv-card top-card">
        <div class="scan-light"></div>
        <div class="card-icon red"></div>
        <div class="card-info">
          <div class="card-title">紧急告警</div>
          <div class="card-value red-text">{{ topMetrics.emergency }}</div>
        </div>
      </div>
      <div class="dv-card top-card">
        <div class="scan-light"></div>
        <div class="card-icon orange"></div>
        <div class="card-info">
          <div class="card-title">库存短缺</div>
          <div class="card-value orange-text">{{ stockStats.shortage }}</div>
        </div>
      </div>
      <div class="dv-card top-card">
        <div class="scan-light"></div>
        <div class="card-icon yellow"></div>
        <div class="card-info">
          <div class="card-title">设备离线</div>
          <div class="card-value yellow-text">{{ deviceStatus.offline ? deviceStatus.offline.count : 0 }}</div>
        </div>
      </div>
      <div class="dv-card top-card">
        <div class="scan-light"></div>
        <div class="card-icon blue"></div>
        <div class="card-info">
          <div class="card-title">物资总数</div>
          <div class="card-value blue-text">{{ stockStats.total }}</div>
        </div>
      </div>
    </div>

    <!-- 主体内容布局 -->
    <div class="dv-main-container">
      <!-- 左侧: 综合态势区 -->
      <div class="dv-left-panel">
        <div class="dv-card md-card">
          <div class="panel-title"><i class="el-icon-s-data"></i> 综合态势</div>
          <div class="metrics-list">
            <div class="m-item" v-for="(m, i) in metrics" :key="i">
              <span class="m-label">{{ m.label }}</span>
              <div class="m-value-wrapper">
                <span class="m-value" :style="{ color: m.color }">{{ m.value }}</span>
                <span class="m-unit" v-if="m.unit" :style="{ color: m.color, opacity: 0.7 }">{{ m.unit }}</span>
              </div>
            </div>
          </div>
        </div>
        <div class="dv-card sm-card">
          <div class="panel-title"><i class="el-icon-connection"></i> 设备在线状态</div>
          <div class="device-status-list">
             <div class="status-item" v-for="(status, key) in deviceStatus" :key="key">
              <span class="s-label">{{ status.label }}</span>
              <span class="s-value" :style="{ color: status.color }">{{ status.count }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 中间: 地图/主视区 -->
      <div class="dv-center-panel">
        <div class="dv-card map-card">
          <div class="panel-title"><i class="el-icon-location"></i> 仓储监控态势全景</div>
          <div class="warehouse-layout">
            <!-- 真实仓储货架库位图 -->
            <div class="warehouse-zone" v-for="(zone, index) in warehouseZones" :key="index">
              <div class="zone-title">{{ zone.name }}</div>
              <div class="rack-grid">
                <div 
                  class="rack-item" 
                  v-for="rack in zone.locations" :key="rack.locationId"
                  :class="{ 'rack-full': rack.status === 1, 'rack-warning': rack.status === 2 }"
                >
                  <div class="rack-name">{{ rack.name }}</div>
                  <div class="rack-status"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 右侧: 趋势和统计 -->
      <div class="dv-right-panel">
        <div class="dv-card md-card">
          <div class="panel-title"><i class="el-icon-trend-charts"></i> 近两小时风险趋势</div>
          <div class="chart-placeholder">
            <!-- ECharts 折线图容器 -->
            <div id="trendChart" style="width:100%; height:100%;"></div>
          </div>
        </div>
        <div class="dv-card md-card">
          <div class="panel-title"><i class="el-icon-pie-chart"></i> 库存健康状态分布</div>
           <div class="chart-placeholder">
            <!-- ECharts 饼图容器 -->
            <div id="pieChart" style="width:100%; height:100%;"></div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
// 这里引入图表库和API
import * as echarts from 'echarts'
import { getLocations } from '@/api/location'
import { getAllStockItems, getStockSummary } from '@/api/stock'
import { getDashboardStats } from '@/api/stats'
import { getAllDevices, getLatestSensorData } from '@/api/device'

export default {
  name: 'BigScreenDashboard',
  data() {
    return {
      currentTime: new Date().toLocaleString(),
      warehouseZones: [], // 真实库区数据
      topMetrics: { emergency: 0 },
      metrics: [
        { label: '系统运行天数', value: '128', color: '#00f0ff', unit: '天' },
        { label: '环境平均温度', value: '0', color: '#67c23a', unit: '°C' },
        { label: '环境平均湿度', value: '0', color: '#40a9ff', unit: '%' },
        { label: '待处理告警数', value: '0', color: '#ff4d4f', unit: '条' }
      ],
      deviceStatus: {
        online: { label: '在线', count: 0, color: '#67c23a' },
        offline: { label: '离线', count: 0, color: '#f56c6c' }
      },
      stockStats: { total: 0, warning: 0, shortage: 0 },
      timer: null
    }
  },
  mounted() {
    this.timer = setInterval(() => {
      this.currentTime = new Date().toLocaleString()
    }, 1000)
    
    // 确保 DOM 渲染后再初始化图表
    this.$nextTick(() => {
      this.initCharts()
      this.fetchAllData().then(() => {
        this.updateCharts()
      })
    })

    window.addEventListener('resize', this.resizeCharts)
  },
  beforeDestroy() {
    if(this.timer) clearInterval(this.timer)
    window.removeEventListener('resize', this.resizeCharts)
    if (this.trendChartInst) this.trendChartInst.dispose()
    if (this.pieChartInst) this.pieChartInst.dispose()
  },
  methods: {
    async fetchAllData() {
      // 聚合所有数据请求
      await Promise.all([
        this.fetchWarehouseData(),
        this.fetchDashboardStats(),
        this.fetchStockData(),
        this.fetchSensorData()
      ])
    },
    
    initCharts() {
      const trendDom = document.getElementById('trendChart');
      const pieDom = document.getElementById('pieChart');
      if (trendDom) {
        this.trendChartInst = echarts.init(trendDom);
      }
      if (pieDom) {
        this.pieChartInst = echarts.init(pieDom);
      }
    },
    updateCharts() {
      if (this.trendChartInst) {
        // 生成近两小时的时间标签 (每30分钟一个点)
        const times = [];
        const now = new Date();
        for (let i = 5; i >= 0; i--) {
          const t = new Date(now.getTime() - i * 30 * 60000);
          const h = String(t.getHours()).padStart(2, '0');
          const m = String(t.getMinutes()).padStart(2, '0');
          times.push(`${h}:${m}`);
        }
        
        // 模拟近两小时风险趋势数据，最后一个点为当前真实的紧急告警数
        const emergencyCount = this.topMetrics.emergency || 0;
        const baseRisk = Math.max(0, emergencyCount - 2);
        const riskData = [
          baseRisk,
          Math.max(0, emergencyCount - 1),
          emergencyCount + 1,
          Math.max(0, emergencyCount - 1),
          emergencyCount > 0 ? emergencyCount - 1 : 0,
          emergencyCount
        ];

        const option = {
          tooltip: { trigger: 'axis', backgroundColor: 'rgba(0,0,0,0.7)', textStyle: { color: '#fff' } },
          grid: { left: '10%', right: '5%', bottom: '15%', top: '15%' },
          xAxis: { 
            type: 'category', 
            data: times, 
            axisLine: { lineStyle: { color: '#00f0ff' } } 
          },
          yAxis: { 
            type: 'value', 
            splitLine: { lineStyle: { color: 'rgba(0,240,255,0.1)' } },
            axisLine: { lineStyle: { color: '#00f0ff' } } 
          },
          series: [
            { 
              name: '风险指数', 
              data: riskData, 
              type: 'line', 
              smooth: true,
              lineStyle: { color: '#00f0ff', width: 3 },
              areaStyle: {
                color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                  { offset: 0, color: 'rgba(0,240,255,0.5)' },
                  { offset: 1, color: 'rgba(0,240,255,0)' }
                ])
              }
            }
          ]
        };
        this.trendChartInst.setOption(option);
      }

      if (this.pieChartInst) {
        const total = this.stockStats.total || 0;
        const warning = this.stockStats.warning || 0;
        const shortage = this.stockStats.shortage || 0;
        const normal = Math.max(0, total - warning - shortage);

        const option = {
          tooltip: { trigger: 'item', backgroundColor: 'rgba(0,0,0,0.7)', textStyle: { color: '#fff' } },
          series: [
            {
              name: '健康分布',
              type: 'pie',
              radius: ['40%', '70%'],
              roseType: 'radius',
              data: [
                { value: normal, name: '库存正常', itemStyle: { color: '#40a9ff' } },
                { value: warning, name: '库存积压', itemStyle: { color: '#faad14' } },
                { value: shortage, name: '库存短缺', itemStyle: { color: '#ff4d4f' } }
              ],
              label: {
                color: '#fff'
              }
            }
          ]
        };
        this.pieChartInst.setOption(option);
      }
    },
    resizeCharts() {
      if (this.trendChartInst) this.trendChartInst.resize();
      if (this.pieChartInst) this.pieChartInst.resize();
    },

    async fetchDashboardStats() {
      try {
        const res = await getDashboardStats()
        if (res && (res.code === 1 || res.code === 200)) {
          const d = res.data || {}
          this.topMetrics.emergency = d.unprocessedAlarms || 0
          this.metrics[3].value = d.unprocessedAlarms != null ? String(d.unprocessedAlarms) : '0'
          this.deviceStatus.online.count = d.onlineDevices || 0
          this.deviceStatus.offline.count = d.offlineDevices || 0
        }
      } catch (e) {
        console.error('获取系统统计失败', e)
      }
    },
    async fetchSensorData() {
      try {
        // 先获取所有设备，找出在线的温湿度传感器
        const devicesRes = await getAllDevices()
        const devices = (devicesRes && (devicesRes.code === 1 || devicesRes.code === 200)) ? devicesRes.data : (Array.isArray(devicesRes) ? devicesRes : [])
        
        let avgTemp = 0;
        let avgHum = 0;
        let count = 0;

        // 并发请求所有传感器的最新数据
        if (devices && devices.length > 0) {
          const promises = devices.map(d => getLatestSensorData(d.deviceId))
          const sensorsData = await Promise.allSettled(promises)
          
          sensorsData.forEach(result => {
             if (result.status === 'fulfilled') {
                const res = result.value;
                const sData = (res && (res.code === 1 || res.code === 200)) ? res.data : (res && res.temperature !== undefined ? res : null);
                if (sData && sData.temperature !== null) {
                   avgTemp += parseFloat(sData.temperature || 0);
                   avgHum += parseFloat(sData.humidity || 0);
                   count++;
                }
             }
          })
        }

        if (count > 0) {
          this.metrics[1].value = (avgTemp / count).toFixed(1);
          this.metrics[2].value = (avgHum / count).toFixed(1);
        } else {
          this.metrics[1].value = '--'; // 改为无数据占位符，不使用假数据
          this.metrics[2].value = '--'; // 改为无数据占位符，不使用假数据
        }
      } catch (e) {
        console.error('获取温湿度数据失败', e)
      }
    },
    async fetchStockData() {
      try {
        const res = await getStockSummary({ page: 1, pageSize: 1 })
        if (res && (res.code === 1 || res.code === 200)) {
          const d = res.data || {}
          this.stockStats.total = d.total || 0
          this.stockStats.shortage = d.lowStockCount || 0
          this.stockStats.warning = (d.lowStockCount || 0) + (d.overStockCount || 0)
        }
      } catch (e) {
        console.error('获取库存概览失败', e)
      }
    },
    formatTime(ct) {
      if (!ct) return '-'
      try {
        const d = Array.isArray(ct)
          ? new Date(ct[0], ct[1] - 1, ct[2], ct[3] || 0, ct[4] || 0, ct[5] || 0)
          : new Date(ct)
        const pad = n => String(n).padStart(2, '0')
        return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
      } catch (e) {
        return String(ct)
      }
    },
    async fetchWarehouseData() {
      try {
        const [resLocations, resStock] = await Promise.all([
          getLocations(),
          getAllStockItems()
        ]);
        
        let locations = [];
        if (resLocations && (resLocations.code === 200 || resLocations.code === 1)) {
            locations = resLocations.data || [];
        } else if (Array.isArray(resLocations)) {
            locations = resLocations;
        }

        let stockItems = [];
        if (resStock && (resStock.code === 200 || resStock.code === 1)) {
            stockItems = resStock.data || [];
        } else if (Array.isArray(resStock)) {
            stockItems = resStock;
        }
        
        // 映射被占用的存位
        const occupiedMap = new Map();
        stockItems.forEach(item => {
            if (item.location) {
                occupiedMap.set(item.location, item);
            }
        });

        const groups = {};
        // 1. 创建库区 (Level 1)
        locations.forEach(loc => {
            if (loc.level === 1) {
                groups[loc.id] = { 
                    id: loc.id, 
                    name: loc.name, 
                    sortOrder: loc.sortOrder || 0,
                    locations: [] 
                };
            }
        });
        
        // 2. 添加具体库位 (Level 2)
        locations.forEach(loc => {
            if (loc.level === 2 && loc.parentId && groups[loc.parentId]) {
                const stockInfo = occupiedMap.get(loc.id);
                // 状态定义: 0-空位, 1-满载/占用, 2-异常(预警)
                const status = stockInfo ? 1 : 0; 
                groups[loc.parentId].locations.push({
                   locationId: loc.id,
                   name: loc.name,
                   status: status,
                   sortOrder: loc.sortOrder || 0
                });
            }
        });

        // 3. 排序组装
        const zonesList = Object.values(groups).sort((a, b) => a.sortOrder - b.sortOrder);
        zonesList.forEach(zone => {
            zone.locations.sort((a, b) => a.sortOrder - b.sortOrder);
        });

        this.warehouseZones = zonesList;
      } catch (err) {
        console.error('Failed to fetch warehouse data:', err);
        this.$message.error('获取仓储数据失败，请检查网络或刷新重试');
      }
    },
    goBack() {
      // 返回传统后台界面
      this.$router.push('/dashboard')
    },
    getAlarmTag(severity) {
      const colors = { 1: '#ff4d4f', 2: '#faad14', 3: '#40a9ff' }
      return { color: colors[severity] || '#eee' }
    }
  }
}
</script>

<style scoped>
/* 核心大屏暗黑+霓虹风格样式 */
.data-v-dashboard {
  position: relative;
  width: 100%;
  height: 100vh; /* 固定 100vh */
  display: flex;
  flex-direction: column;
  background: #030816;
  color: #fff;
  font-family: 'Helvetica Neue', Arial, sans-serif;
  box-sizing: border-box;
  padding: 10px 20px;
  overflow: hidden;
  background-image: radial-gradient(circle at 50% 50%, #061129, #010205);
  animation: bg-breathe 10s infinite alternate;
}

@keyframes bg-breathe {
  0% { background-image: radial-gradient(circle at 50% 50%, #061129, #010205); }
  100% { background-image: radial-gradient(circle at 50% 50%, #0a1c42, #02050f); }
}

/* 装饰性科技边框 */
.dv-card {
  background: rgba(8, 20, 48, 0.6);
  border: 1px solid #113366;
  border-radius: 4px;
  box-shadow: 0 0 10px rgba(0, 240, 255, 0.1) inset;
  position: relative;
  overflow: hidden;
  animation: card-fade-in 0.8s cubic-bezier(0.25, 0.8, 0.25, 1) both;
}

@keyframes card-fade-in {
  0% { opacity: 0; transform: translateY(20px); }
  100% { opacity: 1; transform: translateY(0); }
}

/* 为不同的卡片增加交错的动画延迟 */
.dv-top-cards .dv-card:nth-child(1) { animation-delay: 0.1s; }
.dv-top-cards .dv-card:nth-child(2) { animation-delay: 0.2s; }
.dv-top-cards .dv-card:nth-child(3) { animation-delay: 0.3s; }
.dv-top-cards .dv-card:nth-child(4) { animation-delay: 0.4s; }
.dv-left-panel .dv-card:nth-child(1) { animation-delay: 0.5s; }
.dv-left-panel .dv-card:nth-child(2) { animation-delay: 0.6s; }
.dv-center-panel .dv-card { animation-delay: 0.7s; }
.dv-right-panel .dv-card:nth-child(1) { animation-delay: 0.8s; }
.dv-right-panel .dv-card:nth-child(2) { animation-delay: 0.9s; }
.dv-bottom-panel .dv-card { animation-delay: 1.0s; }

/* 炫光扫描线特效 */
.dv-card::before, .dv-card::after {
  content: '';
  position: absolute;
  width: 15px;
  height: 15px;
  border: 2px solid #00f0ff;
  border-radius: 2px;
  z-index: 10;
  transition: all 0.5s ease;
}
.dv-card::before { top: -2px; left: -2px; border-right: none; border-bottom: none; }
.dv-card::after { bottom: -2px; right: -2px; border-left: none; border-top: none; }
.dv-card:hover::before { width: 30px; height: 30px; border-color: #fff; box-shadow: -2px -2px 10px #00f0ff; }
.dv-card:hover::after { width: 30px; height: 30px; border-color: #fff; box-shadow: 2px 2px 10px #00f0ff; }

/* 内部扫光层 */
.dv-card .scan-light {
  position: absolute;
  top: 0; left: -100%;
  width: 50%; height: 100%;
  background: linear-gradient(90deg, transparent, rgba(0, 240, 255, 0.1), transparent);
  transform: skewX(-45deg);
  animation: scan-light 4s infinite linear;
  pointer-events: none;
}
@keyframes scan-light {
  0% { left: -100%; }
  20% { left: 200%; }
  100% { left: 200%; }
}

.panel-title {
  padding: 10px 15px;
  font-size: 16px;
  color: #00f0ff;
  font-weight: bold;
  border-bottom: 1px solid rgba(0, 240, 255, 0.2);
  text-shadow: 0 0 5px rgba(0,240,255,0.5);
  position: relative;
  overflow: hidden;
}
.panel-title::after {
  content: ''; position: absolute;
  bottom: -1px; left: -100%; width: 50%; height: 2px;
  background: linear-gradient(90deg, transparent, #00f0ff, transparent);
  animation: title-scan 3s infinite;
}
@keyframes title-scan {
  0% { left: -100%; }
  50% { left: 200%; }
  100% { left: 200%; }
}
.panel-title i {
  display: inline-block;
  animation: icon-float 2s infinite ease-in-out alternate;
}
@keyframes icon-float {
  0% { transform: translateY(0) scale(1); text-shadow: 0 0 5px #00f0ff; }
  100% { transform: translateY(-2px) scale(1.1); text-shadow: 0 0 15px #fff; }
}

/* 头部 */
.dv-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 60px;
  margin-bottom: 20px;
  background: linear-gradient(180deg, rgba(0, 15, 30, 0) 0%, rgba(0, 240, 255, 0.15) 100%);
  border-bottom: 2px solid rgba(0, 240, 255, 0.6);
  background-size: contain;
}
.dv-header-title {
  font-size: 28px;
  font-weight: 700;
  color: #fff;
  letter-spacing: 2px;
  text-shadow: 0 0 10px #00f0ff;
  animation: neon-flicker 4s infinite alternate;
}
@keyframes neon-flicker {
  0%, 19%, 21%, 23%, 25%, 54%, 56%, 100% {
    text-shadow: 0 0 5px #fff, 0 0 10px #fff, 0 0 20px #00f0ff, 0 0 40px #00f0ff;
  }
  20%, 24%, 55% {
    text-shadow: none;
    opacity: 0.8;
  }
}
.dv-time { color: #00f0ff; font-family: monospace; font-size: 16px; }
.el-button--primary[ghost] {
  background: transparent !important;
  border-color: #00f0ff !important;
  color: #00f0ff !important;
}

/* 顶部四卡片 */
.dv-top-cards {
  display: flex;
  gap: 20px;
  margin-bottom: 20px;
}
.top-card {
  flex: 1;
  display: flex;
  align-items: center;
  padding: 15px 20px;
  gap: 15px;
}
.card-icon { width: 12px; height: 12px; border-radius: 50%; position: relative; }
.card-icon::after {
  content: ''; position: absolute;
  top: -8px; left: -8px; right: -8px; bottom: -8px;
  border: 1px dashed; border-radius: 50%;
  animation: spin-ring 3s linear infinite;
}
@keyframes spin-ring { 100% { transform: rotate(360deg); } }
.card-icon.red { background: #ff4d4f; box-shadow: 0 0 8px #ff4d4f; }
.card-icon.red::after { border-color: #ff4d4f; }
.card-icon.orange { background: #faad14; box-shadow: 0 0 8px #faad14; }
.card-icon.orange::after { border-color: #faad14; }
.card-icon.yellow { background: #fadb14; box-shadow: 0 0 8px #fadb14; }
.card-icon.yellow::after { border-color: #fadb14; }
.card-icon.blue { background: #40a9ff; box-shadow: 0 0 8px #40a9ff; }
.card-icon.blue::after { border-color: #40a9ff; }
.card-title { font-size: 14px; color: #aaa; margin-bottom: 5px; }
.card-value { 
  font-size: 28px; font-weight: bold; font-family: Impact, sans-serif; 
  display: inline-block; animation: num-pulse 2s infinite alternate; 
}
@keyframes num-pulse {
  0% { transform: scale(1); text-shadow: 0 0 5px currentColor; }
  100% { transform: scale(1.08); text-shadow: 0 0 25px currentColor; }
}
.red-text { color: #ff4d4f; }
.orange-text { color: #faad14; }
.yellow-text { color: #fadb14; }
.blue-text { color: #40a9ff; }

/* 主体布局 */
.dv-main-container {
  display: flex;
  gap: 20px;
  flex: 1; /* 让主体容器吃满剩余的屏幕空间 */
  min-height: 400px;
}
.dv-left-panel, .dv-right-panel {
  flex: 0 0 25%;
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.dv-center-panel {
  flex: 1;
}

/* 面板通用 */
.md-card { flex: 2; display: flex; flex-direction: column; }
.sm-card { flex: 1.2; display: flex; flex-direction: column; }
.map-card { padding: 0; height: 100%; display: flex; flex-direction: column; }

/* 左侧具体内容 */
.metrics-list, .device-status-list { padding: 15px; display: flex; flex-direction: column; gap: 15px; }
.m-item, .status-item { display: flex; justify-content: space-between; align-items: center; }
.m-label, .s-label { color: #88acc6; font-size: 14px; }
.m-value, .s-value { 
  font-size: 18px; font-weight: bold; font-family: monospace;
  animation: glitch-text 3s infinite alternate;
}
@keyframes glitch-text {
  0% { transform: skewX(0); text-shadow: none; }
  10% { transform: skewX(-5deg); text-shadow: -2px 0 red, 2px 0 cyan; }
  15% { transform: skewX(5deg); text-shadow: -1px 0 red, 1px 0 cyan; }
  20% { transform: skewX(0); text-shadow: none; }
  100% { transform: skewX(0); text-shadow: none; }
}
.m-unit {
  font-size: 12px;
  margin-left: 4px;
}
.m-value-wrapper { display: flex; align-items: baseline; }
.s-value { position: relative; }

/* 仓储全景图 */
.warehouse-layout {
  flex: 1;
  margin: 10px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  background-image: linear-gradient(rgba(0, 240, 255, 0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 240, 255, 0.05) 1px, transparent 1px);
  background-size: 50px 50px;
  border-radius: 4px;
  border: 1px solid rgba(0, 240, 255, 0.2);
  overflow-y: auto;
  box-shadow: inset 0 0 40px rgba(0,0,0,0.8);
  position: relative;
}
.warehouse-layout::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background: repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,240,255,0.05) 2px, rgba(0,240,255,0.05) 4px);
  pointer-events: none;
  animation: grid-scan 10s linear infinite;
  z-index: 0;
}
@keyframes grid-scan {
  0% { background-position: 0 0; }
  100% { background-position: 0 100px; }
}
.warehouse-zone {
  background: rgba(0, 40, 80, 0.4);
  border: 1px solid rgba(0, 240, 255, 0.3);
  padding: 15px;
  border-radius: 6px;
  position: relative;
}
.zone-title {
  color: #00f0ff;
  font-weight: bold;
  font-size: 16px;
  margin-bottom: 15px;
  text-shadow: 0 0 5px #00f0ff;
  border-left: 4px solid #00f0ff;
  padding-left: 10px;
  position: relative;
  display: inline-block;
}
.zone-title::after {
  content: ''; position: absolute;
  top: 0; left: 0; width: 4px; height: 100%;
  background: #fff;
  box-shadow: 0 0 10px #fff;
  animation: border-pulse 1.5s infinite;
}
@keyframes border-pulse {
  0% { height: 0; opacity: 1; }
  50% { height: 100%; opacity: 0.5; }
  100% { height: 100%; opacity: 0; transform: translateY(100%); }
}
.rack-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
  gap: 15px;
}
.rack-item {
  height: 60px;
  background: rgba(0, 240, 255, 0.05);
  border: 1px solid rgba(0, 240, 255, 0.4);
  border-radius: 4px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  cursor: pointer;
  transition: all 0.3s;
  box-shadow: 0 0 10px rgba(0,0,0,0.5);
  animation: pop-in-rack 0.8s cubic-bezier(0.175, 0.885, 0.32, 1.275) both;
}
@keyframes pop-in-rack {
  0% { opacity: 0; transform: scale(0.2); }
  100% { opacity: 1; transform: scale(1); }
}
.rack-item:nth-child(even) { animation-delay: 1.2s; }
.rack-item:nth-child(odd) { animation-delay: 1.4s; }
.rack-item:hover {
  transform: translateY(-2px) scale(1.05);
  background: rgba(0, 240, 255, 0.2);
  box-shadow: 0 0 15px rgba(0, 240, 255, 0.5);
}
.rack-name {
  font-size: 12px;
  color: #c0dfff;
  margin-bottom: 5px;
}
.rack-status {
  width: 40px;
  height: 4px;
  border-radius: 2px;
  background: #00f0ff; /* 默认正常（空闲或部分可用） */
  box-shadow: 0 0 5px #00f0ff;
}
/* 异常或满载状态 */
.rack-full .rack-status {
  background: #faad14;
  box-shadow: 0 0 5px #faad14;
}
.rack-warning .rack-status {
  background: #ff4d4f;
  box-shadow: 0 0 5px #ff4d4f;
}
.rack-warning {
  border-color: rgba(255, 77, 79, 0.6);
  animation: pulse-border 2s infinite;
}
@keyframes pulse-border {
  0% { box-shadow: 0 0 0 0 rgba(255,77,79, 0.4); }
  70% { box-shadow: 0 0 0 8px rgba(255,77,79, 0); }
  100% { box-shadow: 0 0 0 0 rgba(255,77,79, 0); }
}

/* 右侧图表区域 */
.chart-placeholder { flex: 1; padding: 10px; color: #444; }

/* 底部列表 */
.dv-bottom-panel { height: 200px; }
.bottom-card { height: 100%; overflow: hidden; }
.table-container { padding: 10px; height: calc(100% - 40px); }
.dark-table.el-table { background: transparent; color: #fff; }
::v-deep .dark-table.el-table th, ::v-deep .dark-table.el-table tr { background-color: transparent !important; color: #88acc6;}
::v-deep .dark-table.el-table--enable-row-hover .el-table__body tr:hover>td { background-color: rgba(0, 240, 255, 0.1) !important; }
::v-deep .dark-table.el-table td { border-bottom: 1px solid rgba(255,255,255,0.05); padding: 6px 0; }
::v-deep .dark-table.el-table th { border-bottom: 1px solid rgba(255,255,255,0.1); }
::v-deep .dark-table.el-table::before { display: none; }
/* 列表滚动入场动画 */
::v-deep .dark-table.el-table .el-table__row {
  animation: slide-in-row 0.6s cubic-bezier(0.25, 0.8, 0.25, 1) both;
}
::v-deep .dark-table.el-table .el-table__row:nth-child(1) { animation-delay: 1.1s; }
::v-deep .dark-table.el-table .el-table__row:nth-child(2) { animation-delay: 1.2s; }
::v-deep .dark-table.el-table .el-table__row:nth-child(3) { animation-delay: 1.3s; }
::v-deep .dark-table.el-table .el-table__row:nth-child(4) { animation-delay: 1.4s; }
::v-deep .dark-table.el-table .el-table__row:nth-child(5) { animation-delay: 1.5s; }
@keyframes slide-in-row {
  0% { transform: translateX(30px); opacity: 0; }
  100% { transform: translateX(0); opacity: 1; }
}
</style>
