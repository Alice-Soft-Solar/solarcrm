'use client';

import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import PageHeader from '@/components/PageHeader';
import { LoadingSpinner, Button } from '@/components/ui';

interface Employee {
  id: string;
  full_name: string;
  company_id: string;
  company_name?: string;
  role_id: string;
  phone_number?: string | null;
  roles: {
    role_name: string;
  } | {
    role_name: string;
  }[];
  auth_users?: {
    email: string;
  };
}

interface Role {
  id: string;
  role_name: string;
}

interface Company {
  id: string;
  name: string;
}

export default function EmployeesPage() {
  const router = useRouter();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    full_name: '',
    role_id: '',
    company_id: '',
    phone_number: '',
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const supabase = useMemo(() => createClient(supabaseUrl, supabaseKey), [supabaseUrl, supabaseKey]);

  useEffect(() => {
    checkAccessAndFetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const checkAccessAndFetch = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.push('/login');
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('roles (role_name)')
        .eq('id', user.id)
        .single();

      if (!profile) {
        router.push('/dashboard');
        return;
      }

      const roles = profile.roles as { role_name: string } | { role_name: string }[];
      const roleName = Array.isArray(roles) ? roles[0]?.role_name : roles?.role_name;

      if (roleName !== 'Admin' && roleName !== 'Super Admin') {
        router.push('/dashboard');
        return;
      }

      setCurrentUserId(user.id);
      await Promise.all([fetchEmployees(user.id), fetchRoles(), fetchCompanies()]);
    } catch (err) {
      console.error('Error:', err);
      router.push('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployees = async (excludeUserId: string) => {
    console.log('Fetching employees, excluding user ID:', excludeUserId);
    
    try {
      // Fetch profiles via API route (uses service role key, bypasses RLS)
      const response = await fetch('/api/employees/list', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ excludeUserId }),
      });

      const result = await response.json();

      if (!response.ok) {
        console.error('❌ Error fetching employees:', result.error);
        alert(`Error loading employees: ${result.error}. Check console for details.`);
        setEmployees([]);
        return;
      }

      const profilesData = result.profiles || [];

      console.log('✅ Fetched profiles:', profilesData.length, 'profiles');
      if (profilesData.length > 0) {
        console.log('Profile details:', profilesData.map((p: any) => {
          const roles = p.roles as { role_name: string } | { role_name: string }[];
          const roleName = Array.isArray(roles) ? roles[0]?.role_name : roles?.role_name;
          return {
            id: p.id,
            name: p.full_name,
            role: roleName || 'N/A'
          };
        }));
      } else {
        console.warn('⚠️ No profiles found (excluding current user).');
      }

      if (profilesData.length === 0) {
        setEmployees([]);
        return;
      }

      // Fetch companies if not already loaded (handle race condition with parallel fetch)
      let companiesData = companies;
      if (companiesData.length === 0) {
        const { data: fetchedCompanies, error: companiesError } = await supabase
          .from('companies')
          .select('id, name')
          .order('name');
        
        if (!companiesError && fetchedCompanies) {
          companiesData = fetchedCompanies;
          setCompanies(fetchedCompanies); // Update state for future use
        }
      }

      // Create company map for quick lookup
      const companyMap: Record<string, string> = {};
      companiesData.forEach((company) => {
        companyMap[company.id] = company.name;
      });

      // Show employees immediately without waiting for emails
      const employeesWithData = profilesData.map((profile: any) => {
        return {
          id: profile.id,
          full_name: profile.full_name,
          company_id: profile.company_id,
          company_name: profile.company_id ? (companyMap[profile.company_id] || 'N/A') : 'N/A',
          role_id: profile.role_id,
          phone_number: profile.phone_number || null,
          roles: profile.roles,
          auth_users: {
            email: 'Loading...',
          },
        };
      });

      setEmployees(employeesWithData as Employee[]);

      // Fetch emails in background (non-blocking)
      const userIds = profilesData.map((p: any) => p.id);
    fetch('/api/employees/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userIds }),
    })
      .then((response) => {
        if (response.ok) {
          return response.json();
        }
        throw new Error('Failed to fetch emails');
      })
      .then((data) => {
        const emailMap = data.emailMap || {};
        // Update employees with emails, preserving company_name
        const updatedEmployees = employeesWithData.map((employee: any) => ({
          ...employee,
          company_name: employee.company_name || (employee.company_id ? (companyMap[employee.company_id] || 'N/A') : 'N/A'),
          auth_users: {
            email: emailMap[employee.id] || 'N/A',
          },
        }));
        setEmployees(updatedEmployees as Employee[]);
      })
      .catch((error) => {
        console.error('Error fetching emails:', error);
        // Update employees to show N/A for emails, preserving company_name
        const updatedEmployees = employeesWithData.map((employee: any) => ({
          ...employee,
          company_name: employee.company_name || (employee.company_id ? (companyMap[employee.company_id] || 'N/A') : 'N/A'),
          auth_users: {
            email: 'N/A',
          },
        }));
        setEmployees(updatedEmployees as Employee[]);
      });
    } catch (error: any) {
      console.error('Error in fetchEmployees:', error);
      alert(`Error loading employees: ${error.message}`);
      setEmployees([]);
    }
  };

  const fetchRoles = async () => {
    const { data, error } = await supabase
      .from('roles')
      .select('id, role_name')
      .order('role_name');

    if (error) {
      console.error('Error fetching roles:', error);
      return;
    }

    setRoles(data || []);
  };

  const fetchCompanies = async () => {
    const { data, error } = await supabase
      .from('companies')
      .select('id, name')
      .order('name');

    if (error) {
      console.error('Error fetching companies:', error);
      setCompanies([]);
      return;
    }

    console.log('Fetched companies:', data); // Debug: Check if companies are fetched
    setCompanies(data || []);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (editingEmployee) {
        // Update existing employee via API route (uses service role key to bypass RLS)
        const response = await fetch('/api/employees/update', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            user_id: editingEmployee.id,
            full_name: formData.full_name,
            role_id: formData.role_id,
            company_id: formData.company_id,
            phone_number: formData.phone_number || null,
          }),
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || 'Failed to update employee');
        }
      } else {
        // Create new employee via API route (uses service role key)
        const response = await fetch('/api/employees/create', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: formData.email,
            password: formData.password,
            full_name: formData.full_name,
            role_id: formData.role_id,
            company_id: formData.company_id,
            phone_number: formData.phone_number || null,
          }),
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || 'Failed to create employee');
        }
      }

      setShowForm(false);
      setEditingEmployee(null);
      setFormData({ email: '', password: '', full_name: '', role_id: '', company_id: '', phone_number: '' });
      if (currentUserId) {
        await fetchEmployees(currentUserId);
      }
    } catch (error: any) {
      alert(error.message || 'An error occurred');
    }
  };

  const handleEdit = (employee: Employee) => {
    setEditingEmployee(employee);
    setFormData({
      email: '',
      password: '',
      full_name: employee.full_name,
      role_id: employee.role_id,
      company_id: employee.company_id,
      phone_number: employee.phone_number || '',
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this employee?')) return;

    try {
      // Delete employee via API route (uses service role key to bypass RLS)
      const response = await fetch('/api/employees/delete', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ user_id: id }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to delete employee');
      }

      if (currentUserId) {
        await fetchEmployees(currentUserId);
      }
    } catch (error: any) {
      alert(error.message || 'An error occurred');
    }
  };

  if (loading) {
    return <LoadingSpinner fullScreen text="Loading..." />;
  }

  return (
    <div className="min-h-screen bg-background">
      <PageHeader title="Employees" />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Employee Management</h2>
            <p className="mt-2 text-foreground opacity-70">
              Manage employees and their roles
            </p>
          </div>
          <Button
            onClick={() => {
              setShowForm(true);
              setEditingEmployee(null);
              setFormData({ email: '', password: '', full_name: '', role_id: '', company_id: '', phone_number: '' });
            }}
            variant="primary"
            size="sm"
          >
            Add Employee
          </Button>
        </div>

        {showForm && (
          <div className="mb-8 rounded-lg border border-zinc-200 bg-white p-6">
            <h3 className="mb-4 text-lg font-semibold text-foreground">
              {editingEmployee ? 'Edit Employee' : 'Add New Employee'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              {!editingEmployee && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-foreground">
                      Email
                    </label>
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="mt-1 block w-full rounded-md border border-border bg-white px-3 py-2 text-foreground placeholder-zinc-400 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent transition-all duration-200"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground">
                      Password
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        className="mt-1 block w-full rounded-md border border-border bg-white px-3 py-2 pr-10 text-foreground placeholder-zinc-400 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent transition-all duration-200"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground opacity-70 hover:text-foreground"
                      >
                        {showPassword ? (
                          <svg
                            className="h-5 w-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                            />
                          </svg>
                        ) : (
                          <svg
                            className="h-5 w-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                            />
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                            />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                </>
              )}
              <div>
                <label className="block text-sm font-medium text-foreground">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  className="mt-1 block w-full rounded-md border border-border bg-white px-3 py-2 text-foreground"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={formData.phone_number}
                  onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                  placeholder="+91 1234567890"
                  className="mt-1 block w-full rounded-md border border-border bg-white px-3 py-2 text-foreground placeholder-zinc-400 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent transition-all duration-200"
                />
                <p className="mt-1 text-xs text-foreground opacity-70">
                  Format: +91 followed by 10 digits (e.g., +91 9876543210)
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground">
                  Role
                </label>
                <select
                  required
                  value={formData.role_id}
                  onChange={(e) => setFormData({ ...formData, role_id: e.target.value })}
                  className="mt-1 block w-full rounded-md border border-border bg-white px-3 py-2 text-foreground"
                >
                  <option value="">Select a role</option>
                  {roles
                    .filter((role) => role.role_name !== 'Admin' && role.role_name !== 'Super Admin')
                    .map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.role_name}
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground">
                  Company <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={formData.company_id}
                  onChange={(e) => setFormData({ ...formData, company_id: e.target.value })}
                  className="mt-1 block w-full rounded-md border border-border bg-white px-3 py-2 text-foreground"
                >
                  <option value="">Select a company</option>
                  {companies.length > 0 ? (
                    companies.map((company) => (
                      <option key={company.id} value={company.id}>
                        {company.name}
                      </option>
                    ))
                  ) : (
                    <option value="" disabled>Loading companies...</option>
                  )}
                </select>
                {companies.length === 0 && !loading && (
                  <p className="mt-1 text-xs text-foreground opacity-70">
                    No companies found. Please create a company first.
                  </p>
                )}
              </div>
              <div className="flex gap-4">
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                >
                  {editingEmployee ? 'Update' : 'Create'}
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setEditingEmployee(null);
                  }}
                  variant="outline"
                  size="sm"
                >
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        )}

        <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow">
          <table className="min-w-full divide-y divide-zinc-200">
            <thead className="bg-zinc-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-foreground opacity-70">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-foreground opacity-70">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-foreground opacity-70">
                  Phone Number
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-foreground opacity-70">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-foreground opacity-70">
                  Company
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-foreground opacity-70">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 bg-white">
              {employees.map((employee) => (
                <tr key={employee.id} className="hover:bg-zinc-50 transition-colors duration-150">
                  <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-foreground">
                    {employee.full_name}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-foreground opacity-70">
                    {employee.auth_users?.email || 'N/A'}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-foreground opacity-70">
                    {employee.phone_number || 'N/A'}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-foreground opacity-70">
                    {Array.isArray(employee.roles) 
                      ? employee.roles[0]?.role_name || 'N/A'
                      : employee.roles?.role_name || 'N/A'}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-foreground opacity-70">
                    {employee.company_name || 'N/A'}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium">
                    <button
                      onClick={() => handleEdit(employee)}
                      className="mr-4 text-blue-600 hover:text-blue-700 transition-colors duration-150"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(employee.id)}
                      className="text-red-600 hover:text-red-700 transition-colors duration-150"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}

