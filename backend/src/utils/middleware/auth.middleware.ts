import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AppDataSource } from '../../config/database';
import { User } from '../../entity/user.entity';
import logger from '../logger';

interface AuthRequest extends Request {
  user?: {
    id: string;
    username: string;
  };
}

export const authenticateToken = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ error: 'Access token is required' });
    }
    
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET!) as any;
    
    const userRepository = AppDataSource.getRepository(User);
    const user = await userRepository.findOne({ where: { id: decoded.userId } });
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    
    req.user = {
      id: user.id,
      username: user.username
    };
    
    next();
  } catch (error) {
    logger.error('Authentication error:', error);
    res.status(401).json({ error: 'Invalid token' });
  }
};

export const requireOrganizationAccess = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const organizationId = req.params.organizationId || req.body.organizationId;
    
    if (!organizationId) {
      return res.status(400).json({ error: 'Organization ID is required' });
    }
    
    // Set the user context for RLS
    await AppDataSource.manager.query(`SET LOCAL app.user_id = $1`, [req.user.id]);
    
    const orgMembershipRepository = AppDataSource.getRepository('OrgMembership');
    const membership = await orgMembershipRepository.findOne({
      where: {
        organizationId,
        userId: req.user.id
      }
    });
    
    if (!membership) {
      return res.status(403).json({ error: 'Access denied to this organization' });
    }
    
    req.user.organizationId = organizationId;
    req.user.role = membership.role;
    
    next();
  } catch (error) {
    logger.error('Organization access check error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const requireAdminAccess = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user || !req.user.role) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  if (req.user.role !== 'OWNER' && req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  
  next();
};
