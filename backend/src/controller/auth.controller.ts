import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { AppDataSource } from '../config/database';
import { User } from '../entity/user.entity';
import { OrgMembership } from '../entity/org-membership.entity';
import { Organization } from '../entity/organization.entity';
import { Activity } from '../entity/activity.entity';
import { ActivityKind } from '../db/enums';
import logger from '../utils/logger';

const router = Router();

interface AuthRequest extends Request {
  user?: {
    id: string;
    username: string;
  };
}

const generateTokens = (userId: string, username: string) => {
  const accessToken = jwt.sign(
    { userId, username },
    process.env.JWT_ACCESS_SECRET!,
    { expiresIn: '15m' }
  );
  
  const refreshToken = jwt.sign(
    { userId, username },
    process.env.JWT_REFRESH_SECRET!,
    { expiresIn: '7d' }
  );
  
  return { accessToken, refreshToken };
};

router.post('/register', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }
    
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    
    const userRepository = AppDataSource.getRepository(User);
    const existingUser = await userRepository.findOne({ where: { username } });
    
    if (existingUser) {
      return res.status(400).json({ error: 'Username already exists' });
    }
    
    const passwordHash = await bcrypt.hash(password, 12);
    const user = userRepository.create({
      username,
      passwordHash
    });
    
    await userRepository.save(user);
    
    const { accessToken, refreshToken } = generateTokens(user.id, user.username);
    
    logger.info(`User registered: ${username}`);
    
    res.status(201).json({
      message: 'User created successfully',
      user: {
        id: user.id,
        username: user.username,
        createdAt: user.createdAt
      },
      accessToken,
      refreshToken
    });
  } catch (error) {
    logger.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }
    
    const userRepository = AppDataSource.getRepository(User);
    const user = await userRepository.findOne({ where: { username } });
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const { accessToken, refreshToken } = generateTokens(user.id, user.username);
    
    logger.info(`User logged in: ${username}`);
    
    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        username: user.username,
        createdAt: user.createdAt
      },
      accessToken,
      refreshToken
    });
  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(401).json({ error: 'Refresh token is required' });
    }
    
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET!) as any;
    
    const userRepository = AppDataSource.getRepository(User);
    const user = await userRepository.findOne({ where: { id: decoded.userId } });
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }
    
    const { accessToken, refreshToken: newRefreshToken } = generateTokens(user.id, user.username);
    
    logger.info(`Token refreshed for user: ${user.username}`);
    
    res.json({
      message: 'Token refreshed successfully',
      accessToken,
      refreshToken: newRefreshToken
    });
  } catch (error) {
    logger.error('Token refresh error:', error);
    res.status(401).json({ error: 'Invalid refresh token' });
  }
});

router.post('/logout', async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;
    
    if (refreshToken) {
      // In a production app, you would blacklist the refresh token
      // For now, we'll just return success
      logger.info('User logged out');
    }
    
    res.json({ message: 'Logout successful' });
  } catch (error) {
    logger.error('Logout error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/me', async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const userRepository = AppDataSource.getRepository(User);
    const user = await userRepository.findOne({ 
      where: { id: req.user.id },
      relations: ['memberships', 'memberships.organization']
    });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const organizations = user.memberships?.map(membership => ({
      id: membership.organization.id,
      name: membership.organization.name,
      subdomain: membership.organization.subdomain,
      role: membership.role,
      joinedAt: membership.createdAt
    })) || [];
    
    res.json({
      user: {
        id: user.id,
        username: user.username,
        createdAt: user.createdAt
      },
      organizations
    });
  } catch (error) {
    logger.error('Get user profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
