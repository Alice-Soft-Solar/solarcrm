import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { generateWorkOrderNumber, getCurrentYearMonth, parseWorkOrderNumber } from '@/utils/work-order-number';

/**
 * API endpoint to get the next work order number
 * 
 * POST /api/work-orders/next-number
 * Body: { company_id: string, company_code?: string }
 * 
 * Returns: { work_order_number: string, serial_number: number }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { company_id, company_code } = body;

    if (!company_id) {
      return NextResponse.json(
        { error: 'company_id is required' },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Supabase configuration missing' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Get company code from company table if not provided
    let companyCode = company_code;
    if (!companyCode) {
      const { data: company, error: companyError } = await supabase
        .from('companies')
        .select('code, name')
        .eq('id', company_id)
        .single();

      if (companyError || !company) {
        // If company table doesn't have code, try to extract from name or use default
        // For now, we'll use first 3 letters of company name or default to "GMS"
        if (company?.name) {
          companyCode = company.name.toUpperCase().slice(0, 3).padEnd(3, 'X');
        } else {
          companyCode = 'GMS'; // Default company code
        }
      } else {
        companyCode = company.code || company.name.toUpperCase().slice(0, 3).padEnd(3, 'X');
      }
    }

    // Ensure company code is exactly 3 characters
    companyCode = companyCode.toUpperCase().slice(0, 3).padEnd(3, 'X');

    // Get current year and month
    const { year, month } = getCurrentYearMonth();

    // Find the highest serial number for this company, year, and month
    const { data: existingOrders, error: fetchError } = await supabase
      .from('work_orders')
      .select('work_order_number')
      .eq('company_id', company_id)
      .like('work_order_number', `${companyCode}${String(year).slice(-2)}${String(month).padStart(2, '0')}%`);

    if (fetchError) {
      console.error('Error fetching existing work orders:', fetchError);
      // Continue with serial number 1 if fetch fails
    }

    // Parse existing work order numbers to find the highest serial number
    let maxSerialNumber = 0;
    if (existingOrders && existingOrders.length > 0) {
      for (const order of existingOrders) {
        try {
          const parsed = parseWorkOrderNumber(order.work_order_number);
          // Check if it's for the same year and month
          if (parsed.year === year && parsed.month === month) {
            if (parsed.serialNumber > maxSerialNumber) {
              maxSerialNumber = parsed.serialNumber;
            }
          }
        } catch (err) {
          // Skip invalid work order numbers
          console.warn('Invalid work order number format:', order.work_order_number);
        }
      }
    }

    // Generate next serial number
    const nextSerialNumber = maxSerialNumber + 1;

    // Generate work order number
    const workOrderNumber = generateWorkOrderNumber(
      companyCode,
      year,
      month,
      nextSerialNumber
    );

    return NextResponse.json({
      success: true,
      work_order_number: workOrderNumber,
      serial_number: nextSerialNumber,
      company_code: companyCode,
      year,
      month,
    });
  } catch (error: any) {
    console.error('Error generating work order number:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate work order number' },
      { status: 500 }
    );
  }
}


