import React from 'react';
import { render, screen } from '@testing-library/react';
import PageHeader from '../../src/components/PageHeader';

// Mock next/link since it's used in the component
jest.mock('next/link', () => {
  return ({ children, ...rest }: { children: React.ReactNode }) => {
    return <a {...rest}>{children}</a>;
  };
});

describe('PageHeader Component', () => {
  it('renders the title correctly', () => {
    render(<PageHeader title="Test Page Title" />);
    expect(screen.getByText('Test Page Title')).toBeInTheDocument();
    expect(screen.getByText('Solar CRM')).toBeInTheDocument();
  });

  it('renders back button by default', () => {
    render(<PageHeader title="Test Page" />);
    const backButton = screen.getByLabelText('Back to Dashboard');
    expect(backButton).toBeInTheDocument();
  });

  it('does not render back button when showBackButton is false', () => {
    render(<PageHeader title="Test Page" showBackButton={false} />);
    const backButton = screen.queryByLabelText('Back to Dashboard');
    expect(backButton).not.toBeInTheDocument();
  });

  it('renders right action when provided', () => {
    render(
      <PageHeader 
        title="Test Page" 
        rightAction={<button>Ctx Action</button>} 
      />
    );
    expect(screen.getByText('Ctx Action')).toBeInTheDocument();
  });
});
