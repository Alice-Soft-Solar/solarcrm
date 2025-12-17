'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { Button } from '@/components/ui';

export default function LeadSuccessPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const leadId = searchParams.get('leadId');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return (
    <DashboardLayout>
      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="rounded-lg border border-green-200 bg-green-50 p-8 text-center shadow-sm">
          <div className="mb-4">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <svg
                className="h-8 w-8 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
          </div>
          <h1 className="mb-2 text-2xl font-bold text-green-900">Lead Created Successfully!</h1>
          <p className="mb-6 text-sm text-green-700">
            Your lead has been saved to the database.
            {leadId && (
              <span className="block mt-2 text-xs opacity-75">Lead ID: {leadId}</span>
            )}
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Button
              variant="primary"
              size="md"
              onClick={() => router.push('/dashboard/leads/new')}
            >
              Create Another Lead
            </Button>
            <Button
              variant="outline"
              size="md"
              onClick={() => router.push('/dashboard/leads')}
            >
              View Leads
            </Button>
            <Button
              variant="outline"
              size="md"
              onClick={() => router.push('/dashboard')}
            >
              Go to Dashboard
            </Button>
          </div>
        </div>
      </main>
    </DashboardLayout>
  );
}

