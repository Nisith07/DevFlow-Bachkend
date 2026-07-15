export function sendData(res, data, { status = 200, meta } = {}) {
  const payload = { data }
  if (meta) payload.meta = meta
  return res.status(status).json(payload)
}
