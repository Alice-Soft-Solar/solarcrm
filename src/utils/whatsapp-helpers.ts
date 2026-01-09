/**
 * Helper functions for fetching user phone numbers and sending WhatsApp messages
 */

import { createClient } from '@supabase/supabase-js';
import { sendWhatsAppMessage } from './whatsapp';
import { WhatsAppResponse } from './whatsapp';

export interface UserWithPhone {
  id: string;
  full_name: string;
  phone?: string | null;
  email?: string;
}

/**
 * Fetches admin users for a company
 * Uses phone_number column from profiles table
 */
export async function getAdminUsers(
  companyId: string,
  supabase: ReturnType<typeof createClient> | any
): Promise<UserWithPhone[]> {
  try {
    const { data: admins, error } = await supabase
      .from('profiles')
      .select(`
        id,
        full_name,
        phone_number,
        roles!inner (
          role_name
        )
      `)
      .eq('company_id', companyId)
      .in('roles.role_name', ['Admin', 'Super Admin']);

    if (error) {
      console.error('Error fetching admin users:', error);
      return [];
    }

    // Get emails for users
    const adminIds = admins?.map((admin: any) => admin.id) || [];
    const emailMap: Record<string, string> = {};

    if (adminIds.length > 0) {
      const emailPromises = adminIds.map(async (userId: string) => {
        try {
          const { data: user } = await supabase.auth.admin.getUserById(userId);
          return { userId, email: user?.user?.email || null };
        } catch {
          return { userId, email: null };
        }
      });

      const results = await Promise.all(emailPromises);
      results.forEach(({ userId, email }) => {
        if (email) emailMap[userId] = email;
      });
    }

    return (admins || []).map((admin: any) => ({
      id: admin.id,
      full_name: admin.full_name,
      phone: admin.phone_number, // Map phone_number to phone for interface compatibility
      email: emailMap[admin.id],
    }));
  } catch (error) {
    console.error('Error in getAdminUsers:', error);
    return [];
  }
}

/**
 * Fetches sales executive user by ID
 * Uses phone_number column from profiles table
 */
export async function getSalesExecutive(
  salesExecutiveId: string,
  supabase: ReturnType<typeof createClient> | any
): Promise<UserWithPhone | null> {
  try {
    const { data: salesExec, error } = await supabase
      .from('profiles')
      .select('id, full_name, phone_number')
      .eq('id', salesExecutiveId)
      .single();

    if (error || !salesExec) {
      console.error('Error fetching sales executive:', error);
      return null;
    }

    // Get email
    let email: string | undefined;
    try {
      const { data: user } = await supabase.auth.admin.getUserById(salesExecutiveId);
      email = user?.user?.email;
    } catch {
      // Ignore email fetch errors
    }

    return {
      id: (salesExec as any).id,
      full_name: (salesExec as any).full_name,
      phone: (salesExec as any).phone_number, // Map phone_number to phone for interface compatibility
      email,
    };
  } catch (error) {
    console.error('Error in getSalesExecutive:', error);
    return null;
  }
}

/**
 * Fetches inventory users for a company
 * Uses phone_number column from profiles table
 */
export async function getInventoryUsers(
  companyId: string,
  supabase: ReturnType<typeof createClient> | any
): Promise<UserWithPhone[]> {
  try {
    const { data: inventoryUsers, error } = await supabase
      .from('profiles')
      .select(`
        id,
        full_name,
        phone_number,
        roles!inner (
          role_name
        )
      `)
      .eq('company_id', companyId)
      .eq('roles.role_name', 'Inventory');

    if (error) {
      console.error('Error fetching inventory users:', error);
      return [];
    }

    // Get emails for users
    const userIds = inventoryUsers?.map((user: any) => user.id) || [];
    const emailMap: Record<string, string> = {};

    if (userIds.length > 0) {
      const emailPromises = userIds.map(async (userId: string) => {
        try {
          const { data: user } = await supabase.auth.admin.getUserById(userId);
          return { userId, email: user?.user?.email || null };
        } catch {
          return { userId, email: null };
        }
      });

      const results = await Promise.all(emailPromises);
      results.forEach(({ userId, email }) => {
        if (email) emailMap[userId] = email;
      });
    }

    return (inventoryUsers || []).map((user: any) => ({
      id: user.id,
      full_name: user.full_name,
      phone: user.phone_number, // Map phone_number to phone for interface compatibility
      email: emailMap[user.id],
    }));
  } catch (error) {
    console.error('Error in getInventoryUsers:', error);
    return [];
  }
}

/**
 * Fetches sales lead users for a company
 */
export async function getSalesLeadUsers(
  companyId: string,
  supabase: ReturnType<typeof createClient> | any
): Promise<UserWithPhone[]> {
  try {
    const { data: salesLeads, error } = await supabase
      .from('profiles')
      .select(`
        id,
        full_name,
        phone_number,
        roles!inner (
          role_name
        )
      `)
      .eq('company_id', companyId)
      .eq('roles.role_name', 'salesLead');

    if (error) {
      console.error('Error fetching sales lead users:', error);
      return [];
    }

    return (salesLeads || []).map((user: any) => ({
      id: user.id,
      full_name: user.full_name,
      phone: user.phone_number,
    }));
  } catch (error) {
    console.error('Error in getSalesLeadUsers:', error);
    return [];
  }
}

/**
 * Sends WhatsApp message to a user (with phone number validation)
 */
export async function sendWhatsAppToUser(
  user: UserWithPhone,
  message: string
): Promise<WhatsAppResponse> {
  if (!user.phone) {
    return {
      success: false,
      error: `Phone number not available for user ${user.full_name} (${user.id})`,
    };
  }

  return await sendWhatsAppMessage({
    to: user.phone,
    body: message,
  });
}

/**
 * Sends WhatsApp messages to multiple users (non-blocking)
 * Returns array of results
 */
export async function sendWhatsAppToUsers(
  users: UserWithPhone[],
  message: string
): Promise<Array<{ user: UserWithPhone; result: WhatsAppResponse }>> {
  const results = await Promise.allSettled(
    users.map(async (user) => ({
      user,
      result: await sendWhatsAppToUser(user, message),
    }))
  );

  return results
    .filter((r): r is PromiseFulfilledResult<{ user: UserWithPhone; result: WhatsAppResponse }> => r.status === 'fulfilled')
    .map((r) => r.value);
}

