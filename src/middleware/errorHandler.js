import { AppError } from '../shared/errors/AppError.js'

export function errorHandler(error, req, res, _next) {
  if (error?.code === 11000) {
    return res.status(409).json({
      error: { code: 'CONFLICT', message: 'A record with this value already exists.' },
      requestId: req.requestId,
    })
  }

  const knownError = error instanceof AppError
  const statusCode = knownError ? error.statusCode : 500
  const code = knownError ? error.code : 'INTERNAL_ERROR'
  const message = knownError ? error.message : 'Something went wrong. Please try again.'

  if (statusCode >= 500) console.error({ requestId: req.requestId, error })

  const payload = { error: { code, message }, requestId: req.requestId }
  if (knownError && error.fields) payload.error.fields = error.fields
  return res.status(statusCode).json(payload)
}
