<template>
  <div class="profile-container">
    <!-- 用户卡片 -->
    <div class="user-card">
      <div class="user-bg"></div>
      <div class="user-content">
        <div class="avatar-wrapper">
          <el-avatar 
            :size="80" 
            src="https://cube.elemecdn.com/0/88/03b0d39583f48206768a7534e55bcpng.png">
          </el-avatar>
          <div class="avatar-badge">
            <i class="el-icon-edit"></i>
          </div>
        </div>
        <div class="user-info">
          <h2 class="user-name">{{ userInfo.nickname }}</h2>
          <el-tag type="primary" effect="plain" size="small">{{ userInfo.role }}</el-tag>
          <p class="user-email">{{ userInfo.email }}</p>
          <p class="user-email" v-if="userInfo.createTime" style="font-size: 12px; margin-top: 4px;">加入时间: {{ userInfo.createTime.replace('T', ' ') }}</p>
        </div>
      </div>
    </div>

    <!-- 统计卡片 -->
    <div class="stats-row">
      <el-tooltip content="今日累计出入库及设备操作次数" placement="top" effect="light">
        <div class="stat-item">
          <span class="stat-value">{{ stats.todayOps }}</span>
          <span class="stat-label">今日操作 <i class="el-icon-info" style="font-size: 12px; color: #909399;"></i></span>
        </div>
      </el-tooltip>
      <div class="stat-divider"></div>
      <el-tooltip content="本周累计出入库及设备操作次数" placement="top" effect="light">
        <div class="stat-item">
          <span class="stat-value">{{ stats.weekLogins }}</span>
          <span class="stat-label">本周活跃 <i class="el-icon-info" style="font-size: 12px; color: #909399;"></i></span>
        </div>
      </el-tooltip>
      <div class="stat-divider"></div>
      <el-tooltip content="库存预警物料与离线设备总数" placement="top" effect="light">
        <div class="stat-item">
          <span class="stat-value">{{ stats.pending }}</span>
          <span class="stat-label">待处理 <i class="el-icon-info" style="font-size: 12px; color: #909399;"></i></span>
        </div>
      </el-tooltip>
    </div>

    <!-- 菜单列表 -->
    <div class="menu-section">
      <div class="section-title">账户设置</div>
      <div class="menu-card">
        <div class="menu-item" @click="handleMenu('个人信息')">
          <div class="menu-icon" style="background: rgba(93, 135, 255, 0.1);">
            <i class="el-icon-user" style="color: var(--primary-color);"></i>
          </div>
          <div class="menu-text">
            <span class="menu-title">个人信息</span>
            <span class="menu-desc">修改头像、昵称等个人资料</span>
          </div>
          <i class="el-icon-arrow-right"></i>
        </div>
        
        <div class="menu-item" @click="handleMenu('安全设置')">
          <div class="menu-icon" style="background: rgba(19, 222, 185, 0.1);">
            <i class="el-icon-lock" style="color: var(--success-color);"></i>
          </div>
          <div class="menu-text">
            <span class="menu-title">安全设置</span>
            <span class="menu-desc">密码修改、登录验证</span>
          </div>
          <i class="el-icon-arrow-right"></i>
        </div>
        
        <div class="menu-item" @click="handleMenu('消息通知')">
          <div class="menu-icon" style="background: rgba(255, 174, 31, 0.1);">
            <i class="el-icon-message" style="color: var(--warning-color);"></i>
          </div>
          <div class="menu-text">
            <span class="menu-title">消息通知</span>
            <span class="menu-desc">系统消息、预警通知设置</span>
          </div>
          <el-badge :value="3" class="menu-badge">
            <i class="el-icon-arrow-right"></i>
          </el-badge>
        </div>
      </div>
      
      <div class="section-title">其他</div>
      <div class="menu-card">
        <div class="menu-item" @click="handleMenu('操作日志')">
          <div class="menu-icon" style="background: rgba(124, 143, 172, 0.1);">
            <i class="el-icon-document" style="color: var(--text-secondary);"></i>
          </div>
          <div class="menu-text">
            <span class="menu-title">操作日志</span>
            <span class="menu-desc">查看系统操作历史记录</span>
          </div>
          <i class="el-icon-arrow-right"></i>
        </div>
        
        <div class="menu-item" @click="handleMenu('系统设置')">
          <div class="menu-icon" style="background: rgba(93, 135, 255, 0.1);">
            <i class="el-icon-setting" style="color: var(--primary-color);"></i>
          </div>
          <div class="menu-text">
            <span class="menu-title">系统设置</span>
            <span class="menu-desc">主题、语言、数据同步</span>
          </div>
          <i class="el-icon-arrow-right"></i>
        </div>
        
        <div class="menu-item" @click="handleMenu('关于')">
          <div class="menu-icon" style="background: rgba(83, 155, 255, 0.1);">
            <i class="el-icon-info" style="color: var(--info-color);"></i>
          </div>
          <div class="menu-text">
            <span class="menu-title">关于我们</span>
            <span class="menu-desc">版本信息、帮助文档</span>
          </div>
          <i class="el-icon-arrow-right"></i>
        </div>
      </div>
      
      <!-- 退出按钮 -->
      <el-button type="danger" plain class="logout-btn" @click="logout">
        <i class="el-icon-switch-button"></i>
        退出登录
      </el-button>
    </div>
  </div>
</template>

<script>
import { getUserById } from '@/api/sysUser'
import { getDashboardStats } from '@/api/stats'

export default {
  name: 'ProfileView',
  data() {
    return {
      userInfo: {
        username: '加载中...',
        nickname: '加载中...',
        role: '普通用户',
        email: 'user@warehouse.com',
        createTime: '',
        userId: null
      },
      stats: {
        todayOps: 0,
        weekLogins: 0,
        pending: 0
      }
    }
  },
  created() {
    this.initUserInfo()
    this.loadStats()
  },
  methods: {
    async loadStats() {
      try {
        const res = await getDashboardStats()
        if (res && res.code === 1) {
          this.stats = {
            todayOps: res.data.todayOps || 0,
            weekLogins: res.data.weekActive || 0, // Using weekActive from backend
            pending: res.data.pending || 0
          }
        }
      } catch (err) {
        console.error('Failed to load stats', err)
        // Fallback to random if failed (or just 0)
        this.stats = { todayOps: 0, weekLogins: 0, pending: 0 }
      }
    },
    async initUserInfo() {
      // 1. 从本地存储获取基础信息
      const userStr = localStorage.getItem('user')
      if (userStr) {
        try {
          const localUser = JSON.parse(userStr)
          this.userInfo.userId = localUser.userId
          this.userInfo.username = localUser.username
          // 优先显示昵称
          this.userInfo.nickname = localUser.nickname || localUser.username
          
          // 简单判断角色 (演示用)
          if (localUser.username === 'admin') {
            this.userInfo.role = '超级管理员'
          }

          // 2. 尝试获取最新信息
          if (localUser.userId) {
            try {
              const res = await getUserById(localUser.userId)
              if (res && res.code === 1) {
                const remoteUser = res.data
                this.userInfo.nickname = remoteUser.nickname || remoteUser.username
                this.userInfo.username = remoteUser.username
                this.userInfo.createTime = remoteUser.createTime
                this.userInfo.email = `${remoteUser.username}@warehouse.com`
                
                // 更新本地存储
                localStorage.setItem('user', JSON.stringify(remoteUser))
              }
            } catch (err) {
              console.error('Fetch user detail failed', err)
            }
          }
        } catch (e) {
          console.error('Failed to init user info', e)
        }
      }
    },
    handleMenu(item) {
      this.$message.info(`${item} 功能开发中...`)
    },
    logout() {
      this.$confirm('确定要退出登录吗？', '提示', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }).then(() => {
        localStorage.removeItem('isLogin')
        this.$router.push('/login')
        this.$message({
          type: 'success',
          message: '已安全退出!'
        })
      }).catch(() => {})
    }
  }
}
</script>

<style scoped>
.profile-container {
  max-width: 600px;
  margin: 0 auto;
}

/* User Card */
.user-card {
  background: var(--bg-white);
  border-radius: var(--radius-xl);
  overflow: hidden;
  box-shadow: var(--shadow-card);
  margin-bottom: 20px;
}

.user-bg {
  height: 100px;
  background: linear-gradient(135deg, var(--primary-color) 0%, var(--primary-light-1) 100%);
}

.user-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0 24px 24px;
  margin-top: -50px;
}

.avatar-wrapper {
  position: relative;
}

.avatar-wrapper .el-avatar {
  border: 4px solid var(--bg-white);
  box-shadow: var(--shadow-md);
}

.avatar-badge {
  position: absolute;
  bottom: 4px;
  right: 4px;
  width: 28px;
  height: 28px;
  background: var(--primary-color);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid var(--bg-white);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.avatar-badge:hover {
  transform: scale(1.1);
}

.avatar-badge i {
  font-size: 12px;
  color: #fff;
}

.user-info {
  text-align: center;
  margin-top: 16px;
}

.user-name {
  font-size: 22px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0 0 8px;
}

.user-email {
  font-size: 13px;
  color: var(--text-secondary);
  margin: 8px 0 0;
}

/* Stats Row */
.stats-row {
  display: flex;
  align-items: center;
  justify-content: space-around;
  background: var(--bg-white);
  border-radius: var(--radius-lg);
  padding: 20px;
  margin-bottom: 20px;
  box-shadow: var(--shadow-card);
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
}

.stat-value {
  font-size: 24px;
  font-weight: 700;
  color: var(--primary-color);
}

.stat-label {
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 4px;
}

.stat-divider {
  width: 1px;
  height: 40px;
  background: var(--border-light);
}

/* Menu Section */
.menu-section {
  margin-bottom: 20px;
}

.section-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
  margin: 20px 0 12px;
  padding-left: 4px;
}

.menu-card {
  background: var(--bg-white);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-card);
  overflow: hidden;
}

.menu-item {
  display: flex;
  align-items: center;
  padding: 16px 20px;
  cursor: pointer;
  transition: all var(--transition-fast);
  border-bottom: 1px solid var(--border-light);
}

.menu-item:last-child {
  border-bottom: none;
}

.menu-item:hover {
  background: var(--bg-container);
}

.menu-icon {
  width: 44px;
  height: 44px;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.menu-icon i {
  font-size: 20px;
}

.menu-text {
  flex: 1;
  margin-left: 14px;
  display: flex;
  flex-direction: column;
}

.menu-title {
  font-size: 15px;
  font-weight: 500;
  color: var(--text-primary);
}

.menu-desc {
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 2px;
}

.menu-item > .el-icon-arrow-right {
  color: var(--text-placeholder);
  font-size: 14px;
  transition: all var(--transition-fast);
}

.menu-item:hover > .el-icon-arrow-right {
  color: var(--primary-color);
  transform: translateX(4px);
}

.menu-badge {
  display: flex;
  align-items: center;
}

.menu-badge >>> .el-badge__content {
  font-size: 10px;
}

/* Logout Button */
.logout-btn {
  width: 100%;
  height: 48px;
  margin-top: 24px;
  border-radius: var(--radius-md);
  font-size: 15px;
  font-weight: 500;
}

/* Responsive */
@media (max-width: 640px) {
  .profile-container {
    margin: 0;
  }
  
  .user-card,
  .menu-card,
  .stats-row {
    border-radius: var(--radius-md);
  }
}
</style>
