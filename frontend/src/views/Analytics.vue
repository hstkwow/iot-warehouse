<template>
  <div class="analytics-container">
    <div class="page-header">
      <div>
        <h2 class="page-title">数据报表</h2>
        <p class="page-subtitle">查看指定物资在本周、本月、本年的出入库记录</p>
      </div>
      <div class="header-actions">
        <el-button icon="el-icon-download" type="primary" @click="exportRecords">导出Excel</el-button>
        <el-button icon="el-icon-refresh" @click="refreshData">刷新</el-button>
      </div>
    </div>

    <el-card class="filter-card" shadow="hover">
      <div class="filter-row">
        <div class="filter-item">
          <span class="filter-label">选择分类</span>
          <el-select
            v-model="selectedCategoryId"
            clearable
            filterable
            placeholder="请选择分类"
            style="width: 240px"
            @change="handleCategoryChange"
          >
            <el-option
              v-for="category in categories"
              :key="category.categoryId"
              :label="category.categoryName"
              :value="category.categoryId"
            />
          </el-select>
        </div>

        <div class="filter-item">
          <span class="filter-label">选择物资</span>
          <el-select
            v-model="selectedMaterialId"
            filterable
            clearable
            placeholder="请选择物资"
            style="width: 320px"
            @change="handleMaterialChange"
          >
            <el-option
              v-if="selectedCategoryId"
              :label="`该类全部物资`"
              :value="'__CATEGORY_ALL__'"
            />
            <el-option
              v-for="item in filteredMaterials"
              :key="item.materialId"
              :label="item.name"
              :value="item.materialId"
            />
          </el-select>
        </div>

        <div class="filter-item">
          <span class="filter-label">时间范围</span>
          <el-radio-group v-model="range" size="small" @change="handleRangeChange">
            <el-radio-button label="week">近一周</el-radio-button>
            <el-radio-button label="month">近一月</el-radio-button>
            <el-radio-button label="year">近一年</el-radio-button>
            <el-radio-button label="custom">自定义</el-radio-button>
          </el-radio-group>
        </div>

        <div class="filter-item" v-if="range === 'custom'">
          <span class="filter-label">自定义时间</span>
          <el-date-picker
            v-model="customRange"
            type="daterange"
            unlink-panels
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            value-format="yyyy-MM-dd"
            style="width: 320px"
          />
        </div>
      </div>
    </el-card>

    <el-row :gutter="20" class="overview-row">
      <el-col :span="8">
        <el-card shadow="hover" class="overview-card">
          <div class="overview-label">总入库次数</div>
          <div class="overview-value inbound">{{ totalInbound }}</div>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card shadow="hover" class="overview-card">
          <div class="overview-label">总出库次数</div>
          <div class="overview-value outbound">{{ totalOutbound }}</div>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card shadow="hover" class="overview-card">
          <div class="overview-label">净流入次数</div>
          <div class="overview-value" :class="{ positive: netFlow >= 0, negative: netFlow < 0 }">
            {{ netFlow }}
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-card class="table-card" shadow="hover" v-loading="loading">
      <div slot="header" class="table-header">
        <span class="table-title">{{ selectedMaterialName || '全部物资' }} 出入库记录</span>
        <span class="table-meta">{{ rangeText }} | 共 {{ filteredRecords.length }} 条</span>
      </div>

      <el-table :data="filteredRecords" stripe border>
        <el-table-column prop="materialName" label="物资" min-width="160" show-overflow-tooltip />
        <el-table-column prop="materialCode" label="物资编码" width="160" show-overflow-tooltip />
        <el-table-column label="数量" width="100" align="right">
          <template slot-scope="scope">
            {{ formatQuantity(scope.row.quantity) }}
          </template>
        </el-table-column>
        <el-table-column label="类型" width="100" align="center">
          <template slot-scope="scope">
            <el-tag :type="scope.row.ioType === 1 ? 'success' : 'warning'" size="mini">
              {{ scope.row.ioType === 1 ? '入库' : '出库' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="rfidTag" label="RFID" width="150" show-overflow-tooltip />
        <el-table-column label="时间" width="170">
          <template slot-scope="scope">
            {{ formatDateTime(scope.row.time) }}
          </template>
        </el-table-column>
        <el-table-column prop="orderNo" label="单号" width="190" show-overflow-tooltip />
        <el-table-column label="区域/库位" min-width="180" show-overflow-tooltip>
          <template slot-scope="scope">
            {{ formatLocation(scope.row) }}
          </template>
        </el-table-column>
        <el-table-column prop="deviceId" label="设备" width="170" show-overflow-tooltip />
      </el-table>

      <el-empty v-if="filteredRecords.length === 0" description="当前筛选条件下暂无出入库记录" />
    </el-card>
  </div>
</template>

<script>
import { getAllMaterials } from '@/api/material'
import { getAllCategories } from '@/api/category'
import { getAllIoRecords } from '@/api/io-record'

export default {
  name: 'DataAnalytics',
  data() {
    return {
      loading: false,
      categories: [],
      materials: [],
      records: [],
      selectedCategoryId: null,
      selectedMaterialId: null,
      range: 'week',
      customRange: []
    }
  },
  computed: {
    filteredMaterials() {
      if (!this.selectedCategoryId) return this.materials
      const selected = String(this.selectedCategoryId)
      return this.materials.filter(item => String(item.categoryId) === selected)
    },
    selectedMaterial() {
      if (this.selectedMaterialId === '__CATEGORY_ALL__') return null
      return this.materials.find(item => item.materialId === this.selectedMaterialId) || null
    },
    selectedCategory() {
      return this.categories.find(item => item.categoryId === this.selectedCategoryId) || null
    },
    selectedMaterialName() {
      if (this.selectedMaterialId === '__CATEGORY_ALL__') {
        return this.selectedCategory ? `${this.selectedCategory.categoryName}（全部物资）` : '该类全部物资'
      }
      return this.selectedMaterial ? this.selectedMaterial.name : ''
    },
    rangeText() {
      if (this.range === 'week') return '近一周'
      if (this.range === 'month') return '近一月'
      if (this.range === 'custom') {
        if (Array.isArray(this.customRange) && this.customRange.length === 2) {
          return `${this.customRange[0]} 至 ${this.customRange[1]}`
        }
        return '自定义'
      }
      return '近一年'
    },
    filteredRecords() {
      const { start, end } = this.getRangeBounds()
      let list = this.records

      if (this.selectedMaterial) {
        const code = this.selectedMaterial.materialCode
        const name = this.selectedMaterial.name
        list = list.filter(record => {
          const byCode = code && record.materialCode && String(record.materialCode) === String(code)
          const byName = name && record.materialName && String(record.materialName) === String(name)
          return byCode || byName
        })
      } else if (this.selectedMaterialId === '__CATEGORY_ALL__' && this.selectedCategoryId) {
        const codeSet = new Set(this.filteredMaterials.map(item => String(item.materialCode)))
        const nameSet = new Set(this.filteredMaterials.map(item => String(item.name)))
        list = list.filter(record => {
          const byCode = record.materialCode && codeSet.has(String(record.materialCode))
          const byName = record.materialName && nameSet.has(String(record.materialName))
          return byCode || byName
        })
      }

      list = list.filter(record => {
        if (!record.time) return false
        const t = new Date(record.time).getTime()
        return t >= start.getTime() && t <= end.getTime()
      })

      return list.slice().sort((a, b) => new Date(b.time || 0) - new Date(a.time || 0))
    },
    totalInbound() {
      return this.filteredRecords.filter(item => item.ioType === 1).length
    },
    totalOutbound() {
      return this.filteredRecords.filter(item => item.ioType === 2).length
    },
    netFlow() {
      return this.totalInbound - this.totalOutbound
    }
  },
  async mounted() {
    await this.fetchInitialData()
  },
  methods: {
    async fetchInitialData() {
      this.loading = true
      try {
        const [categoryRes, materialRes, ioRes] = await Promise.all([
          getAllCategories(),
          getAllMaterials({ page: 1, pageSize: 1000 }),
          getAllIoRecords({ page: 1, pageSize: 5000 })
        ])

        const categoryData = categoryRes && categoryRes.data ? categoryRes.data : []
        this.categories = Array.isArray(categoryData) ? categoryData : []

        const pageData = materialRes && materialRes.data ? materialRes.data : {}
        this.materials = Array.isArray(pageData.records) ? pageData.records : []

        const ioData = ioRes && ioRes.data ? ioRes.data : {}
        this.records = Array.isArray(ioData.records) ? ioData.records : []

        this.pickDefaultCategory()
        this.pickDefaultMaterial()
      } catch (error) {
        console.error('初始化数据报表失败', error)
      } finally {
        this.loading = false
      }
    },
    pickDefaultCategory() {
      if (this.categories.length === 0) {
        this.selectedCategoryId = null
        return
      }
      const firstCategoryWithMaterial = this.categories.find(category =>
        this.materials.some(item => String(item.categoryId) === String(category.categoryId))
      )
      this.selectedCategoryId = firstCategoryWithMaterial
        ? firstCategoryWithMaterial.categoryId
        : this.categories[0].categoryId
    },
    pickDefaultMaterial() {
      const pool = this.filteredMaterials
      this.selectedMaterialId = this.selectedCategoryId && pool.length > 0 ? '__CATEGORY_ALL__' : null
    },
    handleCategoryChange() {
      this.pickDefaultMaterial()
    },
    handleMaterialChange() {
      // computed 自动刷新
    },
    handleRangeChange(val) {
      if (val === 'custom' && (!Array.isArray(this.customRange) || this.customRange.length !== 2)) {
        const end = new Date()
        const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000)
        this.customRange = [this.formatDate(start), this.formatDate(end)]
      }
    },
    async refreshData() {
      await this.fetchInitialData()
    },
    getRangeBounds() {
      const now = new Date()
      if (this.range === 'week') {
        return {
          start: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
          end: now
        }
      }
      if (this.range === 'month') {
        return {
          start: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
          end: now
        }
      }
      if (this.range === 'custom' && Array.isArray(this.customRange) && this.customRange.length === 2) {
        const start = new Date(this.customRange[0])
        const end = new Date(this.customRange[1])
        start.setHours(0, 0, 0, 0)
        end.setHours(23, 59, 59, 999)
        return { start, end }
      }
      return {
        start: new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000),
        end: now
      }
    },
    formatDate(date) {
      const y = date.getFullYear()
      const m = String(date.getMonth() + 1).padStart(2, '0')
      const d = String(date.getDate()).padStart(2, '0')
      return `${y}-${m}-${d}`
    },
    formatLocation(record) {
      const zone = record.zoneName || ''
      const location = record.locationName || record.location || ''
      if (zone && location) return `${zone} / ${location}`
      return location || '-'
    },
    formatQuantity(value) {
      if (value === null || value === undefined || value === '') return '-'
      const n = Number(value)
      return Number.isNaN(n) ? value : n.toFixed(2)
    },
    formatDateTime(value) {
      if (!value) return '-'
      if (typeof value === 'string') {
        return value.replace('T', ' ').slice(0, 19)
      }
      return String(value)
    },
    exportRecords() {
      const rows = this.filteredRecords || []
      if (rows.length === 0) {
        this.$message.warning('当前没有可导出的记录')
        return
      }

      const headers = ['时间', '类型', '物资名称', '物资编码', '数量', 'RFID', '单号', '区域/库位', '设备ID']
      const lines = [headers.map(this.csvEscape).join(',')]

      rows.forEach(item => {
        const row = [
          item.time || '',
          item.ioType === 1 ? '入库' : '出库',
          item.materialName || '',
          item.materialCode || '',
          this.formatQuantity(item.quantity),
          item.rfidTag || '',
          item.orderNo || '',
          this.formatLocation(item),
          item.deviceId || ''
        ]
        lines.push(row.map(this.csvEscape).join(','))
      })

      const csv = `\uFEFF${lines.join('\n')}`
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      const stamp = this.formatDate(new Date())
      const fileName = `analytics_${this.range}_${stamp}.csv`
      link.href = URL.createObjectURL(blob)
      link.download = fileName
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(link.href)
      this.$message.success('导出成功')
    },
    csvEscape(value) {
      const text = value === null || value === undefined ? '' : String(value)
      return `"${text.replace(/"/g, '""')}"`
    }
  }
}
</script>

<style scoped>
.analytics-container {
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
  margin-bottom: 20px;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.page-title {
  margin: 0;
  font-size: 24px;
  color: #303133;
}

.page-subtitle {
  margin: 5px 0 0;
  color: #909399;
  font-size: 14px;
}

.filter-card {
  margin-bottom: 20px;
  border-radius: 16px;
}

.filter-row {
  display: flex;
  gap: 24px;
  flex-wrap: wrap;
  align-items: center;
}

.filter-item {
  display: flex;
  align-items: center;
  gap: 12px;
}

.filter-label {
  font-size: 14px;
  color: #606266;
  font-weight: 600;
}

.overview-row {
  margin-bottom: 20px;
}

.overview-card {
  border-radius: 16px;
}

.overview-label {
  color: #8b95a7;
  font-size: 14px;
  margin-bottom: 12px;
}

.overview-value {
  font-size: 34px;
  line-height: 1;
  font-weight: 700;
  color: #1f2937;
}

.overview-value.inbound {
  color: #2f7cf6;
}

.overview-value.outbound {
  color: #f08c2e;
}

.overview-value.positive {
  color: #16a34a;
}

.overview-value.negative {
  color: #dc2626;
}

.table-card {
  border-radius: 18px;
}

.table-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.table-title {
  font-size: 16px;
  font-weight: 700;
  color: #1f2937;
}

.table-meta {
  color: #8b95a7;
  font-size: 13px;
}
</style>
