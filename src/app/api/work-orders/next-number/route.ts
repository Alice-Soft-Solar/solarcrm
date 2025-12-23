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

    let companyCode = company_code;
    // Normalize provided company code (remove spaces, uppercase)
    if (companyCode) {
      companyCode = companyCode.replace(/\s+/g, '').toUpperCase();
    }
    
    if (!companyCode) {
      const { data: company, error: companyError } = await supabase
        .from('companies')
        .select('name')
        .eq('id', company_id)
        .single();

      if (companyError) {
        console.error('Error fetching company:', companyError);
        return NextResponse.json(
          { error: `Failed to fetch company: ${companyError.message}` },
          { status: 400 }
        );
      }

      if (!company) {
        return NextResponse.json(
          { error: `Company with ID ${company_id} not found` },
          { status: 404 }
        );
      }

      if (company.name) {
        // Remove all spaces first, then extract first 3 characters
        // Example: "GM Solar" -> "GMSOLAR" -> "GMS"
        const cleanName = company.name.replace(/\s+/g, '').toUpperCase();
        companyCode = cleanName.slice(0, 3).padEnd(3, 'X');
      } else {
        return NextResponse.json(
          { error: `Company ${company_id} has no name. Please update the company record.` },
          { status: 400 }
        );
      }
    }

    // Ensure company code is exactly 3 characters (remove spaces, uppercase, extract first 3, pad if needed)
    companyCode = companyCode.replace(/\s+/g, '').toUpperCase().slice(0, 3).padEnd(3, 'X');

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
  } catch (error: unknown) {
    console.error('Error generating work order number:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate work order number' },
      { status: 500 }
    );
  }
}


