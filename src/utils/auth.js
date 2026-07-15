import jwt from 'jsonwebtoken'

export const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  path: '/',
}

export function createToken(userId) {
  return jwt.sign({ sub: userId.toString() }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  })
}

export function sendSession(res, user, status = 200) {
  const token = createToken(user._id)
  return res.status(status).cookie('devflow_token', token, cookieOptions).json({ 
    user: user.toSafeObject(),
    token
  })
}
