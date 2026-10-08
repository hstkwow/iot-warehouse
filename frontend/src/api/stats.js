import request from '@/utils/request';

export function getDashboardStats() {
  return request.get('/stats/dashboard');
}

export function getIoTrend(params) {
  return request.get('/stats/io-trend', params);
}
