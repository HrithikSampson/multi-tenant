# Multi-Tenant Task Management Frontend

A React frontend for the multi-tenant task management application.

## Features

- **Authentication**: Login and registration with JWT tokens
- **Workspace Selection**: Choose from available organizations
- **Project Management**: Create and manage projects
- **Task Management**: Create, update, and track tasks
- **Role-Based Access**: Different permissions for OWNER, ADMIN, EDITOR, and VIEWER roles

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create environment file:
```bash
cp .env.example .env
```

3. Update the API URL in `.env`:
```
REACT_APP_API_URL=http://localhost:3000/api
```

4. Start the development server:
```bash
npm start
```

## Tech Stack

- **React 18** with TypeScript
- **React Router** for navigation
- **Tailwind CSS** for styling
- **Axios** for API calls
- **Lucide React** for icons

## Project Structure

```
src/
├── components/          # Reusable components
├── contexts/           # React contexts (Auth)
├── pages/              # Page components
├── services/           # API services
├── types/              # TypeScript type definitions
└── App.tsx             # Main app component
```

## API Integration

The frontend integrates with the backend API endpoints:

- **Authentication**: `/api/auth/*`
- **Organizations**: `/api/organizations/*`
- **Projects**: `/api/projects/*`
- **Tasks**: `/api/tasks/*`

## Role-Based Features

### OWNER/ADMIN
- Create organizations and projects
- Manage organization members
- Full project and task management

### EDITOR
- Create and manage tasks
- Update project details
- Manage project members

### VIEWER
- View projects and tasks
- Update task status (if assigned)

## Development

The app uses:
- **TypeScript** for type safety
- **Tailwind CSS** for styling
- **React Context** for state management
- **Protected Routes** for authentication
