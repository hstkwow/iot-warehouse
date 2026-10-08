import Toast from 'tdesign-miniprogram/toast/index';
import { getAllCategories, addCategory, updateCategory, deleteCategory } from '../../api/category.js';

Page({
  data: {
    categories: [],
    dialogVisible: false,
    deleteDialogVisible: false,
    dialogTitle: '新增分类',
    currentId: null,
    formName: '',
    formDesc: '',
    itemToDelete: null
  },
  
  onLoad() {
    this.loadCategories();
  },
  
  async loadCategories() {
    try {
      const res = await getAllCategories();
      let list = [];
      if (Array.isArray(res.data)) {
        list = res.data;
      } else if (Array.isArray(res)) {
        list = res;
      } else if (res && res.data && Array.isArray(res.data.records)) {
        list = res.data.records;
      }
      this.setData({ categories: list });
    } catch (err) {
      console.error(err);
      Toast({ context: this, selector: '#t-toast', message: '分类加载失败', theme: 'error' });
    }
  },

  handleAdd() {
    this.setData({
      dialogVisible: true,
      dialogTitle: '新增分类',
      currentId: null,
      formName: '',
      formDesc: ''
    });
  },

  handleEdit(e) {
    const item = e.currentTarget.dataset.item;
    this.setData({
      dialogVisible: true,
      dialogTitle: '编辑分类',
      currentId: item.categoryId,
      formName: item.categoryName || '',
      formDesc: item.description || ''
    });
  },

  handleDelete(e) {
    const item = e.currentTarget.dataset.item;
    this.setData({
      deleteDialogVisible: true,
      itemToDelete: item
    });
  },

  onNameChange(e) {
    this.setData({ formName: e.detail.value });
  },

  onDescChange(e) {
    this.setData({ formDesc: e.detail.value });
  },

  closeDialog() {
    this.setData({ dialogVisible: false });
  },

  closeDeleteDialog() {
    this.setData({ deleteDialogVisible: false, itemToDelete: null });
  },

  async confirmSave() {
    const { formName, formDesc, currentId } = this.data;
    if (!formName || !formName.trim()) {
      Toast({ context: this, selector: '#t-toast', message: '分类名称不能为空', theme: 'error' });
      return;
    }
    
    try {
      if (currentId) {
        await updateCategory({ categoryId: currentId, categoryName: formName, description: formDesc });
        Toast({ context: this, selector: '#t-toast', message: '修改成功', theme: 'success' });
      } else {
        await addCategory({ categoryName: formName, description: formDesc });
        Toast({ context: this, selector: '#t-toast', message: '新增成功', theme: 'success' });
      }
      this.setData({ dialogVisible: false });
      this.loadCategories();
    } catch (error) {
      Toast({ context: this, selector: '#t-toast', message: '操作失败', theme: 'error' });
    }
  },

  async confirmDelete() {
    const { itemToDelete } = this.data;
    if (itemToDelete) {
      try {
        await deleteCategory(itemToDelete.categoryId);
        Toast({ context: this, selector: '#t-toast', message: '删除成功', theme: 'success' });
        this.setData({ deleteDialogVisible: false, itemToDelete: null });
        this.loadCategories();
      } catch (error) {
        Toast({ context: this, selector: '#t-toast', message: '删除失败', theme: 'error' });
      }
    }
  }
});
