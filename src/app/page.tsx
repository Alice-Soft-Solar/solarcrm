import { Button, Card } from '@/components/ui';

const features = [
  {
    title: 'Customer Management',
    description: 'Manage customer relationships and track interactions efficiently',
    icon: (
      <svg
        className="h-6 w-6 text-foreground"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
        />
      </svg>
    ),
  },
  {
    title: 'Work Orders',
    description: 'Create and track work orders with detailed customer information',
    icon: (
      <svg
        className="h-6 w-6 text-foreground"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
        />
      </svg>
    ),
  },
  {
    title: 'Lead Tracking',
    description: 'Monitor leads from initial contact to conversion',
    icon: (
      <svg
        className="h-6 w-6 text-foreground"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
        />
      </svg>
    ),
  },
];

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12">
      <main className="mx-auto w-full max-w-4xl text-center">
        {/* Hero Section */}
        <div className="mb-12 space-y-6">
          <h1 className="text-display font-bold tracking-tight text-foreground">
            Solar CRM
          </h1>
          <p className="mx-auto max-w-2xl text-xl text-foreground opacity-70 sm:text-2xl">
            Customer Relationship Management System
          </p>
          <p className="mx-auto max-w-xl text-base text-foreground opacity-70 sm:text-lg">
            Streamline your solar business operations with comprehensive customer, lead, and work order management
          </p>
        </div>

        {/* CTA Button */}
        <div className="mb-16">
          <Button
            asLink
            href="/login"
            variant="primary"
            size="lg"
          >
            Get Started
            <svg
              className="ml-2 h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 7l5 5m0 0l-5 5m5-5H6"
              />
            </svg>
          </Button>
        </div>

        {/* Features Grid */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, index) => (
            <Card key={index}>
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-zinc-100">
                {feature.icon}
              </div>
              <h3 className="mb-2 text-lg font-semibold text-foreground">
                {feature.title}
              </h3>
              <p className="text-sm text-foreground opacity-70">
                {feature.description}
              </p>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}
