'use client';

import { ErrorBoundary } from '../ui';

export default function ErrorBoundaryProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ErrorBoundary>{children}</ErrorBoundary>;
}





