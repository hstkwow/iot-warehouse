import { MessageBox } from 'element-ui';

/**
 * 统一的删除确认弹窗
 * @param {string} content - 主要内容（可包含 HTML，例如："确认删除物资 <span ...>XXX</span> 吗？"）
 * @param {string} subText - 辅助说明（默认："此操作将永久删除该数据，且无法恢复！"）
 * @returns {Promise}
 */
const confirmDelete = function(content, subText = '此操作将永久删除该数据，且无法恢复！') {
  // 组装 HTML
  // 使用 text-align: left 避免多行文字居中对齐导致的阅读困难
  const html = `
    <div style="font-size: 16px; text-align: center; font-weight: 500;">${content}</div>
    <div style="margin-top: 8px; color: #909399; font-size: 13px; text-align: center;">${subText}</div>
  `;
  
  return MessageBox.confirm(html, '删除警示', {
    confirmButtonText: '确定删除',
    confirmButtonClass: 'el-button--danger',
    cancelButtonText: '取消',
    type: 'warning',
    center: true, // 保持布局居中（图标、标题、按钮）
    dangerouslyUseHTMLString: true,
    customClass: 'app-delete-confirm', // 使用 global.css 中的类
    distinguishCancelAndClose: true,
    closeOnClickModal: false,
    showClose: false // 隐藏右上角关闭按钮，更像现代 App 弹窗
  });
};

export default {
  install(Vue) {
    if (!Vue.prototype.$confirmDelete) {
        Vue.prototype.$confirmDelete = confirmDelete;
    }
  }
};