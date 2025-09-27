import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { organizationAPI } from '../services/api';
import { Organization } from '../types';
import { Building2, Plus, ArrowRight, Crown, Shield, User } from 'lucide-react';

const WorkspaceSelection: React.FC = () => {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const [newOrgSubdomain, setNewOrgSubdomain] = useState('');
  const [creating, setCreating] = useState(false);
  
  const { user, setOrganization } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    fetchOrganizations();
  }, []);

  const fetchOrganizations = async () => {
    try {
      const orgs = await organizationAPI.getOrganizations();
      setOrganizations(orgs);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch organizations');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectOrganization = async (orgId: string) => {
    try {
      await organizationAPI.switchOrganization(orgId);
      setOrganization(orgId);
      navigate('/projects');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to switch organization');
    }
  };

  const handleCreateOrganization = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError('');

    try {
      await organizationAPI.createOrganization(newOrgName, newOrgSubdomain);
      setNewOrgName('');
      setNewOrgSubdomain('');
      setShowCreateForm(false);
      await fetchOrganizations();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create organization');
    } finally {
      setCreating(false);
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'OWNER':
        return <Crown className="h-4 w-4 text-yellow-500" />;
      case 'ADMIN':
        return <Shield className="h-4 w-4 text-blue-500" />;
      default:
        return <User className="h-4 w-4 text-gray-500" />;
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'OWNER':
        return 'bg-yellow-100 text-yellow-800';
      case 'ADMIN':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Welcome, {user?.username}!</h1>
          <p className="mt-2 text-gray-600">Select a workspace to continue</p>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md">
            {error}
          </div>
        )}

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {organizations.map((org) => (
            <div
              key={org.id}
              onClick={() => handleSelectOrganization(org.id)}
              className="bg-white rounded-lg shadow-md p-6 cursor-pointer hover:shadow-lg transition-shadow border border-gray-200"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center">
                  <Building2 className="h-8 w-8 text-primary-600 mr-3" />
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{org.name}</h3>
                    <p className="text-sm text-gray-500">@{org.subdomain}</p>
                  </div>
                </div>
                <ArrowRight className="h-5 w-5 text-gray-400" />
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  {getRoleIcon(org.role)}
                  <span className={`ml-2 px-2 py-1 rounded-full text-xs font-medium ${getRoleColor(org.role)}`}>
                    {org.role}
                  </span>
                </div>
              </div>
            </div>
          ))}

          <div
            onClick={() => setShowCreateForm(true)}
            className="bg-white rounded-lg shadow-md p-6 cursor-pointer hover:shadow-lg transition-shadow border-2 border-dashed border-gray-300 hover:border-primary-400"
          >
            <div className="flex flex-col items-center justify-center h-full">
              <Plus className="h-8 w-8 text-gray-400 mb-2" />
              <h3 className="text-lg font-medium text-gray-900">Create Workspace</h3>
              <p className="text-sm text-gray-500 text-center">Start a new organization</p>
            </div>
          </div>
        </div>

        {showCreateForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <h3 className="text-lg font-semibold mb-4">Create New Workspace</h3>
              
              <form onSubmit={handleCreateOrganization}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Organization Name
                    </label>
                    <input
                      type="text"
                      value={newOrgName}
                      onChange={(e) => setNewOrgName(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                      placeholder="Enter organization name"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Subdomain
                    </label>
                    <input
                      type="text"
                      value={newOrgSubdomain}
                      onChange={(e) => setNewOrgSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                      placeholder="organization-name"
                      required
                    />
                    <p className="text-xs text-gray-500 mt-1">Only lowercase letters, numbers, and hyphens</p>
                  </div>
                </div>
                
                <div className="flex justify-end space-x-3 mt-6">
                  <button
                    type="button"
                    onClick={() => setShowCreateForm(false)}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creating}
                    className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700 disabled:opacity-50"
                  >
                    {creating ? 'Creating...' : 'Create'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default WorkspaceSelection;
