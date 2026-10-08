import axios from 'axios';
import { Message, Loading } from 'element-ui';
import { config } from '../config';
import router from '../router';

// Loading 实例
let loadingInstance = null;
let requestCount = 0;

// 显示 Loading
const showLoading = () => {
  if (requestCount === 0) {
    loadingInstance = Loading.service({
      lock: true,
      text: '加载中...',
      background: 'rgba(255, 255, 255, 0.7)'
    });
  }
  requestCount++;
};

// 隐藏 Loading
const hideLoading = () => {
  requestCount--;
  if (requestCount <= 0) {
    requestCount = 0;
    if (loadingInstance) {
      loadingInstance.close();
      loadingInstance = null;
    }
  }
};

// ============================================
// 创建 Axios 实例 (Java 后端)
// ============================================
const service = axios.create({
  baseURL: config.api.baseUrl,
  timeout: config.api.timeout,
  headers: {
    'Content-Type': 'application/json'
  }
});

// 请求拦截器
service.interceptors.request.use(
  (conf) => {
    // 显示 Loading (可通过 showLoading: false 禁用)
    if (conf.showLoading !== false) {
      showLoading();
    }
    
    // 添加 Token
    const token = localStorage.getItem('token');
    if (token) {
      conf.headers['Authorization'] = `Bearer ${token}`;
    }
    
    // 调试日志
    if (config.app.debug) {
      console.log(`[API] ${conf.method?.toUpperCase()} ${conf.url}`, conf.data || conf.params || '');
    }
    
    return conf;
  },
  (error) => {
    hideLoading();
    console.error('[API] Request Error:', error);
    return Promise.reject(error);
  }
);

// ============================================
// 响应拦截器
// ============================================
service.interceptors.response.use(
  (response) => {
    hideLoading();
    const res = response.data;
    
    // 调试日志
    if (config.app.debug) {
      console.log(`[API] Response:`, res);
    }
    
    // 根据后端返回格式处理
    // 常见格式1: { code: 200, data: {...}, message: 'success' }
    // 常见格式2: { success: true, data: {...} }
    // 常见格式3: 直接返回数据
    
    // 如果有 code 字段
    if (res.code !== undefined) {
      // 后端规范: code=1 为成功, code=0 为失败
      if (res.code === 1) {
        return res;
      } else {
        // 全局错误提示
        Message.error(res.msg || res.message || '操作失败');
        return Promise.reject(new Error(res.msg || res.message || 'Error'));
      }
    }
    
    // 如果有 success 字段
    if (res.success !== undefined) {
      if (res.success) {
        return res.data !== undefined ? res.data : res;
      } else {
        Message.error(res.message || res.msg || '请求失败');
        return Promise.reject(new Error(res.message || 'Error'));
      }
    }
    
    // 直接返回数据
    return res;
  },
  (error) => {
    hideLoading();
    console.error('[API] Response Error:', error);
    
    // 处理不同的错误状态码
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data;
      
      switch (status) {
        case 400:
          Message.error(data?.message || '请求参数错误');
          break;
        case 401:
          Message.error('登录已过期，请重新登录');
          localStorage.removeItem('token');
          localStorage.removeItem('isLogin');
          localStorage.removeItem('user');
          if (router.currentRoute.path !== '/login') {
            router.replace('/login').catch(() => {});
          }
          break;
        case 403:
          Message.error('没有权限访问该资源');
          break;
        case 404:
          Message.error('请求的资源不存在');
          break;
        case 500:
          Message.error(data?.message || '服务器内部错误');
          break;
        default:
          Message.error(data?.message || `请求失败 (${status})`);
      }
    } else if (error.code === 'ECONNABORTED') {
      Message.error('请求超时，请稍后重试');
    } else {
      Message.error('网络连接失败，请检查网络');
    }
    
    return Promise.reject(error);
  }
);

// ============================================
// 封装通用请求方法
// ============================================
const request = {
  get(url, params, options = {}) {
    return service.get(url, { params, ...options });
  },
  post(url, data, options = {}) {
    return service.post(url, data, options);
  },
  put(url, data, options = {}) {
    return service.put(url, data, options);
  },
  delete(url, params, options = {}) {
    return service.delete(url, { params, ...options });
  }
};

export { service as axios };
export default request;
