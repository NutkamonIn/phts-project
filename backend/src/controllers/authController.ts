/**
 * PHTS System - Authentication Controller
 *
 * Handles user authentication logic including login and token generation
 *
 * Date: 2025-12-30
 */

import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import {
  User,
  LoginRequest,
  LoginResponse,
  ApiResponse,
  JwtPayload,
  UserProfile,
} from '../types/auth.js';
import { query } from '../config/database.js';
import { isValidCitizenId } from '../utils/validationUtils.js';

// Load environment variables
dotenv.config();

/**
 * Get user base record plus profile details from local tables.
 */
async function getUserWithProfile(userId: number): Promise<UserProfile | null> {
  const users = await query<User[]>(
    'SELECT id AS user_id, citizen_id, role, is_active, last_login_at FROM users WHERE id = ? LIMIT 1',
    [userId]
  );

  if (!users || users.length === 0) {
    return null;
  }

  const user = users[0];

  let employeeDetails = await query<any[]>(
    `SELECT 
       first_name, 
       last_name, 
       position_name as position, 
       department, 
       position_number, 
       emp_type as employee_type, 
       mission_group, 
       start_work_date as start_current_position
     FROM pts_employees WHERE citizen_id = ? LIMIT 1`,
    [user.citizen_id]
  );

  if (!employeeDetails || employeeDetails.length === 0) {
    employeeDetails = await query<any[]>(
      `SELECT first_name, last_name, position_name as position, department, position_number, employee_type, mission_group, start_current_position
       FROM pts_support_employees WHERE citizen_id = ? LIMIT 1`,
      [user.citizen_id]
    );
  }

  const detail = employeeDetails?.[0];

  return {
    id: user.user_id,
    citizen_id: user.citizen_id,
    role: user.role,
    is_active: user.is_active,
    last_login_at: user.last_login_at,
    first_name: detail?.first_name,
    last_name: detail?.last_name,
    position: detail?.position,
    position_number: detail?.position_number,
    department: detail?.department,
    employee_type: detail?.employee_type,
    mission_group: detail?.mission_group,
    start_current_position: detail?.start_current_position,
  };
}

/**
 * Login Handler
 *
 * Authenticates user with citizen_id and password
 * Returns JWT token on successful authentication
 *
 * @route POST /api/auth/login
 * @access Public
 */
export async function login(
  req: Request<{}, {}, LoginRequest>,
  res: Response<LoginResponse | ApiResponse>
): Promise<void> {
  try {
    const { citizen_id, password } = req.body;

    // Validate input
    if (!citizen_id || !password) {
      res.status(400).json({
        success: false,
        error: 'Please provide both citizen ID and password',
      });
      return;
    }

    // Validate citizen ID format
    if (!isValidCitizenId(citizen_id)) {
      res.status(400).json({
        success: false,
        error: 'Invalid citizen ID. Must be 13 digits with a valid checksum.',
      });
      return;
    }

    // Query user from database
    const users = await query<User[]>(
      'SELECT id AS user_id, citizen_id, password_hash, role, is_active, last_login_at FROM users WHERE citizen_id = ? LIMIT 1',
      [citizen_id]
    );

    // Check if user exists
    if (!users || users.length === 0) {
      res.status(401).json({
        success: false,
        error: 'Invalid citizen ID or password',
      });
      return;
    }

    const user = users[0];

    // Check if account is active
    if (!user.is_active) {
      res.status(403).json({
        success: false,
        error: 'Your account has been deactivated. Please contact administrator.',
      });
      return;
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

    if (!isPasswordValid) {
      res.status(401).json({
        success: false,
        error: 'Invalid citizen ID or password',
      });
      return;
    }

    // Update last login timestamp
    await query(
      'UPDATE users SET last_login_at = NOW() WHERE id = ?',
      [user.user_id]
    );

    // Generate JWT token
    const jwtPayload: JwtPayload = {
      userId: user.user_id,
      citizenId: user.citizen_id,
      role: user.role,
    };

    const jwtSecret = process.env.JWT_SECRET || 'default_secret_key_change_in_production';

    const token = jwt.sign(jwtPayload, jwtSecret, {
      expiresIn: '24h',
    });

    const userProfile: UserProfile =
      (await getUserWithProfile(user.user_id)) || {
        id: user.user_id,
        citizen_id: user.citizen_id,
        role: user.role,
        is_active: user.is_active,
        last_login_at: user.last_login_at,
      };

    // Return success response
    res.status(200).json({
      success: true,
      token,
      user: userProfile,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: 'An error occurred during login. Please try again.',
    });
  }
}

/**
 * Get Current User Profile
 *
 * Returns the profile of the currently authenticated user
 *
 * @route GET /api/auth/me
 * @access Protected
 */
export async function getCurrentUser(
  req: Request,
  res: Response<ApiResponse<UserProfile>>
): Promise<void> {
  try {
    // User is attached to request by authMiddleware
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Not authenticated',
      });
      return;
    }

    const { userId } = req.user;

    const userProfile = await getUserWithProfile(userId);

    if (!userProfile) {
      res.status(404).json({
        success: false,
        error: 'User not found',
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: userProfile,
    });
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({
      success: false,
      error: 'An error occurred while fetching user profile',
    });
  }
}

/**
 * Logout Handler
 *
 * Since JWT is stateless, logout is handled on the client side by removing the token
 * This endpoint can be used for logging purposes
 *
 * @route POST /api/auth/logout
 * @access Protected
 */
export async function logout(
  _req: Request,
  res: Response<ApiResponse>
): Promise<void> {
  try {
    // In a stateless JWT setup, logout is handled client-side
    // You can add additional logic here if needed (e.g., token blacklisting)

    res.status(200).json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      error: 'An error occurred during logout',
    });
  }
}
