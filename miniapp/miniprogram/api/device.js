import request from '../util/request.js';

// 获取所有设备列表
export function getAllDevices() {
  return request.get('/devices');
}

// 新增设备
export function addDevice(data) {
  return request.post('/devices', data);
}

// 更新设备
export function updateDevice(data) {
  return request.put('/devices', data);
}

// 删除设备
export function deleteDevice(id) {
  return request.delete(`/devices/${id}`);
}

// 获取最新传感器数据
export function getLatestSensorData(deviceId) {
  return request.get('/sensor-data/latest', { deviceId });
}

// 获取传感器历史数据
export function getSensorHistory(deviceId, limit = 10) {
    return request.get('/sensor-data/history', { deviceId, limit });
}

// 获取指定时间范围的传感器数据
export function getSensorDataByRange(deviceId, start, end) {
    return request.get('/sensor-data/range', { deviceId, start, end });
}

// 发送设备控制指令
export function sendDeviceCommand(deviceId, command) {
  return request.post(`/devices/${deviceId}/cmd`, command);
}

// 分配设备给用户 (Admin)
// userId 可以是单个 ID 或 ID 数组
export function assignDevice(deviceId, userId) {
  return request.post('/devices/assign', { deviceId, userId });
}

// 获取设备已分配的用户ID列表
export function getAssignedUsers(deviceId) {
    return request.get(`/devices/${deviceId}/users`);
}

// 取消设备分配 (Admin)
export function revokeAccess(deviceId, userId) {
    return request.post('/devices/revoke', { deviceId, userId });
}

// 获取设备配置
export function getDeviceConfig(deviceId) {
    return request.get(`/device-configs/${deviceId}`);
}

// 保存设备配置（同时下发到硬件）
export function saveDeviceConfig(config) {
    return request.post('/device-configs', config);
}



// 获取单个设备详情 (包含 ledStatus, alarmStatus 等)
export function getDeviceById(deviceId) {
  return request.get(`/devices/${deviceId}`);
}
