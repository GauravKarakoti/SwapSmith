"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { useState, useEffect, type ComponentType } from "react";
import {
  Zap,
  User,
  LogOut,
  Home,
  TrendingUp,
  Terminal as TerminalIcon,
  MessageSquare,
  BookOpen,
  Trophy,
  Menu,
  X,
  Info,
} from "lucide-react";
import Image from "next/image";
import { useAuth } from "@/hooks/useAuth";
import WalletConnector from "./WalletConnector";
import ThemeToggle from "@/components/ThemeToggle";

export default function Navbar() {
  const pathname = usePathname();
  const { logout, user } = useAuth();
  const isTerminal = pathname === "/terminal";

  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [profileImageUrl, setProfileImageUrl] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const NAV_ITEMS = [
    { href: "/prices", label: "Live Prices", Icon: TrendingUp },
    { href: "/discussions", label: "Discussions", Icon: MessageSquare },
    { href: "/learn", label: "Learn", Icon: BookOpen },
    { href: "/rewards", label: "Rewards", Icon: Trophy },
    { href: "/terminal", label: "Terminal", Icon: TerminalIcon },
    { href: "/about", label: "About", Icon: Info },
  ];

  useEffect(() => { setMobileMenuOpen(false); }, [pathname]);

  useEffect(() => {
    const loadImage = () => {
      const img = localStorage.getItem(`profile-image-${user?.uid}`);
      setProfileImageUrl(img);
    };
    loadImage();
    window.addEventListener("profileImageChanged", loadImage);
    return () => window.removeEventListener("profileImageChanged", loadImage);
  }, [user?.uid]);

  return (
    <>
      <nav className={`fixed top-0 left-0 right-0 z-50 border-b border-zinc-200 dark:border-zinc-800 backdrop-blur-xl h-16 sm:h-20 transition-colors ${
        isTerminal ? "bg-white/70 dark:bg-zinc-900/40" : "bg-white/80 dark:bg-[#050505]/80"
      }`}>
        <div className="max-w-[1600px] mx-auto px-4 h-full flex items-center justify-between gap-4">
          
          {/* LEFT: Logo & Branding */}
          <div className="flex items-center gap-6 shrink-0">
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="bg-blue-600 p-1.5 rounded-lg shadow-lg shadow-blue-500/20 group-hover:scale-105 transition-transform">
                <Zap className="w-5 h-5 text-white" fill="white" />
              </div>
              <span className="text-lg font-black uppercase tracking-tighter text-zinc-900 dark:text-white hidden lg:block">
                SwapSmith
              </span>
            </Link>

            {isTerminal && (
              <div className="hidden xl:flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
                  System Active
                </span>
              </div>
            )}
          </div>

          {/* CENTER: Navigation (Desktop) */}
          <div className="hidden md:flex items-center justify-center flex-1 min-w-0">
            <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800/40 p-1 rounded-xl border border-zinc-200 dark:border-zinc-800">
              <Link
                href="/"
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                  pathname === "/" 
                  ? "bg-white dark:bg-zinc-800 text-blue-600 dark:text-white shadow-sm" 
                  : "text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
                }`}
              >
                <Home className="w-4 h-4" />
                <span>Home</span>
              </Link>
              
              {NAV_ITEMS.map(({ href, label, Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                    pathname === href
                      ? "bg-white dark:bg-zinc-800 text-blue-600 dark:text-white shadow-sm"
                      : "text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden lg:inline">{label}</span>
                </Link>
              ))}
            </div>
          </div>

          {/* RIGHT: Actions */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <div className="hidden sm:flex items-center gap-3">
              <WalletConnector />
              <ThemeToggle />
            </div>

            <button
              onClick={() => setShowProfileMenu((v) => !v)}
              className="relative p-0.5 rounded-full border-2 border-transparent hover:border-blue-500 transition-all active:scale-95"
            >
              {profileImageUrl ? (
                <Image src={profileImageUrl} alt="P" width={36} height={36} className="rounded-full object-cover" unoptimized />
              ) : (
                <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg">
                  <User className="w-4 h-4 text-white" />
                </div>
              )}
            </button>

            <button
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden p-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Profile Dropdown */}
        {showProfileMenu && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setShowProfileMenu(false)} />
            <div className="absolute right-4 top-20 w-56 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2">
              <div className="p-3 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/20">
                <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest px-2">Account</p>
              </div>
              <div className="p-2">
                {[
                  { href: "/profile", label: "Profile", icon: User },
                  { href: "/rewards", label: "Rewards", icon: Trophy },
                  { href: "/learn", label: "Learning", icon: BookOpen },
                ].map((item) => (
                  <Link key={item.href} href={item.href} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors" onClick={() => setShowProfileMenu(false)}>
                    <item.icon className="w-4 h-4" /> {item.label}
                  </Link>
                ))}
                <div className="h-px bg-zinc-100 dark:bg-zinc-800 my-2" />
                <button onClick={() => { logout(); setShowProfileMenu(false); }} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors">
                  <LogOut className="w-4 h-4" /> Logout
                </button>
              </div>
            </div>
          </>
        )}
      </nav>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <>
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60]" onClick={() => setMobileMenuOpen(false)} />
          <div className="fixed top-0 right-0 bottom-0 w-[85%] max-w-sm bg-white dark:bg-zinc-900 shadow-2xl z-[70] animate-in slide-in-from-right">
            <div className="p-6 flex flex-col h-full">
              <div className="flex items-center justify-between mb-8">
                <span className="font-black tracking-tighter text-xl">MENU</span>
                <button onClick={() => setMobileMenuOpen(false)} className="p-2 rounded-full bg-zinc-100 dark:bg-zinc-800"><X /></button>
              </div>
              <div className="space-y-2 flex-1">
                {[ {href: "/", label: "Home", Icon: Home}, ...NAV_ITEMS].map((item) => (
                   <Link key={item.href} href={item.href} className={`flex items-center gap-4 p-4 rounded-2xl text-lg font-bold transition-all ${pathname === item.href ? "bg-blue-600 text-white shadow-lg" : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"}`}>
                     <item.Icon className="w-6 h-6" /> {item.label}
                   </Link>
                ))}
              </div>
              <div className="pt-6 border-t border-zinc-100 dark:border-zinc-800 space-y-4">
                <WalletConnector />
                <div className="flex justify-center"><ThemeToggle /></div>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}