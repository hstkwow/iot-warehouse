import Vue from 'vue'
import VueRouter from 'vue-router'
import MainLayout from '../layout/MainLayout.vue'

Vue.use(VueRouter)

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('../views/Login.vue')
  },
  {
    path: '/big-screen',
    name: 'BigScreen',
    component: () => import('../views/BigScreenDashboard.vue'),
    meta: { title: '可视化大屏' }
  },
  {
    path: '/',
    component: MainLayout,
    redirect: '/dashboard',
    children: [
      {
        path: 'dashboard',
        name: 'Dashboard',
        component: () => import('../views/Dashboard.vue')
      },
      {
        path: 'alerts',
        name: 'Alerts',
        component: () => import('../views/Alerts.vue')
      },
      {
        path: 'devices',
        name: 'Devices',
        component: () => import('../views/Devices.vue')
      },
      {
        path: 'device-config',
        name: 'DeviceConfig',
        component: () => import('../views/DeviceConfig.vue')
      },
      {
        path: 'materials',
        name: 'Materials',
        component: () => import('../views/Materials.vue')
      },
      {
        path: 'stock',
        name: 'Stock',
        component: () => import('../views/Stock.vue')
      },
      {
        path: 'locations',
        name: 'Locations',
        component: () => import('../views/Locations.vue')
      },
      {
        path: 'analytics',
        name: 'Analytics',
        component: () => import('../views/Analytics.vue')
      },
      {
        path: 'history',
        name: 'History',
        component: () => import('../views/History.vue')
      },
      {
        path: 'profile',
        name: 'Profile',
        component: () => import('../views/Profile.vue')
      }
    ]
  }
]

const router = new VueRouter({
  mode: 'hash',
  routes
})

router.beforeEach((to, from, next) => {
  const token = localStorage.getItem('token')

  if (to.path === '/login') {
    // 已有 token 时，访问登录页自动跳转首页
    if (token) {
      next('/dashboard')
    } else {
      next()
    }
  } else {
    // 访问非登录页，如果没有 token，强制跳转登录页
    if (!token) {
      next('/login')
    } else {
      next()
    }
  }
})

export default router
