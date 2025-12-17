'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface MenuItem {
  title: string;
  href: string;
  icon: React.ReactNode;
  roles?: string[];
}

interface AppDrawerProps {
  roleName: string;
  menuItems: MenuItem[];
  isOpen: boolean;
  onToggle: () => void;
}

export default function AppDrawer({ roleName, menuItems, isOpen, onToggle }: AppDrawerProps) {
  const pathname = usePathname();

  // Filter menu items based on role
  const filteredItems = menuItems.filter(item => {
    if (!item.roles) return true;
    return item.roles.includes(roleName);
  });

  return (
    <>
      {/* Backdrop overlay for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onToggle}
          aria-hidden="true"
        />
      )}
      
      {/* Sidebar - Slides from left */}
      <div
        className={`
          fixed left-0 top-0 z-50 h-full 
          w-72 sm:w-72 max-w-[85vw] bg-gradient-to-b from-white via-white to-zinc-50
          border-r border-border shadow-2xl
          transform transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:z-40
        `}
      >
        <div className="flex h-full flex-col">
          {/* Header with Green Theme */}
          <div className="border-b border-border bg-gradient-to-r from-accent/10 to-accent/5 px-6 py-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent shadow-lg">
                  <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                  </svg>
                </div>
                <h2 className="text-lg font-bold text-foreground">
                  Navigation
                </h2>
              </div>
              <button
                onClick={onToggle}
                className="rounded-lg p-2 text-foreground/70 hover:bg-foreground/10 hover:text-foreground transition-colors"
                aria-label="Close menu"
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          </div>

          {/* Menu Items with Green Theme */}
          <nav className="flex-1 overflow-y-auto px-4 py-6">
            <div className="space-y-2">
              {filteredItems.map((item, index) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                return (
                  <Link
                    key={index}
                    href={item.href}
                    onClick={onToggle}
                    className={`
                      group relative flex items-center gap-4 rounded-xl px-4 py-4
                      transition-all duration-200 ease-in-out
                      ${
                        isActive
                          ? 'bg-gradient-to-r from-accent to-accent-hover text-white shadow-lg shadow-accent/30'
                          : 'text-foreground hover:bg-accent/10 hover:shadow-md'
                      }
                    `}
                  >
                    {/* Active indicator bar */}
                    {isActive && (
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-white rounded-r-full" />
                    )}
                    
                    <div
                      className={`
                        flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl
                        transition-all duration-200 ease-in-out
                        ${
                          isActive
                            ? 'bg-white/20 text-white'
                            : 'bg-accent/10 text-accent group-hover:bg-accent group-hover:text-white'
                        }
                      `}
                    >
                      {item.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p
                        className={`
                          font-semibold text-base truncate
                          transition-colors duration-200
                          ${isActive ? 'text-white' : 'text-foreground'}
                        `}
                      >
                        {item.title}
                      </p>
                    </div>
                    {isActive && (
                      <div className="h-2 w-2 flex-shrink-0 rounded-full bg-white" />
                    )}
                  </Link>
                );
              })}
            </div>
          </nav>

          {/* Footer with Green Theme */}
          <div className="border-t border-border bg-zinc-50 px-6 py-4">
            <p className="text-xs text-foreground/60 text-center">
              Solar CRM Dashboard
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

