import request from '@/utils/request';

/**
 * 用户登录
 * @param {Object} data { username, password }
 */
export function login(data) {
  return request.post('/login', data);
}

/**
 * 获取所有用户列表
 */
export function getAllUsers() {
  return request.get('/sys-users');
}

/**
 * 根据ID获取用户详情
 * @param {Number} id 用户ID
 */
export function getUserById(id) {
  return request.get(`/sys-users/${id}`);
}

/**
 * 添加新用户
 * @param {Object} data 用户信息
 */
export function addUser(data) {
  return request.post('/sys-users', data);
}

/**
 * 更新用户信息
 * @param {Object} data 用户信息
 */
export function updateUser(data) {
  return request.put('/sys-users', data);
}

/**
 * 删除用户
 * @param {Number} id 用户ID
 */
export function deleteUser(id) {
  return request.delete(`/sys-users/${id}`);
}

/**
 * 修改用户密码
 * @param {Number} id 用户ID
 * @param {String} password 新密码
 */
export function updateUserPassword(id, password) {
  return request.put(`/sys-users/${id}/password`, null, {
    params: { password }
  });
}

/**
 * 修改用户状态
 * @param {Number} id 用户ID
 * @param {Number} status 状态 (1:正常, 0:禁用)
 */
export function updateUserStatus(id, status) {
  return request.put(`/sys-users/${id}/status`, null, {
    params: { status }
  });
}
