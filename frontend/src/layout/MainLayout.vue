<template>
  <el-container class="app-layout">
    <!-- 侧边栏 -->
    <el-aside :width="isCollapse ? '64px' : '240px'" class="sidebar">
      <!-- Logo 区域 -->
      <div class="logo-section" @click="$router.push('/dashboard')">
        <div class="logo-icon">
          <i class="el-icon-s-grid"></i>
        </div>
        <transition name="fade-text">
          <span v-show="!isCollapse" class="logo-text">智能仓储系统</span>
        </transition>
      </div>
      
      <!-- 菜单 -->
      <el-menu
        :default-active="$route.path"
        :collapse="isCollapse"
        :collapse-transition="false"
        background-color="#ffffff"
        text-color="#303133"
        active-text-color="#409eff"
        :unique-opened="true"
        router
        class="sidebar-menu">
        
        <!-- 监控中心 -->
        <el-submenu index="monitor">
          <template slot="title">
            <i class="el-icon-monitor"></i>
            <span slot="title">监控中心</span>
          </template>
          <el-menu-item index="/dashboard">
            <i class="el-icon-data-board"></i>
            <span slot="title">仪表盘</span>
          </el-menu-item>
          <el-menu-item index="/alerts">
            <i class="el-icon-message-solid"></i>
            <span slot="title">告警中心</span>
          </el-menu-item>
        </el-submenu>

        <!-- 设备管理 -->
        <el-submenu index="device">
          <template slot="title">
            <i class="el-icon-cpu"></i>
            <span slot="title">设备管理</span>
          </template>
          <el-menu-item index="/devices">
            <i class="el-icon-s-operation"></i>
            <span slot="title">设备列表</span>
          </el-menu-item>
          <el-menu-item index="/device-config">
            <i class="el-icon-setting"></i>
            <span slot="title">设备控制</span>
          </el-menu-item>
        </el-submenu>

        <!-- 库存管理 -->
        <el-submenu index="storage">
          <template slot="title">
            <i class="el-icon-box"></i>
            <span slot="title">库存管理</span>
          </template>
          <el-menu-item index="/materials">
            <i class="el-icon-s-cooperation"></i>
            <span slot="title">物资列表</span>
          </el-menu-item>
          <el-menu-item index="/stock">
            <i class="el-icon-s-data"></i>
            <span slot="title">库存统计</span>
          </el-menu-item>
          <el-menu-item index="/locations">
            <i class="el-icon-location"></i>
            <span slot="title">库位视图</span>
          </el-menu-item>
        </el-submenu>

        <!-- 数据分析 -->
        <el-submenu index="analysis">
          <template slot="title">
            <i class="el-icon-pie-chart"></i>
            <span slot="title">数据分析</span>
          </template>
          <el-menu-item index="/analytics">
            <i class="el-icon-s-marketing"></i>
            <span slot="title">数据报表</span>
          </el-menu-item>
          <el-menu-item index="/history">
            <i class="el-icon-time"></i>
            <span slot="title">历史记录</span>
          </el-menu-item>
        </el-submenu>

        <!-- 系统设置 -->
        <el-submenu index="system">
          <template slot="title">
            <i class="el-icon-setting"></i>
            <span slot="title">系统设置</span>
          </template>
          <el-menu-item index="/profile">
            <i class="el-icon-user"></i>
            <span slot="title">个人中心</span>
          </el-menu-item>
        </el-submenu>
      </el-menu>
      
      <!-- 折叠按钮 -->
      <div class="collapse-btn" @click="toggleCollapse">
        <i :class="isCollapse ? 'el-icon-s-unfold' : 'el-icon-s-fold'"></i>
      </div>
    </el-aside>
    
    <!-- 主体区域 -->
    <el-container class="main-wrapper">
      <!-- 顶部导航栏 -->
      <el-header height="60px" class="header-bar">
        <div class="header-left">
          <!-- 面包屑导航 -->
          <el-breadcrumb separator="/">
            <el-breadcrumb-item :to="{ path: '/dashboard' }">
              <i class="el-icon-s-home"></i>
            </el-breadcrumb-item>
            <el-breadcrumb-item>{{ currentTitle }}</el-breadcrumb-item>
          </el-breadcrumb>
        </div>
        
        <div class="header-right">
          <!-- 搜索 -->
          <div class="header-item search-btn" @click="showSearch = !showSearch">
            <i class="el-icon-search"></i>
          </div>
          
          <!-- 全屏 -->
          <el-tooltip content="全屏" placement="bottom" :open-delay="300">
            <div class="header-item" @click="toggleFullScreen">
              <i :class="isFullScreen ? 'el-icon-copy-document' : 'el-icon-full-screen'"></i>
            </div>
          </el-tooltip>
          
          <!-- 通知 -->
          <el-tooltip content="通知" placement="bottom" :open-delay="300">
            <div class="header-item">
              <el-badge :is-dot="hasNotification" class="badge-item">
                <i class="el-icon-bell"></i>
              </el-badge>
            </div>
          </el-tooltip>
          
          <!-- 用户头像和下拉菜单 -->
          <el-dropdown class="user-dropdown" trigger="click" @command="handleCommand">
            <div class="user-info">
              <el-avatar 
                :size="36" 
                src="https://cube.elemecdn.com/0/88/03b0d39583f48206768a7534e55bcpng.png"
                class="user-avatar">
              </el-avatar>
              <div class="user-detail">
                <span class="user-name">{{ userInfo.nickname }}</span>
                <span class="user-role">{{ userInfo.username }}</span>
              </div>
              <i class="el-icon-arrow-down"></i>
            </div>
            <el-dropdown-menu slot="dropdown" class="user-dropdown-menu">
              <el-dropdown-item command="profile">
                <i class="el-icon-user"></i>
                <span>个人中心</span>
              </el-dropdown-item>
              <el-dropdown-item command="settings">
                <i class="el-icon-setting"></i>
                <span>系统设置</span>
              </el-dropdown-item>
              <el-dropdown-item divided command="logout" class="logout-item">
                <i class="el-icon-switch-button" style="color: var(--danger-color);"></i>
                <span style="color: var(--danger-color);">退出登录</span>
              </el-dropdown-item>
            </el-dropdown-menu>
          </el-dropdown>
        </div>
      </el-header>
      
      <!-- 内容区 -->
      <el-main class="main-content">
        <transition name="fade-page" mode="out-in">
          <router-view class="page-view" />
        </transition>
      </el-main>
    </el-container>
  </el-container>
</template>

<script>
export default {
  name: 'MainLayout',
  data() {
    return {
      isCollapse: false,
      isFullScreen: false,
      showSearch: false,
      hasNotification: true,
      pageTitle: {
        '/dashboard': '仪表盘',
        '/alerts': '告警中心',
        '/devices': '设备列表',
        '/device-config': '设备控制',
        '/materials': '物资列表',
        '/category': '物资种类',
        '/stock': '库存统计',
        '/locations': '库位视图',
        '/analytics': '数据报表',
        '/history': '历史记录',
        '/profile': '个人中心'
      },
      userInfo: {
        nickname: '管理员',
        username: 'admin'
      }
    }
  },
  created() {
    this.getUserInfo()
  },
  computed: {
    sidebarWidth() {
      return this.isCollapse ? '64px' : '240px'
    },
    currentTitle() {
      return this.pageTitle[this.$route.path] || '首页'
    },
    activeMenu() {
      return this.$route.path
    }
  },
  mounted() {
    this.$watch('$route', () => {
      this.$forceUpdate()
    })
  },
  methods: {
    getUserInfo() {
      const userStr = localStorage.getItem('user')
      if (userStr) {
        try {
          const user = JSON.parse(userStr)
          if (user) {
            this.userInfo = {
              nickname: user.nickname || user.username || '管理员',
              username: user.username || 'admin'
            }
          }
        } catch (e) {
          console.error('Failed to parse user info', e)
        }
      }
    },
    toggleCollapse() {
      this.isCollapse = !this.isCollapse
    },
    toggleFullScreen() {
      const elem = document.documentElement
      if (!this.isFullScreen) {
        if (elem.requestFullscreen) {
          elem.requestFullscreen()
        } else if (elem.webkitRequestFullscreen) {
          elem.webkitRequestFullscreen()
        } else if (elem.mozRequestFullScreen) {
          elem.mozRequestFullScreen()
        } else if (elem.msRequestFullscreen) {
          elem.msRequestFullscreen()
        }
        this.isFullScreen = true
      } else {
        if (document.exitFullscreen) {
          document.exitFullscreen()
        } else if (document.webkitExitFullscreen) {
          document.webkitExitFullscreen()
        } else if (document.mozCancelFullScreen) {
          document.mozCancelFullScreen()
        } else if (document.msExitFullscreen) {
          document.msExitFullscreen()
        }
        this.isFullScreen = false
      }
    },
    refreshPage() {
      this.$message.info('页面刷新中...')
      setTimeout(() => {
        location.reload()
      }, 500)
    },
    handleCommand(command) {
      switch (command) {
        case 'profile':
          this.$router.push('/profile')
          break
        case 'settings':
          this.$message.info('系统设置开发中...')
          break
        case 'logout':
          // 清除所有登录信息
          localStorage.removeItem('isLogin')
          localStorage.removeItem('token')
          localStorage.removeItem('user')
          
          this.$router.push('/login')
          this.$message.success('已退出登录')
          break
      }
    }
  }
}
</script>

<style scoped>
/* ========================================
   App Layout - Art Design Pro Style
   ======================================== */
.app-layout {
  height: 100vh;
  width: 100%;
  display: flex;
}

/* ========================================
   Sidebar Syles (Clean Light Style)
   ======================================== */
.sidebar {
  background: #ffffff; /* Light background */
  display: flex;
  flex-direction: column;
  transition: width var(--transition-normal) var(--ease-smooth);
  overflow: hidden;
  position: relative;
  z-index: 1001;
  box-shadow: 2px 0 8px rgba(0, 0, 0, 0.05); /* Softer shadow */
  border-right: 1px solid #e6e6e6;
}

/* Logo Section */
.logo-section {
  height: 64px;
  display: flex;
  align-items: center;
  padding: 0 16px;
  cursor: pointer;
  background: #ffffff; /* Match sidebar */
  border-bottom: 1px solid #e6e6e6;
  flex-shrink: 0;
  overflow: hidden;
}

.logo-section:hover {
  background-color: #f5f7fa;
}

.logo-icon {
  width: 32px;
  height: 32px;
  background: var(--primary-color);
  border-radius: 4px; 
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-right: 12px;
}

.logo-icon i {
  font-size: 18px;
  color: #fff;
}

.logo-text {
  font-size: 18px;
  font-weight: 600;
  color: #303133; /* Dark text */
  white-space: nowrap;
  letter-spacing: 0.5px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
}

/* Sidebar Menu */
.sidebar-menu {
  flex: 1;
  border-right: none !important;
  padding-top: 10px;
  overflow-y: auto;
  overflow-x: hidden;
  background-color: #ffffff; 
}

.sidebar-menu::-webkit-scrollbar {
  width: 6px;
  background-color: transparent;
}

.sidebar-menu::-webkit-scrollbar-thumb {
  background-color: rgba(0, 0, 0, 0.1); /* Darker scrollbar for light theme */
  border-radius: 3px;
}

/* Menu Group Title (Deprecated but kept for reference) */
.menu-group-title {
  display: none;
}

/* Base Menu Item Style (applied to both items and submenu titles) */
.sidebar-menu .el-menu-item,
.sidebar-menu .el-submenu__title {
  height: 50px !important;
  line-height: 50px !important;
  margin: 4px 0;
  border-radius: 0; 
  transition: all 0.3s cubic-bezier(0.645, 0.045, 0.355, 1);
  color: #606266;
}

/* Icon Style */
.sidebar-menu .el-menu-item i,
.sidebar-menu .el-submenu__title i {
  margin-right: 10px;
  font-size: 18px;
  width: 24px;
  text-align: center;
  color: #909399;
  transition: color 0.3s;
  vertical-align: middle;
}

/* Hover State */
.sidebar-menu .el-menu-item:hover,
.sidebar-menu .el-submenu__title:hover {
  color: var(--primary-color) !important;
  background-color: #ecf5ff !important;
}

.sidebar-menu .el-menu-item:hover i,
.sidebar-menu .el-submenu__title:hover i {
  color: var(--primary-color);
}

/* Active State (Leaf Items) */
.sidebar-menu .el-menu-item.is-active {
  background-color: #e6f7ff !important;
  color: var(--primary-color) !important;
  border-right: 3px solid var(--primary-color);
}

.sidebar-menu .el-menu-item.is-active i {
  color: var(--primary-color) !important;
}

/* Submenu Arrow Icon */
.sidebar-menu .el-submenu__title .el-submenu__icon-arrow {
  font-size: 12px;
  margin-top: -6px; 
}

/* Nested Menu Items Indentation Adjustment */
.sidebar-menu .el-submenu .el-menu-item {
  height: 44px !important;
  line-height: 44px !important;
  margin: 0;
  min-width: unset;
}

/* 
   Collapsed Menu Logic - Robust Handling for Submenus 
*/
.sidebar-menu.el-menu--collapse {
  width: 64px;
}

/* Hide text and arrow in collapsed mode */
.sidebar-menu.el-menu--collapse .el-submenu__title span,
.sidebar-menu.el-menu--collapse .el-submenu__icon-arrow {
  display: none !important;
}

/* Center icons in collapsed mode */
.sidebar-menu.el-menu--collapse .el-submenu__title {
  padding: 0 !important;
  display: flex !important;
  justify-content: center !important;
  align-items: center !important;
}

.sidebar-menu.el-menu--collapse .el-submenu__title i {
  margin: 0 !important;
  font-size: 20px;
  width: auto !important;
}

/* Fix for tooltip/div wrappers if present */
.sidebar-menu.el-menu--collapse .el-submenu__title > div {
  display: flex !important;
  justify-content: center !important;
  align-items: center !important;
  width: 100%;
  height: 100%;
}

/* Collapse Button */
.collapse-btn {
  height: 48px; 
  line-height: 48px;
  text-align: center;
  cursor: pointer;
  background: #fcfcfc;
  border-top: 1px solid #e6e6e6; /* Match border */
  color: #606266;
  transition: all 0.3s;
}

.collapse-btn:hover {
  color: var(--primary-color);
  background: #f5f7fa; 
}

.collapse-btn i {
  font-size: 18px;
}

/* ========================================
   Main Content Wrapper
   ======================================== */
.main-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
  background-color: var(--bg-page);
  overflow: hidden;
}

/* ========================================
   Header Bar
   ======================================== */
.header-bar {
  background: var(--bg-white);
  box-shadow: var(--shadow-sm);
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 20px;
  z-index: 1000;
  flex-shrink: 0;
}

.header-left {
  display: flex;
  align-items: center;
}

.header-left .el-breadcrumb {
  font-size: 14px;
}

.header-left .el-breadcrumb__inner {
  color: var(--text-secondary);
  transition: color var(--transition-fast);
}

.header-left .el-breadcrumb__inner:hover {
  color: var(--primary-color);
}

.header-left .el-breadcrumb__inner.is-link:hover {
  color: var(--primary-color);
}

/* Header Right */
.header-right {
  display: flex;
  align-items: center;
  gap: 4px;
}

.header-item {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-md);
  cursor: pointer;
  color: var(--text-secondary);
  transition: all var(--transition-fast) var(--ease-smooth);
}

.header-item:hover {
  background-color: var(--primary-light-7);
  color: var(--primary-color);
}

.header-item i {
  font-size: 18px;
}

.badge-item {
  display: flex;
  align-items: center;
  justify-content: center;
}

/* User Dropdown */
.user-dropdown {
  margin-left: 12px;
}

.user-info {
  display: flex;
  align-items: center;
  padding: 6px 12px;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.user-info:hover {
  background-color: var(--primary-light-7);
}

.user-avatar {
  border: 2px solid var(--primary-light-5);
}

.user-detail {
  margin: 0 10px;
  display: flex;
  flex-direction: column;
}

.user-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  line-height: 1.3;
}

.user-role {
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.3;
}

.user-info .el-icon-arrow-down {
  font-size: 12px;
  color: var(--text-secondary);
  transition: transform var(--transition-fast);
}

.user-dropdown:hover .el-icon-arrow-down {
  transform: rotate(180deg);
}

/* Dropdown Menu Styles */
/* Moved to global style block below */

/* ========================================
   Main Content Area
   ======================================== */
.main-content {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
  background-color: var(--bg-page);
}

.page-view {
  animation: pageEnter 0.3s var(--ease-smooth);
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

/* ========================================
   Responsive Adjustments
   ======================================== */
@media (max-width: 768px) {
  .sidebar {
    position: fixed;
    left: 0;
    top: 0;
    bottom: 0;
    z-index: 2000;
  }
  
  .user-detail {
    display: none;
  }
  
  .header-item.search-btn {
    display: none;
  }
}
</style>
