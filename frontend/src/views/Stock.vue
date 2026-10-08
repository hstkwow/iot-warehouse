<template>
  <div class="stock-container">
    <!-- 页面头 -->
    <div class="page-header">
      <div class="header-left">
        <h2 class="page-title">库存统计</h2>
        <p class="page-subtitle">物资库存统计和预警分析</p>
      </div>
      <div class="header-right">
        <el-button type="primary" icon="el-icon-download" @click="exportData">导出报表</el-button>
        <el-button icon="el-icon-refresh" @click="refreshData">刷新</el-button>
      </div>
    </div>

    <!-- 统计概览 -->
    <div class="stats-grid">
      <div class="stat-card" v-for="(stat, index) in statsData" :key="index">
        <div class="stat-header">
          <div class="stat-icon" :style="{ background: stat.bgColor }">
            <i :class="stat.icon" :style="{ color: stat.color }"></i>
          </div>
          <div>
            <div class="stat-value">{{ stat.value }}</div>
            <div class="stat-label">{{ stat.label }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- 库存列表 -->
    <el-card class="list-card" style="margin-bottom: 20px;">
        <div slot="header" class="card-header" style="display: flex; justify-content: space-between; align-items: center;">
            <span class="card-title">库存明细</span>
            <el-input 
                v-model="searchText" 
                placeholder="搜索物资"
                style="width: 250px;"
                prefix-icon="el-icon-search">
            </el-input>
        </div>
        <el-table :data="stockData" stripe style="width: 100%" v-loading="loading">
            <el-table-column label="物资名称" prop="materialName" min-width="150"></el-table-column>
            <el-table-column label="分类" prop="categoryName" width="120">
            <template slot-scope="scope">
                <el-tag type="info" size="small" effect="plain">{{ scope.row.categoryName || '未分类' }}</el-tag>
            </template>
            </el-table-column>
            <el-table-column label="库存数量" prop="quantity" width="100">
            <template slot-scope="scope">
                <span :style="{ color: getQuantityColor(scope.row.quantity, scope.row.minStock) }">
                {{ scope.row.quantity }} {{ scope.row.unit }}
                </span>
            </template>
            </el-table-column>
            <el-table-column label="最小库存" prop="minStock" width="100"></el-table-column>
            <el-table-column label="库存状态" width="100">
            <template slot-scope="scope">
                <el-tag :type="getStockStatus(scope.row.quantity, scope.row.minStock, scope.row.maxStock)">
                {{ getStockStatusLabel(scope.row.quantity, scope.row.minStock, scope.row.maxStock) }}
                </el-tag>
            </template>
            </el-table-column>
            <el-table-column label="操作" width="100">
            <template slot-scope="scope">
                <el-button type="primary" size="mini" @click="viewDetail(scope.row)">详情</el-button>
            </template>
            </el-table-column>
        </el-table>
        <div style="margin-top: 15px; display: flex; justify-content: flex-end;">
           <el-pagination
             @size-change="handleStockSizeChange"
             @current-change="handleStockPageChange"
             :current-page="stockPage"
             :page-sizes="[5, 10, 20, 50]"
             :page-size="stockSize"
             layout="total, sizes, prev, pager, next, jumper"
             :total="stockTotal">
           </el-pagination>
        </div>
    </el-card>

    <!-- 出入库记录 -->
    <el-card class="list-card" style="margin-bottom: 20px;">
        <div slot="header" class="card-header">
            <span class="card-title">出入库记录</span>
        </div>
        <el-table :data="ioRecords" stripe style="width: 100%" v-loading="ioLoading" height="400">
            <el-table-column label="时间" prop="time" width="180">
                <template slot-scope="scope">
                    {{ scope.row.time ? scope.row.time.replace('T', ' ').substring(0, 19) : '' }}
                </template>
            </el-table-column>
            <el-table-column label="类型" prop="ioType" width="100">
                    <template slot-scope="scope">
                    <el-tag :type="scope.row.ioType === 1 ? 'success' : 'warning'">
                        {{ scope.row.ioType === 1 ? '入库' : '出库' }}
                    </el-tag>
                </template>
            </el-table-column>
            <el-table-column label="物资名称" prop="materialName" min-width="150"></el-table-column>
                <el-table-column label="RFID" prop="rfidTag" width="180"></el-table-column>
            <el-table-column label="单号" prop="orderNo" width="180"></el-table-column>
            <el-table-column label="库位" prop="location" width="180">
                <template slot-scope="scope">
                    {{ (scope.row.zoneName ? scope.row.zoneName + ' - ' : '') +  (scope.row.locationName || scope.row.location) }}
                </template>
            </el-table-column>
        </el-table>
        <div style="margin-top: 15px; display: flex; justify-content: flex-end;">
           <el-pagination
             @size-change="handleIoSizeChange"
             @current-change="handleIoPageChange"
             :current-page="ioPage"
             :page-sizes="[5, 10, 20, 50]"
             :page-size="ioSize"
             layout="total, sizes, prev, pager, next, jumper"
             :total="ioTotal">
           </el-pagination>
        </div>
    </el-card>

    <!-- 库存预警 -->
    <el-card class="stats-card" style="margin-bottom: 20px;">
        <div slot="header" class="card-header">
        <span class="card-title">库存预警</span>
        </div>
        <div v-if="warningItems.length === 0" style="padding: 20px; text-align: center; color: #909399;">
            暂无库存预警信息
        </div>
        <div class="warning-list">
        <div class="warning-item" v-for="(item, index) in warningItems" :key="index">
            <div class="warning-type" :class="item.type">
            <i :class="item.icon"></i>
            </div>
            <div class="warning-content">
            <div class="warning-title">{{ item.title }}</div>
            <div class="warning-desc">{{ item.desc }}</div>
            </div>
            <div class="warning-count">{{ item.count }}</div>
        </div>
        </div>
    </el-card>

    <!-- 库存批次详情弹窗 -->
    <el-dialog :title="(selectedItem ? selectedItem.materialName : '') + ' - 库存明细'" :visible.sync="detailVisible" width="1000px">
        <el-table :data="rfidList" v-loading="rfidLoading" stripe border max-height="500">
           <el-table-column type="index" label="序号" width="50" align="center"></el-table-column>
           <el-table-column label="RFID 标签" prop="rfidTag" min-width="150" show-overflow-tooltip></el-table-column>
           <el-table-column label="入库批次" prop="batchNo" width="120" show-overflow-tooltip></el-table-column>
           <el-table-column label="入库时间" prop="inTime" width="160"></el-table-column>
           <el-table-column label="有效期至" prop="expiryDate" width="120">
               <template slot-scope="scope">
                   <span :style="getExpiryStyle(scope.row.expiryDate)">{{ formatDate(scope.row.expiryDate) }}</span>
               </template>
           </el-table-column>
           <el-table-column label="库位" min-width="180" show-overflow-tooltip>
               <template slot-scope="scope">
                   {{ (scope.row.zoneName ? scope.row.zoneName + ' - ' : '') +  (scope.row.locationName || scope.row.location) }}
               </template>
           </el-table-column>
           <el-table-column label="数量" prop="quantity" width="80" align="center"></el-table-column>
           <el-table-column label="状态" prop="status" width="80" align="center">
              <template slot-scope="scope">
                  <el-tag v-if="scope.row.status === 1" type="success" size="mini">正常</el-tag>
                  <el-tag v-else-if="scope.row.status === 0" type="info" size="mini">已出库</el-tag>
                  <el-tag v-else-if="scope.row.status === 4" type="danger" size="mini">已过期</el-tag>
                  <el-tag v-else type="warning" size="mini">异常</el-tag>
              </template>
           </el-table-column>
           <el-table-column label="操作" width="100" fixed="right" align="center">
             <template slot-scope="scope">
               <el-button type="text" size="small" @click="handleEditStock(scope.row)">移库/编辑</el-button>
             </template>
           </el-table-column>
        </el-table>
        <div slot="footer">
            <el-button @click="detailVisible = false">关闭</el-button>
        </div>
    </el-dialog>

    <!-- 移库编辑弹窗 -->
    <el-dialog title="编辑库存/移库" :visible.sync="editStockVisible" width="400px" append-to-body>
      <el-form :model="editStockForm" :rules="editStockRules" ref="editStockForm" label-width="80px">
        <el-form-item label="物资" v-if="editStockForm.materialName">
           <el-input v-model="editStockForm.materialName" disabled></el-input>
        </el-form-item>
        <el-form-item label="RFID" prop="rfidTag">
           <el-input v-model="editStockForm.rfidTag" disabled></el-input>
        </el-form-item>
        <el-form-item label="库位" prop="location">
             <el-input v-model="editStockForm.location" placeholder="请输入库位修改为（如: A-01）"></el-input>
        </el-form-item>
        <el-form-item label="数量" prop="quantity">
             <el-input-number v-model="editStockForm.quantity" :min="0" style="width: 100%"></el-input-number>
        </el-form-item>
        <el-form-item label="状态" prop="status">
           <el-select v-model="editStockForm.status" placeholder="请选择">
              <el-option label="正常" :value="1"></el-option>
              <el-option label="已出库" :value="0"></el-option>
              <el-option label="已过期" :value="4"></el-option>
              <el-option label="损坏/丢失" :value="2"></el-option>
           </el-select>
        </el-form-item>
      </el-form>
      <div slot="footer">
         <el-button @click="editStockVisible = false">取消</el-button>
         <el-button type="primary" @click="submitEditStock">确认修改</el-button>
      </div>
    </el-dialog>
  </div>
</template>

<script>
import { getStockSummary, getStockByMaterialId, updateStockItem } from '@/api/stock'
import { getAllIoRecords } from '@/api/io-record'

export default {
  name: 'StockManager',
  data() {
    return {
      activeTab: 'stock',
      
      // Pagination
      stockPage: 1,
      stockSize: 10,
      stockTotal: 0,
      ioPage: 1,
      ioSize: 10,
      ioTotal: 0,

      ioRecords: [],
      ioLoading: false,
      editStockVisible: false,
      editStockForm: {
        itemId: null,
        rfidTag: '',
        location: '',
        status: 1
      },
      editStockRules: {
        location: [{ required: true, message: '请选择库位', trigger: 'change' }]
      },
      searchText: '',
      loading: false,
      detailVisible: false,
      selectedItem: null,
      rfidList: [],
      rfidLoading: false,
      statsData: [
        { label: '库存预警', value: 0, icon: 'el-icon-warning', color: '#ffae1f', bgColor: 'rgba(255,174,31,0.1)' },
        { label: '库存不足', value: 0, icon: 'el-icon-close', color: '#f5222d', bgColor: 'rgba(245,34,45,0.1)' },
        { label: '库存积压', value: 0, icon: 'el-icon-loading', color: '#faad14', bgColor: 'rgba(250,173,20,0.1)' },
        { label: '库存总量', value: 0, icon: 'el-icon-s-data', color: '#52c41a', bgColor: 'rgba(82,196,26,0.1)' }
      ],
      stockData: [],
      warningItems: []
    }
  },
  computed: {
    filteredStockData() {
      if (!this.searchText) {
        return this.stockData
      }
      const lowerSearch = this.searchText.toLowerCase()
      return this.stockData.filter(item => 
        (item.materialName && item.materialName.toLowerCase().includes(lowerSearch)) ||
        (item.categoryName && item.categoryName.toLowerCase().includes(lowerSearch))
      )
    }
  },
  created() {
    this.fetchData()
  },
  methods: {
    async fetchData() {
      this.loading = true
      const params = {
          page: this.stockPage,
          pageSize: this.stockSize
      };
      
      console.log('Fetching stock summary with params:', params); // Debug log

      try {
        const res = await getStockSummary(params)
        // Support multiple success codes (1 or 200) or direct array return
        if (res.code === 1 || res.code === 200) {
          if (res.data && res.data.records) {
              this.stockData = res.data.records
              this.stockTotal = res.data.total
              
              // Use global stats from backend if available
              this.globalStats = {
                  lowStock: res.data.lowStockCount,
                  overStock: res.data.overStockCount,
                  totalQuantity: res.data.totalQuantity
              };

          } else {
              this.stockData = res.data || []
              this.stockTotal = this.stockData.length
              this.globalStats = null;
          }
          this.calculateStats()
        } else if (Array.isArray(res)) {
            // In case interceptor unwraps it
            this.stockData = res
            this.stockTotal = res.length
            this.globalStats = null;
            this.calculateStats()
        }
      } catch (error) {
        console.error(error)
        this.$message.error('获取数据失败')
      } finally {
        this.loading = false
      }
      this.fetchIoRecords()
    },
    async fetchIoRecords() {
        this.ioLoading = true;
        try {
            const res = await getAllIoRecords({
                page: this.ioPage,
                pageSize: this.ioSize
            });
            if (res.code === 200 || res.code === 1) {
                if (res.data && res.data.records) {
                    this.ioRecords = res.data.records;
                    this.ioTotal = res.data.total;
                } else {
                    this.ioRecords = res.data || [];
                    this.ioTotal = this.ioRecords.length;
                }
            } else if (Array.isArray(res)) {
                this.ioRecords = res;
                this.ioTotal = res.length;
            }
        } catch(e) {
            console.error(e);
        } finally {
            this.ioLoading = false;
        }
    },
    handleStockSizeChange(val) {
        console.log('Stock size change:', val);
        this.stockSize = val;
        this.stockPage = 1;
        this.$nextTick(() => {
            this.fetchData();
        });
    },
    handleStockPageChange(val) {
        console.log('Stock page change:', val);
        this.stockPage = val;
        this.$nextTick(() => {
            this.fetchData();
        });
    },
    handleIoSizeChange(val) {
        console.log('IO size change:', val);
        this.ioSize = val;
        this.ioPage = 1;
        this.$nextTick(() => {
             this.fetchIoRecords();
        });
    },
    handleIoPageChange(val) {
        console.log('IO page change:', val);
        this.ioPage = val;
        this.$nextTick(() => {
            this.fetchIoRecords();
        });
    },
    calculateStats() {
      let lowStock = 0;
      let overStock = 0;

      if (this.globalStats && this.globalStats.lowStock !== undefined) {
          // Use server-side calculated stats (accurate for all pages)
          lowStock = this.globalStats.lowStock;
          overStock = this.globalStats.overStock;
      } else {
          // Fallback to client-side calculation (only for current page)
          lowStock = this.stockData.filter(item => (item.quantity || 0) <= (item.minStock || 0)).length
          overStock = this.stockData.filter(item => item.quantity > item.maxStock).length
      }

      const warnings = lowStock + overStock

      const totalQty = (this.globalStats && this.globalStats.totalQuantity != null)
          ? this.globalStats.totalQuantity
          : this.stockData.reduce((sum, item) => sum + parseFloat(item.quantity || 0), 0)

      this.statsData[0].value = warnings
      this.statsData[1].value = lowStock
      this.statsData[2].value = overStock
      this.statsData[3].value = totalQty

      this.warningItems = []
      if (lowStock > 0) {
        this.warningItems.push({ 
           type: 'danger', icon: 'el-icon-circle-close', 
           title: '库存不足', desc: `${lowStock} 种物资低于最小库存`, count: lowStock 
        })
      }
      if (overStock > 0) {
         this.warningItems.push({ 
           type: 'info', icon: 'el-icon-info', 
           title: '库存积压', desc: `${overStock} 种物资超过最大库存`, count: overStock 
        })
      }
    },
    getQuantityColor(quantity, minStock) {
      if (!quantity) quantity = 0
      if (!minStock) minStock = 0
      return quantity <= minStock ? '#f5222d' : '#67c23a'
    },
    getStockStatus(quantity, minStock, maxStock) {
      if (!quantity) quantity = 0
      if (!minStock) minStock = 0
      if (quantity <= minStock) return 'danger'
      if (quantity > maxStock) return 'warning'
      return 'success'
    },
    getStockStatusLabel(quantity, minStock, maxStock) {
      if (!quantity) quantity = 0
      if (!minStock) minStock = 0
      if (quantity <= minStock) return '库存不足'
      if (quantity > maxStock) return '库存积压'
      return '正常'
    },
    formatDate(val) {
      if (!val) return ''
      if (Array.isArray(val)) {
        return val[0] + '-' + String(val[1]).padStart(2, '0') + '-' + String(val[2]).padStart(2, '0')
      }
      return val
    },
    getExpiryStyle(dateStr) {
       if (!dateStr) return {}
       let d = dateStr
       if (Array.isArray(d)) {
         d = this.formatDate(d)
       }
       const days = (new Date(d) - new Date()) / (1000 * 3600 * 24)
       if (days < 0) return { color: '#f5222d', fontWeight: 'bold' } // Expired
       if (days < 30) return { color: '#faad14', fontWeight: 'bold' } // Expiring soon
       return { color: '#606266' }
    },
    async viewDetail(row) {
      this.selectedItem = row
      this.detailVisible = true
      this.rfidList = []
      this.rfidLoading = true
      try {
        const res = await getStockByMaterialId(row.materialId)
        if (res.code === 1 || res.code === 200) {
           this.rfidList = res.data
        } else if (Array.isArray(res)) {
           this.rfidList = res
        } else {
           this.rfidList = res.data || []
        }
      } catch(e) {
          console.error(e)
          this.$message.error('获取详细库存失败')
      } finally {
          this.rfidLoading = false
      }
    },
    exportData() {
      this.$message.success('导出成功')
    },
    refreshData() {
      this.fetchData()
      this.$message.success('刷新中...')
    },
    handleEditStock(row) {
      if (!row) return
      this.editStockForm = {
        itemId: row.itemId,
        rfidTag: row.rfidTag,
        location: row.location,
        status: row.status,
        materialId: row.materialId, 
        quantity: row.quantity,
        batchNo: row.batchNo,
        expiryDate: row.expiryDate,
        inTime: row.inTime,
        materialName: row.materialName // For display
      }
      this.editStockVisible = true
    },
    async submitEditStock() {
      this.$refs.editStockForm.validate(async (valid) => {
        if (valid) {
           try {
             // Use update API
             await updateStockItem(this.editStockForm)
             this.$message.success('更新成功')
             this.editStockVisible = false
             
             this.fetchData() // Refresh list & stats
             
             // If detailed view was active, refresh it
             if (this.selectedItem && this.selectedItem.materialId === this.editStockForm.materialId) {
                // Refresh detail list: need to re-fetch rfidList
                this.viewDetail(this.selectedItem)
             }
           } catch(e) {
             console.error(e)
           }
        }
      })
    },
  }
}
</script>

<style scoped lang="css">
.stock-container {
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
}

.stat-card:hover {
  box-shadow: var(--shadow-md);
  transform: translateY(-2px);
}

.stat-header {
  display: flex;
  align-items: center;
  gap: 16px;
}

.stat-icon {
  width: 48px;
  height: 48px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  flex-shrink: 0;
}

.stat-value {
  font-size: 24px;
  font-weight: 600;
  color: var(--text-primary);
}

.stat-label {
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 4px;
}

.list-card, .stats-card {
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

.warning-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.warning-item {
  display: flex;
  align-items: center;
  padding: 12px;
  background: var(--bg-secondary);
  border-radius: 8px;
  transition: all 0.3s ease;
}

.warning-item:hover {
  background: var(--bg-tertiary);
}

.warning-type {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  margin-right: 12px;
  flex-shrink: 0;
}

.warning-type.danger {
  background: rgba(245, 34, 45, 0.1);
  color: #f5222d;
}

.warning-type.warning {
  background: rgba(255, 174, 31, 0.1);
  color: #ffae1f;
}

.warning-type.info {
  background: rgba(0, 102, 255, 0.1);
  color: #0066ff;
}

.warning-content {
  flex: 1;
}

.warning-title {
  font-weight: 600;
  color: var(--text-primary);
  font-size: 14px;
}

.warning-desc {
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 2px;
}

.warning-count {
  font-size: 18px;
  font-weight: 600;
  color: var(--primary-color);
}
</style>
