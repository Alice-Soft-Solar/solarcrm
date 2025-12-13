'use client';

import React from 'react';

interface ChartCardProps {
  title: string;
  children: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
}

export default function ChartCard({ 
  title, 
  children, 
  className = '',
  action 
}: ChartCardProps) {
  return (
    <div
      className={`
        group relative overflow-hidden rounded-2xl 
        border border-border/50 bg-white p-6 
        shadow-sm hover:shadow-xl hover:border-accent/30
        transition-all duration-300
        ${className}
      `}
    >
      {/* Subtle gradient overlay on hover */}
      <div className="absolute inset-0 bg-gradient-to-br from-accent/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      
      {/* Header */}
      <div className="relative flex items-center justify-between mb-6">
        <h3 className="text-lg font-bold text-foreground tracking-tight">
          {title}
        </h3>
        {action && (
          <div className="flex items-center gap-2">
            {action}
          </div>
        )}
      </div>
      
      {/* Chart container with better spacing */}
      <div className="relative h-80 -mx-2">
        {children}
      </div>
    </div>
  );
}
