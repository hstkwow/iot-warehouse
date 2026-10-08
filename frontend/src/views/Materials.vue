<template>
  <div class="materials-container">
    <!-- 页面头 -->
    <div class="page-header">
      <div class="header-left">
        <h2 class="page-title">物资管理</h2>
        <p class="page-subtitle">管理仓库中的所有物资信息</p>
      </div>
      <div class="header-right">
        <el-button icon="el-icon-finished" @click="showCategoryManager">分类管理</el-button>
        <el-button type="primary" icon="el-icon-plus" @click="showAddMaterial">新增物资</el-button>
        <el-button icon="el-icon-refresh" @click="refreshMaterials">刷新</el-button>
      </div>
    </div>

    <!-- 统计卡片 -->
    <el-row :gutter="20" class="stats-row">
      <el-col :span="12">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-icon-wrapper icon-blue">
            <i class="el-icon-box"></i>
          </div>
          <div class="stat-content">
            <div class="stat-value">{{ total }}</div>
            <div class="stat-label">物资总数 (种)</div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-icon-wrapper icon-purple">
            <i class="el-icon-menu"></i>
          </div>
          <div class="stat-content">
            <div class="stat-value">{{ categories.length }}</div>
            <div class="stat-label">物资分类数</div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 物资列表 -->
    <el-card class="list-card">
      <div slot="header" class="card-header">
        <span class="card-title">物资列表</span>
        <div class="header-actions">
          <el-input 
            v-model="searchText" 
            placeholder="搜索物资名称"
            style="width: 220px; margin-right: 10px;"
            prefix-icon="el-icon-search"
            @keyup.enter="handleSearch"
            @clear="handleSearch"
            clearable>
          </el-input>
          <el-select v-model="filterCategory" placeholder="物资分类" style="width: 150px;" @change="handleSearch" clearable @visible-change="handleCategoryVisibleChange">
            <el-option label="全部分类" value=""></el-option>
            <el-option 
              v-for="cat in categories" 
              :key="cat.categoryId" 
              :label="cat.categoryName" 
              :value="cat.categoryId">
            </el-option>
          </el-select>
          <el-button type="primary" size="medium" icon="el-icon-search" @click="handleSearch">搜索</el-button>
        </div>
      </div>
      
      <div style="margin-bottom: 15px;" v-if="selectedMaterials.length > 0">
        <el-alert
          type="info"
          show-icon
          :closable="false">
          <template slot="title">
            <span style="display: flex; align-items: center; justify-content: space-between;">
              <span>已选择 {{ selectedMaterials.length }} 项</span>
              <el-button type="text" size="small" style="color: #f5222d; margin-left: 10px;" @click="batchDelete">批量删除</el-button>
            </span>
          </template>
        </el-alert>
      </div>

      <el-table 
        :data="materials"
        stripe
        border
        style="width: 100%"
        @selection-change="handleSelectionChange">
        <el-table-column type="selection" width="55" align="center"></el-table-column>
        <el-table-column label="图片" width="100" align="center">
          <template slot-scope="scope">
            <el-image 
              style="width: 50px; height: 50px"
              :src="scope.row.imageUrl" 
              :preview-src-list="[scope.row.imageUrl]"
              v-if="scope.row.imageUrl">
            </el-image>
            <span v-else>无</span>
          </template>
        </el-table-column>
        <el-table-column label="物资名称" prop="name" min-width="120" show-overflow-tooltip align="center"></el-table-column>
        <el-table-column label="分类" width="90" align="center">
          <template slot-scope="scope">
            <el-tag type="info" effect="plain">{{ getCategoryName(scope.row.categoryId) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="规格型号" prop="spec" min-width="100" show-overflow-tooltip align="center"></el-table-column>
        <el-table-column label="单位" prop="unit" width="60" align="center"></el-table-column>
        <el-table-column label="当前库存" width="100" align="center">
          <template slot-scope="scope">
            <span :style="{ color: scope.row.currentStock <= scope.row.minStock ? '#f5222d' : '#52c41a' }">
              {{ scope.row.currentStock }} {{ scope.row.unit }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="预警天数" width="90" prop="expiryWarningDays" align="center"></el-table-column>
        <!-- <el-table-column label="创建时间" width="180" prop="createTime"></el-table-column> -->
        <el-table-column label="操作" width="210" fixed="right" align="center">
          <template slot-scope="scope">
            <el-button type="text" size="small" @click="viewMaterialDetail(scope.row)">详情</el-button>
            <el-button type="text" size="small" @click="editMaterial(scope.row)">编辑</el-button>
            <el-button type="text" size="small" style="color: #1890ff" icon="el-icon-bank-card" @click="openRfidWrite(scope.row)">写RFID</el-button>
            <el-button type="text" size="small" style="color: #f5222d" @click="deleteMaterial(scope.row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-wrapper">
        <el-pagination
          :current-page="currentPage"
          :page-size="pageSize"
          :total="total"
          @size-change="handleSizeChange"
          @current-change="handleCurrentChange"
          layout="total, sizes, prev, pager, next, jumper"
          :page-sizes="[10, 20, 50, 100]">
        </el-pagination>
      </div>
    </el-card>

    <!-- 编辑/新增物资对话框 -->
    <el-dialog 
      :title="isEditMode ? '编辑物资' : '新增物资'" 
      :visible.sync="materialDialogVisible"
      width="700px"
      @close="resetMaterialForm">
      <el-form :model="materialForm" :rules="materialRules" ref="materialForm" label-width="140px">
        <el-form-item label="物资图片" prop="imageUrl">
          <el-upload
            class="avatar-uploader"
            :action="uploadUrl"
            :headers="uploadHeaders"
            :show-file-list="false"
            :on-success="handleAvatarSuccess"
            :before-upload="beforeAvatarUpload">
            <img v-if="materialForm.imageUrl" :src="materialForm.imageUrl" class="avatar">
            <i v-else class="el-icon-plus avatar-uploader-icon"></i>
          </el-upload>
        </el-form-item>
        <el-form-item label="物资名称" prop="name">
          <el-input v-model="materialForm.name" placeholder="请输入物资名称"></el-input>
        </el-form-item>
        <el-form-item label="物资分类" prop="categoryId">
          <el-select v-model="materialForm.categoryId" placeholder="请选择分类" @visible-change="handleCategoryVisibleChange">
            <el-option 
              v-for="cat in categories" 
              :key="cat.categoryId" 
              :label="cat.categoryName" 
              :value="cat.categoryId">
            </el-option>
          </el-select>
        </el-form-item>
        <el-form-item label="规格型号" prop="spec">
          <el-input v-model="materialForm.spec" placeholder="请输入规格型号"></el-input>
        </el-form-item>
        <el-form-item label="单位" prop="unit">
          <el-input v-model="materialForm.unit" placeholder="请输入单位（如：件、根、米等）"></el-input>
        </el-form-item>
        <el-form-item label="最低库存警示" prop="minStock">
          <el-input-number v-model="materialForm.minStock" :min="0" controls-position="right"></el-input-number>
        </el-form-item>
        <el-form-item label="最高库存限制" prop="maxStock">
          <el-input-number v-model="materialForm.maxStock" :min="1" controls-position="right"></el-input-number>
        </el-form-item>
        <el-form-item label="有效期预警天数" prop="expiryWarningDays">
          <el-input-number v-model="materialForm.expiryWarningDays" :min="0" controls-position="right"></el-input-number>
        </el-form-item>
      </el-form>
      <span slot="footer" class="dialog-footer">
        <el-button @click="materialDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveMaterial">保存</el-button>
      </span>
    </el-dialog>

    <!-- 物资详情对话框 -->
    <el-dialog title="物资详情" :visible.sync="detailDialogVisible" width="900px">
      <div v-if="selectedMaterial" class="material-detail">
        <div style="text-align: center; margin-bottom: 20px;" v-if="selectedMaterial.imageUrl">
          <el-image 
            style="width: 200px; height: 200px; border-radius: 4px;"
            :src="selectedMaterial.imageUrl" 
            :preview-src-list="[selectedMaterial.imageUrl]">
          </el-image>
        </div>
        <el-row :gutter="20">
          <el-col :span="12">
            <div class="detail-item">
              <label>物资名称:</label>
              <span>{{ selectedMaterial.name }}</span>
            </div>
            <div class="detail-item">
              <label>分类:</label>
              <el-tag type="info" effect="plain">{{ getCategoryName(selectedMaterial.categoryId) }}</el-tag>
            </div>
            <div class="detail-item">
              <label>规格型号:</label>
              <span>{{ selectedMaterial.spec }}</span>
            </div>
            <div class="detail-item">
              <label>创建时间:</label>
              <span>{{ selectedMaterial.createTime ? selectedMaterial.createTime.replace('T', ' ') : '---' }}</span>
            </div>
          </el-col>
          <el-col :span="12">
            <div class="detail-item">
              <label>单位:</label>
              <span>{{ selectedMaterial.unit }}</span>
            </div>
            <div class="detail-item">
              <label>当前库存:</label>
              <span :style="{ color: selectedMaterial.currentStock <= selectedMaterial.minStock ? '#f5222d' : '#52c41a', fontWeight: 'bold' }">
                {{ selectedMaterial.currentStock }} {{ selectedMaterial.unit }}
              </span>
            </div>
            <div class="detail-item">
              <label>库存范围:</label>
              <span>{{ selectedMaterial.minStock }} - {{ selectedMaterial.maxStock }}</span>
            </div>
            <div class="detail-item">
              <label>更新时间:</label>
              <span>{{ selectedMaterial.updateTime ? selectedMaterial.updateTime.replace('T', ' ') : '---' }}</span>
            </div>
          </el-col>
        </el-row>
        
        <el-divider content-position="left">该物资的库存明细</el-divider>
        <el-table :data="rfidList" v-loading="rfidLoading" size="small" stripe border max-height="400">
           <el-table-column label="RFID 标签" prop="rfidTag" min-width="150" show-overflow-tooltip></el-table-column>
           <el-table-column label="库位" min-width="180" show-overflow-tooltip>
               <template slot-scope="scope">
                   {{ (scope.row.zoneName ? scope.row.zoneName + ' - ' : '') + (scope.row.locationName || scope.row.location) }}
               </template>
           </el-table-column>
           <el-table-column label="数量" prop="quantity" width="100" align="center">
               <template slot-scope="scope">
                   {{ scope.row.quantity }} {{ selectedMaterial.unit }}
               </template>
           </el-table-column>
           <el-table-column label="状态" prop="status" width="80" align="center">
               <template slot-scope="scope">
                   <el-tag v-if="scope.row.status === 1" type="success" size="mini">在库</el-tag>
                   <el-tag v-else-if="scope.row.status === 0" type="info" size="mini">出库</el-tag>
                   <el-tag v-else type="danger" size="mini">异常</el-tag>
               </template>
           </el-table-column>
        </el-table>
      </div>
      <span slot="footer" class="dialog-footer">
        <el-button @click="detailDialogVisible = false">关闭</el-button>
        <el-button type="primary" @click="editMaterial(selectedMaterial)">编辑</el-button>
      </span>
    </el-dialog>

    <!-- 分类管理弹窗 -->
    <el-dialog title="物资分类管理" :visible.sync="categoryManageVisible" width="700px">
      <div style="margin-bottom: 15px;">
         <el-button type="primary" size="small" icon="el-icon-plus" @click="showAddCategory">新增分类</el-button>
      </div>
      <el-table :data="categories" stripe border size="small" style="width: 100%" height="400">
         <el-table-column prop="categoryId" label="ID" width="60"></el-table-column>
         <el-table-column prop="categoryName" label="分类名称" width="150"></el-table-column>
         <el-table-column prop="description" label="描述"></el-table-column>
         <el-table-column label="操作" width="120">
           <template slot-scope="scope">
             <el-button type="text" size="small" @click="editCategory(scope.row)">编辑</el-button>
             <el-button type="text" size="small" style="color: #f5222d" @click="deleteCategoryItem(scope.row)">删除</el-button>
           </template>
         </el-table-column>
      </el-table>
      <div slot="footer">
         <el-button @click="categoryManageVisible = false">关闭</el-button>
      </div>
    </el-dialog>

    <!-- 分类编辑/新增弹窗 -->
    <el-dialog :title="isCategoryEdit ? '编辑分类' : '新增分类'" :visible.sync="categoryFormVisible" width="400px" append-to-body>
       <el-form :model="categoryForm" :rules="categoryRules" ref="categoryForm" label-width="80px">
          <el-form-item label="名称" prop="categoryName">
             <el-input v-model="categoryForm.categoryName"></el-input>
          </el-form-item>
          <el-form-item label="描述" prop="description">
             <el-input type="textarea" v-model="categoryForm.description"></el-input>
          </el-form-item>
       </el-form>
       <div slot="footer">
          <el-button @click="categoryFormVisible = false">取消</el-button>
          <el-button type="primary" @click="submitCategoryForm">保存</el-button>
       </div>
    </el-dialog>

    <!-- RFID 写入弹窗 -->
    <el-dialog
      :title="rfidWaiting ? '等待写卡中…' : '写入 RFID 卡'"
      :visible.sync="rfidWriteVisible" width="500px" append-to-body
      :close-on-click-modal="!rfidWaiting"
      :close-on-press-escape="!rfidWaiting"
      @close="resetRfidForm">

      <!-- 第一步：填写表单 -->
      <div v-if="rfidWriteTarget && !rfidWaiting">
        <el-descriptions :column="2" border size="small" style="margin-bottom:18px;">
          <el-descriptions-item label="物资名称">{{ rfidWriteTarget.name }}</el-descriptions-item>
          <el-descriptions-item label="物资编码">{{ rfidWriteTarget.materialCode }}</el-descriptions-item>
          <el-descriptions-item label="规格型号">{{ rfidWriteTarget.spec || '—' }}</el-descriptions-item>
          <el-descriptions-item label="单位">{{ rfidWriteTarget.unit }}</el-descriptions-item>
        </el-descriptions>
        <el-form :model="rfidWriteForm" :rules="rfidWriteRules" ref="rfidWriteFormRef" label-width="80px" size="small">
          <el-form-item label="写入设备" prop="deviceId">
            <div style="display:flex;gap:8px;">
              <el-select v-model="rfidWriteForm.deviceId" placeholder="选择在线设备" style="flex:1;" :loading="rfidDevicesLoading">
                <el-option v-for="d in rfidOnlineDevices" :key="d.deviceId"
                  :label="d.deviceName || d.deviceId"
                  :value="d.deviceId">
                </el-option>
              </el-select>
              <el-button icon="el-icon-refresh" @click="loadRfidDevices"></el-button>
            </div>
          </el-form-item>
          <el-form-item label="数量" prop="quantity">
            <el-input-number v-model="rfidWriteForm.quantity" :min="0.01" :precision="2" style="width:100%;" controls-position="right"></el-input-number>
          </el-form-item>
          <el-form-item label="区域" prop="zone">
            <el-select v-model="rfidWriteForm.zone" placeholder="先选区域" style="width:100%;" clearable @change="onZoneChange">
              <el-option v-for="z in rfidZoneOptions" :key="z.id"
                :label="z.name"
                :value="z.id">
              </el-option>
            </el-select>
          </el-form-item>
          <el-form-item label="位子" prop="location">
            <el-select v-model="rfidWriteForm.location" placeholder="再选具体位子" style="width:100%;" clearable filterable
              :disabled="!rfidWriteForm.zone">
              <el-option v-for="loc in rfidLocationOptions" :key="loc.id"
                :label="loc.name"
                :value="loc.id">
              </el-option>
            </el-select>
          </el-form-item>
          <el-form-item label="批次号">
            <el-input v-model="rfidWriteForm.batchNo" placeholder="可选"></el-input>
          </el-form-item>
          <el-form-item label="有效期">
            <el-date-picker v-model="rfidWriteForm.expiryDate" type="date"
              value-format="yyyy-MM-dd" placeholder="可选" style="width:100%;"></el-date-picker>
          </el-form-item>
          <div class="rfid-tag-preview">
            <span class="rtag-label">卡片写入内容：</span>
            <code class="rtag-val">{{ rfidTagPreview }}</code>
            <span class="rtag-hint">物资编码，用于离线识别</span>
          </div>
        </el-form>
      </div>

      <!-- 第二步：等待硬件写卡 -->
      <div v-if="rfidWaiting" class="rfid-waiting-view">
        <div class="rfid-waiting-icon-wrap">
          <i class="el-icon-mobile-phone rfid-waiting-icon"></i>
          <i class="el-icon-loading rfid-waiting-spin"></i>
        </div>
        <p class="rfid-waiting-title">请将空白 RFID 卡放到设备读卡区</p>
        <div class="rfid-waiting-tag-row">
          <span>写入内容：</span><code class="rtag-val">{{ rfidTagPreview }}</code>
        </div>
        <el-progress :percentage="Math.min(rfidPollCount * 100 / 7, 99)" :show-text="false" style="margin:14px 0 4px;"></el-progress>
        <p class="rfid-waiting-sub">自动检测中，剩余约 {{ Math.max(7 - rfidPollCount, 0) }} 秒超时</p>
      </div>

      <div slot="footer">
        <template v-if="!rfidWaiting">
          <el-button @click="rfidWriteVisible = false">取消</el-button>
          <el-button type="primary" :loading="rfidWriting" @click="submitRfidWrite">确认写入</el-button>
        </template>
        <template v-else>
          <el-button type="danger" plain @click="cancelRfidWrite">取消写卡</el-button>
        </template>
      </div>
    </el-dialog>
  </div>
</template>

<script>
import { 
  getAllMaterials, 
  addMaterial, 
  updateMaterial, 
  deleteMaterial,
  getMaterialById 
} from '@/api/material'
import { getAllCategories, addCategory, updateCategory, deleteCategory } from '@/api/category'
import { getAllDevices, sendDeviceCommand } from '@/api/device'
import { getStockPendingByMaterial, prepareRfidWrite } from '@/api/stock'
import { getLocations } from '@/api/location'
import { config } from '@/config'

export default {
  name: 'MaterialList',
  data() {
    return {
      uploadUrl: config.api.baseUrl + '/upload/image',
      searchText: '',
      filterCategory: '',
      categories: [],
      currentPage: 1,
      pageSize: 10,
      total: 0,
      isEditMode: false,
      materialDialogVisible: false,
      detailDialogVisible: false,
      selectedMaterial: null,
      rfidLoading: false,
      rfidList: [],
      selectedMaterials: [], // For batch selection
      materialForm: {
        materialId: null,
        name: '',
        categoryId: null,
        spec: '',
        unit: '个',
        minStock: 0,
        maxStock: 999,
        expiryWarningDays: 30,
        imageUrl: ''
      },
      materialRules: {
        name: [{ required: true, message: '请输入物资名称', trigger: 'blur' }],
        categoryId: [{ required: true, message: '请选择分类', trigger: 'change' }],
        unit: [{ required: true, message: '请输入单位', trigger: 'blur' }]
      },
      
      // Category Management Data
      categoryManageVisible: false,
      categoryFormVisible: false,
      isCategoryEdit: false,
      categoryForm: {
        categoryId: null,
        categoryName: '',
        description: ''
      },
      categoryRules: {
        categoryName: [{ required: true, message: '请输入分类名称', trigger: 'blur' }]
      },

      materials: [],

      // RFID 写入
      rfidWriteVisible: false,
      rfidWriteTarget: null,
      rfidWriting: false,
      rfidWaiting: false,
      rfidPendingMaterialId: null,
      rfidPollTimer: null,
      rfidPollCount: 0,
      rfidWriteStartTime: null,
      rfidDevicesLoading: false,
      rfidOnlineDevices: [],
      rfidZoneOptions: [],
      rfidAllSlots: [],
      rfidLocationOptions: [],
      rfidWriteForm: {
        deviceId: '',
        quantity: 1,
        zone: '',
        location: '',
        batchNo: '',
        expiryDate: ''
      },
      rfidWriteRules: {
        deviceId:  [{ required: true, message: '请选择设备',   trigger: 'change' }],
        quantity:  [{ required: true, message: '请输入数量',   trigger: 'blur'   }],
        zone:      [{ required: true, message: '请选择区域',   trigger: 'change' }],
        location:  [{ required: true, message: '请选择位子',   trigger: 'change' }]
      }
    }
  },
  computed: {
    uploadHeaders() {
      const token = localStorage.getItem('token') || localStorage.getItem(config.app.tokenKey)
      return token ? { Authorization: `Bearer ${token}` } : {}
    },
    rfidTagPreview() {
      if (!this.rfidWriteTarget) return ''
      return this.rfidWriteTarget.materialCode || ''
    }
  },
  mounted() {
    this.fetchData()
    this.fetchCategories()
  },
  methods: {
    handleAvatarSuccess(res) {
      if (res.code === 1) {
        this.materialForm.imageUrl = res.data;
        this.$message.success('图片上传成功');
      } else {
        this.$message.error('图片上传失败: ' + res.msg);
      }
    },
    beforeAvatarUpload(file) {
      const isJPG = file.type === 'image/jpeg' || file.type === 'image/png';
      const isLt2M = file.size / 1024 / 1024 < 2;

      if (!isJPG) {
        this.$message.error('上传图片只能是 JPG/PNG 格式!');
      }
      if (!isLt2M) {
        this.$message.error('上传图片大小不能超过 2MB!');
      }
      return isJPG && isLt2M;
    },
    getCategoryName(id) {
      if (!this.categories || this.categories.length === 0) return 'Loading...';
      const category = this.categories.find(c => c.categoryId === id);
      return category ? category.categoryName : '未知分类';
    },
    async fetchCategories() {
      try {
        const res = await getAllCategories()
        
        if (res && res.code === 1) { // Standard Result wrapper check
             this.categories = res.data;
        } else if (Array.isArray(res)) {
            this.categories = res;
        } else if (res && res.data) {
             this.categories = res.data;
        }
      } catch (e) {
        console.error('Fetch categories failed:', e)
      }
    },
    async fetchData() {
      try {
        const params = {
            page: this.currentPage,
            pageSize: this.pageSize,
            categoryId: this.filterCategory || undefined,
            keyword: this.searchText || undefined
        }
        const res = await getAllMaterials(params)
        
        if (res.code === 200 || res.code === 1) {
            if (res.data && res.data.records) {
                // Backend pagination
                this.materials = res.data.records
                this.total = res.data.total
            } else {
                // Fallback to list
                this.materials = Array.isArray(res.data) ? res.data : []
                this.total = this.materials.length
            }
        } else if (Array.isArray(res)) {
            this.materials = res
            this.total = res.length
        }
      } catch (error) {
        console.error('Fetch materials failed:', error)
      }
    },
    showAddMaterial() {
      // Refresh categories if needed when opening dialog
      if (!this.categories || this.categories.length === 0) {
        this.fetchCategories();
      }
      this.isEditMode = false
      this.materialForm = {
        materialId: null,
        name: '',
        categoryId: null,
        spec: '',
        unit: '个',
        minStock: 0,
        maxStock: 999,
        expiryWarningDays: 30,
        imageUrl: ''
      }
      this.materialDialogVisible = true
    },
    async editMaterial(material) {
      this.isEditMode = true
      this.materialDialogVisible = true
      this.materialForm = { ...material } // 先展示旧数据，避免闪烁

      try {
        const res = await getMaterialById(material.materialId)
        if(res.code === 1) {
           this.materialForm = res.data
        }
      } catch(e) {
          console.error(e)
      }
    },
    async saveMaterial() {
      this.$refs.materialForm.validate(async (valid) => {
        if (valid) {
          try {
            if (this.isEditMode) {
              await updateMaterial(this.materialForm)
              this.$message.success('编辑成功')
            } else {
              await addMaterial(this.materialForm)
              this.$message.success('添加成功')
            }
            this.materialDialogVisible = false
            this.fetchData()
          } catch (error) {
             // Error handled in interceptor
          }
        }
      })
    },
    resetMaterialForm() {
      this.$refs.materialForm.clearValidate()
    },
    async viewMaterialDetail(material) {
      if (!material || !material.materialId) return
      
      this.selectedMaterial = material
      this.detailDialogVisible = true
      
      this.rfidLoading = true
      this.rfidList = []
      
      try {
          // Call the updated Material Details API which now includes stock items
          const res = await getMaterialById(material.materialId)
          if (res.code === 200 || res.code === 1) {
              // Update selectedMaterial with full details if needed
              this.selectedMaterial = res.data
              // Populate RFID list from the nested stockItems field
              this.rfidList = res.data.stockItems || []
              
              if (!this.rfidList.length) {
                  // Fallback: If for some reason stockItems is empty/null but we expect data, 
                  // check if there is a legacy format (unlikely with new Backend impl)
              }
          } else {
             this.$message.error(res.msg || '获取详情失败')
          }
      } catch(e) {
          console.error(e)
          this.$message.error('获取详情失败')
      } finally {
          this.rfidLoading = false
      }
    },
    async deleteMaterial(material) {
      this.$confirmDelete(
        `确认删除物资 <span style="color: #f56c6c; font-weight: bold;">${material.name}</span> 吗？`,
        '此操作将永久删除该物资及其关联的图片文件，且无法恢复！'
      ).then(async () => {
        try {
          // Use materialId, fallback to finding by code if id missing in old data
          const id = material.materialId || material.id
          if (id) {
            const res = await deleteMaterial([id]) // 统一传数组
            if (res.code === 1 || res.code === 200) {
              this.$message.success('删除成功')
              // Check if current page is empty after deletion, go back one page if needed
              if (this.materials.length === 1 && this.currentPage > 1) {
                  this.currentPage--;
              }
              this.fetchData()
            } else {
              this.$message.error(res.msg || '删除失败')
            }
          } else {
             this.$message.error('无法获取物资ID')
          }
        } catch (error) {
           // Error handled in interceptor
        }
      }).catch(() => {})
    },
    
    // Batch Selection logic
    handleSelectionChange(val) {
      this.selectedMaterials = val;
    },
    
    // Batch Delete Logic
    batchDelete() {
      if (!this.selectedMaterials.length) return;
      
      this.$confirmDelete(
        `确认删除选中的 <span style="color: #f56c6c; font-weight: bold;">${this.selectedMaterials.length}</span> 项物资吗？`,
        '关联的图片将被一并清除，不可恢复！'
      ).then(async () => {
         try {
           const ids = this.selectedMaterials.map(item => item.materialId);
           const res = await deleteMaterial(ids);
           
           if (res.code === 1 || res.code === 200) {
              this.$message.success('批量删除成功');
              // Calculate remaining items on page to decide if we should go back a page
              if (this.materials.length === ids.length && this.currentPage > 1) {
                  this.currentPage--;
              }
              this.fetchData();
              this.selectedMaterials = []; // Clear selection
           } else {
               this.$message.error(res.msg || '部分或全部删除失败');
           }
         } catch(e) { /* error handled in interceptor */ }
      }).catch(() => {});
    },
    handleSearch() {
      this.currentPage = 1
      this.fetchData()
    },
    async handleCategoryVisibleChange(visible) {
      if (visible && (!this.categories || this.categories.length === 0)) {
        await this.fetchCategories();
      }
    },
    handleSizeChange(val) {
      console.log('Size change:', val);
      this.pageSize = val;
      this.currentPage = 1;
      this.$nextTick(() => {
        this.fetchData();
      });
    },
    handleCurrentChange(val) {
      console.log('Current page change:', val);
      this.currentPage = val;
      this.$nextTick(() => {
        this.fetchData();
      });
    },
    refreshMaterials() {
      this.fetchData()
    },

    // Category Management Methods
    showCategoryManager() {
      this.categoryManageVisible = true
      this.fetchCategories() // Refresh list
    },
    showAddCategory() {
      this.isCategoryEdit = false
      this.categoryForm = {
        categoryId: null,
        categoryName: '',
        description: ''
      }
      this.categoryFormVisible = true
      this.$nextTick(() => {
        if (this.$refs.categoryForm) this.$refs.categoryForm.clearValidate()
      })
    },
    editCategory(row) {
      this.isCategoryEdit = true
      this.categoryForm = { ...row }
      this.categoryFormVisible = true
      this.$nextTick(() => {
        if (this.$refs.categoryForm) this.$refs.categoryForm.clearValidate()
      })
    },
    async deleteCategoryItem(row) {
      this.$confirmDelete(
         `确认删除分类 <span style="color: #f56c6c; font-weight: bold;">${row.categoryName}</span> 吗？`
      )
        .then(async () => {
          try {
             const res = await deleteCategory(row.categoryId)
             if (res.code === 1) {
                this.$message.success('删除成功')
                this.fetchCategories()
             } else {
                this.$message.error(res.msg || '删除失败')
             }
          } catch(e) { console.error(e) }
        }).catch(() => {})
    },
    async submitCategoryForm() {
       this.$refs.categoryForm.validate(async (valid) => {
          if (valid) {
             try {
                if (this.isCategoryEdit) {
                   await updateCategory(this.categoryForm)
                   this.$message.success('更新成功')
                } else {
                   await addCategory(this.categoryForm)
                   this.$message.success('添加成功')
                }
                this.categoryFormVisible = false
                this.fetchCategories()
             } catch(e) { console.error(e) }
          }
       })
    },

    // ---- RFID 写入 ----
    openRfidWrite(material) {
      this.rfidWriteTarget = material
      this.rfidWriteForm = { deviceId: '', quantity: 1, zone: '', location: '', batchNo: '', expiryDate: '' }
      this.loadRfidDevices()
      this.loadRfidLocations()
      this.rfidWriteVisible = true
    },
    resetRfidForm() {
      if (this.rfidPollTimer) {
        clearInterval(this.rfidPollTimer)
        this.rfidPollTimer = null
      }
      this.rfidWriteTarget = null
      this.rfidWriting = false
      this.rfidWaiting = false
      this.rfidPollCount = 0
      this.rfidPendingMaterialId = null
      this.rfidWriteStartTime = null
      if (this.$refs.rfidWriteFormRef) this.$refs.rfidWriteFormRef.resetFields()
    },
    cancelRfidWrite() {
      if (this.rfidPollTimer) {
        clearInterval(this.rfidPollTimer)
        this.rfidPollTimer = null
      }
      this.$message.warning('已取消写卡')
      this.rfidWriteStartTime = null
      this.rfidWriteVisible = false
    },
    async loadRfidLocations() {
      try {
        const res = await getLocations()
        const list = Array.isArray(res.data || res) ? (res.data || res) : []
        this.rfidZoneOptions = list.filter(l => l.level === 1)
        this.rfidAllSlots   = list.filter(l => l.level === 2)
        this.rfidLocationOptions = []
      } catch (e) {
        console.warn('[RFID] load locations failed', e)
      }
    },
    onZoneChange(zoneId) {
      this.rfidWriteForm.location = ''
      this.rfidLocationOptions = zoneId
        ? this.rfidAllSlots.filter(s => s.parentId === zoneId)
        : []
    },
    async loadRfidDevices() {
      this.rfidDevicesLoading = true
      try {
        const res = await getAllDevices()
        if (res.code === 1 || res.code === 200) {
          this.rfidOnlineDevices = (res.data || []).filter(d => d.status === 1)
          if (!this.rfidOnlineDevices.length) this.$message.warning('当前没有在线设备')
        }
      } catch (e) {
        this.$message.error('加载设备失败')
      } finally {
        this.rfidDevicesLoading = false
      }
    },
    async submitRfidWrite() {
      this.$refs.rfidWriteFormRef.validate(async valid => {
        if (!valid) return
        this.rfidWriting = true
        try {
          const materialCode = this.rfidWriteTarget.materialCode
          const materialId = this.rfidWriteTarget.materialId

          // 1. 先向后端预登记本次写卡的明细（数量、批次、有效期、库位）
          await prepareRfidWrite({
            materialId,
            quantity:    this.rfidWriteForm.quantity,
            location:    this.rfidWriteForm.location,
            batchNo:     this.rfidWriteForm.batchNo  || null,
            expiryDate:  this.rfidWriteForm.expiryDate || null
          })

          // 2. 下发 MQTT 写卡指令，卡片数据写入 materialCode
          await sendDeviceCommand(this.rfidWriteForm.deviceId, { rfid_write: materialCode })

          // 3. 切换到等待状态，轮询 pending 记录
          this.rfidPendingMaterialId = materialId
          this.rfidWriteStartTime = new Date()
          this.rfidWriting = false
          this.rfidWaiting = true
          this.rfidPollCount = 0
          this.rfidPollTimer = setInterval(() => { this.pollRfidStatus() }, 1000)
        } catch (e) {
          this.$message.error(e.message || '操作失败')
          this.rfidWriting = false
        }
      })
    },
    async pollRfidStatus() {
      this.rfidPollCount++
      if (this.rfidPollCount > 7) {
        clearInterval(this.rfidPollTimer)
        this.rfidPollTimer = null
        this.rfidWaiting = false
        this.$message.error('等待超时，未检测到卡片，请检查设备后重新写卡')
        return
      }
      try {
        const res = await getStockPendingByMaterial(this.rfidPendingMaterialId)
        console.log('[RFID poll] materialId=', this.rfidPendingMaterialId, 'res=', JSON.stringify(res))
        // res 可能是 { code:1, data:{...} } 或已被拦截器拆包成 data 本身
        const item = (res && res.itemId) ? res : (res && res.data && res.data.itemId ? res.data : null)
        // 写卡采用"删旧建新"，能查到 pending 记录即为本次写入成功
        if (item) {
          clearInterval(this.rfidPollTimer)
          this.rfidPollTimer = null
          this.rfidWriteVisible = false
          this.$message.success('RFID 写入成功！卡片已关联入库，等待上架')
          this.fetchData()
        }
      } catch (e) {
        console.warn('[RFID poll] error:', e)
        // 网络异常，继续轮询
      }
    }
  }
}
</script>

<style scoped lang="css">
.materials-container {
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

.material-detail {
  padding: 20px 0;
}

.detail-item {
  display: flex;
  align-items: flex-start;
  margin-bottom: 12px;
  line-height: 24px;
}

.detail-item label {
  font-weight: 600;
  color: var(--text-primary);
  width: 80px;
  margin-right: 12px;
  text-align: right;
  flex-shrink: 0;
}

.detail-item span {
  color: var(--text-secondary);
  flex: 1;
  word-break: break-all;
}

/* 修复图片上传组件的样式问题 */
::v-deep .avatar-uploader .el-upload {
    border: 1px dashed #d9d9d9;
    border-radius: 6px;
    cursor: pointer;
    position: relative;
    overflow: hidden;
    width: 100px;
    height: 100px;
}
::v-deep .avatar-uploader .el-upload:hover {
    border-color: #409EFF;
}
.avatar-uploader-icon {
    font-size: 28px;
    color: #8c939d;
    width: 100px;
    height: 100px;
    line-height: 100px;
    text-align: center;
}
.avatar {
    width: 100px;
    height: 100px;
    display: block;
    object-fit: contain; /* 确保图片缩放包含在框内 */
}

/* 统计卡片样式 */
.stats-row {
  margin-bottom: 24px;
}

.stat-card {
  border: none;
  border-radius: 8px;
  /* box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05); */
  transition: all 0.3s;
}

.stat-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.1);
}

.stat-card /deep/ .el-card__body {
  display: flex;
  align-items: center;
  padding: 20px;
}

.stat-icon-wrapper {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 16px;
  font-size: 24px;
}

.icon-blue {
  background: rgba(24, 144, 255, 0.1);
  color: #1890ff;
}

.icon-green {
  background: rgba(82, 196, 26, 0.1);
  color: #52c41a;
}

.icon-red {
  background: rgba(245, 34, 45, 0.1);
  color: #f5222d;
}

.icon-purple {
  background: rgba(114, 46, 209, 0.1);
  color: #722ed1;
}

.stat-content {
  flex: 1;
}

.stat-value {
  font-size: 24px;
  font-weight: 700;
  color: #333;
  line-height: 1.2;
  margin-bottom: 4px;
}

.stat-label {
  font-size: 13px;
  color: #999;
}

.rfid-tag-preview {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  background: #f5f7fa;
  border-radius: 6px;
  margin-top: 8px;
}

.rtag-label {
  font-size: 13px;
  color: #606266;
  white-space: nowrap;
}

.rtag-val {
  font-family: monospace;
  font-size: 14px;
  letter-spacing: 1px;
  color: #1890ff;
  background: #e6f7ff;
  padding: 2px 10px;
  border-radius: 4px;
  border: 1px solid #91d5ff;
}

.rtag-hint {
  font-size: 12px;
  color: #909399;
  margin-left: auto;
}

.rfid-waiting-view {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px 0 10px;
  text-align: center;
}

.rfid-waiting-icon-wrap {
  position: relative;
  width: 64px;
  height: 64px;
  margin-bottom: 16px;
}

.rfid-waiting-icon {
  font-size: 48px;
  color: #409EFF;
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}

.rfid-waiting-spin {
  font-size: 64px;
  color: #c0d9f5;
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}

.rfid-waiting-title {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
  margin: 0 0 10px;
}

.rfid-waiting-tag-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
  font-size: 13px;
  color: #606266;
}

.rfid-waiting-sub {
  font-size: 12px;
  color: #909399;
  margin: 0;
}
</style>
