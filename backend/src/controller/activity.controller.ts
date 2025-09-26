import { Router, Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { Activity } from '../entity/activity.entity';
import { authenticateToken, requireOrganizationAccess } from '../utils/middleware/auth.middleware';
import logger from '../utils/logger';

const router = Router();

interface AuthRequest extends Request {
  user?: {
    id: string;
    username: string;
    organizationId?: string;
    role?: string;
  };
}

router.get('/:organizationId/activities', authenticateToken, requireOrganizationAccess, async (req: AuthRequest, res: Response) => {
  try {
    const { organizationId } = req.params;
    const { page = 1, limit = 20, kind } = req.query;
    
    const activityRepository = AppDataSource.getRepository(Activity);
    const whereClause: any = { organizationId };
    
    if (kind) {
      whereClause.kind = kind;
    }
    
    const [activities, total] = await activityRepository.findAndCount({
      where: whereClause,
      relations: ['actor'],
      order: {
        createdAt: 'DESC'
      },
      skip: (Number(page) - 1) * Number(limit),
      take: Number(limit)
    });
    
    const activityList = activities.map(activity => ({
      id: activity.id,
      kind: activity.kind,
      message: activity.message,
      objectType: activity.objectType,
      objectId: activity.objectId,
      meta: activity.meta,
      actor: {
        id: activity.actor.id,
        username: activity.actor.username
      },
      createdAt: activity.createdAt
    }));
    
    res.json({
      activities: activityList,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    });
  } catch (error) {
    logger.error('Get activities error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:organizationId/activities/recent', authenticateToken, requireOrganizationAccess, async (req: AuthRequest, res: Response) => {
  try {
    const { organizationId } = req.params;
    const { limit = 10 } = req.query;
    
    const activityRepository = AppDataSource.getRepository(Activity);
    const activities = await activityRepository.find({
      where: { organizationId },
      relations: ['actor'],
      order: {
        createdAt: 'DESC'
      },
      take: Number(limit)
    });
    
    const recentActivities = activities.map(activity => ({
      id: activity.id,
      kind: activity.kind,
      message: activity.message,
      actor: {
        id: activity.actor.id,
        username: activity.actor.username
      },
      createdAt: activity.createdAt
    }));
    
    res.json({ activities: recentActivities });
  } catch (error) {
    logger.error('Get recent activities error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
