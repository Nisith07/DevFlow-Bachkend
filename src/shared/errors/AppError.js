export class AppError extends Error {
  constructor(message, { statusCode = 500, code = 'INTERNAL_ERROR', fields } = {}) {
    super(message)
    this.name = 'AppError'
    this.statusCode = statusCode
    this.code = code
    this.fields = fields
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'The requested resource was not found.') {
    super(message, { statusCode: 404, code: 'NOT_FOUND' })
    this.name = 'NotFoundError'
  }
}
