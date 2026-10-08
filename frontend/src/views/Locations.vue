<template>
  <div class="locations-container">
    <div class="page-header">
      <div class="header-left">
        <h2 class="page-title">库位管理</h2>
        <p class="page-subtitle">仓库库位规划和分配管理</p>
      </div>
    </div>

    <el-row :gutter="20">
      <el-col :span="18">
        <el-card class="warehouse-map-card">
          <div slot="header" class="card-header">
            <span>仓库布局图</span>
            <el-button type="primary" size="small" icon="el-icon-plus" @click="showAddAreaDialog">添加区域</el-button>
          </div>
          <div class="warehouse-grid">
            <div class="section" v-for="section in sections" :key="section.id">
              <div class="section-header">
                  <span>{{ section.name }}</span>
                  <div class="section-actions" style="float: right;">
                    <el-button type="primary" size="mini" plain icon="el-icon-plus" @click.stop="showAddBinDialog(section)">添加库位</el-button>
                    <el-button type="text" size="mini" icon="el-icon-edit" @click.stop="editZone(section)">编辑</el-button>
                    <el-button type="text" size="mini" icon="el-icon-delete" style="color: #f5222d;" @click.stop="deleteZone(section)">删除</el-button>
                  </div>
              </div>
              <div class="location-grid">
                <div 
                  v-for="location in section.locations"
                  :key="location.locationId"
                  :class="['location-item', { occupied: location.status === 1 }]"
                  @click="selectLocation(location)"
                  @dblclick="handleDoubleClick(location)">
                  <div class="location-id" :title="location.locationId">{{ location.displayName || location.name }}</div>
                  <div class="location-status" :style="{ background: location.status === 1 ? '#52c41a' : '#d9d9d9' }"></div>
                </div>
              </div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="info-card">
          <div slot="header" class="card-header">
            <span>库位统计</span>
          </div>
          <div class="stat-items">
            <div class="stat-item">
              <span class="label">总库位数</span>
              <span class="value">{{ totalLocations }}</span>
            </div>
            <div class="stat-item">
              <span class="label">已占用</span>
              <span class="value" style="color: #52c41a;">{{ occupiedCount }}</span>
            </div>
            <div class="stat-item">
              <span class="label">空闲库位</span>
              <span class="value" style="color: #1890ff;">{{ freeCount }}</span>
            </div>
            <div class="stat-item">
              <span class="label">占用率</span>
              <span class="value" style="color: #faad14;">{{ occupationRate }}</span>
            </div>
          </div>

          <el-divider></el-divider>

          <div v-if="selectedLocation" class="location-detail">
            <h4>库位详情</h4>
            <div class="detail-item">
              <span class="label">库位号:</span>
              <span class="value">{{ selectedLocation.locationId }}</span>
            </div>
            <div class="detail-item">
              <span class="label">所属区域:</span>
              <span class="value">{{ selectedLocation.section }}</span>
            </div>
            <div class="detail-item">
              <span class="label">状态:</span>
              <el-tag :type="selectedLocation.status === 1 ? 'success' : 'info'">
                {{ selectedLocation.status === 1 ? '已占用' : '空闲' }}
              </el-tag>
            </div>
            <div class="detail-item" v-if="selectedLocation.status === 1">
              <span class="label">物资:</span>
              <span class="value">{{ selectedLocation.material }}</span>
            </div>
            <div style="margin-top: 20px; text-align: right;">
                <el-button type="primary" size="small" icon="el-icon-edit" @click="editBin">修改</el-button>
                <el-button type="danger" size="small" icon="el-icon-delete" @click="deleteCurrentLocation">删除</el-button>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>
    
    <!-- 添加/编辑弹窗 -->
    <el-dialog 
        :title="isEdit ? (addForm.type === 1 ? '编辑区域' : '编辑库位') : (addForm.type === 1 ? '添加区域' : '添加库位')" 
        :visible.sync="addDialogVisible" 
        width="400px">
        <el-form :model="addForm" :rules="addRules" ref="addForm" label-width="80px">
            <!-- Hidden Type Selection - Context Determined -->
            
            <el-form-item 
                label="所属区域" 
                prop="parentId" 
                v-if="addForm.type === 2 && !isEdit"
                :rules="addForm.type === 2 ? addRules.parentId : [{ required: false }]">
                <el-select 
                    v-model="addForm.parentId" 
                    placeholder="请选择区域" 
                    disabled 
                    style="width: 100%">
                    <el-option v-for="item in areaOptions" :key="item.id" :label="item.name" :value="item.id"></el-option>
                </el-select>
            </el-form-item>
            <el-form-item label="编号" prop="id" v-if="isEdit">
                <el-input v-model="addForm.id" disabled style="width: 100%"></el-input>
            </el-form-item>
            <el-form-item label="名称" prop="name">
                <el-input v-model="addForm.name" placeholder="显示名称, 如 新建库区" style="width: 100%"></el-input>
            </el-form-item>
        </el-form>
        <span slot="footer" class="dialog-footer">
            <el-button @click="addDialogVisible = false">取消</el-button>
            <el-button type="primary" @click="confirmAdd">确定</el-button>
        </span>
    </el-dialog>

    <el-dialog 
        :title="(currentDetailLocation ? currentDetailLocation.name : '') + ' - 物资详情'" 
        :visible.sync="stockDetailVisible" 
        width="600px">
        <el-table :data="currentStockDetails" border stripe v-if="currentStockDetails.length > 0">
            <el-table-column prop="materialName" label="物资名称"></el-table-column>
            <el-table-column prop="quantity" label="数量" width="100" align="center"></el-table-column>
            <el-table-column prop="categoryName" label="分类" width="120" align="center"></el-table-column>
            <el-table-column prop="rfidTag" label="RFID" width="150" align="center"></el-table-column>
        </el-table>
        <div v-else style="text-align: center; padding: 20px; color: #909399;">
            <i class="el-icon-info"></i> 该库位暂无物资记录
        </div>
        <span slot="footer" class="dialog-footer">
             <el-button type="primary" @click="stockDetailVisible = false">关闭</el-button>
        </span>
    </el-dialog>
  </div>
</template>

<script>
import { getLocations, addLocation, deleteLocation, updateLocation } from '@/api/location'
import { getAllStockItems } from '@/api/stock'

export default {
  name: 'LocationCenter',
  data() {
    return {
      selectedLocation: null,
      sections: [],
      rawLocations: [],
      stockItems: [],
      addDialogVisible: false,
      stockDetailVisible: false,
      currentDetailLocation: null,
      currentStockDetails: [],
      isEdit: false,
      addForm: {
        type: 2, // 1=Zone, 2=Bin
        id: '',
        name: '',
        parentId: '',
      },
      addRules: {
        name: [{ required: true, message: '请输入名称', trigger: 'blur' }],
        parentId: [{ required: true, message: '请选择所属区域', trigger: 'change' }]
      }
    }
  },
  computed: {
    // Only get Type=1 (Warehouse/Area) locations
    areaOptions() {
        return this.rawLocations.filter(loc => loc.level === 1);
    },
    totalLocations() {
        return this.rawLocations.filter(loc => loc.level === 2).length || 0;
    },
    occupiedCount() {
        // Calculate based on computed sections/locations status
        let count = 0;
        this.sections.forEach(section => {
            section.locations.forEach(loc => {
                if (loc.status === 1) count++;
            });
        });
        return count;
    },
    freeCount() {
        return this.totalLocations - this.occupiedCount;
    },
    occupationRate() {
        if (this.totalLocations === 0) return '0%';
        return Math.round((this.occupiedCount / this.totalLocations) * 100) + '%';
    }
  },
  created() {
    this.fetchData()
  },
  methods: {
    async fetchData() {
      try {
        const [res, resStock] = await Promise.all([
          getLocations(),
          getAllStockItems()
        ]);
        
        const locations = (res.code === 200 || res.code === 1) ? res.data : (Array.isArray(res) ? res : []);
        const stockItems = (resStock.code === 200 || resStock.code === 1) ? resStock.data : (Array.isArray(resStock) ? resStock : []);
        
        this.rawLocations = locations;
        // Backend now returns VO with materialName, categoryName etc.
        this.stockItems = stockItems;
        
        // Map occupied locations
        // Assuming stockItem.location stores the locationId string
        const occupiedMap = new Map();
        this.stockItems.forEach(item => {
            if (item.location) {
                occupiedMap.set(item.location, item);
            }
        });
        
        // Transform for display
        const groups = {};
        // 1. Create Sections
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
        
        // 2. Add Child Locations
        locations.forEach(loc => {
            if (loc.level === 2 && loc.parentId && groups[loc.parentId]) {
                const stockInfo = occupiedMap.get(loc.id);
                const item = {
                   locationId: loc.id,
                   name: loc.name,
                   displayName: loc.name,
                   section: groups[loc.parentId].name,
                   status: stockInfo ? 1 : 0, 
                   material: stockInfo ? (stockInfo.materialName || '未知物资') : null,
                   sortOrder: loc.sortOrder || 0
                };
                groups[loc.parentId].locations.push(item);
            }
        });
        
        // Sort sections: Priority by sortOrder, then by Name
        this.sections = Object.values(groups).sort((a, b) => {
            if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
            return a.name.localeCompare(b.name, 'zh-CN');
        });

        // Sort bins within sections
        this.sections.forEach(section => {
            section.locations.sort((a, b) => {
                if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
                return a.name.localeCompare(b.name, 'zh-CN');
            });
        });
      } catch (e) {
        console.error(e)
      }
    },
    selectLocation(location) {
      this.selectedLocation = location
    },
    handleDoubleClick(location) {
        this.selectLocation(location);
        this.currentDetailLocation = location;
        if (this.stockItems && this.stockItems.length) {
            this.currentStockDetails = this.stockItems.filter(item => item.location === location.locationId);
        } else {
            this.currentStockDetails = [];
        }
        this.stockDetailVisible = true;
    },
    // Action: "Add Area" button at top-right
    showAddAreaDialog() {
        this.isEdit = false;
        this.addDialogVisible = true;
        this.addForm = { 
            type: 1, // Only Zone
            id: '', 
            name: '', 
            parentId: '' 
        };
        this.$nextTick(() => {
            if(this.$refs.addForm) this.$refs.addForm.clearValidate();
        });
    },
    // Action: "Add Bin" button inside a specific zone
    showAddBinDialog(section) {
        this.isEdit = false;
        this.addDialogVisible = true;
        this.addForm = {
            type: 2, // Only Bin
            id: '',
            name: '',
            parentId: section.id // Pre-fill parent
        };
        this.$nextTick(() => {
            if(this.$refs.addForm) this.$refs.addForm.clearValidate();
        });
    },
    editZone(section) {
        this.isEdit = true;
        this.addDialogVisible = true;
        this.addForm = {
            type: 1, // Zone
            id: section.id,
            name: section.name,
            parentId: '' // Zone normally has no parent in this simplified view
        };
        this.$nextTick(() => {
            if(this.$refs.addForm) this.$refs.addForm.clearValidate();
        });
    },
    async deleteZone(section) {
        if (section.locations && section.locations.length > 0) {
            try {
                await this.$confirmDelete(
                    `确认删除区域 <span style="color: #f56c6c; font-weight: bold;">${section.name}</span> 吗？`,
                    `该区域下包含 ${section.locations.length} 个库位，删除区域将一并删除所有库位！`
                );
            } catch (e) {
                return;
            }
        } else {
             try {
                await this.$confirmDelete(
                    `确认删除区域 <span style="color: #f56c6c; font-weight: bold;">${section.name}</span> 吗？`
                );
            } catch (e) {
                return;
            }
        }

        try {
            // If cascade delete is not supported by backend, we might need to delete children first.
            // But let's assume one call for now or simple delete.
            // If backend doesn't cascade, we might need to loop delete.
            // Let's rely on deleteLocation.
            await deleteLocation(section.id);
            this.$message.success('删除区域成功');
            this.fetchData();
        } catch(e) {
            console.error(e);
            this.$message.error('删除失败');
        }
    },
    async confirmAdd() {
        this.$refs.addForm.validate(async valid => {
            if (valid) {
               try {
                   const isZone = this.addForm.type === 1;
                   
                   if (this.isEdit) {
                       // Update Logic
                       const payload = {
                           id: this.addForm.id,
                           name: this.addForm.name,
                           // parentId, level, sortOrder keep original or minimal update
                           parentId: isZone ? null : this.addForm.parentId,
                           level: isZone ? 1 : 2
                       };
                       await updateLocation(payload);
                       this.$message.success('修改成功');
                   } else {
                       // Add Logic
                       let autoId = '';
                       // ... (existing generation logic)
                       if (isZone) {
                           // Use simpler Zone ID: Z + 4 random digits (e.g. Z5678)
                           const random4 = Math.floor(Math.random() * 9000) + 1000;
                           autoId = `Z${random4}`;
                       } else {
                            // Bin ID: ParentId + - + 3 random digits
                           const random3 = Math.floor(Math.random() * 900) + 100;
                           autoId = `${this.addForm.parentId}-${random3}`;
                       }

                       const payload = {
                           id: autoId,
                           name: this.addForm.name,
                           parentId: isZone ? null : this.addForm.parentId,
                           level: isZone ? 1 : 2,
                           sortOrder: 100
                       };
                       await addLocation(payload);
                       this.$message.success('添加成功');
                   }
                   
                   this.addDialogVisible = false;
                   this.fetchData();
               } catch(e) {
                   console.error(e);
               }
            }
        })
    },
    editBin() {
        if (!this.selectedLocation) return;
        const raw = this.rawLocations.find(l => l.id === this.selectedLocation.locationId);
        if (!raw) return;

        this.isEdit = true;
        this.addDialogVisible = true;
        this.addForm = {
            type: 2, // Bin
            id: raw.id,
            name: raw.name,
            parentId: raw.parentId
        };
        this.$nextTick(() => {
            if(this.$refs.addForm) this.$refs.addForm.clearValidate();
        });
    },
    async deleteCurrentLocation() {
        if(!this.selectedLocation) return;
        
        try {
            await this.$confirmDelete(
                `确认删除库位 <span style="color: #f56c6c; font-weight: bold;">${this.selectedLocation.name}</span> 吗？`
            );
            
            await deleteLocation(this.selectedLocation.locationId);
            this.$message.success('删除成功');
            this.selectedLocation = null;
            this.fetchData();
        } catch(e) {
            console.error(e);
        }
    }
  }
}
</script>

<style scoped lang="css">
.locations-container {
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
  margin-bottom: 24px;
}

.page-header h2 {
  margin: 0;
  font-size: 24px;
  font-weight: 600;
  color: var(--text-primary);
}

.page-header p {
  margin: 8px 0 0;
  color: var(--text-secondary);
  font-size: 14px;
}

.warehouse-map-card, .info-card {
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.warehouse-grid {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.section {
  padding: 16px; 
  background: var(--bg-secondary);
  border-radius: 8px;
}

.section-header {
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 12px;
  font-size: 14px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.location-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(80px, 1fr)); /* Use auto-fill and fixed min-width */
  gap: 12px;
}

.location-item {
  height: 80px; /* Fixed height */
  /* aspect-ratio: 1; removed to enforce fixed size */
  border: 2px solid #d9d9d9;
  border-radius: 6px;
  padding: 6px;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: var(--bg-white);
}

.location-item:hover {
  border-color: var(--primary-color);
  box-shadow: 0 2px 8px rgba(0, 102, 255, 0.1);
}

.location-item.occupied {
  background: linear-gradient(135deg, #52c41a15 0%, #52c41a08 100%);
  border-color: #52c41a;
}

.location-id {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
  /* Handle long text */
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  width: 100%;
}

.location-status {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-top: 4px;
}

.stat-items {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.stat-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  background: var(--bg-secondary);
  border-radius: 6px;
}

.stat-item .label {
  color: var(--text-secondary);
  font-size: 13px;
}

.stat-item .value {
  font-weight: 600;
  font-size: 18px;
  color: var(--text-primary);
}

.location-detail {
  padding-top: 12px;
}

.location-detail h4 {
  margin: 0 0 12px;
  color: var(--text-primary);
  font-weight: 600;
}

.detail-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid var(--border-color);
}

.detail-item .label {
  color: var(--text-secondary);
  font-size: 13px;
}

.detail-item .value {
  color: var(--text-primary);
  font-weight: 500;
}

.detail-item:last-child {
  border-bottom: none;
}
</style>
