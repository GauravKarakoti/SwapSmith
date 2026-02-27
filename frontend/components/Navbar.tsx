"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import {
  Zap,
  User,
  Users,
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
  ChevronRight,
  Star,
} from "lucide-react";
import Image from "next/image";
import { useAuth } from "@/hooks/useAuth";
import WalletConnector from "./WalletConnector";
import ThemeToggle from "@/components/ThemeToggle";
import MarketSentimentWidget from "@/components/MarketSentimentWidget";

const NAV_ITEMS = [
  { href: "/prices", label: "Live Prices", Icon: TrendingUp },
  { href: "/discussions", label: "Discussions", Icon: MessageSquare },
  { href: "/terminal", label: "Terminal", Icon: TerminalIcon },
  { href: "/contributors", label: "Contributors", Icon: Users },
  { href: "/watchlist", label: "Watchlist", Icon: Star },
];

const PROFILE_MENU = [
  { href: "/profile", label: "Profile", Icon: User },
  { href: "/rewards", label: "Rewards", Icon: Trophy },
  { href: "/learn", label: "Learn", Icon: BookOpen },
  { href: "/about", label: "About", Icon: Info },
];

export default function Navbar() {
  const pathname = usePathname();
  const { logout, user } = useAuth();
  const isTerminal = pathname === "/terminal";

  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [profileImageUrl, setProfileImageUrl] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => { setMobileMenuOpen(false); }, [pathname]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setShowProfileMenu(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    const loadImage = () => {
      if (!user?.uid) return;
      const img = localStorage.getItem(`profile-image-${user.uid}`);
      setProfileImageUrl(img);
    };
    loadImage();
    window.addEventListener("profileImageChanged", loadImage);
    return () => window.removeEventListener("profileImageChanged", loadImage);
  }, [user?.uid]);

  return (
    <>
      <nav
        className={`fixed top-0 left-0 right-0 z-50 h-16 sm:h-20 backdrop-blur-2xl transition-all duration-300 ${
          scrolled ? "border-b border-zinc-200 dark:border-zinc-800 shadow-sm" : "border-b border-transparent"
        } ${isTerminal ? "bg-white/80 dark:bg-zinc-950/80" : "bg-white/85 dark:bg-[#08080f]/85"}`}
      >
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 h-full grid grid-cols-[auto_1fr_auto] items-center">

          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group shrink-0">
            <div className="rounded-xl shadow-lg shadow-blue-500/20 group-hover:scale-105 transition-all duration-200 overflow-hidden" style={{ width: 32, height: 32 }}>
              <Image src="/swapsmithicon.png" alt="SwapSmith" width={32} height={32} />
            </div>
            <span className="hidden lg:block text-lg font-black uppercase tracking-tighter text-zinc-900 dark:text-white">
              SwapSmith
            </span>
          </Link>

          {/* Center Navigation - hidden on mobile, shown on md+ */}
          <div className="hidden md:flex items-center justify-center px-4">
            <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800/40 p-1 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
              <Link
                href="/"
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all shrink-0 ${
                  pathname === "/" 
                  ? "bg-white dark:bg-zinc-800 text-blue-600 dark:text-white shadow-sm" 
                  : "text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
                }`}
              >
                <Home className="w-4 h-4" />
                <span className="hidden lg:inline">Home</span>
              </Link>

              {NAV_ITEMS.map(({ href, label, Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all shrink-0 ${
                    pathname === href
                      ? "bg-white dark:bg-zinc-800 text-blue-600 dark:text-white shadow-sm"
                      : "text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden xl:inline">{label}</span>
                </Link>
              ))}
            </div>
            <div className="ml-4 hidden xl:block flex-shrink-0">
              <MarketSentimentWidget />
            </div>
          </div>

          {/* Right Side Actions */}
          <div className="flex items-center gap-2 sm:gap-3 ml-auto">
            <div className="hidden md:flex items-center gap-3">
              <WalletConnector />
              <ThemeToggle />
            </div>

            <div className="hidden md:block relative" ref={profileRef}>
              <button
                onClick={() => setShowProfileMenu((v) => !v)}
                className="p-1 rounded-full border-2 border-transparent hover:border-blue-500 transition-all active:scale-95"
              >
                {profileImageUrl ? (
                  <Image src={profileImageUrl} alt="P" width={36} height={36} className="rounded-full object-cover" unoptimized />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-linear-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg">
                    <User className="w-4 h-4 text-white" />
                  </div>
                )}
              </button>

              {showProfileMenu && (
                <div className="absolute right-0 mt-3 w-60 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                  <div className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/20">
                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Manage Account</p>
                  </div>
                  <div className="p-2">
                    {PROFILE_MENU.map(({ href, label, Icon }) => (
                      <Link
                        key={href}
                        href={href}
                        onClick={() => setShowProfileMenu(false)}
                        className="group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all"
                      >
                        <Icon className="w-4 h-4 text-zinc-400 group-hover:text-blue-500 transition-colors" />
                        {label}
                        <ChevronRight className="w-3.5 h-3.5 ml-auto opacity-0 group-hover:opacity-100 transition-all" />
                      </Link>
                    ))}
                    <div className="h-px bg-zinc-100 dark:bg-zinc-800 my-2" />
                    <button
                      onClick={() => { setShowProfileMenu(false); logout(); }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      Logout
                    </button>
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden p-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 ml-auto"
            >
              <Menu className="w-6 h-6" />
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Menu - shown below md */}
      {mobileMenuOpen && (
        <>
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60]" onClick={() => setMobileMenuOpen(false)} />
          <div className="fixed top-0 right-0 bottom-0 w-[85%] max-w-sm bg-white dark:bg-zinc-900 shadow-2xl z-[70] animate-in slide-in-from-right duration-300">
            <div className="p-6 flex flex-col h-full">
              <div className="flex items-center justify-between mb-6">
                <Link href="/" className="flex items-center gap-2" onClick={() => setMobileMenuOpen(false)}>
                  <div className="rounded-xl overflow-hidden" style={{ width: 32, height: 32 }}>
                    <Image src="/swapsmithicon.png" alt="SwapSmith" width={32} height={32} />
                  </div>
                  <span className="font-black text-lg uppercase tracking-tighter text-zinc-900 dark:text-white">SwapSmith</span>
                </Link>
                <button onClick={() => setMobileMenuOpen(false)} className="p-2 rounded-full bg-zinc-100 dark:bg-zinc-800"><X /></button>
              </div>
              <div className="space-y-1 flex-1 overflow-y-auto">
                {[{ href: "/", label: "Home", Icon: Home }, ...NAV_ITEMS].map(({ href, label, Icon }) => (
                  <Link
                    key={href}
                    href={href}
                    className={`flex items-center gap-4 p-4 rounded-2xl text-base font-bold transition-all ${
                      pathname === href ? "bg-blue-600 text-white shadow-lg shadow-blue-500/30" : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 dark:text-zinc-300"
                    }`}
                  >
                    <Icon className="w-5 h-5" /> {label}
                  </Link>
                ))}
                {PROFILE_MENU.map(({ href, label, Icon }) => (
                  <Link
                    key={href}
                    href={href}
                    className={`flex items-center gap-4 p-4 rounded-2xl text-base font-bold transition-all ${
                      pathname === href ? "bg-blue-600 text-white shadow-lg shadow-blue-500/30" : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 dark:text-zinc-300"
                    }`}
                  >
                    <Icon className="w-5 h-5" /> {label}
                  </Link>
                ))}
              </div>
              <div className="pt-6 border-t border-zinc-100 dark:border-zinc-800 space-y-4">
                <WalletConnector />
                <div className="flex items-center justify-between">
                  <ThemeToggle />
                  <button
                    onClick={() => { setMobileMenuOpen(false); logout(); }}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                  >
                    <LogOut className="w-4 h-4" /> Logout
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}