import request from '@/utils/request';

/**
 * 获取所有分类
 */
export function getAllCategories() {
  return request.get('/categories');
}

/**
 * 添加分类
 */
export function addCategory(data) {
  return request.post('/categories', data);
}

/**
 * 更新分类
 */
export function updateCategory(data) {
  return request.put('/categories', data);
}

/**
 * 删除分类
 */
export function deleteCategory(id) {
  return request.delete(`/categories/${id}`);
}
