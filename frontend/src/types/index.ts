export interface User {
  userId: string;
  username: string;
}

export interface Organization {
  id: string;
  name: string;
  subdomain: string;
  role: 'OWNER' | 'ADMIN' | 'USER';
}

export interface Project {
  id: string;
  name: string;
  slug: string;
  created_at: string;
  user_role?: 'EDITOR' | 'VIEWER';
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: 'TODO' | 'INPROGRESS' | 'DONE';
  assignee_id?: string;
  assignee_username?: string;
  due_date?: string;
  priority?: number;
  order_in_board: number;
  created_by: string;
  created_by_username?: string;
  created_at: string;
  updated_at: string;
}

export interface ProjectMember {
  id: string;
  username: string;
  role: 'EDITOR' | 'VIEWER';
  joined_at: string;
}

export interface AuthContextType {
  user: User | null;
  token: string | null;
  organizationId: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  setOrganization: (organizationId: string) => void;
  isAuthenticated: boolean;
}
