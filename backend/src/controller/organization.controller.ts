import { Router, Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { Organization } from '../entity/organization.entity';
import { OrgMembership } from '../entity/org-membership.entity';
import { User } from '../entity/user.entity';
import { Activity } from '../entity/activity.entity';
import { ActivityKind, OrgRole } from '../db/enums';
import { authenticateToken, requireOrganizationAccess, requireAdminAccess } from '../utils/middleware/auth.middleware';
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

router.post('/create', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { name, subdomain } = req.body;
    
    if (!name || !subdomain) {
      return res.status(400).json({ error: 'Name and subdomain are required' });
    }
    
    const organizationRepository = AppDataSource.getRepository(Organization);
    const existingOrg = await organizationRepository.findOne({ where: { subdomain } });
    
    if (existingOrg) {
      return res.status(400).json({ error: 'Subdomain already exists' });
    }
    
    const organization = organizationRepository.create({
      name,
      subdomain
    });
    
    await organizationRepository.save(organization);
    
    const membershipRepository = AppDataSource.getRepository(OrgMembership);
    const membership = membershipRepository.create({
      organizationId: organization.id,
      userId: req.user!.id,
      role: OrgRole.OWNER
    });
    
    await membershipRepository.save(membership);
    
    const activityRepository = AppDataSource.getRepository(Activity);
    const activity = activityRepository.create({
      organizationId: organization.id,
      actorId: req.user!.id,
      kind: ActivityKind.ANNOUNCE,
      message: `${req.user!.username} created organization "${name}"`,
      objectType: 'organization',
      objectId: organization.id
    });
    
    await activityRepository.save(activity);
    
    logger.info(`Organization created: ${name} by ${req.user!.username}`);
    
    res.status(201).json({
      message: 'Organization created successfully',
      organization: {
        id: organization.id,
        name: organization.name,
        subdomain: organization.subdomain,
        roomKey: organization.roomKey,
        createdAt: organization.createdAt
      }
    });
  } catch (error) {
    logger.error('Create organization error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/join', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { organizationId } = req.body;
    
    if (!organizationId) {
      return res.status(400).json({ error: 'Organization ID is required' });
    }
    
    const organizationRepository = AppDataSource.getRepository(Organization);
    const organization = await organizationRepository.findOne({ where: { id: organizationId } });
    
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    const membershipRepository = AppDataSource.getRepository(OrgMembership);
    const existingMembership = await membershipRepository.findOne({
      where: {
        organizationId,
        userId: req.user!.id
      }
    });
    
    if (existingMembership) {
      return res.status(400).json({ error: 'Already a member of this organization' });
    }
    
    const membership = membershipRepository.create({
      organizationId,
      userId: req.user!.id,
      role: OrgRole.USER
    });
    
    await membershipRepository.save(membership);
    
    const activityRepository = AppDataSource.getRepository(Activity);
    const activity = activityRepository.create({
      organizationId,
      actorId: req.user!.id,
      kind: ActivityKind.NOTIFY,
      message: `${req.user!.username} joined the organization`,
      objectType: 'membership',
      objectId: membership.organizationId
    });
    
    await activityRepository.save(activity);
    
    logger.info(`User ${req.user!.username} joined organization ${organizationId}`);
    
    res.status(201).json({
      message: 'Successfully joined organization',
      organization: {
        id: organization.id,
        name: organization.name,
        subdomain: organization.subdomain
      }
    });
  } catch (error) {
    logger.error('Join organization error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:organizationId', authenticateToken, requireOrganizationAccess, async (req: AuthRequest, res: Response) => {
  try {
    const organizationRepository = AppDataSource.getRepository(Organization);
    const organization = await organizationRepository.findOne({
      where: { id: req.params.organizationId },
      relations: ['memberships', 'memberships.user', 'projects']
    });
    
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    const members = organization.memberships?.map(membership => ({
      id: membership.user.id,
      username: membership.user.username,
      role: membership.role,
      joinedAt: membership.createdAt
    })) || [];
    
    const projects = organization.projects?.map(project => ({
      id: project.id,
      name: project.name,
      slug: project.slug,
      createdAt: project.createdAt
    })) || [];
    
    res.json({
      organization: {
        id: organization.id,
        name: organization.name,
        subdomain: organization.subdomain,
        roomKey: organization.roomKey,
        createdAt: organization.createdAt
      },
      members,
      projects
    });
  } catch (error) {
    logger.error('Get organization error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:organizationId/members', authenticateToken, requireOrganizationAccess, async (req: AuthRequest, res: Response) => {
  try {
    const membershipRepository = AppDataSource.getRepository(OrgMembership);
    const memberships = await membershipRepository.find({
      where: { organizationId: req.params.organizationId },
      relations: ['user']
    });
    
    const members = memberships.map(membership => ({
      id: membership.user.id,
      username: membership.user.username,
      role: membership.role,
      joinedAt: membership.createdAt
    }));
    
    res.json({ members });
  } catch (error) {
    logger.error('Get organization members error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:organizationId/members/:userId/role', authenticateToken, requireOrganizationAccess, requireAdminAccess, async (req: AuthRequest, res: Response) => {
  try {
    const { role } = req.body;
    const { organizationId, userId } = req.params;
    
    if (!role || !['OWNER', 'ADMIN', 'USER'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }
    
    const membershipRepository = AppDataSource.getRepository(OrgMembership);
    const membership = await membershipRepository.findOne({
      where: {
        organizationId,
        userId
      }
    });
    
    if (!membership) {
      return res.status(404).json({ error: 'Membership not found' });
    }
    
    membership.role = role as OrgRole;
    await membershipRepository.save(membership);
    
    const activityRepository = AppDataSource.getRepository(Activity);
    const activity = activityRepository.create({
      organizationId,
      actorId: req.user!.id,
      kind: ActivityKind.NOTIFY,
      message: `${req.user!.username} updated role to ${role}`,
      objectType: 'membership',
      objectId: membership.organizationId
    });
    
    await activityRepository.save(activity);
    
    logger.info(`Role updated for user ${userId} in organization ${organizationId}`);
    
    res.json({
      message: 'Role updated successfully',
      membership: {
        userId: membership.userId,
        role: membership.role
      }
    });
  } catch (error) {
    logger.error('Update member role error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;