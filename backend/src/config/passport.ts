/**
 * PHTS System - Passport JWT Strategy Configuration
 *
 * Configures Passport.js with JWT strategy for token-based authentication
 *
 * Date: 2025-12-30
 */

import passport from 'passport';
import { Strategy as JwtStrategy, ExtractJwt, StrategyOptions } from 'passport-jwt';
import dotenv from 'dotenv';
import { JwtPayload, User } from '../types/auth.js';
import { query } from './database.js';

// Load environment variables
dotenv.config();

/**
 * JWT Strategy Options
 * Configures how JWT tokens are extracted and verified
 */
const jwtOptions: StrategyOptions = {
  // Extract JWT from Authorization header as Bearer token
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),

  // Secret key for verifying JWT signature
  secretOrKey: process.env.JWT_SECRET || 'default_secret_key_change_in_production',

  // Validate token expiration
  ignoreExpiration: false,

  // Algorithm used for signing (default: HS256)
  algorithms: ['HS256'],
};

/**
 * JWT Strategy Implementation
 * Verifies JWT payload and attaches user information to request
 */
passport.use(
  new JwtStrategy(jwtOptions, async (jwtPayload: JwtPayload, done) => {
    try {
      // Extract user information from JWT payload
      const { userId, citizenId, role } = jwtPayload;

      // Validate that required fields exist in payload
      if (!userId || !citizenId || !role) {
        return done(null, false, { message: 'Invalid token payload' });
      }

      const users = await query<User[]>(
        `SELECT id AS user_id, citizen_id, role, is_active 
         FROM users 
         WHERE id = ? AND citizen_id = ? 
         LIMIT 1`,
        [userId, citizenId]
      );

      // Check if user exists
      if (!users || users.length === 0) {
        return done(null, false, { message: 'User not found' });
      }

      const user = users[0];

      // Check if user account is active
      if (!user.is_active) {
        return done(null, false, { message: 'Account is inactive' });
      }

      // Verify role matches (prevent token reuse after role change)
      if (user.role !== role) {
        return done(null, false, { message: 'User role has changed. Please login again.' });
      }

      // Authentication successful - attach payload to request
      return done(null, jwtPayload);
    } catch (error) {
      console.error('JWT Strategy Error:', error);
      return done(error, false);
    }
  })
);

/**
 * Initialize Passport middleware
 * Call this function in your Express app setup
 */
export function initializePassport() {
  return passport.initialize();
}

export default passport;
