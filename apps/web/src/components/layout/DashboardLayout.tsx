'use client';

import { createClient } from '@/lib/supabase';
import { useRouter, usePathname } from 'next/navigation';
import { useState } from 'react';

const navItems = [
  { label: 'Dashboard', href: '/' },
  { label: 'History', href: '/history' },
  { label: 'Knowledge Base', href: '/knowledge-base' },
  { label: 'Settings', href: '/settings' },
];

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const router = useRouter();
  const pathname = usePathname();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.refresh();
  };

  return (
    <div className="flex h-screen bg-bg-primary">
      <aside className="w-56 flex flex-col border-r border-border bg-bg-secondary">
        <div className="flex items-center gap-2 px-4 h-14 border-b border-border">
          <div className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center">
            <span className="text-xs font-bold text-white">TC</span>
          </div>
          <span className="font-semibold text-text-primary">Copilot</span>
        </div>

        <nav className="flex-1 p-2 space-y-1">
          {navItems.map((item) => (
            <button
              key={item.label}
              onClick={() => router.push(item.href)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                pathname === item.href
                  ? 'bg-accent/10 text-accent'
                  : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="p-2 border-t border-border">
          <button
            onClick={handleSignOut}
            className="w-full px-3 py-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors text-sm"
          >
            Sign Out
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
