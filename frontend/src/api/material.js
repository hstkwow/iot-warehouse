import request from '@/utils/request';

/**
 * 获取所有物资列表
 */
export function getAllMaterials(params) {
  return request.get('/materials', params);
}

/**
 * 根据ID获取物资详情
 * @param {Number} id 物资ID
 */
export function getMaterialById(id) {
  return request.get(`/materials/${id}`);
}

/**
 * 添加物资
 * @param {Object} data 物资信息
 */
export function addMaterial(data) {
  return request.post('/materials', data);
}

/**
 * 更新物资信息
 * @param {Object} data 物资信息
 */
export function updateMaterial(data) {
  return request.put('/materials', data);
}

/**
 * 删除物资（支持批量，ids可以是单个ID或ID数组）
 * @param {Number|Array} ids 物资ID或ID列表
 */
export function deleteMaterial(ids) {
  const idStr = Array.isArray(ids) ? ids.join(',') : ids;
  return request.delete(`/materials/${idStr}`);
}
