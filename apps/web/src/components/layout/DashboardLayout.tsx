'use client';

import { createClient } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

const navItems = [
  { label: 'Dashboard', icon: 'LayoutDashboard', href: '/' },
  { label: 'Meetings', icon: 'Video', href: '/meetings' },
  { label: 'History', icon: 'Clock', href: '/history' },
  { label: 'Knowledge Base', icon: 'Library', href: '/knowledge-base' },
  { label: 'Settings', icon: 'Settings', href: '/settings' },
];

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.refresh();
  };

  return (
    <div className="flex h-screen bg-bg-primary">
      {/* Sidebar */}
      <aside className={`${collapsed ? 'w-16' : 'w-56'} flex flex-col border-r border-border bg-bg-secondary transition-all duration-200`}>
        {/* Logo */}
        <div className="flex items-center gap-2 px-4 h-14 border-b border-border">
          <div className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center">
            <span className="text-xs font-bold text-white">TC</span>
          </div>
          {!collapsed && <span className="font-semibold text-text-primary">Copilot</span>}
        </div>

        {/* Nav */}
        <nav className="flex-1 p-2 space-y-1">
          {navItems.map((item) => (
            <button
              key={item.label}
              onClick={() => router.push(item.href)}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors"
            >
              <span className="text-lg">{item.label[0]}</span>
              {!collapsed && <span className="text-sm">{item.label}</span>}
            </button>
          ))}
        </nav>

        {/* Bottom */}
        <div className="p-2 border-t border-border">
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors text-sm"
          >
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
