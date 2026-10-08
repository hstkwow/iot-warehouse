import request from '../util/request.js';

export function getAllIoRecords(params) {
  return request.get('/io-records', params);
}
