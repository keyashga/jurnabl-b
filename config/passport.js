// config/passport.js
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import dotenv from 'dotenv';
import User from '../models/userModel.js';

dotenv.config();

passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: `${process.env.BASE_URL}/api/auth/google/callback`,
},
async (accessToken, refreshToken, profile, done) => {
  try {
    const email = profile.emails?.[0]?.value;
    let user = await User.findOne({ email });

    if (!user) {
      const usernameBase = profile.displayName.toLowerCase().replace(/\s+/g, '');
      let username = usernameBase;
      let counter = 1;
      while (await User.findOne({ username })) {
        username = `${usernameBase}${counter++}`;
      }

      user = await User.create({
        name: profile.displayName,
        email,
        username,
        profileImage: profile.photos?.[0]?.value,
      });
    }

    return done(null, user);
  } catch (error) {
    console.error('Google auth error:', error);
    done(error, null);
  }
}));

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});
