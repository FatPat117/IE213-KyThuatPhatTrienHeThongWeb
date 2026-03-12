'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useState } from 'react';
import { useAuth } from '@/lib';

const WalletConnectButton = dynamic(() => import('@/components/wallet/WalletConnectButton'), {
  ssr: false,
});

export default function Header() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { token, user } = useAuth();
  const hasProvider =
    typeof window === 'undefined' ||
    Boolean((window as Window & { ethereum?: unknown }).ethereum);
  const isSignedIn = Boolean(token && user?.wallet);

  const publicLinks = [
    { href: '/campaigns', label: 'Chiến dịch' },
    { href: '/donations', label: 'Quyên góp' },
    { href: '/status', label: 'Trạng thái' },
  ];
  const privateLinks = [
    { href: '/campaigns/create', label: 'Tạo mới' },
    { href: '/certificates', label: 'Chứng chỉ của tôi' },
    { href: '/my-campaigns', label: 'Chiến dịch của tôi' },
    { href: '/settings', label: 'Cài đặt' },
  ];
  const navigationLinks = isSignedIn ? [...publicLinks.slice(0, 1), ...privateLinks, ...publicLinks.slice(1)] : publicLinks;

  return (
    <>
      <header className="sticky top-0 z-50 bg-gradient-to-r from-white via-slate-50 to-white border-b border-slate-200/50 shadow-sm backdrop-blur-md bg-opacity-95">
        {/* Alert Banner - Only show if no MetaMask */}
        {!hasProvider && (
          <div className="bg-gradient-to-r from-amber-50 to-yellow-50 border-b border-amber-200 px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-7xl flex items-center justify-between gap-3 py-2.5">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <span className="text-lg">⚠️</span>
                <p className="text-xs sm:text-sm font-medium text-amber-900 truncate">
                  Chưa có MetaMask. <span className="hidden sm:inline">Cài đặt để kết nối ví.</span>
                </p>
              </div>
              <a
                href="https://metamask.io/download/"
                target="_blank"
                rel="noopener noreferrer"
                className="whitespace-nowrap px-3 sm:px-4 py-1.5 rounded-lg bg-amber-600 text-white text-xs sm:text-sm font-semibold hover:bg-amber-700 transition"
              >
                Cài đặt
              </a>
            </div>
          </div>
        )}

        <nav className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8 py-4">
          {/* Logo Section */}
          <Link href="/" className="flex items-center gap-3 group cursor-pointer flex-shrink-0">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 via-blue-600 to-blue-700 text-white font-bold text-lg shadow-md group-hover:shadow-lg group-hover:from-blue-400 group-hover:to-blue-600 transition-all duration-300 transform group-hover:scale-105">
              FD
            </div>
            <div className="hidden sm:flex flex-col">
              <p className="text-xs font-semibold text-blue-600 tracking-widest uppercase leading-none">FundRaising</p>
              <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-blue-700 bg-clip-text text-transparent">dApp</h1>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <div className="hidden lg:flex items-center gap-1">
            {navigationLinks.map((link) => (
              <div key={link.href} className="relative group">
                <Link
                  href={link.href}
                  className="px-3 py-2 text-sm font-medium text-slate-700 hover:text-blue-600 transition-colors relative after:absolute after:bottom-0 after:left-0 after:w-0 after:h-0.5 after:bg-gradient-to-r after:from-blue-500 after:to-blue-600 hover:after:w-full after:transition-all after:duration-300"
                >
                  {link.label}
                </Link>
              </div>
            ))}
          </div>

          {/* Right Section - Wallet Button */}
          <div className="flex items-center gap-3">
            <WalletConnectButton />

            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="lg:hidden inline-flex items-center justify-center p-2 rounded-lg text-slate-700 hover:bg-slate-100 transition-colors"
              aria-label="Toggle menu"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d={isMobileMenuOpen ? 'M6 18L18 6M6 6l12 12' : 'M4 6h16M4 12h16M4 18h16'}
                />
              </svg>
            </button>
          </div>
        </nav>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="lg:hidden border-t border-slate-200/50 bg-gradient-to-b from-slate-50 to-white">
            <div className="px-4 py-4 space-y-2">
              {navigationLinks.map((link) => (
                <div key={link.href}>
                  <Link
                    href={link.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="block px-3 py-2 text-sm font-medium text-slate-700 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors"
                  >
                    {link.label}
                  </Link>
                </div>
              ))}
            </div>
          </div>
        )}
      </header>
    </>
  );
}
