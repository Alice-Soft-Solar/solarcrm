import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { userIds } = await request.json();

    if (!userIds || !Array.isArray(userIds)) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseServiceKey) {
      console.error('SUPABASE_SERVICE_ROLE_KEY is not configured');
      return NextResponse.json(
        { error: 'Service role key not configured', emailMap: {} },
        { status: 500 }
      );
    }

    // Use service role key to access auth.users
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Fetch user emails from auth.users in parallel (much faster)
    const emailMap: Record<string, string> = {};

    // Use Promise.all to fetch all users in parallel instead of sequential loop
    const emailPromises = userIds.map(async (userId) => {
      try {
        const { data: user, error } = await supabase.auth.admin.getUserById(userId);
        if (!error && user?.user?.email) {
          return { userId, email: user.user.email };
        }
        return { userId, email: null };
      } catch (error) {
        return { userId, email: null };
      }
    });

    const results = await Promise.all(emailPromises);
    results.forEach(({ userId, email }) => {
      if (email) {
        emailMap[userId] = email;
      }
    });

    return NextResponse.json({ emailMap });
  } catch (error: unknown) {
    console.error('API Error fetching emails:', error);
    const errorMessage = error instanceof Error ? error.message : 'An error occurred';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

