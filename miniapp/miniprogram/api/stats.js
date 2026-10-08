import request from '../util/request.js';

export function getDashboardStats() {
  return request.get('/stats/dashboard');
}
