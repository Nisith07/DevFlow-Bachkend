import { Strategy as GoogleStrategy } from 'passport-google-oauth20'
import User from '../models/User.js'

export function configurePassport(passport) {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_CALLBACK_URL) {
    console.warn('Google OAuth is not configured. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_CALLBACK_URL.')
    return false
  }

  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL,
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value?.toLowerCase()
          if (!email) return done(new Error('Google did not provide an email address.'))

          let user = await User.findOne({ $or: [{ googleId: profile.id }, { email }] })
          if (!user) {
            user = await User.create({
              name: profile.displayName || email.split('@')[0],
              email,
              googleId: profile.id,
              avatarUrl: profile.photos?.[0]?.value || '',
              providers: ['google'],
              lastLoginAt: new Date(),
            })
          } else {
            user.googleId = profile.id
            user.name = user.name || profile.displayName || email.split('@')[0]
            user.avatarUrl = user.avatarUrl || profile.photos?.[0]?.value || ''
            if (!user.providers.includes('google')) user.providers.push('google')
            user.lastLoginAt = new Date()
            await user.save()
          }
          return done(null, user)
        } catch (error) {
          return done(error)
        }
      },
    ),
  )
  return true
}
