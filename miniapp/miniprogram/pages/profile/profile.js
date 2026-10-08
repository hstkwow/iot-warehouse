import { updateUser } from '../../api/sysUser.js';
import { getDashboardStats } from '../../api/stats.js';

Page({
  data: {
    statusBarHeight: wx.getWindowInfo().statusBarHeight || 44,
    userInfo: {},
    defaultAvatar: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjY2NjY2NjIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PHBhdGggZD0iTTIwIDIxdjItMmE0IDQgMCAwIDAtNC00SDhhNCA0IDAgMCAwLTQgNHYyIi8+PGNpcmNsZSBjeD0iMTIiIGN5PSI3IiByPSI0Ii8+PC9zdmc+',
    showEditDialog: false,
    editUsername: '',
    stats: {
      devices: '-',
      alarms: '-',
      lowStock: '-'
    }
  },
  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().init();
    }

    const user = wx.getStorageSync('user');
    if (user) {
      this.setData({ userInfo: user });
    }
    this.fetchStats();
  },
  async fetchStats() {
    try {
      const res = await getDashboardStats();
      if (res.code === 200 || res.code === 1 || res.success) {
        const data = res.data || {};
        this.setData({
          'stats.devices': data.totalDevices != null ? data.totalDevices : 0,
          'stats.alarms': data.unprocessedAlarms != null ? data.unprocessedAlarms : 0,
          'stats.lowStock': data.lowStock != null ? data.lowStock : 0
        });
      }
    } catch(err) {
      console.error('Fetch profile stats error', err);
    }
  },
  handleEditUsername() {
    this.setData({
      editUsername: this.data.userInfo.nickname || this.data.userInfo.username || '',
      showEditDialog: true
    });
  },
  onUsernameInput(e) {
    this.setData({ editUsername: e.detail.value });
  },
  onCancelEdit() {
    this.setData({ showEditDialog: false });
  },
  async onConfirmEdit() {
    const newName = this.data.editUsername.trim();
    if (!newName) {
      wx.showToast({ title: '用户名不能为空', icon: 'none' });
      return;
    }
    
    try {
      wx.showLoading({ title: '保存中...' });
      const user = this.data.userInfo;
      const data = {
        userId: user.userId || user.id, // 兼容可能的id字段异构
        nickname: newName
      };
      
      const res = await updateUser(data);
      wx.hideLoading();
      
      // 后端 Result 定义中，成功时 code === 1 (或者直接取 200)，并且可能包一层 data 层面的内容
      if (res.code === 200 || res.code === 1 || res.success) {
        wx.showToast({ title: '修改成功', icon: 'success' });
        // 更新本地与存储
        user.nickname = newName;
        wx.setStorageSync('user', user);
        this.setData({
          userInfo: user,
          showEditDialog: false
        });
      } else {
        wx.showToast({ title: res.message || '修改失败', icon: 'none' });
      }
    } catch (err) {
      wx.hideLoading();
      console.error('Update username error', err);
      wx.showToast({ title: '网络异常，请重试', icon: 'none' });
    }
  },
  handleMenuClick() {
    wx.showToast({ title: '功能开发中', icon: 'none' });
  },
  handleLogout() {
    wx.showModal({
      title: '提示',
      content: '确定要退出设备控制台吗？',
      success: (res) => {
        if (res.confirm) {
          wx.removeStorageSync('token');
          wx.removeStorageSync('user');
          wx.reLaunch({ url: '/pages/login/login' });
        }
      }
    });
  }
});