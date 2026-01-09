import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, verifyUserAndGetProfile, hasRole } from '@/lib/supabase-server';
import { sendWhatsAppMessage } from '@/utils/whatsapp';
import { getCustomerCreationMessage, getAdminCreationMessage } from '@/utils/whatsapp-templates';
import { getAdminUsers, getSalesExecutive, sendWhatsAppToUser, sendWhatsAppToUsers } from '@/utils/whatsapp-helpers';

/**
 * API Route: Create Work Order
 * 
 * Security: RLS enforced + Server-side verification
 * - Uses authenticated client with RLS enforcement
 * - Verifies user identity and company from database
 * - Only allows users to create work orders for their own company
 */

export async function POST(request: NextRequest) {
  try {
    // Step 1: Create authenticated Supabase client (uses cookies/JWT)
    const supabase = await createServerClient(request);

    // Step 2: Verify user and get verified profile/role from database
    const { userId, companyId, roleName } = await verifyUserAndGetProfile(supabase, request);

    // Step 3: Check authorization - only certain roles can create work orders
    const allowedRoles = ['Sales', 'salesLead', 'Admin', 'Super Admin'];
    if (!hasRole(roleName, allowedRoles)) {
      return NextResponse.json(
        { error: 'Unauthorized: You do not have permission to create work orders' },
        { status: 403 }
      );
    }

    // Step 4: Parse request body
    const body = await request.json();
    const {
      company_id,
      sales_executive_id,
      work_order_number,
      customer_name,
      customer_address,
      town,
      customer_email,
      customer_phone,
      power_bill,
      power_units,
      site_details,
      structure_height,
      roof_type,
      plant_capacity,
      order_amount,
      aadhaar_url,
      pan_url,
      bank_statement_url,
      cancelled_check_url,
    } = body;

    // Step 5: Validate required fields
    if (!sales_executive_id || !work_order_number || !customer_name || !customer_address || !town || !customer_phone || !order_amount) {
      return NextResponse.json(
        { error: 'Missing required fields. Please provide: sales_executive_id, work_order_number, customer_name, customer_address, town, customer_phone, and order_amount' },
        { status: 400 }
      );
    }

    // Step 6: Validate field formats
    if (typeof work_order_number !== 'string' || work_order_number.trim().length === 0) {
      return NextResponse.json(
        { error: 'Work order number must be a non-empty string' },
        { status: 400 }
      );
    }

    if (typeof customer_name !== 'string' || customer_name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Customer name must be a non-empty string' },
        { status: 400 }
      );
    }

    // Step 7: Verify company_id matches authenticated user's company (security check)
    if (company_id && company_id !== companyId) {
      return NextResponse.json(
        { error: 'Unauthorized: Cannot create work orders for other companies' },
        { status: 403 }
      );
    }

    // Step 8: Convert order_amount to number
    const orderAmount = parseFloat(order_amount);
    if (isNaN(orderAmount)) {
      return NextResponse.json(
        { error: 'Order amount must be a valid number' },
        { status: 400 }
      );
    }

    // Step 9: Insert work order with RLS enforcement (uses verified companyId)
    // RLS policy ensures work order is created with authenticated user's company_id
    const { data, error } = await supabase
      .from('work_orders')
      .insert({
        company_id: companyId, // Use verified company ID from authenticated user
        sales_executive_id,
        work_order_number,
        customer_name,
        customer_address,
        town,
        customer_email: customer_email || null,
        customer_phone,
        power_bill: power_bill || null,
        power_units: power_units || null,
        site_details: site_details || null,
        structure_height: structure_height || null,
        roof_type: roof_type || null,
        plant_capacity: plant_capacity || null,
        order_amount: orderAmount,
        work_order_status: 'Created',
        aadhaar_url: aadhaar_url || null,
        pan_url: pan_url || null,
        bank_statement_url: bank_statement_url || null,
        cancelled_check_url: cancelled_check_url || null,
      })
      .select();


    if (error) {
      console.error('Error creating work order:', error);
      return NextResponse.json(
        { error: error.message, details: error.details, hint: error.hint },
        { status: 400 }
      );
    }

    const workOrder = data?.[0];

    // Step 10: Send WhatsApp notifications (non-blocking - don't fail if this fails)
    // Use service client for fetching admin/sales exec profiles (cross-company data)
    if (workOrder) {
      try {
        // Use authenticated supabase client for fetching profiles
        // Fetch sales executive details
        const salesExecutive = await getSalesExecutive(sales_executive_id, supabase as any);
        
        // Fetch admin users
        const adminUsers = await getAdminUsers(companyId, supabase as any);

        // Get payment received (initially 0 for new work order)
        const paymentReceived = 0;

        // Prepare work order data for templates
        const workOrderData = {
          work_order_number,
          customer_name,
          order_amount: orderAmount,
          payment_received: paymentReceived,
          plant_capacity: plant_capacity || null,
          executive_name: salesExecutive?.full_name || 'N/A',
          executive_contact: salesExecutive?.phone || 'N/A',
          escalation_contact: adminUsers.length > 0 ? (adminUsers[0].phone || 'N/A') : 'N/A',
        };

        // Send to customer
        if (customer_phone) {
          const customerMessage = getCustomerCreationMessage(workOrderData);
          const customerResult = await sendWhatsAppMessage({
            to: customer_phone,
            body: customerMessage,
          });
          if (customerResult.success) {
            console.log('✅ Customer WhatsApp notification sent');
          } else {
            console.warn('⚠️ Customer WhatsApp failed:', customerResult.error);
          }
        }

        // Send to sales executive
        if (salesExecutive?.phone) {
          const salesMessage = getAdminCreationMessage(workOrderData);
          const salesResult = await sendWhatsAppToUser(salesExecutive, salesMessage);
          if (salesResult.success) {
            console.log('✅ Sales Executive WhatsApp notification sent');
          } else {
            console.warn('⚠️ Sales Executive WhatsApp failed:', salesResult.error);
          }
        } else {
          console.warn('⚠️ Sales Executive phone number not available');
        }

        // Send to all admin users
        if (adminUsers.length > 0) {
          const adminMessage = getAdminCreationMessage(workOrderData);
          const adminResults = await sendWhatsAppToUsers(adminUsers, adminMessage);
          const successCount = adminResults.filter((r) => r.result.success).length;
          console.log(`✅ Admin WhatsApp notifications sent: ${successCount}/${adminUsers.length}`);
          adminResults.forEach(({ user, result }) => {
            if (!result.success) {
              console.warn(`⚠️ Admin ${user.full_name} WhatsApp failed:`, result.error);
            }
          });
        } else {
          console.warn('⚠️ No admin users found for WhatsApp notification');
        }
      } catch (whatsappError) {
        // Log but don't fail the work order creation
        console.error('Error sending WhatsApp notifications:', whatsappError);
      }
    }


    return NextResponse.json({
      success: true,
      workOrder,
    });
  } catch (error: unknown) {
    console.error('API Error creating work order:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'An error occurred' },
      { status: 500 }
    );
  }
}

