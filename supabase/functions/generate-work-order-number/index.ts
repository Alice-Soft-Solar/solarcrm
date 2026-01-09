import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 1. Extract and verify Authorization header first
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('Missing Authorization header')
    
    // 2. Create Supabase client with ANON key (enforces RLS)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader }
        }
      }
    )

    // 3. Verify User
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    if (userError || !user) throw new Error('Unauthorized')

    // 2. Get User Profile & Company
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('company_id, companies(name)')
      .eq('id', user.id)
      .single();

    if (profileError || !profile || !profile.companies) {
      throw new Error('Profile or Company information not found');
    }

    const companyId = profile.company_id;
    const companyName = profile.companies.name;

    // 3. Generate Company Code (3 chars, Uppercase, Padded)
    const cleanName = companyName ? companyName.replace(/\s+/g, '').toUpperCase() : 'XXX';
    const companyCode = cleanName.slice(0, 3).padEnd(3, 'X');

    // 4. Get Date Components
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const yearCode = String(year).slice(-2);
    const monthCode = String(month).padStart(2, '0');
    const prefix = `${companyCode}${yearCode}${monthCode}`;

    // 5. Retry loop to handle race conditions
    const maxRetries = 10;
    let attempt = 0;
    let workOrderNumber = '';
    
    while (attempt < maxRetries) {
      attempt++;
      
      // 5a. Find Max Serial Number
      const { data: existingOrders, error: fetchError } = await supabase
        .from('work_orders')
        .select('work_order_number')
        .eq('company_id', companyId)
        .like('work_order_number', `${prefix}%`)
        .order('work_order_number', { ascending: false })
        .limit(50); // Get more records to be safe

      if (fetchError) {
        throw new Error(`Failed to fetch existing orders: ${fetchError.message}`);
      }

      let maxSerialNumber = 0;
      if (existingOrders && existingOrders.length > 0) {
        existingOrders.forEach((order: any) => {
          try {
            // Format: CCCYYMMSSSS (11 chars total)
            // Serial is last 4 chars
            const serialPart = order.work_order_number.slice(-4);
            const serial = parseInt(serialPart, 10);
            if (!isNaN(serial) && serial > maxSerialNumber) {
              maxSerialNumber = serial;
            }
          } catch (e) {
            // ignore invalid formats
          }
        });
      }

      // 5b. Generate candidate number
      const nextSerial = maxSerialNumber + 1;
      const nextSerialCode = String(nextSerial).padStart(4, '0');
      const candidateNumber = `${prefix}${nextSerialCode}`;

      // 5c. Double-check this number doesn't exist (race condition protection)
      const { data: duplicate, error: checkError } = await supabase
        .from('work_orders')
        .select('work_order_number')
        .eq('work_order_number', candidateNumber)
        .maybeSingle();

      if (checkError) {
        throw new Error(`Failed to check for duplicates: ${checkError.message}`);
      }

      if (!duplicate) {
        // Number is unique!
        workOrderNumber = candidateNumber;
        break;
      }

      // Number already exists, retry with next attempt
      console.log(`Attempt ${attempt}: Number ${candidateNumber} already exists, retrying...`);
      
      // Small delay before retry to reduce contention
      await new Promise(resolve => setTimeout(resolve, 50 * attempt));
    }

    if (!workOrderNumber) {
      throw new Error('Failed to generate unique work order number after multiple attempts');
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        work_order_number: workOrderNumber,
        attempts: attempt
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Edge function error:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'An error occurred',
        success: false
      }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
