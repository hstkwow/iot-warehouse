import request from '../util/request.js';

export const addMaterial = (data) => request.post('/materials', data);
export const getAllMaterials = (params) => request.get('/materials', params);

export const getMaterialDetail = (id) => request.get(`/materials/${id}`);
export const updateMaterial = (data) => request.put('/materials', data);
export const deleteMaterial = (id) => request.delete(`/materials/${id}`);
