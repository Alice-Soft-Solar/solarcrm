import Link from 'next/link';

interface PageHeaderProps {
  title: string;
  showBackButton?: boolean;
  backHref?: string;
  rightAction?: React.ReactNode;
}

export default function PageHeader({
  title,
  showBackButton = true,
  backHref = '/dashboard',
  rightAction,
}: PageHeaderProps) {
  return (
    <nav className="border-b border-border bg-zinc-50">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-4">
            {showBackButton && (
              <Link
                href={backHref}
                className="flex items-center text-foreground hover:text-accent transition-colors"
                title="Back to Dashboard"
                aria-label="Back to Dashboard"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </Link>
            )}
            <Link href="/dashboard" className="text-xl font-bold text-foreground">
              Solar CRM
            </Link>
            <span className="text-zinc-400" aria-hidden="true">/</span>
            <span className="text-foreground">{title}</span>
          </div>
          {rightAction && <div>{rightAction}</div>}
        </div>
      </div>
    </nav>
  );
}

