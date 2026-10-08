import request from '../util/request.js'

export function getLocations() {
  return request.get('/locations')
}

export function addLocation(data) {
  return request.post('/locations', data)
}

export function updateLocation(data) {
    return request.put('/locations', data)
}

export function deleteLocation(id) {
    return request.delete(`/locations/${id}`)
}
