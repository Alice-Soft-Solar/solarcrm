'use client';

import React, { useEffect, useState } from 'react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: {
    value: number;
    label: string;
    isPositive?: boolean;
  };
  icon?: React.ReactNode;
  color?: 'blue' | 'green' | 'orange' | 'purple' | 'red';
  onClick?: () => void;
}

export default function StatCard({
  title,
  value,
  subtitle,
  trend,
  icon,
  color = 'blue',
  onClick,
}: StatCardProps) {
  const [displayValue, setDisplayValue] = useState(0);
  const isNumeric = typeof value === 'number';

  useEffect(() => {
    if (isNumeric) {
      const target = value;
      const duration = 1000;
      const steps = 60;
      const increment = target / steps;
      let current = 0;
      const timer = setInterval(() => {
        current += increment;
        if (current >= target) {
          setDisplayValue(target);
          clearInterval(timer);
        } else {
          setDisplayValue(Math.floor(current));
        }
      }, duration / steps);
      return () => clearInterval(timer);
    }
  }, [value, isNumeric]);

  const colorConfig = {
    blue: {
      gradient: 'from-blue-500 via-blue-600 to-blue-700',
      bg: 'bg-gradient-to-br from-blue-50 via-blue-100/50 to-white',
      border: 'border-blue-200/50',
      iconBg: 'bg-gradient-to-br from-blue-500 to-blue-600',
      text: 'text-blue-700',
      lightText: 'text-blue-600',
      shadow: 'shadow-blue-500/20',
    },
    green: {
      gradient: 'from-emerald-500 via-emerald-600 to-emerald-700',
      bg: 'bg-gradient-to-br from-emerald-50 via-emerald-100/50 to-white',
      border: 'border-emerald-200/50',
      iconBg: 'bg-gradient-to-br from-emerald-500 to-emerald-600',
      text: 'text-emerald-700',
      lightText: 'text-emerald-600',
      shadow: 'shadow-emerald-500/20',
    },
    orange: {
      gradient: 'from-orange-500 via-orange-600 to-orange-700',
      bg: 'bg-gradient-to-br from-orange-50 via-orange-100/50 to-white',
      border: 'border-orange-200/50',
      iconBg: 'bg-gradient-to-br from-orange-500 to-orange-600',
      text: 'text-orange-700',
      lightText: 'text-orange-600',
      shadow: 'shadow-orange-500/20',
    },
    purple: {
      gradient: 'from-purple-500 via-purple-600 to-purple-700',
      bg: 'bg-gradient-to-br from-purple-50 via-purple-100/50 to-white',
      border: 'border-purple-200/50',
      iconBg: 'bg-gradient-to-br from-purple-500 to-purple-600',
      text: 'text-purple-700',
      lightText: 'text-purple-600',
      shadow: 'shadow-purple-500/20',
    },
    red: {
      gradient: 'from-red-500 via-red-600 to-red-700',
      bg: 'bg-gradient-to-br from-red-50 via-red-100/50 to-white',
      border: 'border-red-200/50',
      iconBg: 'bg-gradient-to-br from-red-500 to-red-600',
      text: 'text-red-700',
      lightText: 'text-red-600',
      shadow: 'shadow-red-500/20',
    },
  };

  const config = colorConfig[color];

  const shadowClass = {
    blue: 'hover:shadow-blue-500/20',
    green: 'hover:shadow-emerald-500/20',
    orange: 'hover:shadow-orange-500/20',
    purple: 'hover:shadow-purple-500/20',
    red: 'hover:shadow-red-500/20',
  }[color];

  return (
    <div
      onClick={onClick}
      className={`
        group relative overflow-hidden rounded-2xl border ${config.border} 
        ${config.bg} p-6 transition-all duration-300
        hover:shadow-xl ${shadowClass} hover:-translate-y-1
        ${onClick ? 'cursor-pointer' : ''}
      `}
    >
      {/* Animated gradient background */}
      <div
        className={`absolute inset-0 bg-gradient-to-br ${config.gradient} opacity-0 group-hover:opacity-5 transition-opacity duration-300`}
      />
      
      {/* Decorative corner accent */}
      <div
        className={`absolute -right-8 -top-8 h-24 w-24 rounded-full bg-gradient-to-br ${config.gradient} opacity-10 blur-2xl`}
      />

      <div className="relative flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground/70 mb-2 uppercase tracking-wide">
            {title}
          </p>
          <p
            className={`
              text-4xl font-bold ${config.text} mb-1
              tabular-nums
            `}
          >
            {isNumeric
              ? displayValue.toLocaleString()
              : value}
          </p>
          {subtitle && (
            <p className="text-xs text-foreground/60 font-medium">
              {subtitle}
            </p>
          )}
          {trend && (
            <div className="mt-3 flex items-center gap-2">
              <div
                className={`
                  flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold
                  ${trend.isPositive ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}
                `}
              >
                <span>{trend.isPositive ? '↑' : '↓'}</span>
                <span>{Math.abs(trend.value)}%</span>
              </div>
              <span className="text-xs text-foreground/60">
                {trend.label}
              </span>
            </div>
          )}
        </div>
        {icon && (
          <div
            className={`
              ${config.iconBg} rounded-xl p-3 shadow-lg
              transform group-hover:scale-110 group-hover:rotate-3
              transition-transform duration-300
            `}
          >
            <div className="text-white">
              {icon}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
