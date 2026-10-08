Page({
  data: {
    record: {}
  },

  onLoad(options) {
    if (options.data) {
      try {
        const record = JSON.parse(decodeURIComponent(options.data));
        // 格式化时间
        if (record.time && record.time.includes('T')) {
          record.time = record.time.replace('T', ' ').split('.')[0];
        }
        this.setData({ record });
      } catch (e) {
        console.error('解析出入库记录失败:', e);
      }
    }
  }
});
