import { Router, Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { Task } from '../entity/task.entity';
import { Activity } from '../entity/activity.entity';
import { ActivityKind, TaskStatus } from '../db/enums';
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

router.post('/:organizationId/projects/:projectId/tasks', authenticateToken, requireOrganizationAccess, async (req: AuthRequest, res: Response) => {
  try {
    const { title, description, assigneeId, dueDate, priority } = req.body;
    const { organizationId, projectId } = req.params;
    
    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }
    
    const taskRepository = AppDataSource.getRepository(Task);
    const task = taskRepository.create({
      organizationId,
      projectId,
      title,
      description,
      assigneeId,
      dueDate,
      priority,
      createdBy: req.user!.id,
      status: TaskStatus.TODO
    });
    
    await taskRepository.save(task);
    
    const activityRepository = AppDataSource.getRepository(Activity);
    const activity = activityRepository.create({
      organizationId,
      actorId: req.user!.id,
      kind: ActivityKind.NOTIFY,
      message: `${req.user!.username} created task "${title}"`,
      objectType: 'task',
      objectId: task.id
    });
    
    await activityRepository.save(activity);
    
    logger.info(`Task created: ${title} in project ${projectId}`);
    
    res.status(201).json({
      message: 'Task created successfully',
      task: {
        id: task.id,
        title: task.title,
        description: task.description,
        status: task.status,
        assigneeId: task.assigneeId,
        dueDate: task.dueDate,
        priority: task.priority,
        createdAt: task.createdAt
      }
    });
  } catch (error) {
    logger.error('Create task error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:organizationId/projects/:projectId/tasks', authenticateToken, requireOrganizationAccess, async (req: AuthRequest, res: Response) => {
  try {
    const { organizationId, projectId } = req.params;
    const { status } = req.query;
    
    const taskRepository = AppDataSource.getRepository(Task);
    const whereClause: any = {
      organizationId,
      projectId
    };
    
    if (status) {
      whereClause.status = status;
    }
    
    const tasks = await taskRepository.find({
      where: whereClause,
      relations: ['assignee', 'createdByUser'],
      order: {
        orderInBoard: 'ASC',
        createdAt: 'DESC'
      }
    });
    
    const taskList = tasks.map(task => ({
      id: task.id,
      title: task.title,
      description: task.description,
      status: task.status,
      assigneeId: task.assigneeId,
      assignee: task.assignee ? {
        id: task.assignee.id,
        username: task.assignee.username
      } : null,
      dueDate: task.dueDate,
      priority: task.priority,
      orderInBoard: task.orderInBoard,
      createdBy: task.createdBy,
      createdByUser: task.createdByUser ? {
        id: task.createdByUser.id,
        username: task.createdByUser.username
      } : null,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt
    }));
    
    res.json({ tasks: taskList });
  } catch (error) {
    logger.error('Get tasks error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:organizationId/projects/:projectId/tasks/:taskId', authenticateToken, requireOrganizationAccess, async (req: AuthRequest, res: Response) => {
  try {
    const { title, description, status, assigneeId, dueDate, priority, orderInBoard } = req.body;
    const { organizationId, projectId, taskId } = req.params;
    
    const taskRepository = AppDataSource.getRepository(Task);
    const task = await taskRepository.findOne({
      where: {
        id: taskId,
        organizationId,
        projectId
      }
    });
    
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    if (title !== undefined) task.title = title;
    if (description !== undefined) task.description = description;
    if (status !== undefined) task.status = status as TaskStatus;
    if (assigneeId !== undefined) task.assigneeId = assigneeId;
    if (dueDate !== undefined) task.dueDate = dueDate;
    if (priority !== undefined) task.priority = priority;
    if (orderInBoard !== undefined) task.orderInBoard = orderInBoard;
    
    task.updatedBy = req.user!.id;
    
    await taskRepository.save(task);
    
    const activityRepository = AppDataSource.getRepository(Activity);
    let activityMessage = '';
    
    if (status && status !== task.status) {
      activityMessage = `${req.user!.username} updated task "${task.title}" to ${status}`;
    } else {
      activityMessage = `${req.user!.username} updated task "${task.title}"`;
    }
    
    const activity = activityRepository.create({
      organizationId,
      actorId: req.user!.id,
      kind: ActivityKind.NOTIFY,
      message: activityMessage,
      objectType: 'task',
      objectId: task.id
    });
    
    await activityRepository.save(activity);
    
    logger.info(`Task updated: ${task.title} in project ${projectId}`);
    
    res.json({
      message: 'Task updated successfully',
      task: {
        id: task.id,
        title: task.title,
        description: task.description,
        status: task.status,
        assigneeId: task.assigneeId,
        dueDate: task.dueDate,
        priority: task.priority,
        orderInBoard: task.orderInBoard,
        updatedAt: task.updatedAt
      }
    });
  } catch (error) {
    logger.error('Update task error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:organizationId/projects/:projectId/tasks/:taskId', authenticateToken, requireOrganizationAccess, async (req: AuthRequest, res: Response) => {
  try {
    const { organizationId, projectId, taskId } = req.params;
    
    const taskRepository = AppDataSource.getRepository(Task);
    const task = await taskRepository.findOne({
      where: {
        id: taskId,
        organizationId,
        projectId
      }
    });
    
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    await taskRepository.remove(task);
    
    const activityRepository = AppDataSource.getRepository(Activity);
    const activity = activityRepository.create({
      organizationId,
      actorId: req.user!.id,
      kind: ActivityKind.NOTIFY,
      message: `${req.user!.username} deleted task "${task.title}"`,
      objectType: 'task',
      objectId: taskId
    });
    
    await activityRepository.save(activity);
    
    logger.info(`Task deleted: ${task.title} in project ${projectId}`);
    
    res.json({ message: 'Task deleted successfully' });
  } catch (error) {
    logger.error('Delete task error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:organizationId/projects/:projectId/tasks/board', authenticateToken, requireOrganizationAccess, async (req: AuthRequest, res: Response) => {
  try {
    const { organizationId, projectId } = req.params;
    
    const taskRepository = AppDataSource.getRepository(Task);
    const tasks = await taskRepository.find({
      where: {
        organizationId,
        projectId
      },
      relations: ['assignee'],
      order: {
        orderInBoard: 'ASC',
        createdAt: 'DESC'
      }
    });
    
    const board = {
      todo: tasks.filter(task => task.status === TaskStatus.TODO),
      inProgress: tasks.filter(task => task.status === TaskStatus.INPROGRESS),
      done: tasks.filter(task => task.status === TaskStatus.DONE)
    };
    
    res.json({ board });
  } catch (error) {
    logger.error('Get task board error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
