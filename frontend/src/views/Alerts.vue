<template>
  <div class="alerts-container">
    <!-- 页面头 -->
    <div class="page-header">
      <div class="header-left">
        <h2 class="page-title">告警中心</h2>
        <p class="page-subtitle">实时监控系统告警和异常事件</p>
      </div>
      <div class="header-right">
        <el-button-group>
          <el-button 
            v-for="status in statusFilters" 
            :key="status.value"
            :type="filterStatus === status.value ? 'primary' : 'default'"
            size="small"
            @click="filterStatus = status.value">
            {{ status.label }}
            <el-badge :value="status.count" class="badge-item"></el-badge>
          </el-button>
        </el-button-group>
        <el-button type="success" icon="el-icon-refresh" @click="refreshAlerts">刷新</el-button>
      </div>
    </div>

    <!-- 统计卡片 -->
    <div class="stats-grid">
      <!-- 总览卡片 -->
      <div class="stat-card stat-card--overview">
        <div class="stat-header">
          <div class="stat-icon" style="background: rgba(64, 158, 255, 0.1);">
            <i class="el-icon-data-analysis" style="color: #409EFF;"></i>
          </div>
          <div class="stat-main">
            <span class="stat-value">{{ statsData.total }}</span>
            <span class="stat-label">告警总数</span>
          </div>
        </div>
        <div class="stat-progress">
          <div class="progress-info">
            <span>处理率</span>
            <span class="progress-percent">{{ processRate }}%</span>
          </div>
          <el-progress :percentage="processRate" :show-text="false" :stroke-width="6" :color="processRate >= 80 ? '#13deb9' : processRate >= 50 ? '#ffae1f' : '#f5222d'"></el-progress>
        </div>
      </div>

      <!-- 未处理卡片 -->
      <div class="stat-card stat-card--danger" @click="filterStatus = 0" style="cursor:pointer;">
        <div class="stat-header">
          <div class="stat-icon" style="background: rgba(245, 34, 45, 0.1);">
            <i class="el-icon-warning" style="color: #f5222d;"></i>
          </div>
          <div class="stat-main">
            <span class="stat-value" style="color: #f5222d;">{{ statsData.unprocessed }}</span>
            <span class="stat-label">待处理</span>
          </div>
        </div>
        <div class="stat-breakdown">
          <div class="breakdown-item">
            <span class="breakdown-dot" style="background:#f5222d;"></span>
            <span>紧急 <b>{{ statsData.critical }}</b></span>
          </div>
          <div class="breakdown-item">
            <span class="breakdown-dot" style="background:#ffae1f;"></span>
            <span>严重 <b>{{ statsData.warning }}</b></span>
          </div>
          <div class="breakdown-item">
            <span class="breakdown-dot" style="background:#409EFF;"></span>
            <span>一般 <b>{{ statsData.info }}</b></span>
          </div>
        </div>
      </div>

      <!-- 已处理卡片 -->
      <div class="stat-card stat-card--success" @click="filterStatus = 1" style="cursor:pointer;">
        <div class="stat-header">
          <div class="stat-icon" style="background: rgba(19, 222, 185, 0.1);">
            <i class="el-icon-circle-check" style="color: #13deb9;"></i>
          </div>
          <div class="stat-main">
            <span class="stat-value" style="color: #13deb9;">{{ statsData.processed }}</span>
            <span class="stat-label">已处理</span>
          </div>
        </div>
        <div class="stat-hint">
          <i class="el-icon-finished"></i>
          <span>点击查看已处理告警</span>
        </div>
      </div>

      <!-- 今日新增卡片 -->
      <div class="stat-card">
        <div class="stat-header">
          <div class="stat-icon" style="background: rgba(114, 46, 209, 0.1);">
            <i class="el-icon-time" style="color: #722ed1;"></i>
          </div>
          <div class="stat-main">
            <span class="stat-value" style="color: #722ed1;">{{ todayCount }}</span>
            <span class="stat-label">今日新增</span>
          </div>
        </div>
        <div class="stat-hint">
          <i class="el-icon-date"></i>
          <span>{{ todayDate }}</span>
        </div>
      </div>
    </div>

    <!-- 告警列表 -->
    <el-card class="list-card">
      <div slot="header" class="card-header">
        <span class="card-title">告警列表</span>
        <div class="header-actions">
          <el-input 
            v-model="searchText" 
            placeholder="搜索告警内容"
            style="width: 200px; margin-right: 10px;"
            prefix-icon="el-icon-search"
            @keyup.enter="searchAlerts">
          </el-input>
          <el-select v-model="filterSource" placeholder="告警来源" style="width: 150px; margin-right: 10px;">
            <el-option label="全部来源" value=""></el-option>
            <el-option label="设备告警" value="device"></el-option>
            <el-option label="库存告警" value="stock"></el-option>
            <el-option label="系统告警" value="system"></el-option>
          </el-select>
        </div>
      </div>

      <el-table 
        :data="paginatedAlerts"
        stripe
        style="width: 100%"
        @selection-change="handleSelectionChange">
        <el-table-column type="selection" width="55"></el-table-column>
        
        <!-- 用户修改：移除告警ID，移动设备名到前列 -->
        
        <el-table-column label="物资名称" min-width="150" prop="relatedId">
           <template slot-scope="scope">
             <div style="font-weight: 500;">
                <i v-if="scope.row.alarmSource === 'device'" class="el-icon-cpu" style="margin-right: 4px; color: #409EFF"></i>
                <i v-else-if="scope.row.alarmSource === 'stock'" class="el-icon-box" style="margin-right: 4px; color: #E6A23C"></i>
                {{ getRelatedName(scope.row) || scope.row.relatedId }}
             </div>
             <div style="font-size: 12px; color: #909399; margin-top: 2px;" v-if="getRelatedName(scope.row) !== scope.row.relatedId">
                ID: {{ scope.row.relatedId }}
             </div>
             <div style="font-size: 12px; color: #909399; margin-top: 2px;" v-else>
                {{ scope.row.alarmSource === 'device' ? 'IoT设备' : (scope.row.alarmSource === 'stock' ? '库存物品' : '系统') }}
             </div>
           </template>
        </el-table-column>

        <el-table-column label="告警类型" width="120">
          <template slot-scope="scope">
            <el-tag :type="getAlarmTypeTag(scope.row.alarmType)" size="medium" effect="light">
              {{ scope.row.alarmType }}
            </el-tag>
          </template>
        </el-table-column>
        
        <el-table-column label="严重级别" width="100">
          <template slot-scope="scope">
            <el-tag :type="getSeverityTag(scope.row.severity)" size="medium">
              {{ getSeverityLabel(scope.row.severity) }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column label="告警内容" min-width="200" show-overflow-tooltip prop="content"></el-table-column>
        
        <!-- 移除原来冗余的“告警来源”列，合并到设备名下方显示 -->
        <!-- 移除原来“关联对象”列，已移动到前面 -->

        <el-table-column label="状态" width="100">
          <template slot-scope="scope">
            <el-tag :type="scope.row.status === 0 ? 'danger' : 'success'" size="small">
              {{ scope.row.status === 0 ? '未处理' : '已处理' }}
            </el-tag>
          </template>
        </el-table-column>
        
        <el-table-column label="创建时间" width="160">
            <template slot-scope="scope">
                <i class="el-icon-time" style="margin-right: 4px; color: #C0C4CC"></i>
                {{ scope.row.createTime ? scope.row.createTime.replace('T', ' ') : '-' }}
            </template>
        </el-table-column>
        
        <!-- 移除处理时间、处理人等非常用列，放入详情弹窗 -->
        
        <el-table-column label="操作" width="150" fixed="right">
          <template slot-scope="scope">
            <el-button 
              type="text" 
              size="medium" 
              icon="el-icon-view"
              @click="viewAlertDetail(scope.row)">
              详情
            </el-button>
            <el-button 
              v-if="scope.row.status === 0"
              type="text" 
              size="medium" 
              icon="el-icon-edit-outline"
              style="color: #67C23A"
              @click="handleAlert(scope.row)">
              处理
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-wrapper">
        <el-pagination
          :current-page.sync="currentPage"
          :page-size="pageSize"
          :total="filteredAlerts.length"
          @current-change="currentPage = $event"
          layout="total, sizes, prev, pager, next, jumper"
          :page-sizes="[10, 20, 50, 100]">
        </el-pagination>
      </div>
    </el-card>

    <!-- 告警详情对话框 -->
    <el-dialog title="告警详情" :visible.sync="detailDialogVisible" width="600px">
      <div v-if="selectedAlert" class="alert-detail">
        <el-row :gutter="20">
          <el-col :span="12">
            <div class="detail-item">
              <label>告警ID:</label>
              <span>{{ selectedAlert.alarmId }}</span>
            </div>
            <div class="detail-item">
              <label>告警类型:</label>
              <el-tag :type="getAlarmTypeTag(selectedAlert.alarmType)">
                {{ selectedAlert.alarmType }}
              </el-tag>
            </div>
            <div class="detail-item">
              <label>严重级别:</label>
              <el-tag :type="getSeverityTag(selectedAlert.severity)">
                {{ getSeverityLabel(selectedAlert.severity) }}
              </el-tag>
            </div>
          </el-col>
          <el-col :span="12">
            <div class="detail-item">
              <label>告警来源:</label>
              <span>{{ selectedAlert.alarmSource }}</span>
            </div>
            <div class="detail-item">
              <label>关联对象:</label>
              <span>{{ selectedAlert.relatedId || '无' }}</span>
            </div>
            <div class="detail-item">
              <label>创建时间:</label>
              <span>{{ selectedAlert.createTime }}</span>
            </div>
          </el-col>
        </el-row>
        <el-divider></el-divider>
        <div class="detail-item full">
          <label>告警内容:</label>
          <p>{{ selectedAlert.content }}</p>
        </div>
        <template v-if="selectedAlert.status === 1">
          <el-divider content-position="left">处理信息</el-divider>
          <el-row :gutter="20">
            <el-col :span="12">
              <div class="detail-item">
                <label>处理时间:</label>
                <span>{{ selectedAlert.resolveTime ? formatTime(selectedAlert.resolveTime) : '-' }}</span>
              </div>
            </el-col>
            <el-col :span="12">
              <div class="detail-item">
                <label>处理人:</label>
                <span>{{ selectedAlert.resolveUser || '-' }}</span>
              </div>
            </el-col>
          </el-row>
          <div class="detail-item full">
            <label>处理措施:</label>
            <p>{{ selectedAlert.resolveRemark || '-' }}</p>
          </div>
        </template>
      </div>
      <span slot="footer" class="dialog-footer">
        <el-button @click="detailDialogVisible = false">关闭</el-button>
        <el-button v-if="selectedAlert && selectedAlert.status === 0" type="primary" @click="handleAlert(selectedAlert)">处理告警</el-button>
      </span>
    </el-dialog>

    <!-- 处理告警对话框 -->
    <el-dialog title="处理告警" :visible.sync="resolveDialogVisible" width="600px" @close="resetResolveForm" :close-on-click-modal="false">
      <div v-if="resolveTarget" class="resolve-info">
        <el-alert 
          :title="resolveTarget.alarmType + ' - ' + resolveTarget.content" 
          type="warning" 
          :closable="false" 
          show-icon 
          style="margin-bottom: 20px">
        </el-alert>
        
        <el-form ref="resolveForm" :model="resolveForm" :rules="resolveRules" label-width="100px" label-position="left">
          <!-- 处理建议部分 -->
          <el-form-item label="处理建议">
            <div style="background: #fdf6ec; padding: 10px 15px; border-radius: 4px; color: #e6a23c; line-height: 1.6; border: 1px solid #faecd8;">
              <div v-if="resolveTarget.alarmSource === 'device'">
                <div style="margin-bottom: 8px"><i class="el-icon-info"></i> 此为设备告警，请检查设备状态</div>
                <el-button type="primary" size="mini" plain @click="navigateToDeviceManager">前往设备管理 >></el-button>
              </div>
              <div v-else-if="resolveTarget.alarmSource === 'stock'">
                <div style="margin-bottom: 8px"><i class="el-icon-info"></i> 此为库存告警，请检查物料库存</div>
                <el-button type="primary" size="mini" plain @click="navigateToStockManager">前往库存管理 >></el-button>
              </div>
              <div v-else>
                 <i class="el-icon-warning-outline"></i> 请根据现场情况排查异常原因，并记录处理结果。
              </div>
            </div>
          </el-form-item>

          <!-- 处理说明输入框 -->
          <el-form-item label="处理说明" prop="detail">
            <el-input 
              v-model="resolveForm.detail" 
              type="textarea" 
              :rows="4" 
              placeholder="请详细描述已采取的处理措施（必填）..."
              resize="none">
            </el-input>
          </el-form-item>
        </el-form>
      </div>

      <span slot="footer">
        <el-button @click="resolveDialogVisible = false">取 消</el-button>
        <el-button type="primary" :loading="resolveLoading" @click="submitResolve">确认已处理</el-button>
      </span>
    </el-dialog>
  </div>
</template>

<script>
import { getAlarms, getAlarmStats, resolveAlarm } from '@/api/alarm'
import { getAllDevices } from '@/api/device'
import { getAllMaterials } from '@/api/material'

export default {
  name: 'AlertsCenter',
  data() {
    return {
      alerts: [],
      deviceMap: {},
      materialMap: {},
      filterStatus: '',
      filterSource: '',
      searchText: '',
      currentPage: 1,
      pageSize: 10,
      total: 0,
      selectedAlert: null,
      detailDialogVisible: false,
      selectedAlerts: [],
      statsData: { total: 0, unprocessed: 0, processed: 0, critical: 0, warning: 0, info: 0 },
      statusFilters: [
        { label: '全部', value: '', count: 0 },
        { label: '未处理', value: 0, count: 0 },
        { label: '已处理', value: 1, count: 0 }
      ],
      // 处理弹窗
      resolveDialogVisible: false,
      resolveLoading: false,
      resolveTarget: null,
      resolveForm: { detail: '' },
      resolveRules: {
        detail: [{ required: true, message: '请填写处理说明', trigger: 'blur' }]
      }
    }
  },
  computed: {
    processRate() {
      if (this.statsData.total === 0) return 0
      return Math.round((this.statsData.processed / this.statsData.total) * 100)
    },
    todayCount() {
      const today = new Date().toISOString().slice(0, 10)
      return this.alerts.filter(a => a.createTime && a.createTime.startsWith(today)).length
    },
    todayDate() {
      const d = new Date()
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    },
    filteredAlerts() {
      let filtered = this.alerts
      
      if (this.filterStatus !== '') {
        filtered = filtered.filter(a => a.status === this.filterStatus)
      }
      
      if (this.filterSource) {
        filtered = filtered.filter(a => a.alarmSource === this.filterSource)
      }
      
      if (this.searchText) {
        const keyword = this.searchText.toLowerCase()
        filtered = filtered.filter(a => 
          (a.content && a.content.toLowerCase().includes(keyword)) || 
          (a.alarmId && a.alarmId.toString().includes(keyword)) ||
          (a.relatedId && a.relatedId.toLowerCase().includes(keyword)) ||
          (a.alarmType && a.alarmType.toLowerCase().includes(keyword))
        )
      }
      
      return filtered
    },
    paginatedAlerts() {
      return this.filteredAlerts.slice((this.currentPage - 1) * this.pageSize, this.currentPage * this.pageSize)
    }
  },
  mounted() {
    this.loadAlarms()
    this.loadStats()
    this.initMaps()
    // 每10秒自动刷新
    this.timer = setInterval(() => {
      this.loadAlarms()
      this.loadStats()
    }, 10000)
  },
  beforeDestroy() {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  },
  methods: {
    async initMaps() {
      try {
        const [deviceRes, materialRes] = await Promise.all([
          getAllDevices(),
          getAllMaterials({ page: 1, pageSize: 1000 })
        ])

        const deviceList = Array.isArray(deviceRes?.data) ? deviceRes.data : []
        deviceList.forEach(d => {
          this.$set(this.deviceMap, d.deviceId, d.deviceName)
        })

        const materialList = Array.isArray(materialRes?.data)
          ? materialRes.data
          : (Array.isArray(materialRes?.data?.records) ? materialRes.data.records : [])
        materialList.forEach(m => {
          this.$set(this.materialMap, m.materialId, m.name)
        })
      } catch (e) {
        console.error('Failed to load maps', e)
      }
    },

    getRelatedName(row) {
        if (!row.relatedId) return row.relatedId;
        
        if (row.alarmSource === 'device') {
            return this.deviceMap[row.relatedId] || row.relatedId;
        } 
        else if (row.alarmSource === 'stock') {
            const id = parseInt(row.relatedId);
            if (!isNaN(id) && this.materialMap[id]) {
                return this.materialMap[id];
            }
            // Maybe string key?
            if (this.materialMap[row.relatedId]) {
                 return this.materialMap[row.relatedId];
            }
            return row.relatedId;
        }
        return row.relatedId;
    },

    async loadAlarms() {
      try {
        const res = await getAlarms()
        if (res.code === 1 || res.code === 200) {
          this.alerts = (res.data || []).map(a => ({
            ...a,
            createTime: a.createTime ? this.formatTime(a.createTime) : ''
          }))
          // 更新 statusFilters 的 count
          const total = this.alerts.length
          const unprocessed = this.alerts.filter(a => a.status === 0).length
          const processed = this.alerts.filter(a => a.status === 1).length
          this.statusFilters[0].count = total
          this.statusFilters[1].count = unprocessed
          this.statusFilters[2].count = processed
        }
      } catch (e) {
        console.error('加载告警失败', e)
      }
    },

    async loadStats() {
      try {
        const res = await getAlarmStats()
        if (res.code === 1 || res.code === 200) {
          const s = res.data
          this.statsData = {
            total: (s.processed || 0) + (s.unprocessed || 0),
            unprocessed: s.unprocessed || 0,
            processed: s.processed || 0,
            critical: s.critical || 0,
            warning: s.warning || 0,
            info: s.info || 0
          }
        }
      } catch (e) {
        console.error('加载统计失败', e)
      }
    },

    formatTime(timeStr) {
      if (!timeStr) return ''
      // 后端返回 LocalDateTime 格式: "2026-02-24T10:30:45" 或数组格式
      if (Array.isArray(timeStr)) {
        const [y, m, d, h = 0, min = 0, s = 0] = timeStr
        return `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')} ${String(h).padStart(2,'0')}:${String(min).padStart(2,'0')}:${String(s).padStart(2,'0')}`
      }
      if (typeof timeStr === 'string' && timeStr.includes('T')) {
        return timeStr.replace('T', ' ').substring(0, 19)
      }
      return timeStr
    },

    getAlarmTypeTag(type) {
      const tags = {
        '温度过高': 'danger',
        '温度过低': 'warning',
        '湿度异常': 'warning',
        '烟雾报警': 'danger',
        '气压异常': 'warning',
        '露点异常': 'warning',
        '环境异常': 'danger',
        '设备离线': 'info',
        '库存不足': 'danger',
        '库存积压': 'warning'
      }
      return tags[type] || 'info'
    },
    getSeverityTag(severity) {
      if (severity === 3) return 'danger'
      if (severity === 2) return 'warning'
      return 'info'
    },
    getSeverityLabel(severity) {
      if (severity === 3) return '紧急'
      if (severity === 2) return '严重'
      return '一般'
    },
    viewAlertDetail(alert) {
      this.selectedAlert = alert
      this.detailDialogVisible = true
    },
    handleAlert(alert) {
      this.resolveTarget = alert
      this.resolveForm = { detail: '' }
      this.resolveDialogVisible = true
      this.detailDialogVisible = false
    },
    async submitResolve() {
      this.$refs.resolveForm.validate(async (valid) => {
        if (!valid) return
        this.resolveLoading = true
        try {
          const res = await resolveAlarm(this.resolveTarget.alarmId, this.resolveForm.detail)
          if (res.code === 1 || res.code === 200) {
            this.$message.success('告警已处理')
            this.resolveDialogVisible = false
            this.loadAlarms()
            this.loadStats()
            // 根据告警来源自动跳转
            if (this.resolveTarget.alarmSource === 'device') {
              setTimeout(() => this.navigateToDeviceManager(), 1500)
            } else if (this.resolveTarget.alarmSource === 'stock') {
              setTimeout(() => this.navigateToStockManager(), 1500)
            }
          } else {
            this.$message.error(res.msg || '处理失败')
          }
        } catch (e) {
          this.$message.error('处理请求失败')
        } finally {
          this.resolveLoading = false
        }
      })
    },
    resetResolveForm() {
      this.resolveTarget = null
      this.resolveForm = { detail: '' }
    },
    navigateToDeviceManager() {
      this.$router.push('/devices')
    },
    navigateToStockManager() {
      this.$router.push('/stock')
    },
    handleSelectionChange(selection) {
      this.selectedAlerts = selection
    },
    searchAlerts() {
      this.currentPage = 1
    },
    async refreshAlerts() {
      await Promise.all([this.loadAlarms(), this.loadStats()])
      this.$message.success('刷新完成')
    }
  }
}
</script>

<style scoped lang="css">
.alerts-container {
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

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.header-left h2 {
  margin: 0;
  font-size: 24px;
  font-weight: 600;
  color: var(--text-primary);
}

.header-left p {
  margin: 8px 0 0;
  color: var(--text-secondary);
  font-size: 14px;
}

.header-right {
  display: flex;
  gap: 12px;
}

.badge-item {
  margin-left: 4px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 24px;
}

.stat-card {
  background: var(--bg-white);
  border-radius: var(--radius-lg);
  padding: 20px;
  box-shadow: var(--shadow-sm);
  transition: all 0.3s ease;
  border: 1px solid transparent;
}

.stat-card:hover {
  box-shadow: var(--shadow-md);
  transform: translateY(-2px);
}

.stat-card--danger:hover {
  border-color: rgba(245, 34, 45, 0.3);
}

.stat-card--success:hover {
  border-color: rgba(19, 222, 185, 0.3);
}

.stat-header {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 12px;
}

.stat-icon {
  width: 44px;
  height: 44px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  flex-shrink: 0;
}

.stat-main {
  display: flex;
  flex-direction: column;
}

.stat-value {
  font-size: 26px;
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1.2;
}

.stat-label {
  font-size: 13px;
  color: var(--text-secondary);
  margin-top: 2px;
}

.stat-progress {
  margin-top: 4px;
}

.progress-info {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 6px;
}

.progress-percent {
  font-weight: 600;
  color: var(--text-primary);
}

.stat-breakdown {
  display: flex;
  gap: 14px;
  flex-wrap: wrap;
}

.breakdown-item {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  color: var(--text-secondary);
}

.breakdown-item b {
  color: var(--text-primary);
  font-weight: 600;
}

.breakdown-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.stat-hint {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 4px;
}

.stat-footer {
  color: var(--text-secondary);
  font-size: 14px;
}

.list-card {
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

.header-actions {
  display: flex;
  gap: 12px;
}

.pagination-wrapper {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
}

.alert-detail {
  padding: 20px 0;
}

.detail-item {
  margin-bottom: 16px;
}

.detail-item.full {
  grid-column: 1 / -1;
}

.detail-item label {
  font-weight: 600;
  color: var(--text-primary);
  display: block;
  margin-bottom: 4px;
}

.detail-item span,
.detail-item p {
  color: var(--text-secondary);
  word-break: break-word;
}

.detail-item p {
  margin: 0;
  padding: 8px;
  background: var(--bg-secondary);
  border-radius: 4px;
}
</style>
