// util/request.js
import { BASE_URL } from './config.js';

/**
 * 封装微信原生的 wx.request
 * 替代 PC 端的 axios
 */
let isRelanching = false;
let lastNetworkToastTime = 0;

const request = (options) => {
  return new Promise((resolve, reject) => {
    // 自动携带 Token
    const token = wx.getStorageSync('token');
    const header = options.header || {
      'Content-Type': 'application/json'
    };
    if (token) {
      // 兼容后端的 Bearer token 格式要求
      header['Authorization'] = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
    }

    wx.request({
      url: BASE_URL + options.url,
      method: options.method || 'GET',
      data: options.data || {},
      header: header,
      success: (res) => {
        const { data, statusCode } = res;
        
        if (statusCode === 200) {
          if (data.code === 200 || data.code === 1) {
            resolve(data);
          } else if (data.code === 401) {
            wx.showToast({ title: '登录已过期', icon: 'error' });
            wx.removeStorageSync('token');
            if (!isRelanching) {
              isRelanching = true;
              setTimeout(() => {
                wx.reLaunch({ 
                  url: '/pages/login/login',
                  complete: () => { isRelanching = false; }
                });
              }, 500); // 延迟跳转，防止启动期间清空栈引发报错
            }
            reject('Unauthorized');
          } else {
            wx.showToast({ title: data.msg || '请求失败', icon: 'none' });
            resolve(data); 
          }
        } else if (statusCode === 401) {
          wx.removeStorageSync('token');
          if (!isRelanching) {
            isRelanching = true;
            setTimeout(() => {
              wx.reLaunch({ 
                url: '/pages/login/login',
                complete: () => { isRelanching = false; }
              });
            }, 500);
          }
          reject('Unauthorized');
        } else {
          wx.showToast({ title: '服务器异常 ' + statusCode, icon: 'error' });
          reject(res);
        }
      },
      fail: (err) => {
        const now = Date.now();
        if (now - lastNetworkToastTime > 3000) {
          wx.showToast({ title: '网络连接失败', icon: 'error' });
          lastNetworkToastTime = now;
        }
        reject(err);
      }
    });
  });
};

// 增加对原 axios 各类方法的兼容，避免大改 api 目录
request.get = (url, params) => request({ url, method: 'GET', data: params });
request.post = (url, data) => request({ url, method: 'POST', data });
request.put = (url, data, config = {}) => {
  // 兼顾有些可能放进来当 params
  const payload = config.params ? config.params : data;
  return request({ url, method: 'PUT', data: payload });
};
request.delete = (url, data) => request({ url, method: 'DELETE', data });

export default request;
