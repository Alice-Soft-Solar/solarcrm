const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://xjgzudgmtbgitxcnklbm.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhqZ3p1ZGdtdGJnaXR4Y25rbGJtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ1MTM1MDgsImV4cCI6MjA4MDA4OTUwOH0.6-xq6ncrcRRNE6OpRh8aEdTkjO30QoEbF396GxcPhVs';

const TEST_EMAIL = 'inventory@example.com';
const TEST_PASSWORD = 'Test123!';
const TEST_WORK_ORDER_ID = '23429145-7e9f-4710-ae7f-cc209cce8d0f';

async function testInventoryDispatch() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // Step 1: Login
  console.log('\n=== Step 1: Login ===');
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
  });

  if (authError) {
    console.error('❌ Login failed:', authError.message);
    return;
  }

  console.log('✅ Login success');
  console.log('   User ID:', authData.user.id);
  console.log('   Token length:', authData.session.access_token.length);

  // Step 2: Get profile
  console.log('\n=== Step 2: Get Profile ===');
  const { data: profile } = await supabase
    .from('profiles')
    .select('*, roles(role_name)')
    .eq('id', authData.user.id)
    .single();

  if (!profile) {
    console.error('❌ Profile not found');
    return;
  }

  console.log('✅ Profile found');
  console.log('   Company ID:', profile.company_id);
  console.log('   Role:', profile.roles?.role_name || 'Unknown');

  // Step 3: Test dispatch API
  console.log('\n=== Step 3: Test Dispatch ===');
  console.log('   Work Order ID:', TEST_WORK_ORDER_ID);

  const response = await fetch('http://localhost:3000/api/work-orders/mark-dispatched', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${authData.session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      access_token: authData.session.access_token,
      work_order_id: TEST_WORK_ORDER_ID,
      user_id: authData.user.id,
      company_id: profile.company_id,
    }),
  });

  const result = await response.json();

  console.log('   Status:', response.status);
  console.log('   Response:', JSON.stringify(result, null, 2));

  if (response.ok) {
    console.log('\n✅ DISPATCH SUCCESS!');
  } else {
    console.log('\n❌ DISPATCH FAILED!');
    console.log('Error:', result.error);
  }
}

testInventoryDispatch();
