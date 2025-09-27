import express, { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import cookieParser from 'cookie-parser';
import { AppDataSource } from '../../data-source';
import { QueryRunner } from 'typeorm';

const app = express();
app.use(cookieParser());
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey';
const ACCESS_EXPIRES_IN = '15m';
const REFRESH_EXPIRES_IN = '7d';

interface JWTPayload {
  userId: string;
  username?: string;
  iat?: number;
  exp?: number;
}

interface AuthenticatedRequest extends Request {
  user?: JWTPayload;
  queryRunner?: QueryRunner;
  accessToken?: string;
  organizationId?: string;
}

export const generateAccessToken = (payload: object): string => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_EXPIRES_IN });
};

export const generateRefreshToken = (payload: object): string => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: REFRESH_EXPIRES_IN });
};

export const verifyToken = (token: string): JWTPayload => {
  return jwt.verify(token, JWT_SECRET) as JWTPayload;
};

async function setUserContextInDB(queryRunner: QueryRunner, userId: string, organizationId?: string): Promise<void> {
  // Always set user_id for basic user context
  await queryRunner.query(`
    SELECT set_config('app.user_id', $1, true)
  `, [userId]);

  // Only set organization context if provided
  if (organizationId) {
    const userVerification = await queryRunner.query(`
      SELECT EXISTS (
        SELECT 1 FROM org_memberships om
        JOIN users u ON u.id = om.user_id  
        WHERE om.user_id = $1 AND om.organization_id = $2
      ) as user_exists
    `, [userId, organizationId]);

    if (!userVerification[0]?.user_exists) {
      throw new Error(`User ${userId} not authorized for organization ${organizationId}`);
    }

    await queryRunner.query(`
      SELECT set_config('app.organization_id', $1, true)
    `, [organizationId]);
  }
}

export const jwtMiddleware = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Authorization header missing' });
  }

  const token = authHeader.split(' ')[1];
  
  try {
    const decoded = verifyToken(token);
    
    if (!decoded.userId) {
      return res.status(401).json({ 
        message: 'Invalid token: missing user data' 
      });
    }

    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();

    try {
      // Always set user context, organization context comes from request
      await setUserContextInDB(queryRunner, decoded.userId);
      
      req.user = decoded;
      req.queryRunner = queryRunner;
      req.accessToken = token;
      
      res.on('finish', () => {
        if (req.queryRunner && !req.queryRunner.isReleased) {
          req.queryRunner.release();
        }
      });

      next();
      
    } catch (contextError) {
      await queryRunner.release();
      return res.status(403).json({ 
        message: 'User authorization failed' 
      });
    }
    
  } catch (err: any) {
    if (err.name === 'TokenExpiredError') {
      const refreshToken = req.cookies.refreshToken;
      
      if (refreshToken) {
        try {
          const refreshDecoded = verifyToken(refreshToken);
          const newAccessToken = generateAccessToken(refreshDecoded as object);
          
          return res.status(200).json({ 
            accessToken: newAccessToken,
            message: 'Token refreshed successfully'
          });
        } catch (refreshErr) {
          return res.status(403).json({ message: 'Invalid or expired refresh token' });
        }
      }
      return res.status(401).json({ message: 'Access token expired' });
    }
    
    return res.status(403).json({ message: 'Invalid access token' });
  }
};

export const executeWithRLS = async (req: AuthenticatedRequest, query: string, params: any[] = []) => {
  if (!req.queryRunner) {
    throw new Error('No database connection available');
  }
  
  return await req.queryRunner.query(query, params);
};

export const hasOrgAccess = async (req: AuthenticatedRequest, organizationId: string): Promise<boolean> => {
  if (!req.user || !req.queryRunner) {
    return false;
  }
  
  try {
    const result = await executeWithRLS(req, `
      SELECT EXISTS (
        SELECT 1 FROM org_memberships 
        WHERE user_id = $1 AND organization_id = $2
      ) as has_access
    `, [req.user.userId, organizationId]);
    
    return result[0]?.has_access || false;
  } catch (error) {
    return false;
  }
};

export const hasProjectAccess = async (req: AuthenticatedRequest, projectId: string): Promise<boolean> => {
  if (!req.user || !req.queryRunner) {
    return false;
  }
  
  try {
    const result = await executeWithRLS(req, `
      SELECT EXISTS (
        SELECT 1 FROM project_members pm
        WHERE pm.user_id = $1 AND pm.project_id = $2
      ) as has_access
    `, [req.user.userId, projectId]);
    
    return result[0]?.has_access || false;
  } catch (error) {
    return false;
  }
};

export const getUserOrganizations = async (req: AuthenticatedRequest) => {
  if (!req.user || !req.queryRunner) {
    return [];
  }
  
  try {
    // Query without RLS since we're getting user's own organizations
    const result = await req.queryRunner.query(`
      SELECT o.id, o.name, o.subdomain, om.role
      FROM organizations o
      JOIN org_memberships om ON o.id = om.organization_id
      WHERE om.user_id = $1
      ORDER BY o.name
    `, [req.user.userId]);
    
    return result;
  } catch (error) {
    return [];
  }
};

export const switchOrganization = async (req: AuthenticatedRequest, organizationId: string) => {
  if (!req.user || !req.queryRunner) {
    throw new Error('No user context available');
  }
  
  const hasAccess = await hasOrgAccess(req, organizationId);
  if (!hasAccess) {
    throw new Error('User does not have access to this organization');
  }
  
  await setUserContextInDB(req.queryRunner, req.user.userId, organizationId);
  req.organizationId = organizationId;
  
  return true;
};

export const setOrganizationContext = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const organizationId = req.headers['x-organization-id'] as string || req.body.organizationId;
  
  if (organizationId && req.queryRunner) {
    try {
      await setUserContextInDB(req.queryRunner, req.user!.userId, organizationId);
      req.organizationId = organizationId;
    } catch (error) {
      return res.status(403).json({ 
        message: 'Invalid organization access' 
      });
    }
  }
  
  next();
};

export const requireOrganization = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!req.organizationId) {
    return res.status(400).json({ 
      message: 'Organization context required. Please provide x-organization-id header or organizationId in body.' 
    });
  }
  
  next();
};



