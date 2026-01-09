
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import PageHeader from '@/components/PageHeader';
import { LoadingSpinner, Button } from '@/components/ui';
import { getSupabaseClient } from '@/lib/supabase-client';
import { exportToExcel, mapDataForExport, getReportHeaders, getReportRowValues } from '@/utils/report-exports';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { getAccessToken } from '@/lib/supabase-client';

interface ReportType {
  id: string;
  title: string;
  category: 'order' | 'stage';
}

const REPORT_TYPES: ReportType[] = [
  // SECTION II: ORDER REPORTS
  { id: 'customer_list', title: '1. CUSTOMER LIST', category: 'order' },
  { id: 'executive_wise_orders', title: '2. ORDER LIST (EXECUTIVE WISE)', category: 'order' },
  { id: 'receipts_list', title: '3. RECEIPTS LIST', category: 'order' },
  { id: 'status_detailed', title: '4. WORKORDER STATUS DETAILED REPORT', category: 'order' },
  { id: 'summary_report', title: '5. WORKORDER SUMMARY REPORT', category: 'order' },
  { id: 'ledger', title: '6. EXECUTIVE & CUSTOMER LEDGER', category: 'order' },
  
  // SECTION III: ORDER STAGE WISE REPORT
  { id: 'stage_6_stages', title: '1. PREPARE & VIEW ORDER STATUS 6 STAGES', category: 'stage' },
  { id: 'to_be_dispatched', title: '2. TO BE DISPATCH REPORTS PAID 65% ABOVE', category: 'stage' },
  { id: 'stock_dispatched', title: '3. STOCK DISPATCHED & ERECTION PENDING', category: 'stage' },
  { id: 'erection_done', title: '4. ERECTION DONE & METER PENDING', category: 'stage' },
  { id: 'dues_report', title: '5. DUES REPORT(DUES/ FULL PAID/NOT PAID/EXCESS PAID)', category: 'stage' },
  { id: 'erection_dues', title: '6. ERECTION DONE DUES', category: 'stage' },
  { id: 'subsidy_report', title: '7. SUBSIDY RECEIVED AND DUE', category: 'stage' },
  { id: 'subsidy_not_eligible', title: '8. SUBSIDY NOT ELIGIBLE TO REDEMPTION', category: 'stage' },
  { id: 'subsidy_not_ready', title: '9. SUBSIDY NOT READY FOR REDEMPTION', category: 'stage' },
  { id: 'subsidy_not_received', title: '10. SUBSIDY NOT RECEIVED BY CUSTOMER', category: 'stage' },
];

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

export default function ReportsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [reportLoading, setReportLoading] = useState(false);
  const [executives, setExecutives] = useState<any[]>([]);
  const [profile, setProfile] = useState<{ company_id: string } | null>(null);
  
  // Selection State
  const [selectedCategory, setSelectedCategory] = useState<'order' | 'stage' | ''>('');
  const [selectedReportId, setSelectedReportId] = useState('');
  
  // Data State
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [stats, setStats] = useState<{ label: string; value: string | number }[]>([]);

  // Filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedExecutive, setSelectedExecutive] = useState('');
  const [selectedStage, setSelectedStage] = useState('');
  
  const supabase = useMemo(() => getSupabaseClient(), []);

  useEffect(() => {
    const initPage = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          router.push('/login');
          return;
        }

        const { data: profileData } = await supabase
          .from('profiles')
          .select('*, roles(role_name)')
          .eq('id', user.id)
          .single();

        if (!profileData) {
          router.push('/dashboard');
          return;
        }

        setProfile(profileData as any);

        // Fetch executives for filter (only relevant roles)
        const { data: execData } = await supabase
          .from('profiles')
          .select('id, full_name, roles!inner(role_name)')
          .eq('company_id', (profileData as any).company_id)
          .in('roles.role_name', ['Admin', 'Super Admin', 'Sales', 'salesLead']);
          
        setExecutives(execData || []);
        setLoading(false);
      } catch (error) {
        console.error('Error initializing reports page:', error);
      }
    };

    initPage();
  }, [router, supabase]);

  // Fetch report data when selection changes
  useEffect(() => {
    if (selectedReportId && profile) {
      handleGeneratePreview();
    } else {
      setPreviewData([]);
      setChartData([]);
      setStats([]);
    }
  }, [selectedReportId, startDate, endDate, selectedExecutive, selectedStage, profile]);

  const handleGeneratePreview = async () => {
    if (!profile || !selectedReportId) return;
    
    setReportLoading(true);
    try {
      const accessToken = getAccessToken();
      const params = new URLSearchParams({
        type: selectedReportId,
        companyId: profile.company_id,
        startDate,
        endDate,
        executiveId: selectedExecutive,
        stage: selectedStage
      });

      const response = await fetch(`/api/reports?${params.toString()}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken && { 'Authorization': `Bearer ${accessToken}` }),
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch report data');
      }

      const { data } = await response.json();
      
      setPreviewData(data || []);
      generateInsights(data || [], selectedReportId);

    } catch (error) {
      console.error('Preview error:', error);
      alert(error instanceof Error ? error.message : 'Failed to load report. Please try again.');
    } finally {
      setReportLoading(false);
    }
  };

  const generateInsights = (data: any[], type: string) => {
    // 1. Calculate Stats
    const totalCount = data.length;
    const totalValue = data.reduce((sum, item) => sum + (item.order_amount || 0), 0);
    const totalPaid = data.reduce((sum, item) => sum + (item.totalPaid || 0), 0);
    
    setStats([
      { label: 'Total Records', value: totalCount },
      { label: 'Total Value', value: `₹${totalValue.toLocaleString()}` },
      { label: 'Total Collected', value: `₹${totalPaid.toLocaleString()}` },
    ]);

    // 2. Prepare Chart Data (Group by Status or Executive)
    const groupedByStatus = data.reduce((acc: any, item: any) => {
      const key = item.work_order_status || 'Unknown';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    const chart = Object.keys(groupedByStatus).map(key => ({
      name: key,
      value: groupedByStatus[key]
    }));

    setChartData(chart);
  };

  const handleExport = async (format: 'pdf' | 'excel') => {
      if (!profile || !selectedReportId) return;
      
      const params = new URLSearchParams({
        type: selectedReportId,
        companyId: profile.company_id,
        startDate,
        endDate,
        executiveId: selectedExecutive,
        stage: selectedStage
      });

      if (format === 'excel') {
        const mapped = mapDataForExport(previewData, selectedReportId);
        const reportTitle = REPORT_TYPES.find(r => r.id === selectedReportId)?.title || 'Report';
        exportToExcel(mapped, reportTitle.replace(/\s+/g, '_'));
      } else {
        // PDF Download with authentication
        try {
          const accessToken = getAccessToken();
          const response = await fetch(`/api/reports/pdf?${params.toString()}`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              ...(accessToken && { 'Authorization': `Bearer ${accessToken}` }),
            },
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to generate PDF');
          }

          // Get the PDF blob
          const blob = await response.blob();
          
          // Create a download link
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          const reportTitle = REPORT_TYPES.find(r => r.id === selectedReportId)?.title || 'Report';
          link.download = `${reportTitle.replace(/\s+/g, '_')}.pdf`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          window.URL.revokeObjectURL(url);
        } catch (error) {
          console.error('PDF download error:', error);
          alert(error instanceof Error ? error.message : 'Failed to download PDF. Please try again.');
        }
      }
  };

  if (loading) return <LoadingSpinner fullScreen text="Loading Reports..." />;

  const getHeadersLocal = (type: string) => {
    try {
      return getReportHeaders(type);
    } catch {
      return [];
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      <PageHeader title="Reports & Insights" />

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        
        {/* Selection Area */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 mb-8">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Category</h3>
                <div className="space-y-2">
                    <button 
                        onClick={() => { setSelectedCategory('order'); setSelectedReportId(''); }}
                        className={`w-full text-left px-4 py-3 rounded-lg border transition-all ${selectedCategory === 'order' ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200' : 'border-gray-200 hover:border-blue-300'}`}
                    >
                        <span className="font-semibold text-gray-900 block">II. Order Reports</span>
                        <span className="text-xs text-gray-500">Customer lists, receipts, and order summaries</span>
                    </button>
                    <button 
                         onClick={() => { setSelectedCategory('stage'); setSelectedReportId(''); }}
                        className={`w-full text-left px-4 py-3 rounded-lg border transition-all ${selectedCategory === 'stage' ? 'border-purple-500 bg-purple-50 ring-2 ring-purple-200' : 'border-gray-200 hover:border-purple-300'}`}
                    >
                        <span className="font-semibold text-gray-900 block">III. Stage Wise Reports</span>
                        <span className="text-xs text-gray-500">Stage tracking, dispatch, subsidy, and dues</span>
                    </button>
                </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-center">
                 <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Select Specific Report</h3>
                 <select
                    disabled={!selectedCategory}
                    value={selectedReportId}
                    onChange={(e) => setSelectedReportId(e.target.value)}
                    className="block w-full rounded-lg border-gray-300 border px-4 py-3 text-gray-900 focus:border-blue-500 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-400"
                 >
                    <option value="">-- Choose a Report --</option>
                    {REPORT_TYPES.filter(r => r.category === selectedCategory).map(report => (
                        <option key={report.id} value={report.id}>{report.title}</option>
                    ))}
                 </select>
                 {!selectedCategory && <p className="text-xs text-red-400 mt-2 ml-1">Please select a category first</p>}
            </div>
        </div>

        {/* Global Filters Bar */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-8 flex flex-wrap gap-4 items-end">
            <div>
               <label className="text-xs font-medium text-gray-700">From Date</label>
               <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border" />
            </div>
            <div>
               <label className="text-xs font-medium text-gray-700">To Date</label>
               <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border" />
            </div>
            <div>
               <label className="text-xs font-medium text-gray-700">Executive</label>
               <select value={selectedExecutive} onChange={(e) => setSelectedExecutive(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border">
                 <option value="">All Executives</option>
                 {executives.map(ex => <option key={ex.id} value={ex.id}>{ex.full_name}</option>)}
               </select>
            </div>
            <div className="flex-grow"></div>
            {selectedReportId && (
                <div className="flex gap-2">
                    <Button onClick={() => handleExport('excel')} variant="outline" className="flex items-center gap-2">
                        <span>📊</span> Download Excel
                    </Button>
                    <Button onClick={() => handleExport('pdf')} variant="primary" className="flex items-center gap-2">
                         <span>📄</span> Download PDF
                    </Button>
                </div>
            )}
        </div>

        {/* Dynamic Content Area */}
        {selectedReportId ? (
            <div className="space-y-8 animate-in fade-in duration-500">
                {/* Visual Insights */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Stat Cards */}
                    <div className="lg:col-span-1 space-y-4">
                        {stats.map((stat, i) => (
                            <div key={i} className="bg-white p-6 rounded-xl shadow-sm border border-l-4 border-l-blue-500">
                                <p className="text-sm font-medium text-gray-500">{stat.label}</p>
                                <p className="text-2xl font-bold text-gray-900 mt-1">{stat.value}</p>
                            </div>
                        ))}
                    </div>
                    {/* Charts */}
                    <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-gray-100 min-h-[300px]">
                        <h3 className="text-lg font-medium text-gray-900 mb-6">Distribution Overview</h3>
                        <ResponsiveContainer width="100%" height={250}>
                             <BarChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis fontSize={12} tickLine={false} axisLine={false} />
                                <Tooltip cursor={{fill: 'transparent'}} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                                <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={40}>
                                  {chartData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                  ))}
                                </Bar>
                             </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Data Preview Table */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
                        <h3 className="font-semibold text-gray-800">Report Preview</h3>
                        <span className="text-xs text-gray-500">Showing first 50 records</span>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    {getHeadersLocal(selectedReportId).map((header, i) => (
                                        <th key={i} className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                                            {header}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {reportLoading ? (
                                    <tr>
                                        <td colSpan={10} className="px-6 py-12 text-center text-gray-500">
                                            <LoadingSpinner />
                                        </td>
                                    </tr>
                                ) : previewData.length === 0 ? (
                                    <tr>
                                        <td colSpan={10} className="px-6 py-12 text-center text-gray-500">
                                            No data found for the selected filters.
                                        </td>
                                    </tr>
                                ) : (
                                    previewData.slice(0, 50).map((row, i) => {
                                        const values = getReportRowValues(row, selectedReportId);
                                        return (
                                            <tr key={i} className="hover:bg-gray-50 transition-colors">
                                                {values.map((val, j) => (
                                                    <td key={j} className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                                                        {val}
                                                    </td>
                                                ))}
                                            </tr>
                                        )
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        ) : (
            <div className="mt-12 text-center py-16 bg-white rounded-xl border border-dashed border-gray-300">
                <div className="mx-auto h-12 w-12 text-gray-400 text-4xl mb-4">📊</div>
                <h3 className="mt-2 text-sm font-medium text-gray-900">No Report Selected</h3>
                <p className="mt-1 text-sm text-gray-500">Select a category and report type above to view insights and download data.</p>
            </div>
        )}
      </div>
    </div>
  );
}
