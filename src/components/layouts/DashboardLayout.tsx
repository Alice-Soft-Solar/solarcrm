'use client';

import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useMemo, ReactNode } from 'react';
import { Button, LoadingSpinner } from '../ui';
import AppDrawer from '../navigation/AppDrawer';

interface Profile {
  id: string;
  full_name: string;
  company_id: string;
  role_id: string;
  roles: {
    role_name: string;
  } | {
    role_name: string;
  }[];
}

interface DashboardLayoutProps {
  children: ReactNode;
  requireAuth?: boolean;
  requiredRole?: string | string[];
}

export default function DashboardLayout({
  children,
  requireAuth = true,
  requiredRole,
}: DashboardLayoutProps) {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const supabase = useMemo(() => createClient(supabaseUrl, supabaseKey), [supabaseUrl, supabaseKey]);

  useEffect(() => {
    if (!requireAuth) {
      setLoading(false);
      setAuthorized(true);
      return;
    }

    const checkAuth = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
          router.push('/login');
          return;
        }

        const { data: profileData, error } = await supabase
          .from('profiles')
          .select(`
            id,
            full_name,
            company_id,
            role_id,
            roles (
              role_name
            )
          `)
          .eq('id', user.id)
          .single();

        if (error || !profileData) {
          console.error('Error fetching profile:', error);
          router.push('/login');
          return;
        }

        // Handle roles which can be an array or single object
        const roles = profileData.roles as { role_name: string } | { role_name: string }[];
        const roleData = Array.isArray(roles) ? roles[0] : roles;

        const normalizedProfile: Profile = {
          ...profileData,
          roles: roleData || { role_name: '' },
        };

        // Check role authorization
        if (requiredRole) {
          const roles = normalizedProfile.roles as { role_name: string } | { role_name: string }[];
          const roleData = Array.isArray(roles) ? roles[0] : roles;
          const roleName = roleData?.role_name || '';
          const requiredRoles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
          if (!roleName || !requiredRoles.includes(roleName)) {
            router.push('/dashboard');
            return;
          }
        }

        setProfile(normalizedProfile);
        setAuthorized(true);
      } catch (err) {
        console.error('Error:', err);
        router.push('/login');
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [router, supabase, requireAuth, requiredRole]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  if (loading) {
    return <LoadingSpinner fullScreen text="Loading..." />;
  }

  if (!authorized || !profile) {
    return null;
  }

  const roleName = typeof profile.roles === 'object' && 'role_name' in profile.roles
    ? profile.roles.role_name
    : Array.isArray(profile.roles) && profile.roles[0]
    ? profile.roles[0].role_name
    : '';

  // Menu items for app drawer
  const menuItems = [
    {
      title: 'View All Work Orders',
      href: '/dashboard/work-orders/list',
      icon: (
        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
    },
    ...(roleName !== 'Inventory'
      ? [
          {
            title: 'Create Work Order',
            href: '/dashboard/work-orders',
            icon: (
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            ),
          },
        ]
      : []),
    ...((roleName === 'Admin' || roleName === 'Super Admin')
      ? [
          {
            title: 'Employee Management',
            href: '/dashboard/employees',
            icon: (
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            ),
            roles: ['Admin', 'Super Admin'],
          },
        ]
      : []),
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Sidebar */}
      <AppDrawer 
        roleName={roleName} 
        menuItems={menuItems}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
      />

      {/* Main Content Area - Shifts when sidebar opens */}
      <div
        className={`
          transition-all duration-300 ease-in-out
          ${sidebarOpen ? 'ml-72' : 'ml-0'}
        `}
      >
        <nav className="border-b border-border bg-white shadow-sm sticky top-0 z-40">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex h-16 items-center justify-between">
              <div className="flex items-center gap-4">
                {/* Burger Menu Button in Header */}
                <button
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  className="flex h-10 w-10 items-center justify-center rounded-lg text-foreground hover:bg-foreground/5 transition-colors duration-200"
                  aria-label="Toggle menu"
                >
                  <div className="flex flex-col gap-1.5">
                    <span
                      className={`h-0.5 w-5 bg-foreground transition-all duration-300 ${
                        sidebarOpen ? 'rotate-45 translate-y-1.5' : ''
                      }`}
                    />
                    <span
                      className={`h-0.5 w-5 bg-foreground transition-all duration-300 ${
                        sidebarOpen ? 'opacity-0' : ''
                      }`}
                    />
                    <span
                      className={`h-0.5 w-5 bg-foreground transition-all duration-300 ${
                        sidebarOpen ? '-rotate-45 -translate-y-1.5' : ''
                      }`}
                    />
                  </div>
                </button>
                
                <h1 className="text-xl font-bold text-foreground">
                  Solar CRM
                </h1>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-sm text-foreground">
                  {profile.full_name} ({roleName})
                </span>
                <Button
                  onClick={handleLogout}
                  variant="primary"
                  size="sm"
                >
                  Logout
                </Button>
              </div>
            </div>
          </div>
        </nav>

        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}

