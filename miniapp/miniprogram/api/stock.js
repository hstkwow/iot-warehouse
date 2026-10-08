import request from '../util/request.js';

/**
 * 获取库存概览
 */
export function getStockSummary(params) {
  return request.get('/stock/summary', params);
}

/**
 * 获取所有库存明细
 */
export function getAllStockItems() {
  return request.get('/stock');
}

/**
 * 根据物资ID获取库存
 * @param {Number} materialId
 */
export function getStockByMaterialId(materialId) {
  return request.get(`/stock/material/${materialId}`);
}

/**
 * 更新库存记录
 */
export function updateStockItem(data) {
  return request.put('/stock', data);
}

/**
 * 查询指定物资最新待入库记录（写卡成功后轮询确认）
 * @param {number} materialId - 物资ID
 */
export function getStockPendingByMaterial(materialId) {
  return request.get(`/stock/pending/${materialId}`, null, { showLoading: false });
}

/**
 * 写卡前预登记：缓存本次写入的数量、库位、批次、有效期
 * @param {{ materialId, quantity, location, batchNo, expiryDate }} data
 */
export function prepareRfidWrite(data) {
  return request.post('/stock/prepare-write', data);
}
