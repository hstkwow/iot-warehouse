Component({
  data: {
    safeAreaBottom: 0,
    overlayActive: false,
    value: 'pages/index/index',
    list: [
      { value: 'pages/index/index', path: '/pages/index/index', label: '首页', icon: 'home' },
      { value: 'pages/devices/devices', path: '/pages/devices/devices', label: '设备', icon: 'desktop' },
      { value: 'pages/stock/stock', path: '/pages/stock/stock', label: '库存', icon: 'layers' },
      { value: 'pages/data/data', path: '/pages/data/data', label: '数据', icon: 'chart' },
      { value: 'pages/profile/profile', path: '/pages/profile/profile', label: '我的', icon: 'user' }
    ],
  },
  attached() {
    const info = wx.getSystemInfoSync();
    this.setData({ safeAreaBottom: info.safeAreaInsets ? (info.screenHeight - info.safeAreaInsets.bottom) : 34 });
  },
  methods: {
    setOverlayActive(active) {
      this.setData({ overlayActive: !!active });
    },
    onTabTap(e) {
      const value = e.currentTarget.dataset.value;
      if (!value || value === this.data.value) {
        return;
      }
      this.setData({ value });
    },
    init() {
      const page = getCurrentPages().pop();
      if (page) {
        this.setData({
          value: page.route
        });
      }
    }
  }
});
