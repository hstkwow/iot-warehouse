import { login } from '../../api/sysUser';

Page({
  data: {
    username: '',
    password: '',
    remember: true,
    loading: false
  },

  onLoad() {
    // 如果记住了账号，可以从本地缓存读取
    const savedUser = wx.getStorageSync('remembered_user');
    if (savedUser) {
      this.setData({
        username: savedUser.username,
        password: savedUser.password,
        remember: true
      });
    }
  },

  onUsernameInput(e) {
    this.setData({ username: e.detail.value });
  },

  onPasswordInput(e) {
    this.setData({ password: e.detail.value });
  },

  toggleRemember() {
    this.setData({ remember: !this.data.remember });
  },

  async handleLogin() {
    const { username, password, remember } = this.data;

    if (!username.trim()) {
      return wx.showToast({ title: '请输入账号', icon: 'none' });
    }
    if (!password.trim()) {
      return wx.showToast({ title: '请输入密码', icon: 'none' });
    }

    this.setData({ loading: true });

    try {
      const res = await login({ username, password });
      
      // 假设 res 成功结构: { code: 1, data: { token: 'xx', user: {...} } }
      if (res.code === 1 || res.code === 200) {
        const token = res.data.token || res.data;
        const user = res.data.user || {};
        
        wx.setStorageSync('token', token);
        wx.setStorageSync('user', user);
        wx.setStorageSync('isLogin', '1');

        if (remember) {
          wx.setStorageSync('remembered_user', { username, password });
        } else {
          wx.removeStorageSync('remembered_user');
        }

        wx.showToast({ title: '登录成功', icon: 'success' });

        // 跳转到带 tabBar 的首页
        setTimeout(() => {
          wx.switchTab({ url: '/pages/index/index' });
        }, 1000);
      } else {
        wx.showToast({ title: res.msg || '登录失败', icon: 'none' });
      }
      this.setData({ loading: false });
    } catch (error) {
      console.error('Login error:', error);
      wx.showToast({ title: '网络连接失败，请检查网络', icon: 'none' });
      this.setData({ loading: false });
    }
  }
});