import { useEffect } from 'react';
import { useUIStore } from '@/stores/uiStore';
import Sidebar from './Sidebar';
import Header from './Header';
import IncusLauncher from '@/components/incus/IncusLauncher';

export default function Layout({ children }: { children: React.ReactNode }) {
  const { sidebarOpen, sidebarCollapsed, darkMode } = useUIStore();

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  return (
    <div className="app-shell flex h-screen overflow-hidden bg-[var(--bg-canvas)]">
      {/* Sidebar */}
      <Sidebar />

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/50 lg:hidden"
          onClick={useUIStore.getState().toggleSidebar}
        />
      )}

      {/* Main content area */}
      <div
        className={`flex flex-1 flex-col overflow-hidden transition-all duration-300 ${
          sidebarCollapsed ? 'lg:ml-20' : 'lg:ml-64'
        }`}
      >
        <Header />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          <div className="mx-auto w-full max-w-7xl">{children}</div>
        </main>
      </div>

      <IncusLauncher />
    </div>
  );
}
