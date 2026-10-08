<template>
  <div class="dashboard-container">
    <!-- 欢迎区域 -->
    <div class="welcome-section">
      <div class="welcome-content">
        <h1>欢迎，管理员</h1>
        <p>{{ greeting }}</p>
      </div>
      <div style="display: flex; align-items: center; gap: 20px;">
        <div class="welcome-time">{{ currentTime }}</div>
        <el-button size="medium" icon="el-icon-data-board" @click="$router.push('/big-screen')" round style="background: rgba(255,255,255,0.2); color: #fff; border: 1px solid rgba(255,255,255,0.4); font-weight: bold;">
          进入数据大屏
        </el-button>
      </div>
    </div>

    <!-- 关键指标 -->
    <div class="metrics-grid">
      <div class="metric-card" v-for="(metric, index) in metrics" :key="index">
        <div class="metric-header">
          <div class="metric-icon" :style="{ background: metric.bgColor }">
            <i :class="metric.icon" :style="{ color: metric.color }"></i>
          </div>
          <div class="metric-info">
            <div class="metric-value">{{ metric.value }}</div>
            <div class="metric-label">{{ metric.label }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- 主要内容区 -->
    <el-row :gutter="20" style="margin-bottom: 20px;">
      <!-- 设备运行状况 -->
      <el-col :span="12">
        <el-card class="content-card">
          <div slot="header" class="card-header">
            <span class="card-title">设备运行状况</span>
            <el-button type="text" size="small" @click="viewAllDevices">查看全部</el-button>
          </div>
          <div class="device-status">
            <div class="status-item" v-for="(status, key) in deviceStatus" :key="key">
              <div class="status-label">{{ status.label }}</div>
              <div class="status-value" :style="{ color: status.color }">{{ status.count }}</div>
              <div class="status-bar">
                <div class="status-fill" :style="{ width: status.percentage + '%', background: status.color }"></div>
              </div>
              <div class="status-percentage">{{ status.percentage }}%</div>
            </div>
          </div>
        </el-card>
      </el-col>

      <!-- 库存概览 -->
      <el-col :span="12">
        <el-card class="content-card">
          <div slot="header" class="card-header">
            <span class="card-title">库存概览</span>
            <div class="header-right">
                <el-button type="text" size="small" icon="el-icon-refresh" @click="fetchStockData" style="margin-right: 8px">刷新</el-button>
                <el-button type="text" size="small" @click="viewAllStock">查看全部</el-button>
            </div>
          </div>
          <div class="stock-overview" v-loading="stockLoading">
            <div class="stock-item">
              <span class="label">物资总数</span>
              <span class="value">{{ stockStats.total }}</span>
              <span class="unit">种</span>
            </div>
            <div class="stock-item warning">
              <span class="label">库存预警</span>
              <span class="value">{{ stockStats.warning }}</span>
              <span class="unit">种</span>
            </div>
            <div class="stock-item danger">
              <span class="label">库存不足</span>
              <span class="value">{{ stockStats.shortage }}</span>
              <span class="unit">种</span>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 底部行 -->
    <el-row :gutter="20">
      <!-- 最近告警 -->
      <el-col :span="12">
        <el-card class="content-card">
          <div slot="header" class="card-header">
            <span class="card-title">最近告警</span>
            <el-button type="text" size="small" @click="viewAllAlerts">查看全部</el-button>
          </div>
          <el-table :data="recentAlerts" stripe max-height="300" style="width: 100%;">
            <el-table-column label="告警类型" width="100">
              <template slot-scope="scope">
                <el-tag :type="getAlarmTag(scope.row.severity)">
                  {{ scope.row.type }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="内容" min-width="120" show-overflow-tooltip prop="content"></el-table-column>
            <el-table-column label="时间" width="160" prop="time"></el-table-column>
          </el-table>
        </el-card>
      </el-col>

      <!-- 快速操作已移除 -->
    </el-row>
  </div>
</template>

<script>
import { getDashboardStats } from '@/api/stats'
import { getStockSummary } from '@/api/stock'
import { getAlarms } from '@/api/alarm'

export default {
  name: 'DashboardPage',
  data() {
    return {
      currentTime: '',
      greeting: '当前系统运行正常，所有设备在线',
      stockLoading: false,
      stockStats: { total: 0, warning: 0, shortage: 0 },
      metrics: [
        { label: '在线设备', value: '-', icon: 'el-icon-success',  color: '#52c41a', bgColor: 'rgba(82,196,26,0.1)'  },
        { label: '异常告警', value: '-', icon: 'el-icon-warning',  color: '#ffae1f', bgColor: 'rgba(255,174,31,0.1)' },
        { label: '库存预警', value: '-', icon: 'el-icon-info',     color: '#1890ff', bgColor: 'rgba(24,144,255,0.1)' },
        { label: '今日操作', value: '-', icon: 'el-icon-document', color: '#722ed1', bgColor: 'rgba(114,46,209,0.1)' }
      ],
      deviceStatus: {
        online:  { label: '在线设备', count: 0, color: '#52c41a', percentage: 0 },
        offline: { label: '离线设备', count: 0, color: '#f5222d', percentage: 0 }
      },
      recentAlerts: []
    }
  },
  mounted() {
    this.updateTime()
    this.fetchAllData()
    setInterval(() => { this.updateTime() }, 1000)
  },
  methods: {
    async fetchAllData() {
      await Promise.all([
        this.fetchDashboardStats(),
        this.fetchStockData(),
        this.fetchRecentAlerts()
      ])
    },

    async fetchDashboardStats() {
      try {
        const res = await getDashboardStats()
        if (res && (res.code === 1 || res.code === 200)) {
          const d = res.data || {}
          this.metrics[0].value = d.onlineDevices     != null ? String(d.onlineDevices)     : '-'
          this.metrics[1].value = d.unprocessedAlarms != null ? String(d.unprocessedAlarms) : '-'
          this.metrics[2].value = d.lowStock          != null ? String(d.lowStock)          : '-'
          this.metrics[3].value = d.todayOps          != null ? String(d.todayOps)          : '-'
          const total   = d.totalDevices   || 0
          const online  = d.onlineDevices  || 0
          const offline = d.offlineDevices || 0
          this.deviceStatus.online.count       = online
          this.deviceStatus.offline.count      = offline
          this.deviceStatus.online.percentage  = total ? Math.round(online  / total * 100) : 0
          this.deviceStatus.offline.percentage = total ? Math.round(offline / total * 100) : 0
          if (offline === 0 && total > 0) {
            this.greeting = `当前系统运行正常，${online} 台设备全部在线`
          } else if (offline > 0) {
            this.greeting = `当前有 ${offline} 台设备离线，请及时处理`
          }
        }
      } catch (e) {
        console.error('获取dashboard统计失败', e)
      }
    },

    async fetchStockData() {
      this.stockLoading = true
      try {
        const res = await getStockSummary({ page: 1, pageSize: 1 })
        if (res && (res.code === 1 || res.code === 200)) {
          const d = res.data || {}
          this.stockStats.total    = d.total          || 0
          this.stockStats.shortage = d.lowStockCount  || 0
          this.stockStats.warning  = (d.lowStockCount || 0) + (d.overStockCount || 0)
        }
      } catch (e) {
        console.error('获取库存概览失败', e)
      } finally {
        this.stockLoading = false
      }
    },

    async fetchRecentAlerts() {
      try {
        const res = await getAlarms({ status: 0 })
        const list = Array.isArray(res) ? res : ((res && res.data) || [])
        this.recentAlerts = list.slice(0, 5).map(a => ({
          type:     a.alarmType || '未知',
          severity: a.severity  || 1,
          content:  a.content   || '',
          time:     this.formatTime(a.createTime)
        }))
      } catch (e) {
        console.error('获取告警列表失败', e)
      }
    },

    formatTime(ct) {
      if (!ct) return '-'
      try {
        const d = Array.isArray(ct)
          ? new Date(ct[0], ct[1] - 1, ct[2], ct[3] || 0, ct[4] || 0, ct[5] || 0)
          : new Date(ct)
        const pad = n => String(n).padStart(2, '0')
        const now = new Date()
        if (d.toDateString() === now.toDateString()) {
          return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
        }
        const yd = new Date(now)
        yd.setDate(now.getDate() - 1)
        if (d.toDateString() === yd.toDateString()) {
          return `昨天 ${pad(d.getHours())}:${pad(d.getMinutes())}`
        }
        return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
      } catch (e) {
        return String(ct)
      }
    },

    updateTime() {
      const now = new Date()
      const p = n => String(n).padStart(2, '0')
      this.currentTime = `${p(now.getHours())}:${p(now.getMinutes())}:${p(now.getSeconds())}`
    },

    getAlarmTag(severity) {
      if (severity === 3) return 'danger'
      if (severity === 2) return 'warning'
      return 'info'
    },
    viewAllDevices() { this.$router.push('/devices') },
    viewAllStock()   { this.$router.push('/stock')   },
    viewAllAlerts()  { this.$router.push('/alerts')  }
  }
}
</script>

<style scoped lang="css">
.dashboard-container {
  animation: pageEnter 0.3s ease-out;
}

@keyframes pageEnter {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 欢迎区域 */
.welcome-section {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: linear-gradient(135deg, #5d87ff 0%, #7899ff 100%);
  border-radius: var(--radius-lg);
  padding: 32px 24px;
  margin-bottom: 24px;
  color: white;
  box-shadow: var(--shadow-md);
}

.welcome-content h1 {
  margin: 0;
  font-size: 28px;
  font-weight: 700;
  letter-spacing: 0.5px;
}

.welcome-content p {
  margin: 8px 0 0;
  font-size: 14px;
  opacity: 0.9;
}

.welcome-time {
  font-size: 48px;
  font-weight: 600;
  font-family: 'Courier New', monospace;
  letter-spacing: 2px;
}

/* 指标网格 */
.metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}

.metric-card {
  background: var(--bg-white);
  border-radius: var(--radius-lg);
  padding: 20px;
  box-shadow: var(--shadow-sm);
  transition: all 0.3s ease;
}

.metric-card:hover {
  box-shadow: var(--shadow-md);
  transform: translateY(-4px);
}

.metric-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 16px;
}

.metric-icon {
  width: 56px;
  height: 56px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  flex-shrink: 0;
}

.metric-value {
  font-size: 32px;
  font-weight: 700;
  color: var(--text-primary);
}

.metric-label {
  font-size: 13px;
  color: var(--text-secondary);
  margin-top: 4px;
}

.metric-footer {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
}

.trend-period {
  color: var(--text-secondary);
}

/* 内容卡片 */
.content-card {
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

/* 设备状态 */
.device-status {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.status-item {
  display: grid;
  grid-template-columns: 80px 1fr 60px;
  gap: 12px;
  align-items: center;
}

.status-label {
  font-weight: 500;
  color: var(--text-secondary);
}

.status-value {
  font-size: 24px;
  font-weight: 700;
}

.status-bar {
  grid-column: 2;
  height: 8px;
  background: var(--bg-secondary);
  border-radius: 4px;
  overflow: hidden;
}

.status-fill {
  height: 100%;
  border-radius: 4px;
  transition: width 0.3s ease;
}

.status-percentage {
  text-align: right;
  font-size: 13px;
  color: var(--text-secondary);
  font-weight: 500;
}

/* 库存概览 */
.stock-overview {
  display: flex;
  gap: 16px;
  justify-content: space-around;
}

.stock-item {
  text-align: center;
  padding: 16px;
  background: var(--bg-secondary);
  border-radius: 8px;
  flex: 1;
}

.stock-item.warning {
  background: rgba(255, 174, 31, 0.1);
  color: #ffae1f;
}

.stock-item.danger {
  background: rgba(245, 34, 45, 0.1);
  color: #f5222d;
}

.stock-item .label {
  display: block;
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 8px;
  font-weight: 500;
}

.stock-item .value {
  display: block;
  font-size: 32px;
  font-weight: 700;
  margin-bottom: 4px;
}

.stock-item .unit {
  display: block;
  font-size: 12px;
  font-weight: 500;
}

/* 快速操作 */
.quick-actions {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.action-btn {
  width: 100%;
  height: 50px;
  font-weight: 500;
  letter-spacing: 0.5px;
  transition: all 0.3s ease;
}

.action-btn:hover {
  transform: translateY(-2px);
}

/* 表格定制 */
.content-card /deep/ .el-table {
  font-size: 13px;
}

.content-card /deep/ .el-table th {
  background-color: var(--bg-secondary);
}

.content-card /deep/ .el-table td, 
.content-card /deep/ .el-table th {
  padding: 12px;
}
</style>
