import { NotFoundError } from '../shared/errors/AppError.js'

export function notFound(req, _res, next) {
  next(new NotFoundError(`No route matches ${req.method} ${req.originalUrl}.`))
}
