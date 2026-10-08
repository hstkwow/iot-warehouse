import request from '@/utils/request';

export function getAllIoRecords(params) {
  return request.get('/io-records', params);
}
