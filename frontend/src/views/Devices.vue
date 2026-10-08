<template>
  <div class="devices-container">
    <!-- 页面头 -->
    <div class="page-header">
      <div class="header-left">
        <h2 class="page-title">设备管理</h2>
        <p class="page-subtitle">监控和管理所有物联网设备</p>
      </div>
      <div class="header-right">
        <el-button type="primary" icon="el-icon-plus" @click="showAddDevice">新增设备</el-button>
        <el-button icon="el-icon-refresh" @click="refreshDevices">刷新</el-button>
      </div>
    </div>

    <!-- 设备统计 -->
    <div class="stats-grid">
      <div class="stat-card" v-for="(stat, index) in deviceStats" :key="index">
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

    <!-- 设备列表 -->
    <el-card class="list-card">
      <div slot="header" class="card-header">
        <span class="card-title">设备列表</span>
        <div class="header-actions">
          <el-input 
            v-model="searchText" 
            placeholder="搜索设备名称或ID"
            style="width: 220px; margin-right: 10px;"
            prefix-icon="el-icon-search"
            @keyup.enter="searchDevices">
          </el-input>
          <el-select v-model="filterType" placeholder="设备类型" style="width: 150px; margin-right: 10px;">
            <el-option label="全部" value=""></el-option>
            <el-option label="传感器" value="sensor"></el-option>
            <el-option label="网关" value="gateway"></el-option>
            <el-option label="RFID读头" value="rfid_reader"></el-option>
          </el-select>
          <el-select v-model="filterStatus" placeholder="在线状态" style="width: 150px;">
            <el-option label="全部状态" value=""></el-option>
            <el-option label="在线" value="1"></el-option>
            <el-option label="离线" value="0"></el-option>
          </el-select>
        </div>
      </div>

      <el-table 
        :data="paginatedDevices"
        stripe
        style="width: 100%">
        <el-table-column label="设备ID" prop="deviceId" width="180"></el-table-column>
        <el-table-column label="设备名称" prop="deviceName" min-width="150"></el-table-column>
        <el-table-column label="设备类型" width="120">
          <template slot-scope="scope">
            <el-tag :type="getDeviceTypeTag(scope.row.deviceType)">
              {{ getDeviceTypeLabel(scope.row.deviceType) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="部署位置" prop="location" min-width="150"></el-table-column>
        <el-table-column label="在线状态" width="120">
          <template slot-scope="scope">
            <el-tag :type="scope.row.status === 1 ? 'success' : 'danger'">
              <i :class="scope.row.status === 1 ? 'el-icon-success' : 'el-icon-circle-close'"></i>
              {{ scope.row.status === 1 ? '在线' : '离线' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="280" fixed="right">
          <template slot-scope="scope">
            <el-button-group>
              <el-button 
                  v-if="isAdmin"
                  type="warning" 
                  size="mini" 
                  @click="openAssignDialog(scope.row)" 
                  icon="el-icon-user" 
                  title="分配">
              </el-button>
              
              <el-button 
                type="primary" 
                size="mini" 
                @click="editDevice(scope.row)"
                icon="el-icon-edit"
                title="编辑">
              </el-button>
              
              <el-button 
                type="info" 
                size="mini" 
                @click="viewDeviceDetail(scope.row)"
                icon="el-icon-info"
                title="详情">
              </el-button>
              
              <el-button 
                type="danger" 
                size="mini" 
                @click="deleteDevice(scope.row)"
                icon="el-icon-delete"
                title="删除">
              </el-button>
            </el-button-group>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-wrapper">
        <el-pagination
          :current-page.sync="currentPage"
          :page-size="pageSize"
          :total="filteredDevices.length"
          @current-change="currentPage = $event"
          layout="total, sizes, prev, pager, next, jumper"
          :page-sizes="[10, 20, 50, 100]">
        </el-pagination>
      </div>
    </el-card>

    <!-- 设备分配对话框 -->
    <el-dialog
      title="设备用户管理"
      :visible.sync="assignDialogVisible"
      width="500px">
      
      <div v-if="currentAssignDevice" style="margin-bottom: 20px;">
          <p>当前设备：<strong>{{ currentAssignDevice.deviceName }}</strong></p>
          <div style="margin-top: 10px;">
              <el-select 
                  v-model="userSearch" 
                  filterable 
                  placeholder="搜索用户以添加..."
                  style="width: 70%; margin-right: 10px;">
                  <el-option
                      v-for="user in filteredUserList"
                      :key="user.userId"
                      :label="user.nickname ? (user.nickname + ' (' + user.username + ')') : user.username"
                      :value="user.userId">
                  </el-option>
              </el-select>
              <el-button type="primary" @click="addUserToDevice">添加授权</el-button>
          </div>
      </div>

      <el-table :data="assignedUsersList" border style="width: 100%" height="300" empty-text="暂无授权用户">
          <el-table-column prop="username" label="用户名" width="120"></el-table-column>
          <el-table-column prop="nickname" label="昵称"></el-table-column>
          <el-table-column label="操作" width="100">
              <template slot-scope="scope">
                  <el-button type="text" style="color: #f56c6c;" @click="removeUserFromDevice(scope.row)">移除</el-button>
              </template>
          </el-table-column>
      </el-table>

    </el-dialog>

    <!-- 编辑/新增设备对话框 -->
    <el-dialog 
      :title="isEditMode ? '编辑设备' : '新增设备'" 
      :visible.sync="deviceDialogVisible"
      width="600px"
      @close="resetDeviceForm">
      <el-form :model="deviceForm" :rules="deviceRules" ref="deviceForm" label-width="100px">
        <el-form-item label="设备ID" prop="deviceId">
          <el-input v-model="deviceForm.deviceId" :disabled="isEditMode" placeholder="自动生成"></el-input>
        </el-form-item>
        <el-form-item label="设备名称" prop="deviceName">
          <el-input v-model="deviceForm.deviceName" placeholder="请输入设备名称"></el-input>
        </el-form-item>
        <el-form-item label="设备类型" prop="deviceType">
          <el-select v-model="deviceForm.deviceType" placeholder="请选择设备类型">
            <el-option label="传感器" value="sensor"></el-option>
            <el-option label="网关" value="gateway"></el-option>
            <el-option label="RFID读头" value="rfid_reader"></el-option>
          </el-select>
        </el-form-item>
        <el-form-item label="部署位置" prop="location">
          <el-input v-model="deviceForm.location" placeholder="请输入部署位置"></el-input>
        </el-form-item>
        <el-form-item label="在线状态">
          <div style="display: flex; align-items: center;">
            <el-switch 
              v-model="deviceForm.status"
              :active-value="1"
              :inactive-value="0"
              disabled>
            </el-switch>
            <span style="margin-left: 10px; color: var(--text-secondary); font-size: 12px;">
              {{ deviceForm.status === 1 ? '在线' : '离线' }} (系统自动检测)
            </span>
          </div>
        </el-form-item>
      </el-form>
      <span slot="footer" class="dialog-footer">
        <el-button @click="deviceDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveDevice">保存</el-button>
      </span>
    </el-dialog>

    <!-- 设备详情对话框 -->
    <el-dialog title="设备详情" :visible.sync="detailDialogVisible" width="700px">
      <div v-if="selectedDevice" class="device-detail">
        <el-row :gutter="20">
          <el-col :span="12">
            <div class="detail-item">
              <label>设备ID:</label>
              <span>{{ selectedDevice.deviceId }}</span>
            </div>
            <div class="detail-item">
              <label>设备名称:</label>
              <span>{{ selectedDevice.deviceName }}</span>
            </div>
            <div class="detail-item">
              <label>设备类型:</label>
              <el-tag :type="getDeviceTypeTag(selectedDevice.deviceType)">
                {{ getDeviceTypeLabel(selectedDevice.deviceType) }}
              </el-tag>
            </div>
          </el-col>
          <el-col :span="12">
            <div class="detail-item">
              <label>部署位置:</label>
              <span>{{ selectedDevice.location }}</span>
            </div>
            <div class="detail-item">
              <label>在线状态:</label>
              <el-tag :type="selectedDevice.status === 1 ? 'success' : 'danger'">
                {{ selectedDevice.status === 1 ? '在线' : '离线' }}
              </el-tag>
            </div>
            <div class="detail-item">
              <label>创建时间:</label>
              <span>{{ selectedDevice.createTime }}</span>
            </div>
          </el-col>
        </el-row>
        <el-divider></el-divider>
        <div class="detail-section">
          <h4>最新传感器数据</h4>
          <el-row :gutter="20" v-if="selectedDeviceData">
             <el-col :span="8">
              <div class="sensor-data-card">
                <span class="label">温度:</span>
                <span class="value">{{ selectedDeviceData.temperature }} °C</span>
              </div>
            </el-col>
            <el-col :span="8">
              <div class="sensor-data-card">
                <span class="label">湿度:</span>
                <span class="value">{{ selectedDeviceData.humidity }} %</span>
              </div>
            </el-col>
            <el-col :span="8">
              <div class="sensor-data-card">
                <span class="label">气压:</span>
                <span class="value">{{ selectedDeviceData.pressure || '-' }} hPa</span>
              </div>
            </el-col>
            
            <el-col :span="8" style="margin-top: 10px;">
              <div class="sensor-data-card">
                <span class="label">烟雾浓度:</span>
                <span class="value" :style="{ color: selectedDeviceData.smokeDensity > 100 ? 'red' : '' }">
                  {{ selectedDeviceData.smokeDensity }}
                </span>
              </div>
            </el-col>
            <el-col :span="8" style="margin-top: 10px;">
              <div class="sensor-data-card">
                <span class="label">光照强度:</span>
                <span class="value">{{ selectedDeviceData.lux || '-' }} Lux</span>
              </div>
            </el-col>
             <el-col :span="8" style="margin-top: 10px;">
              <div class="sensor-data-card">
                <span class="label">露点温度:</span>
                <span class="value">{{ selectedDeviceData.dewPoint || '-' }} °C</span>
              </div>
            </el-col>

            <el-col :span="24" style="margin-top: 10px;">
              <div class="sensor-data-card">
                 <span class="label">上报时间:</span>
                 <span class="value" style="font-size: 12px;">{{ selectedDeviceData.formattedTime || selectedDeviceData.reportTime }}</span>
              </div>
            </el-col>
          </el-row>
          <el-row :gutter="20" v-else>
             <el-col :span="24">
              <div class="sensor-data-card" style="justify-content: center;">
                <span class="label">暂无数据</span>
              </div>
            </el-col>
          </el-row>
        </div>
      </div>
      <span slot="footer" class="dialog-footer">
        <el-button @click="detailDialogVisible = false">关闭</el-button>
        <el-button type="primary" @click="editDevice(selectedDevice)">编辑</el-button>
      </span>
    </el-dialog>
  </div>
</template>

<script>
// 引入 API
import { getAllDevices, addDevice, updateDevice, deleteDevice, getLatestSensorData, assignDevice, getAssignedUsers, revokeAccess } from '@/api/device';
import { getAllUsers } from '@/api/sysUser';

export default {
  name: 'DeviceList',
  data() {
    return {
      searchText: '',
      filterType: '',
      filterStatus: '',
      currentPage: 1,
      pageSize: 10,
      total: 0,
      isEditMode: false,
      deviceDialogVisible: false,
      detailDialogVisible: false,
      selectedDevice: null,
      selectedDeviceData: null,
      
      // Assignment Dialog
      assignDialogVisible: false,
      currentUserList: [], // All users
      currentAssignDevice: null,
      assignLoading: false,
      assignedUserIds: [], // Currently assigned user IDs
      userSearch: '', // Bound to el-select
      
      deviceForm: {
        deviceId: '',
        deviceName: '',
        deviceType: 'sensor',
        location: '',
        status: 1
      },
      deviceRules: {
        deviceId: [
          { required: true, message: '请输入设备ID', trigger: 'blur' }
        ],
        deviceName: [
          { required: true, message: '请输入设备名称', trigger: 'blur' }
        ],
        deviceType: [
          { required: true, message: '请选择设备类型', trigger: 'change' }
        ]
      },
      // 初始化为空数组，等待接口数据
      devices: [],
    }
  },
  computed: {
    isAdmin() {
       try {
          const u = JSON.parse(localStorage.getItem('user'));
          return u && u.role === 'admin';
       } catch (e) {
          return false; 
       }
    },
    // 动态计算统计信息
    deviceStats() {
      const total = this.devices.length;
      const online = this.devices.filter(d => d.status === 1).length;
      const offline = total - online;
      // 暂时写死告警数为0，后续接入告警接口
      const warning = 0;

      return [
        {
          label: '总设备数',
          value: total,
          icon: 'el-icon-cpu',
          color: '#0066ff',
          bgColor: 'rgba(0, 102, 255, 0.1)'
        },
        {
          label: '在线设备',
          value: online,
          icon: 'el-icon-success',
          color: '#13deb9',
          bgColor: 'rgba(19, 222, 185, 0.1)'
        },
        {
          label: '离线设备',
          value: offline,
          icon: 'el-icon-circle-close',
          color: '#f5222d',
          bgColor: 'rgba(245, 34, 45, 0.1)'
        },
        {
          label: '异常告警',
          value: warning,
          icon: 'el-icon-warning',
          color: '#ffae1f',
          bgColor: 'rgba(255, 174, 31, 0.1)'
        }
      ];
    },
    filteredDevices() {
      let filtered = this.devices
      
      if (this.searchText) {
        const lower = this.searchText.toLowerCase();
        filtered = filtered.filter(d => 
          (d.deviceId && d.deviceId.toLowerCase().includes(lower)) ||
          (d.deviceName && d.deviceName.toLowerCase().includes(lower))
        )
      }
      
      if (this.filterType) {
        filtered = filtered.filter(d => d.deviceType === this.filterType)
      }
      
      if (this.filterStatus !== '') {
        const statusVal = parseInt(this.filterStatus);
        filtered = filtered.filter(d => d.status === statusVal)
      }
      
      return filtered
    },
    paginatedDevices() {
      return this.filteredDevices.slice((this.currentPage - 1) * this.pageSize, this.currentPage * this.pageSize)
    },
    // Filter users that are NOT yet assigned
    filteredUserList() {
        if (!this.currentUserList) return [];
        const assignedIds = new Set(this.assignedUserIds || []);
        return this.currentUserList.filter(u => !assignedIds.has(u.userId));
    },
    // Get full user objects for assigned IDs
    assignedUsersList() {
        if (!this.currentUserList) return [];
        const idSet = new Set(this.assignedUserIds || []);
        return this.currentUserList.filter(u => idSet.has(u.userId));
    }
  },
  created() {
    this.refreshDevices();
  },
  methods: {
    getDeviceTypeLabel(type) {
      const labels = {
        'sensor': '传感器',
        'gateway': '网关',
        'rfid_reader': 'RFID读头'
      }
      return labels[type] || type
    },
    getDeviceTypeTag(type) {
      const tags = {
        'sensor': 'success',
        'gateway': 'primary',
        'rfid_reader': 'info'
      }
      return tags[type] || 'default'
    },
    showAddDevice() {
      this.isEditMode = false
      this.deviceForm = {
        deviceId: '',
        deviceName: '',
        deviceType: 'sensor',
        location: '',
        status: 1
      }
      this.deviceDialogVisible = true
    },
    editDevice(device) {
      this.isEditMode = true
      // 深度拷贝对象
      this.deviceForm = { ...device }
      
      // 注意：el-switch 已经配置了 active-value=1，所以不需要手动转换 status 为 boolean
      
      // 如果是编辑模式，删除 createTime，防止日期格式问题
      if (this.deviceForm.createTime) {
          delete this.deviceForm.createTime;
      }
      
      this.deviceDialogVisible = true
    },
    // 保存（新增或编辑）
    saveDevice() {
      this.$refs.deviceForm.validate((valid) => {
        if (valid) {
          const api = this.isEditMode ? updateDevice : addDevice;
          
          // 构造提交数据
          const submitData = { ...this.deviceForm };
          
          // 双重保险：确保 status 是 1 或 0
          submitData.status = (submitData.status === 1 || submitData.status === true) ? 1 : 0;
          
          console.log('Submitting:', submitData);
          
          api(submitData).then(res => {
            console.log('API Response:', res);
            if (res.code === 200 || res.code === 1) {
              this.$message.success(this.isEditMode ? '编辑成功' : '添加成功')
              this.deviceDialogVisible = false
              this.refreshDevices();
            } else {
              this.$message.error(res.msg || res.message || '操作失败');
            }
          }).catch(err => {
            console.error('API Error:', err);
            this.$message.error('请求出错: ' + err.message);
          });
        } else {
            console.warn('Form validation failed');
            this.$message.warning('请检查表单填写是否完整');
            return false;
        }
      })
    },
    resetDeviceForm() {
      this.$refs.deviceForm.clearValidate()
    },
    viewDeviceDetail(device) {
      this.selectedDevice = device;
      this.detailDialogVisible = true;
      this.selectedDeviceData = null;
      
      if (device.deviceId) {
         getLatestSensorData(device.deviceId).then(res => {
             // 兼容 code=1
             if ((res.code === 200 || res.code === 1) && res.data) {
                 this.selectedDeviceData = res.data;
                 
                 // 解析 extraInfo 字符串为对象
                 if ((res.data.extraInfo)) {
                     try {
                         const extra = JSON.parse(res.data.extraInfo);
                         // 合并到 data 对象里方便展示
                         this.selectedDeviceData = { ...this.selectedDeviceData, ...extra };
                     } catch (e) {
                         console.error("Failed to parse extraInfo", e);
                     }
                 }
                 
                 // 格式化时间，优先用 reportTime
                 if (this.selectedDeviceData.reportTime) {
                      this.selectedDeviceData.formattedTime = this.selectedDeviceData.reportTime.replace('T', ' ');
                 }
             }
         });
      }
    },
    deleteDevice(device) {
      this.$confirmDelete(
        `确认删除设备 <span style="color: #f56c6c; font-weight: bold;">${device.deviceName || device.deviceId}</span> 吗？`,
        '此操作不可恢复，请谨慎操作！'
      ).then(() => {
        deleteDevice(device.deviceId).then(res => {
          if (res.code === 200 || res.code === 1) {
            this.$message.success('删除成功')
            this.refreshDevices();
          } else {
            this.$message.error(res.message || '删除失败')
          }
        });
      }).catch(() => {})
    },
    searchDevices() {
      this.currentPage = 1
    },
    refreshDevices() {
      getAllDevices().then(res => {
        // 兼容 code=1 (后端) 和 code=200
        if (res.code === 200 || res.code === 1) {
          this.devices = res.data;
          this.$message.success('数据已刷新');
        } else {
          this.$message.error(res.msg || res.message || '获取设备列表失败');
        }
      }).catch(err => {
        console.error(err);
        this.$message.error('网络错误，无法获取设备列表');
      });
    },

    openAssignDialog(device) {
        this.currentAssignDevice = device;
        this.assignDialogVisible = true;
        this.userSearch = '';
        this.assignedUserIds = [];
        
        // 1. Get all users
        if (!this.currentUserList || this.currentUserList.length === 0) {
            getAllUsers().then(res => {
                if (res.code === 200 || res.code === 1) {
                    this.currentUserList = res.data;
                }
            });
        }
        
        // 2. Get currently assigned users for this device
        getAssignedUsers(device.deviceId).then(res => {
             if (res.code === 200 || res.code === 1) {
                 this.assignedUserIds = res.data;
             }
        });
    },
    // ... rest of methods
    addUserToDevice() {

        if (!this.userSearch) {
             this.$message.warning('请选择用户');
             return;
        }
        
        const userId = this.userSearch; // bound by v-model
        
        assignDevice(this.currentAssignDevice.deviceId, userId).then(res => {
            if (res.code === 200 || res.code === 1) {
                this.$message.success('授权成功');
                this.assignedUserIds.push(userId);
                this.userSearch = ''; // Clear selection
            } else {
                this.$message.error(res.msg || '授权失败');
            }
        });
    },
    removeUserFromDevice(user) {
        this.$confirmDelete(
            `确认移除用户 <span style="color: #f56c6c;">${user.nickname || user.username}</span> 的权限吗？`
        ).then(() => {
            revokeAccess(this.currentAssignDevice.deviceId, user.userId).then(res => {
                if (res.code === 200 || res.code === 1) {
                    this.$message.success('已移除授权');
                    const idx = this.assignedUserIds.indexOf(user.userId);
                    if (idx > -1) this.assignedUserIds.splice(idx, 1);
                } else {
                    this.$message.error(res.msg || '移除失败');
                }
            });
        }).catch(() => {});
    }
  }
}
</script>

<style scoped lang="css">
.devices-container {
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
}

.stat-value {
  font-size: 24px;
  font-weight: 600;
  color: var(--text-primary);
}

.stat-label {
  font-size: 14px;
  color: var(--text-secondary);
  margin-top: 4px;
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

.device-detail {
  padding: 20px 0;
}

.detail-item {
  margin-bottom: 16px;
}

.detail-item label {
  font-weight: 600;
  color: var(--text-primary);
  display: block;
  margin-bottom: 4px;
}

.detail-item span {
  color: var(--text-secondary);
}

.detail-section h4 {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 20px 0 12px;
}

.sensor-data-card {
  background: var(--bg-secondary);
  padding: 12px;
  border-radius: 4px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.sensor-data-card .label {
  color: var(--text-secondary);
  font-weight: 500;
}

.sensor-data-card .value {
  color: var(--primary-color);
  font-weight: 600;
}
</style>
