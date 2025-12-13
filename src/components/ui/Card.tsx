import React from 'react';
import Link from 'next/link';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  asLink?: boolean;
  href?: string;
  onClick?: () => void;
}

export default function Card({
  children,
  className = '',
  asLink = false,
  href,
  onClick,
}: CardProps) {
  const baseStyles = 'rounded-xl border border-border bg-white p-6 shadow-sm transition-all hover:shadow-md hover:border-accent';
  
  const classes = `${baseStyles} ${className}`;
  
  if (asLink && href) {
    return (
      <Link href={href} className={classes}>
        {children}
      </Link>
    );
  }
  
  if (onClick) {
    return (
      <button
        onClick={onClick}
        className={`${classes} text-left w-full`}
        type="button"
      >
        {children}
      </button>
    );
  }
  
  return (
    <div className={classes}>
      {children}
    </div>
  );
}





