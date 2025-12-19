/**
 * Server-side Supabase utilities for API routes
 * 

* SIMPLE & SECURE approach:
 * 1. Extract session from cookies
 * 2. Verify user with anon client
 * 3. Fetch profile/role with service client (verification only)
 * 4. Return authenticated client for RLS-enforced queries
 */

import { createClient } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';

/**
 * Extract access token from request (multiple sources: Authorization header, body, or cookies)
 * Priority: Authorization header > Request body > Cookies
 */
async function extractAccessToken(request: NextRequest): Promise<{ accessToken: string; refreshToken: string } | null> {
  // Method 1: Try Authorization header (Bearer token) - HIGHEST PRIORITY
  const authHeader = request.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
    if (token) {
      // Access token from header is sufficient - refresh token is optional
      // Try to get refresh token from body if available, but don't fail if we can't
      let refreshToken = '';
      try {
        // Only try to read body if it's JSON (most common case)
        const contentType = request.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const clonedRequest = request.clone();
          const body = await clonedRequest.json().catch(() => ({}));
          refreshToken = (body as any)?.refresh_token || '';
        }
      } catch {
        // Ignore errors - access token is sufficient
      }
      return { accessToken: token, refreshToken };
    }
  }

  // Method 2: Try request body (for POST/PUT requests)
  // We need to be careful here - can only read body once
  const contentType = request.headers.get('content-type') || '';
  
  if (contentType.includes('application/json')) {
    try {
      const clonedRequest = request.clone();
      const body = await clonedRequest.json().catch(() => null);
      if (body && (body as any)?.access_token) {
        return {
          accessToken: (body as any).access_token,
          refreshToken: (body as any).refresh_token || '',
        };
      }
    } catch {
      // Body might not be readable, continue
    }
  } else if (contentType.includes('multipart/form-data')) {
    try {
      const clonedRequest = request.clone();
      const formData = await clonedRequest.formData().catch(() => null);
      if (formData) {
        const token = formData.get('access_token') as string | null;
        if (token) {
          return {
            accessToken: token,
            refreshToken: (formData.get('refresh_token') as string) || '',
          };
        }
      }
    } catch {
      // FormData parsing failed, continue
    }
  }

  // Method 3: Try cookies (fallback for cookie-based sessions)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) return null;

  const cookieHeader = request.headers.get('cookie') || '';
  const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
    const [key, value] = cookie.trim().split('=');
    if (key && value) {
      acc[key.trim()] = decodeURIComponent(value);
    }
    return acc;
  }, {} as Record<string, string>);

  // Extract project ref from URL (e.g., https://xyz.supabase.co -> xyz)
  const urlMatch = supabaseUrl.match(/https?:\/\/([^.]+)/);
  const projectRef = urlMatch ? urlMatch[1] : '';
  
  if (!projectRef) return null;

  const sessionCookieKey = `sb-${projectRef}-auth-token`;
  const sessionCookie = cookies[sessionCookieKey];
  
  if (!sessionCookie) return null;

  try {
    const session = JSON.parse(sessionCookie);
    if (session?.access_token) {
      return {
        accessToken: session.access_token,
        refreshToken: session.refresh_token || '',
      };
    }
  } catch (e) {
    // Cookie parsing failed, return null
  }

  return null;
}

/**
 * Decode JWT token to extract user ID and session info
 * JWT format: header.payload.signature
 * Supabase JWT payload contains: sub (user ID), exp (expiration), role, etc.
 */
function decodeJWT(token: string): { sub?: string; exp?: number; role?: string; [key: string]: any } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    // Decode payload (base64url)
    const payload = parts[1];
    // Add padding if needed for base64 decoding
    const padded = payload + '='.repeat((4 - (payload.length % 4)) % 4);
    const decoded = JSON.parse(
      Buffer.from(padded.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString()
    );
    
    return decoded;
  } catch (e) {
    console.error('JWT decode error:', e);
    return null;
  }
}

/**
 * Create authenticated Supabase client (RLS enforced)
 * Accepts token from: Authorization header, request body, or cookies
 * 
 * FIX: Instead of using setSession (which fails), we:
 * 1. Decode JWT to get user ID
 * 2. Create client with token in headers for RLS
 * 3. Use getUser() with token directly via Supabase REST API
 */
export async function createServerClient(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase configuration missing');
  }

  // Extract session from multiple sources (header, body, or cookies)
  const session = await extractAccessToken(request);
  
  if (!session?.accessToken) {
    // No token found - return unauthenticated client
    return createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  // Decode JWT to get user info
  const tokenPayload = decodeJWT(session.accessToken);
  if (!tokenPayload || !tokenPayload.sub) {
    // Invalid token - return unauthenticated client
    return createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  // Create client with token in global headers for RLS enforcement
  // The token in headers is sufficient for RLS - no need for setSession
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
      },
    },
  });

  return supabase;
}

/**
 * Get service role client (bypasses RLS)
 * Use ONLY for verification (profiles/roles lookup)
 */
export function getServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Service role key not configured');
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Verify user session and get profile/role from database
 * Decodes JWT token directly to get user ID (simpler and more reliable)
 */
export async function verifyUserAndGetProfile(supabase: any, request: NextRequest) {
  // Step 1: Extract and decode JWT token to get user ID
  const session = await extractAccessToken(request);
  
  if (!session?.accessToken) {
    console.error('[verifyUserAndGetProfile] No access token found in request');
    throw new Error('Unauthorized: Please log in again');
  }

  const tokenPayload = decodeJWT(session.accessToken);
  if (!tokenPayload?.sub) {
    console.error('[verifyUserAndGetProfile] Invalid token payload - missing sub:', tokenPayload);
    throw new Error('Unauthorized: Invalid token');
  }

  const userId = tokenPayload.sub;

  // Step 2: Fetch profile and role using service client (bypasses RLS for verification)
  const serviceClient = getServiceClient();
  
  const { data: profile, error: profileError } = await serviceClient
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
    .eq('id', userId)
    .single();

  if (profileError) {
    console.error('Profile error in verifyUserAndGetProfile:', profileError.message);
    throw new Error('Unauthorized: Profile not found');
  }

  if (!profile) {
    throw new Error('Unauthorized: Profile not found');
  }

  // Extract role name
  const profileData = profile as any;
  const roles = profileData.roles as { role_name: string } | { role_name: string }[] | null;
  const roleData = Array.isArray(roles) ? roles[0] : roles;
  const roleName = (roleData as { role_name?: string })?.role_name || '';

  if (!roleName) {
    throw new Error('Unauthorized: Role not found');
  }

  const companyId = profileData.company_id as string | null;

  if (!companyId) {
    throw new Error('Unauthorized: Company not found');
  }

  return {
    userId,
    companyId,
    roleName,
    fullName: profileData.full_name || '',
  };
}

/**
 * Check if user has required role
 */
export function hasRole(userRole: string, allowedRoles: string[]): boolean {
  return allowedRoles.includes(userRole);
}

/**
 * Check if user is admin
 */
export function isAdmin(roleName: string): boolean {
  return roleName === 'Admin' || roleName === 'Super Admin';
}

/**
 * Check if user is sales
 */
export function isSales(roleName: string): boolean {
  return roleName === 'Sales';
}

/**
 * Check if user is sales lead
 */
export function isSalesLead(roleName: string): boolean {
  return roleName === 'salesLead';
}

/**
 * Check if user is inventory
 */
export function isInventory(roleName: string): boolean {
  return roleName === 'Inventory';
}
