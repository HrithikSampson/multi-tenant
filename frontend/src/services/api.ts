import axios from 'axios';
import { Organization, Project, Task } from '../types';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  
  const organizationId = localStorage.getItem('organizationId');
  if (organizationId) {
    config.headers['X-Organization-ID'] = organizationId;
  }
  
  return config;
});

// Response interceptor to handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('organizationId');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  login: async (username: string, password: string) => {
    const response = await api.post('/auth/login', { username, password });
    return response.data;
  },
  
  register: async (username: string, password: string) => {
    const response = await api.post('/auth/register', { username, password });
    return response.data;
  },
  
  refresh: async () => {
    const response = await api.post('/auth/refresh');
    return response.data;
  },
};

// Organization API
export const organizationAPI = {
  getOrganizations: async (): Promise<Organization[]> => {
    const response = await api.get('/organizations');
    return response.data.organizations;
  },
  
  createOrganization: async (name: string, subdomain: string) => {
    const response = await api.post('/organizations', { name, subdomain });
    return response.data;
  },
  
  switchOrganization: async (organizationId: string) => {
    const response = await api.post(`/organizations/switch/${organizationId}`);
    return response.data;
  },
  
  getMembers: async (organizationId: string) => {
    const response = await api.get(`/organizations/${organizationId}/members`);
    return response.data.members;
  },
  
  addMember: async (organizationId: string, userId: string, role: string) => {
    const response = await api.post(`/organizations/${organizationId}/members`, {
      userId,
      role,
    });
    return response.data;
  },
  
  updateMemberRole: async (organizationId: string, userId: string, role: string) => {
    const response = await api.put(`/organizations/${organizationId}/members/${userId}`, {
      role,
    });
    return response.data;
  },
  
  removeMember: async (organizationId: string, userId: string) => {
    const response = await api.delete(`/organizations/${organizationId}/members/${userId}`);
    return response.data;
  },
};

// Project API
export const projectAPI = {
  getProjects: async (): Promise<Project[]> => {
    const response = await api.get('/projects');
    return response.data.projects;
  },
  
  createProject: async (name: string, slug: string) => {
    const response = await api.post('/projects', { name, slug });
    return response.data;
  },
  
  getProject: async (projectId: string) => {
    const response = await api.get(`/projects/${projectId}`);
    return response.data.project;
  },
  
  updateProject: async (projectId: string, data: { name?: string; slug?: string }) => {
    const response = await api.put(`/projects/${projectId}`, data);
    return response.data;
  },
  
  deleteProject: async (projectId: string) => {
    const response = await api.delete(`/projects/${projectId}`);
    return response.data;
  },
  
  getMembers: async (projectId: string) => {
    const response = await api.get(`/projects/${projectId}/members`);
    return response.data.members;
  },
  
  addMember: async (projectId: string, userId: string, role: 'EDITOR' | 'VIEWER') => {
    const response = await api.post(`/projects/${projectId}/members`, {
      userId,
      role,
    });
    return response.data;
  },
  
  updateMemberRole: async (projectId: string, userId: string, role: 'EDITOR' | 'VIEWER') => {
    const response = await api.put(`/projects/${projectId}/members/${userId}`, {
      role,
    });
    return response.data;
  },
  
  removeMember: async (projectId: string, userId: string) => {
    const response = await api.delete(`/projects/${projectId}/members/${userId}`);
    return response.data;
  },
};

// Task API
export const taskAPI = {
  getTasks: async (projectId: string, status?: string): Promise<Task[]> => {
    const params = status ? { status } : {};
    const response = await api.get(`/tasks/${projectId}/tasks`, { params });
    return response.data.tasks;
  },
  
  createTask: async (projectId: string, data: {
    title: string;
    description?: string;
    assigneeId?: string;
    dueDate?: string;
    priority?: number;
  }) => {
    const response = await api.post(`/tasks/${projectId}/tasks`, data);
    return response.data;
  },
  
  updateTask: async (projectId: string, taskId: string, data: {
    title?: string;
    description?: string;
    status?: 'TODO' | 'INPROGRESS' | 'DONE';
    assigneeId?: string;
    dueDate?: string;
    priority?: number;
    orderInBoard?: number;
  }) => {
    const response = await api.put(`/tasks/${projectId}/tasks/${taskId}`, data);
    return response.data;
  },
  
  deleteTask: async (projectId: string, taskId: string) => {
    const response = await api.delete(`/tasks/${projectId}/tasks/${taskId}`);
    return response.data;
  },
  
  getTaskBoard: async (projectId: string) => {
    const response = await api.get(`/tasks/${projectId}/tasks/board`);
    return response.data.board;
  },
};

export default api;
