import React, { useState } from 'react';
import { LucideIcon, Menu, X, LogOut, RefreshCw, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
}

interface SidebarLayoutProps {
  portalTitle: string;
  navItems: NavItem[];
  activeTab: string;
  onSelectTab: (id: string) => void;
  breadcrumbSection: string;
  headerAction?: React.ReactNode;
  children: React.ReactNode;
}

export function SidebarLayout({
  portalTitle,
  navItems,
  activeTab,
  onSelectTab,
  breadcrumbSection,
  headerAction,
  children,
}: SidebarLayoutProps) {
  const { firebaseUser, userAccount, portalSettings, logout, loginWithGoogle, role } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [logoError, setLogoError] = useState(false);

  const handleSwitchAccount = async () => {
    const portalHint = role === 'student' ? 'student' : 'faculty';
    await loginWithGoogle(portalHint);
  };

  const sidebarContent = (
    <div className="flex h-full flex-col bg-white border-r border-[#DDE6EE]">
      {/* College Branding */}
      <div className="flex items-center gap-3 border-b border-[#DDE6EE] px-4 py-3.5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md border border-[#DDE6EE] bg-white">
          {!logoError && portalSettings.logoUrl ? (
            <img
              src={portalSettings.logoUrl}
              alt={`${portalSettings.shortName} crest`}
              referrerPolicy="no-referrer"
              onError={() => setLogoError(true)}
              className="h-8 w-8 object-contain"
            />
          ) : (
            <ShieldCheck className="h-5 w-5 text-[#03CAFC]" />
          )}
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-bold text-[#0F1E36] font-display">
            {portalSettings.shortName} ERP
          </div>
          <div className="truncate text-[11px] text-[#5B6B80]">{portalTitle}</div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5" aria-label="Portal Navigation">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                onSelectTab(item.id);
                setMobileOpen(false);
              }}
              className={`flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-[13px] font-medium transition-colors whitespace-nowrap ${
                active
                  ? 'bg-[#ECFAFE] text-[#0F1E36] font-semibold border border-[#BBE9FA]'
                  : 'text-[#5B6B80] hover:bg-[#F5F8FA] hover:text-[#0F1E36] border border-transparent'
              }`}
            >
              <Icon className={`h-4 w-4 shrink-0 ${active ? 'text-[#0284C7]' : 'text-[#5B6B80]'}`} />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Account Footer */}
      <div className="border-t border-[#DDE6EE] p-3">
        <div className="flex items-center gap-2.5 px-1 py-1.5">
          {firebaseUser?.photoURL ? (
            <img
              src={firebaseUser.photoURL}
              alt={userAccount?.displayName || 'User'}
              referrerPolicy="no-referrer"
              className="h-8 w-8 rounded-full border border-[#DDE6EE] object-cover shrink-0"
            />
          ) : (
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#ECFAFE] text-xs font-bold text-[#0F1E36]">
              {(userAccount?.displayName || 'U').charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-[#0F1E36]">
              {userAccount?.displayName || firebaseUser?.displayName || 'Portal User'}
            </p>
            <p className="truncate text-[11px] text-[#5B6B80]">
              {firebaseUser?.email}
            </p>
          </div>
        </div>

        <div className="mt-2 grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={handleSwitchAccount}
            className="flex items-center justify-center gap-1.5 rounded-md border border-[#DDE6EE] bg-white px-2.5 py-1.5 text-[11px] font-medium text-[#0F1E36] hover:bg-[#F5F8FA] whitespace-nowrap"
          >
            <RefreshCw className="h-3 w-3" />
            <span>Switch</span>
          </button>
          <button
            type="button"
            onClick={logout}
            className="flex items-center justify-center gap-1.5 rounded-md border border-[#DDE6EE] bg-white px-2.5 py-1.5 text-[11px] font-medium text-red-700 hover:bg-red-50 whitespace-nowrap"
          >
            <LogOut className="h-3 w-3" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-[#F5F8FA]">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-64 shrink-0 sticky top-0 h-screen">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-slate-900/40"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative z-10 w-64 max-w-[80vw] h-full">
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="absolute right-2 top-3 rounded p-1 text-[#5B6B80] hover:bg-slate-100"
              aria-label="Close navigation"
            >
              <X className="h-4 w-4" />
            </button>
            {sidebarContent}
          </div>
        </div>
      )}

      {/* Main Content Viewport */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-[#DDE6EE] bg-white px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="rounded-md border border-[#DDE6EE] p-1.5 text-[#0F1E36] hover:bg-[#F5F8FA] lg:hidden"
              aria-label="Open menu"
            >
              <Menu className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-2 text-xs sm:text-sm min-w-0">
              <span className="hidden sm:inline font-medium text-[#5B6B80] truncate">
                {portalSettings.collegeName}
              </span>
              <span className="hidden sm:inline text-[#B0C0D0]">/</span>
              <span className="font-semibold text-[#0F1E36] truncate">{breadcrumbSection}</span>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <span className="hidden md:inline text-xs text-[#5B6B80] font-mono-data">
              AY {portalSettings.academicYear} · Sem {portalSettings.semester}
            </span>
            {headerAction}
          </div>
        </header>

        <main className="flex-1 px-4 py-5 sm:px-6 lg:px-7">
          <div className="mx-auto max-w-[1360px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
