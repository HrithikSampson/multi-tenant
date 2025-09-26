import { Router, Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { Project } from '../entity/project.entity';
import { ProjectMember } from '../entity/project-member.entity';
import { Activity } from '../entity/activity.entity';
import { ActivityKind, ProjectRole } from '../db/enums';
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

router.post('/:organizationId/projects', authenticateToken, requireOrganizationAccess, requireAdminAccess, async (req: AuthRequest, res: Response) => {
  try {
    const { name, slug } = req.body;
    const { organizationId } = req.params;
    
    if (!name || !slug) {
      return res.status(400).json({ error: 'Name and slug are required' });
    }
    
    const projectRepository = AppDataSource.getRepository(Project);
    const existingProject = await projectRepository.findOne({
      where: {
        organizationId,
        slug
      }
    });
    
    if (existingProject) {
      return res.status(400).json({ error: 'Project slug already exists in this organization' });
    }
    
    const project = projectRepository.create({
      organizationId,
      name,
      slug
    });
    
    await projectRepository.save(project);
    
    const projectMemberRepository = AppDataSource.getRepository(ProjectMember);
    const projectMember = projectMemberRepository.create({
      organizationId,
      projectId: project.id,
      userId: req.user!.id,
      role: ProjectRole.EDITOR
    });
    
    await projectMemberRepository.save(projectMember);
    
    const activityRepository = AppDataSource.getRepository(Activity);
    const activity = activityRepository.create({
      organizationId,
      actorId: req.user!.id,
      kind: ActivityKind.ANNOUNCE,
      message: `${req.user!.username} created project "${name}"`,
      objectType: 'project',
      objectId: project.id
    });
    
    await activityRepository.save(activity);
    
    logger.info(`Project created: ${name} in organization ${organizationId}`);
    
    res.status(201).json({
      message: 'Project created successfully',
      project: {
        id: project.id,
        name: project.name,
        slug: project.slug,
        createdAt: project.createdAt
      }
    });
  } catch (error) {
    logger.error('Create project error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:organizationId/projects', authenticateToken, requireOrganizationAccess, async (req: AuthRequest, res: Response) => {
  try {
    const { organizationId } = req.params;
    
    const projectRepository = AppDataSource.getRepository(Project);
    const projects = await projectRepository.find({
      where: { organizationId },
      relations: ['members', 'members.user']
    });
    
    const projectList = projects.map(project => ({
      id: project.id,
      name: project.name,
      slug: project.slug,
      createdAt: project.createdAt,
      members: project.members?.map(member => ({
        id: member.user.id,
        username: member.user.username,
        role: member.role
      })) || []
    }));
    
    res.json({ projects: projectList });
  } catch (error) {
    logger.error('Get projects error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:organizationId/projects/:projectId', authenticateToken, requireOrganizationAccess, async (req: AuthRequest, res: Response) => {
  try {
    const { organizationId, projectId } = req.params;
    
    const projectRepository = AppDataSource.getRepository(Project);
    const project = await projectRepository.findOne({
      where: {
        id: projectId,
        organizationId
      },
      relations: ['members', 'members.user', 'tasks']
    });
    
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    const members = project.members?.map(member => ({
      id: member.user.id,
      username: member.user.username,
      role: member.role
    })) || [];
    
    const tasks = project.tasks?.map(task => ({
      id: task.id,
      title: task.title,
      status: task.status,
      assigneeId: task.assigneeId,
      createdAt: task.createdAt
    })) || [];
    
    res.json({
      project: {
        id: project.id,
        name: project.name,
        slug: project.slug,
        createdAt: project.createdAt
      },
      members,
      tasks
    });
  } catch (error) {
    logger.error('Get project error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:organizationId/projects/:projectId/members', authenticateToken, requireOrganizationAccess, requireAdminAccess, async (req: AuthRequest, res: Response) => {
  try {
    const { userId, role } = req.body;
    const { organizationId, projectId } = req.params;
    
    if (!userId || !role) {
      return res.status(400).json({ error: 'User ID and role are required' });
    }
    
    if (!['EDITOR', 'VIEWER'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }
    
    const projectMemberRepository = AppDataSource.getRepository(ProjectMember);
    const existingMember = await projectMemberRepository.findOne({
      where: {
        organizationId,
        projectId,
        userId
      }
    });
    
    if (existingMember) {
      return res.status(400).json({ error: 'User is already a member of this project' });
    }
    
    const projectMember = projectMemberRepository.create({
      organizationId,
      projectId,
      userId,
      role: role as ProjectRole
    });
    
    await projectMemberRepository.save(projectMember);
    
    const activityRepository = AppDataSource.getRepository(Activity);
    const activity = activityRepository.create({
      organizationId,
      actorId: req.user!.id,
      kind: ActivityKind.NOTIFY,
      message: `${req.user!.username} added member to project`,
      objectType: 'project_member',
      objectId: projectMember.organizationId
    });
    
    await activityRepository.save(activity);
    
    logger.info(`Member added to project ${projectId} in organization ${organizationId}`);
    
    res.status(201).json({
      message: 'Member added successfully',
      member: {
        userId: projectMember.userId,
        role: projectMember.role
      }
    });
  } catch (error) {
    logger.error('Add project member error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
