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
import { debugLog } from '@/utils/logger';

/**
 * Extract access token from request (multiple sources: Authorization header, body, or cookies)
 * Priority: Authorization header > Request body > Cookies
 */
async function extractAccessToken(request: NextRequest): Promise<{ accessToken: string; refreshToken: string; source: string } | null> {
  console.log('[TOKEN DEBUG] === Starting token extraction ===');
  
  // Method 1: Try Authorization header (Bearer token) - HIGHEST PRIORITY
  // Note: headers.get() is case-insensitive, but let's be explicit
  const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
  console.log('[TOKEN DEBUG] Authorization header present:', !!authHeader);
  console.log('[TOKEN DEBUG] Authorization header value:', authHeader ? authHeader.substring(0, 20) + '...' : 'null');
  
  if (authHeader) {
    // Check for Bearer token (case-insensitive)
    if (authHeader.toLowerCase().startsWith('bearer ')) {
      const token = authHeader.substring(7).trim();
      if (token && token.length > 0) {
        console.log('[TOKEN DEBUG] ✅ Token extracted from Authorization header');
        console.log('[TOKEN DEBUG] Token length:', token.length);
        console.log('[TOKEN DEBUG] Token starts with:', token.substring(0, 20) + '...');
        
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
        return { accessToken: token, refreshToken, source: 'Authorization header' };
      } else {
        console.log('[TOKEN DEBUG] ❌ Token extracted but is empty!');
      }
    } else {
      console.log('[TOKEN DEBUG] ❌ Authorization header present but does not start with Bearer');
    }
  }

  // Method 2: Try request body (for POST/PUT requests)
  // Only attempt this if we haven't found a token yet
  if (!authHeader) {
      const contentType = request.headers.get('content-type') || '';
      
      if (contentType.includes('application/json')) {
        try {
          const clonedRequest = request.clone();
          const body = await clonedRequest.json().catch(() => null);
          if (body && (body as any)?.access_token) {
            console.log('[TOKEN DEBUG] Token extracted from request body');
            return {
              accessToken: (body as any).access_token,
              refreshToken: (body as any).refresh_token || '',
              source: 'Request body',
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
              console.log('[TOKEN DEBUG] Token extracted from form data');
              return {
                accessToken: token,
                refreshToken: (formData.get('refresh_token') as string) || '',
                source: 'Form data',
              };
            }
          }
        } catch {
          // FormData parsing failed, continue
        }
      }
  }

  // Method 3: Try cookies (fallback for cookie-based sessions)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) {
    console.log('[TOKEN DEBUG] No Supabase URL configured');
    return null;
  }

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
  
  if (!projectRef) {
    console.log('[TOKEN DEBUG] Could not extract project ref from URL');
    return null;
  }

  const sessionCookieKey = `sb-${projectRef}-auth-token`;
  const sessionCookie = cookies[sessionCookieKey];
  
  if (!sessionCookie) {
    console.log('[TOKEN DEBUG] No session cookie found with key:', sessionCookieKey);
    return null;
  }

  try {
    let sessionData = sessionCookie;
    // Check if it's base64 encoded (common in some Supabase versions)
    if (sessionData.startsWith('base64-')) {
      const base64 = sessionData.substring(7);
      sessionData = Buffer.from(base64, 'base64').toString();
    }
    
    const session = JSON.parse(sessionData);
    if (session?.access_token) {
      console.log('[TOKEN DEBUG] Token extracted from cookies');
      return {
        accessToken: session.access_token,
        refreshToken: session.refresh_token || '',
        source: 'Cookie',
      };
    }
  } catch (e) {
    console.log('[TOKEN DEBUG] Cookie parsing failed (might be normal if not JSON):', e);
  }

  console.log('[TOKEN DEBUG] No token found from any source');
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
  console.log('[SUPABASE DEBUG] === Creating Server Client ===');
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase configuration missing');
  }

  // Extract session from multiple sources (header, body, or cookies)
  const session = await extractAccessToken(request);
  
  if (!session?.accessToken) {
    console.log('[SUPABASE DEBUG] No access token found - returning unauthenticated client');
    // No token found - return unauthenticated client
    return createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  console.log('[SUPABASE DEBUG] Token source:', session.source);
  console.log('[SUPABASE DEBUG] Token length:', session.accessToken.length);

  // Decode JWT to get user info
  const tokenPayload = decodeJWT(session.accessToken);
  if (!tokenPayload || !tokenPayload.sub) {
    console.log('[SUPABASE DEBUG] Invalid token payload - missing sub claim');
    // Invalid token - return unauthenticated client
    return createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  console.log('[SUPABASE DEBUG] JWT decoded successfully:');
  console.log('[SUPABASE DEBUG] - sub (user ID):', tokenPayload.sub);
  console.log('[SUPABASE DEBUG] - exp (expiry):', tokenPayload.exp, '- Current time:', Math.floor(Date.now() / 1000));
  console.log('[SUPABASE DEBUG] - Token expired?', tokenPayload.exp ? tokenPayload.exp < Math.floor(Date.now() / 1000) : 'no exp');
  console.log('[SUPABASE DEBUG] - role:', tokenPayload.role);
  console.log('[SUPABASE DEBUG] - aud:', tokenPayload.aud);

  // Create client with token in global headers for RLS enforcement
  // PostgREST uses the Authorization header to set auth.uid() and auth.jwt()
  console.log('[SUPABASE DEBUG] Creating client with Authorization header...');
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

  console.log('[SUPABASE DEBUG] Client created with token in headers');
  console.log('[SUPABASE DEBUG] === Server Client Creation Complete ===');

  return supabase;
}

/**
 * Get anon client with RLS enforced
 * Use for data fetching where RLS policies should be applied
 * @param accessToken - Optional access token for authenticated requests
 */
export function getAnonClient(accessToken?: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase anon key not configured');
  }

  // If access token is provided, include it in headers for RLS context
  const options: any = {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  };

  if (accessToken) {
    options.global = {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    };
  }

  return createClient(supabaseUrl, supabaseAnonKey, options);
}

/**
 * Verify user session and get profile/role from database
 * Decodes JWT token directly to get user ID (simpler and more reliable)
 */
export async function verifyUserAndGetProfile(supabase: any, request: NextRequest) {
  console.log('[verifyUserAndGetProfile] === Starting verification ===');
  
  // Step 1: Extract and decode JWT token to get user ID
  console.log('[verifyUserAndGetProfile] Step 1: Extracting access token...');
  const session = await extractAccessToken(request);
  
  console.log('[verifyUserAndGetProfile] Token extraction result:', session ? `Token found from ${session.source}` : 'NO TOKEN FOUND');
  
  if (!session?.accessToken) {
    console.error('[verifyUserAndGetProfile] ❌ No access token found in request');
    console.error('[verifyUserAndGetProfile] Request headers:', {
      authorization: request.headers.get('authorization'),
      contentType: request.headers.get('content-type'),
    });
    throw new Error('Unauthorized: Please log in again');
  }

  console.log('[verifyUserAndGetProfile] Step 2: Decoding JWT token...');
  const tokenPayload = decodeJWT(session.accessToken);
  if (!tokenPayload?.sub) {
    console.error('[verifyUserAndGetProfile] ❌ Invalid token payload - missing sub:', tokenPayload);
    throw new Error('Unauthorized: Invalid token');
  }

  const userId = tokenPayload.sub;
  console.log('[verifyUserAndGetProfile] ✅ User ID from token:', userId);

  // Step 2: Fetch profile and role using anon client with authentication (RLS enforced)
  const anonClient = getAnonClient(session.accessToken);
  
  const { data: profile, error: profileError } = await anonClient
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

/**
 * Get admin auth client for Supabase Auth admin operations ONLY
 * 
 * ⚠️ DEPRECATED: Do not use service role key in local API routes
 * 
 * For admin auth operations (getUserById, createUser, deleteUser, etc.):
 * - Use Supabase Edge Functions which run in secure backend environment
 * - Edge functions: https://xjgzudgmtbgitxcnklbm.supabase.co/functions/v1/
 * 
 * This function is kept for backwards compatibility with existing routes
 * that will be migrated to edge functions.
 */
export function getAdminAuthClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase configuration not found');
  }

  // Return anon client - admin operations should use edge functions instead
  console.warn('⚠️ getAdminAuthClient() called - consider using Supabase Edge Functions for admin operations');
  
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
