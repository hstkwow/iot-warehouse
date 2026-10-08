import request from '../util/request.js';

// 获取告警列表
export function getAlarms(params) {
  return request.get('/alarms', params);
}

// 获取告警统计
export function getAlarmStats() {
  return request.get('/alarms/stats');
}

// 处理告警(标记为已处理, 需填写处理措施)
export function resolveAlarm(alarmId, remark) {
  return request.put(`/alarms/${alarmId}/resolve`, { remark });
}


