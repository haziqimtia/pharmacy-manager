import React from 'react';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

export function AppLayout({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex h-screen w-screen overflow-hidden">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar title={title} />
        <main className="flex-1 overflow-y-auto bg-slate-50 p-6">{children}</main>
      </div>
    </div>
  );
}
