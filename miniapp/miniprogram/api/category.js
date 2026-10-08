import request from '../util/request.js';

export const getAllCategories = () => request.get('/categories');
export const addCategory = (data) => request.post('/categories', data);
export const updateCategory = (data) => request.put('/categories', data);
export const deleteCategory = (id) => request.delete('/categories/' + id);
