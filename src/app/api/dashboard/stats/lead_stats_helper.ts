
// Helper function to get lead stats using count queries to bypass row limits
async function getLeadStats(supabase: any, baseFilter: (q: any) => any) {
  const getQuery = () => baseFilter(supabase.from('leads').select('*', { count: 'exact', head: true }));
  
  const [totalRes, interestedRes, notInterestedRes, followUpRes] = await Promise.all([
    getQuery(),
    getQuery().eq('status', 'Interested'),
    getQuery().eq('status', 'Not Interested'),
    getQuery().eq('status', 'Follow Up Required')
  ]);

  if (totalRes.error) console.error('Error fetching total leads:', totalRes.error);
  
  const stats = {
    total: totalRes.count || 0,
    interested: interestedRes.count || 0,
    notInterested: notInterestedRes.count || 0,
    followUpRequired: followUpRes.count || 0
  };

  console.log('[STATS DEBUG] Fetched stats:', JSON.stringify(stats));
  return stats;
}
