'use client';

import { createClient } from '@supabase/supabase-js';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, useMemo, Suspense } from 'react';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { LoadingSpinner } from '@/components/ui';
import StatCard from '@/components/dashboard/StatCard';
import { getAccessToken } from '@/lib/supabase-client';
import ChartCard from '@/components/dashboard/ChartCard';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  Area,
  AreaChart,
} from 'recharts';

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

interface DashboardStats {
  workOrders: {
    total: number;
    pending: number;
    closed: number;
    toBeDispatched: number;
    dispatched: number;
    today: number;
    week: number;
    month: number;
  };
  leads: {
    total: number;
    interested: number;
    notInterested: number;
    followUpRequired: number;
  };
  // Sales Lead specific: separate stats for "My Leads" and "Team Leads"
  myLeads?: {
    total: number;
    interested: number;
    notInterested: number;
    followUpRequired: number;
  };
  teamLeads?: {
    total: number;
    interested: number;
    notInterested: number;
    followUpRequired: number;
  };
  payments: {
    todayReceived: number;
    monthlyReceived: number;
    pending: number;
  };
  dispatch: {
    today: number;
    week: number;
    month: number;
    pending: number;
  };
  charts: {
    statusDistribution: Record<string, number>;
    paymentsByDay: Array<{ date: string; amount: number }>;
  };
}

// Modern gradient color palette for charts
const CHART_COLORS = {
  primary: ['#0BC28E', '#10b981', '#059669'],
  blue: ['#3b82f6', '#2563eb', '#1d4ed8'],
  orange: ['#f59e0b', '#d97706', '#b45309'],
  red: ['#ef4444', '#dc2626', '#b91c1c'],
  purple: ['#8b5cf6', '#7c3aed', '#6d28d9'],
  emerald: ['#10b981', '#059669', '#047857'],
};

const PIE_COLORS = [
  'linear-gradient(135deg, #0BC28E 0%, #059669 100%)',
  'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
  'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
  'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
  'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
];

const SOLID_COLORS = ['#0BC28E', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const supabase = useMemo(() => createClient(supabaseUrl, supabaseKey), [supabaseUrl, supabaseKey]);

  useEffect(() => {
    const fetchProfile = async () => {
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

        const roles = profileData.roles as { role_name: string } | { role_name: string }[];
        const roleData = Array.isArray(roles) ? roles[0] : roles;

        const normalizedProfile: Profile = {
          ...profileData,
          roles: roleData || { role_name: '' },
        };

        setProfile(normalizedProfile);

        // Fetch dashboard stats
        const roleName = typeof normalizedProfile.roles === 'object' && 'role_name' in normalizedProfile.roles
          ? normalizedProfile.roles.role_name
          : Array.isArray(normalizedProfile.roles) && normalizedProfile.roles[0]
          ? normalizedProfile.roles[0].role_name
          : '';

        // Get filters from URL params (synced from work orders page)
        const searchQuery = searchParams.get('search') || '';
        const filterCompany = searchParams.get('company') || '';
        const filterSalesExecutive = searchParams.get('salesExecutive') || '';
        const filterPlantCapacity = searchParams.get('plantCapacity') || '';

        const accessToken = getAccessToken();
        const statsResponse = await fetch('/api/dashboard/stats', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(accessToken && { 'Authorization': `Bearer ${accessToken}` }),
          },
          body: JSON.stringify({
            ...(accessToken && { access_token: accessToken }),
            filters: {
              searchQuery,
              filterCompany,
              filterSalesExecutive,
              filterPlantCapacity,
            },
          }),
        });

        if (statsResponse.ok) {
          const statsData = await statsResponse.json();
          setStats(statsData.stats);
        }
      } catch (err) {
        console.error('Error:', err);
        router.push('/login');
      } finally {
        setLoading(false);
        setStatsLoading(false);
      }
    };

    fetchProfile();
  }, [router, supabase, searchParams]);

  if (loading) {
    return <LoadingSpinner fullScreen text="Loading..." />;
  }

  if (!profile) {
    return null;
  }

  const roleName = typeof profile.roles === 'object' && 'role_name' in profile.roles
    ? profile.roles.role_name
    : Array.isArray(profile.roles) && profile.roles[0]
    ? profile.roles[0].role_name
    : '';

  const isAdmin = roleName === 'Admin' || roleName === 'Super Admin';
  const isSalesLead = roleName === 'salesLead';
  const isSales = roleName === 'Sales';
  // Show leads section for Sales, Sales Lead, Admin, and Super Admin
  const showLeadsSection = isSales || isSalesLead || isAdmin;
  // Show work orders section for roles with access (Sales Lead now has access)
  const showWorkOrdersSection = (isAdmin || isSales || isSalesLead || roleName === 'Inventory') && stats?.workOrders;

  // Prepare chart data
  const statusChartData = stats?.charts?.statusDistribution
    ? Object.entries(stats.charts.statusDistribution).map(([name, value]) => ({
        name,
        value,
      }))
    : [];

  const paymentsChartData = stats?.charts?.paymentsByDay || [];

  const formatCurrency = (amount: number) => {
    return `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header with better visual hierarchy */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-foreground mb-2 tracking-tight">
                Dashboard
              </h1>
            </div>
            <div className="hidden md:flex flex-col items-end gap-1">
              <p className="text-foreground/70 text-lg">
                Welcome back, <span className="font-semibold text-foreground">{profile.full_name}</span>
              </p>
              <p className="text-sm text-foreground/60">
                {new Date().toLocaleDateString('en-US', { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </p>
            </div>
          </div>
        </div>

        {/* KPI Cards - Leads */}
        {showLeadsSection && (
          <>
            {/* Sales Lead: Show two separate sections */}
            {isSalesLead ? (
              <>
                {/* Section 1: My Leads (Sales Lead's own leads) */}
                <div>
                  <h2 className="text-xl font-semibold text-foreground mb-4">My Leads Overview</h2>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <StatCard
                      title="Total Leads"
                      value={stats?.myLeads?.total || 0}
                      subtitle="My leads"
                      icon={
                        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                      }
                      color="blue"
                    />
                    <StatCard
                      title="Interested"
                      value={stats?.myLeads?.interested || 0}
                      subtitle="Potential customers"
                      icon={
                        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      }
                      color="green"
                    />
                    <StatCard
                      title="Not Interested"
                      value={stats?.myLeads?.notInterested || 0}
                      subtitle="Closed leads"
                      icon={
                        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      }
                      color="red"
                    />
                    <StatCard
                      title="Follow Up Required"
                      value={stats?.myLeads?.followUpRequired || 0}
                      subtitle="Needs attention"
                      icon={
                        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      }
                      color="orange"
                    />
                  </div>
                </div>

                {/* Section 2: Team Leads (Sales role users' leads) */}
                <div>
                  <h2 className="text-xl font-semibold text-foreground mb-4">Team Leads Overview</h2>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <StatCard
                      title="Total Leads"
                      value={stats?.teamLeads?.total || 0}
                      subtitle="Team leads"
                      icon={
                        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                      }
                      color="blue"
                    />
                    <StatCard
                      title="Interested"
                      value={stats?.teamLeads?.interested || 0}
                      subtitle="Potential customers"
                      icon={
                        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      }
                      color="green"
                    />
                    <StatCard
                      title="Not Interested"
                      value={stats?.teamLeads?.notInterested || 0}
                      subtitle="Closed leads"
                      icon={
                        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      }
                      color="red"
                    />
                    <StatCard
                      title="Follow Up Required"
                      value={stats?.teamLeads?.followUpRequired || 0}
                      subtitle="Needs attention"
                      icon={
                        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      }
                      color="orange"
                    />
                  </div>
                </div>
              </>
            ) : (
              /* Other roles (Sales, Admin, Super Admin): Show single section */
              <div>
                <h2 className="text-xl font-semibold text-foreground mb-4">Leads Overview</h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <StatCard
                    title="Total Leads"
                    value={stats?.leads.total || 0}
                    subtitle="All leads"
                    icon={
                      <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                    }
                    color="blue"
                  />
                  <StatCard
                    title="Interested"
                    value={stats?.leads.interested || 0}
                    subtitle="Potential customers"
                    icon={
                      <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    }
                    color="green"
                  />
                  <StatCard
                    title="Not Interested"
                    value={stats?.leads.notInterested || 0}
                    subtitle="Closed leads"
                    icon={
                      <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    }
                    color="red"
                  />
                  <StatCard
                    title="Follow Up Required"
                    value={stats?.leads.followUpRequired || 0}
                    subtitle="Needs attention"
                    icon={
                      <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    }
                    color="orange"
                  />
                </div>
              </div>
            )}
          </>
        )}

        {/* KPI Cards - Work Orders (Only for roles with work order access - explicitly deny Sales Lead) */}
        {showWorkOrdersSection && (
          <div>
            <h2 className="text-xl font-semibold text-foreground mb-4">Work Orders Overview</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <StatCard
                title="Total Work Orders"
                value={stats.workOrders.total || 0}
                subtitle="All time"
                icon={
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                }
                color="blue"
              />
              <StatCard
                title="Pending"
                value={stats.workOrders.pending || 0}
                subtitle="Awaiting action"
                icon={
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                }
                color="orange"
              />
              <StatCard
                title="To Be Dispatched"
                value={stats.workOrders.toBeDispatched || 0}
                subtitle="Ready for dispatch"
                icon={
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                }
                color="purple"
              />
              <StatCard
                title="Dispatched"
                value={stats.workOrders.dispatched || 0}
                subtitle="Successfully dispatched"
                icon={
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                }
                color="green"
              />
              <StatCard
                title="Closed"
                value={stats.workOrders.closed || 0}
                subtitle="Completed orders"
                icon={
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                }
                color="blue"
              />
            </div>
          </div>
        )}

        {/* KPI Cards - Payments */}
        {isAdmin && (
          <div>
            <h2 className="text-xl font-semibold text-foreground mb-4">Payments Dashboard</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <StatCard
                title="Received Today"
                value={formatCurrency(stats?.payments.todayReceived || 0)}
                subtitle="Today's collections"
                icon={
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                }
                color="green"
              />
              <StatCard
                title="Monthly Received"
                value={formatCurrency(stats?.payments.monthlyReceived || 0)}
                subtitle="This month"
                icon={
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                }
                color="blue"
              />
              <StatCard
                title="Pending Payments"
                value={formatCurrency(stats?.payments.pending || 0)}
                subtitle="Outstanding amount"
                icon={
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                }
                color="red"
              />
            </div>
          </div>
        )}

        {/* Dispatch Summary */}
        {isAdmin && (
          <div>
            <h2 className="text-xl font-semibold text-foreground mb-4">Dispatch Summary</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                title="Today"
                value={stats?.dispatch.today || 0}
                subtitle="Dispatched today"
                color="green"
              />
              <StatCard
                title="This Week"
                value={stats?.dispatch.week || 0}
                subtitle="Dispatched this week"
                color="blue"
              />
              <StatCard
                title="This Month"
                value={stats?.dispatch.month || 0}
                subtitle="Dispatched this month"
                color="purple"
              />
              <StatCard
                title="Pending Dispatch"
                value={stats?.dispatch.pending || 0}
                subtitle="Awaiting dispatch"
                color="orange"
              />
            </div>
          </div>
        )}

        {/* Charts */}
        <div className="grid gap-6 lg:grid-cols-2">
          <ChartCard title="Work Orders by Status">
            {statsLoading ? (
              <div className="flex items-center justify-center h-full">
                <LoadingSpinner size="md" />
              </div>
            ) : statusChartData.length === 0 ? (
              <div className="flex items-center justify-center h-full text-foreground/50">
                <p>No data available</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <defs>
                    <linearGradient id="colorPending" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="#f59e0b" stopOpacity={1} />
                      <stop offset="100%" stopColor="#d97706" stopOpacity={1} />
                    </linearGradient>
                    <linearGradient id="colorToBeDispatched" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="#8b5cf6" stopOpacity={1} />
                      <stop offset="100%" stopColor="#7c3aed" stopOpacity={1} />
                    </linearGradient>
                    <linearGradient id="colorDispatched" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity={1} />
                      <stop offset="100%" stopColor="#059669" stopOpacity={1} />
                    </linearGradient>
                    <linearGradient id="colorClosed" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="#3b82f6" stopOpacity={1} />
                      <stop offset="100%" stopColor="#2563eb" stopOpacity={1} />
                    </linearGradient>
                  </defs>
                  <Pie
                    data={statusChartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent, value }) => {
                      // Only show label if value > 0 and percent >= 5% to avoid overlapping
                      if (value === 0 || (percent || 0) < 0.05) {
                        return null;
                      }
                      return `${name}: ${((percent || 0) * 100).toFixed(0)}%`;
                    }}
                    outerRadius={100}
                    innerRadius={40}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {statusChartData.map((entry, index) => {
                      const gradientId = 
                        entry.name === 'Pending' ? 'colorPending' :
                        entry.name === 'To Be Dispatched' ? 'colorToBeDispatched' :
                        entry.name === 'Dispatched' ? 'colorDispatched' :
                        'colorClosed';
                      return (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={`url(#${gradientId})`}
                          stroke="#fff"
                          strokeWidth={2}
                        />
                      );
                    })}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(255, 255, 255, 0.95)',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                    }}
                  />
                  <Legend
                    wrapperStyle={{ paddingTop: '20px' }}
                    iconType="circle"
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          {isAdmin && (
            <ChartCard title="Payments Trend (Last 7 Days)">
              {statsLoading ? (
                <div className="flex items-center justify-center h-full">
                  <LoadingSpinner size="md" />
                </div>
              ) : paymentsChartData.length === 0 ? (
                <div className="flex items-center justify-center h-full text-foreground/50">
                  <p>No payment data available</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={paymentsChartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <defs>
                      <linearGradient id="paymentGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0BC28E" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#0BC28E" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid 
                      strokeDasharray="3 3" 
                      stroke="#e5e7eb"
                      vertical={false}
                    />
                    <XAxis 
                      dataKey="date" 
                      stroke="#6b7280"
                      fontSize={12}
                      tickLine={false}
                    />
                    <YAxis 
                      stroke="#6b7280"
                      fontSize={12}
                      tickLine={false}
                      tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}k`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                      }}
                      formatter={(value: number) => formatCurrency(value)}
                    />
                    <Legend 
                      wrapperStyle={{ paddingTop: '10px' }}
                      iconType="line"
                    />
                    <Area
                      type="monotone"
                      dataKey="amount"
                      stroke="#0BC28E"
                      strokeWidth={3}
                      fill="url(#paymentGradient)"
                      dot={{ fill: '#0BC28E', r: 5, strokeWidth: 2, stroke: '#fff' }}
                      activeDot={{ r: 7, strokeWidth: 2, stroke: '#fff' }}
                      name="Amount (₹)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
          )}
        </div>

      </div>
    </DashboardLayout>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center">
        <LoadingSpinner size="lg" text="Loading dashboard..." />
      </div>
    }>
      <DashboardContent />
    </Suspense>
  );
}
