/**
 * 项目配置文件
 * 
 * 架构说明：
 * - 前端通过 HTTP 请求 Java 后端 API
 * - Java 后端负责：用户认证、物资管理、传感器数据存储与查询
 * - 硬件设备通过 MQTT/HTTP 将数据上报到 Java 后端
 */

export const config = {
  // ============================================
  // Java 后端 API 配置
  // ============================================
  api: {
    // API 基础地址：生产环境默认走同源 /api（由 Nginx 反向代理），开发环境默认直连本机后端
    baseUrl: process.env.VUE_APP_API_BASE_URL || (process.env.NODE_ENV === 'production' ? '/api' : 'http://localhost:8080'),
    
    // 请求超时时间 (毫秒)
    timeout: parseInt(process.env.VUE_APP_API_TIMEOUT) || 15000
  },

  // ============================================
  // 应用配置
  // ============================================
  app: {
    // 应用名称
    name: '智能仓储系统',
    
    // 数据轮询间隔 (毫秒) - 用于定时刷新传感器数据
    pollingInterval: 3000,
    
    // Token 存储 Key
    tokenKey: 'warehouse_token',
    
    // 是否启用调试模式
    debug: process.env.NODE_ENV !== 'production'
  },

  // ============================================
  // 阈值配置 (用于预警)
  // ============================================
  thresholds: {
    temperature: { min: 10, max: 30 },  // 温度范围 (°C)
    humidity: { min: 30, max: 70 },     // 湿度范围 (%)
    smoke: { max: 100 },                // 烟雾阈值 (PPM)
    light: { min: 100, max: 1000 }      // 光照范围 (Lux)
  }
};
