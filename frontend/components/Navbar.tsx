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
} from "lucide-react";
import Image from "next/image";
import { useAuth } from "@/hooks/useAuth";
import WalletConnector from "./WalletConnector";
import ThemeToggle from "@/components/ThemeToggle";
import MarketSentimentWidget from "@/components/MarketSentimentWidget";

/* ================================================================ */
/* Navigation Config                                                 */
/* ================================================================ */

const NAV_ITEMS = [
  { href: "/prices", label: "Live Prices", Icon: TrendingUp },
  { href: "/discussions", label: "Discussions", Icon: MessageSquare },
  { href: "/terminal", label: "Terminal", Icon: TerminalIcon },
  { href: "/contributors", label: "Contributors", Icon: Users },
];

const PROFILE_MENU = [
  { href: "/profile", label: "Profile", Icon: User },
  { href: "/rewards", label: "Rewards", Icon: Trophy },
  { href: "/learn", label: "Learn", Icon: BookOpen },
  { href: "/about", label: "About", Icon: Info },
];

/* ================================================================ */
/* Component                                                         */
/* ================================================================ */

export default function Navbar() {
  const pathname = usePathname();
  const { logout, user } = useAuth();
  const isTerminal = pathname === "/terminal";

  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [profileImageUrl, setProfileImageUrl] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  /* Detect scroll for shrinking navbar shadow */
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  /* Close mobile menu on route change */
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  /* Close profile dropdown on outside click */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setShowProfileMenu(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  /* Load profile image */
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
      {/* ========================= NAVBAR ========================= */}
      <nav
        className={`fixed  top-0 left-0 right-0 z-50 h-16 sm:h-17 backdrop-blur-2xl transition-all duration-300 ${
          scrolled
            ? "shadow-lg shadow-black/4 dark:shadow-black/30"
            : ""
        } ${
          isTerminal
            ? "bg-white/80 dark:bg-zinc-950/80"
            : "bg-white/85 dark:bg-[#08080f]/85"
        } border-b border-zinc-200/80 dark:border-zinc-800/50`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-full flex items-center justify-between gap-3">

          {/* ── Logo ── */}
          <Link href="/" className="flex items-center gap-2.5 group shrink-0">
            <div className="relative">
              <div className="absolute -inset-1 rounded-xl bg-blue-500/25 blur-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="relative bg-linear-to-br from-blue-500 to-indigo-600 p-1.5 rounded-lg shadow-lg shadow-blue-600/25 group-hover:scale-110 transition-transform duration-200">
                <Zap className="w-5 h-5 text-white" fill="white" />
              </div>
            </div>
            <span className="hidden sm:block text-base font-black uppercase tracking-tight text-zinc-900 dark:text-white select-none">
              SwapSmith
            </span>
          </Link>

          {/* Desktop Nav + Market Sentiment */}
          <div className="hidden md:flex flex-1 justify-center items-center gap-4">
            <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800/40 p-1 rounded-xl border border-zinc-200 dark:border-zinc-800">
              <Link
                href="/"
                className={`nav-link group ${
                  pathname === "/"
                    ? "text-zinc-900 dark:text-white nav-link-active"
                    : "text-zinc-600 dark:text-zinc-200 hover:text-zinc-900 dark:hover:text-white"
                }`}
              >
                <Home className="w-4 h-4" />
                <span>Home</span>
                <span className={`nav-link-indicator ${
                  pathname === "/" ? "opacity-100" : "opacity-0 group-hover:opacity-60"
                }`} />
              </Link>

              {NAV_ITEMS.map(({ href, label, Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className={`nav-link group ${
                    pathname === href
                      ? "text-zinc-900 dark:text-white nav-link-active"
                      : "text-zinc-600 dark:text-zinc-200 hover:text-zinc-900 dark:hover:text-white"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden lg:inline">{label}</span>
                  <span className={`nav-link-indicator ${
                    pathname === href ? "opacity-100" : "opacity-0 group-hover:opacity-60"
                  }`} />
                </Link>
              ))}
            </div>
            {/* Market Sentiment Widget */}
            <div className="ml-4">
              <MarketSentimentWidget />
            </div>
          </div>

          {/* ── Right Actions ── */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="hidden sm:flex items-center gap-2">
              <WalletConnector />
              <ThemeToggle />
            </div>

            {/* Profile avatar + dropdown */}
            <div className="relative" ref={profileRef}>
              <button
                onClick={() => setShowProfileMenu((v) => !v)}
                aria-label="Profile menu"
                className={`rounded-full ring-2 ring-offset-1 ring-offset-white dark:ring-offset-zinc-900 transition-all duration-200 ${
                  showProfileMenu
                    ? "ring-blue-500 scale-105"
                    : "ring-transparent hover:ring-blue-400/60 dark:hover:ring-blue-500/60"
                }`}
              >
                {profileImageUrl ? (
                  <Image
                    src={profileImageUrl}
                    alt="Profile"
                    width={34}
                    height={34}
                    className="rounded-full object-cover w-8.5 h-8.5"
                    unoptimized
                  />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-linear-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                    <User className="w-4 h-4 text-white" />
                  </div>
                )}
              </button>

              {/* Profile Dropdown */}
              {showProfileMenu && (
                <div className="absolute right-0 mt-3 w-56 origin-top-right rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700/70 shadow-2xl shadow-black/10 dark:shadow-black/50 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                  {/* Header */}
                  <div className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-800/40">
                    <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
                      Account
                    </p>
                  </div>

                  <div className="py-1">
                    {PROFILE_MENU.map(({ href, label, Icon }) => (
                      <Link
                        key={href}
                        href={href}
                        onClick={() => setShowProfileMenu(false)}
                        className="group flex items-center gap-3 px-4 py-2.5 text-sm font-semibold text-zinc-700 dark:text-zinc-200 hover:bg-blue-50/60 dark:hover:bg-zinc-800 transition-colors"
                      >
                        <span className="w-7 h-7 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center group-hover:bg-blue-100 dark:group-hover:bg-zinc-700 transition-colors">
                          <Icon className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors" />
                        </span>
                        {label}
                        <ChevronRight className="w-3.5 h-3.5 ml-auto text-zinc-300 dark:text-zinc-600 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                      </Link>
                    ))}
                  </div>

                  <div className="h-px bg-zinc-100 dark:bg-zinc-800" />

                  <div className="py-1">
                    <button
                      onClick={() => {
                        setShowProfileMenu(false);
                        logout();
                      }}
                      className="group w-full flex items-center gap-3 px-4 py-2.5 text-sm font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                    >
                      <span className="w-7 h-7 rounded-lg bg-red-50 dark:bg-red-500/10 flex items-center justify-center">
                        <LogOut className="w-3.5 h-3.5" />
                      </span>
                      Logout
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open menu"
              className="md:hidden p-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>
        </div>
      </nav>

      {/* ========================= MOBILE DRAWER ========================= */}
      {mobileMenuOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-60"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="fixed top-0 right-0 bottom-0 w-[85%] max-w-sm bg-white dark:bg-zinc-900 shadow-2xl z-70 animate-in slide-in-from-right">
            <div className="p-6 flex flex-col h-full">
              <div className="flex items-center justify-between mb-8">
                <span className="font-black tracking-tighter text-xl">
                  MENU
                </span>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  aria-label="Close menu"
                  className="p-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Market Sentiment Widget for mobile */}
              <div className="mb-6">
                <MarketSentimentWidget />
              </div>

              <div className="space-y-2 flex-1">
                {[{ href: "/", label: "Home", Icon: Home }, ...NAV_ITEMS].map(
                  ({ href, label, Icon }) => {
                    const active = pathname === href;
                    return (
                      <Link
                        key={href}
                        href={href}
                        className={`flex items-center gap-3 px-3.5 py-3 rounded-xl text-[15px] font-semibold transition-all ${
                          active
                            ? "bg-blue-600 text-white shadow-lg shadow-blue-600/25"
                            : "text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800/80 hover:text-zinc-900 dark:hover:text-white"
                        }`}
                      >
                        <span
                          className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                            active
                              ? "bg-white/20"
                              : "bg-zinc-100 dark:bg-zinc-800"
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                        </span>
                        {label}
                      </Link>
                    );
                  }
                )}
              </div>

              {/* Footer actions */}
              <div className="px-4 py-4 border-t border-zinc-100 dark:border-zinc-800/60 space-y-3">
                <WalletConnector />
                <div className="flex justify-center">
                  <ThemeToggle />
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}