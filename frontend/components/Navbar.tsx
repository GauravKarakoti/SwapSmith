"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { useState, useEffect, useRef, type ComponentType } from "react";
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

/* ================================================================ */
/* Navigation Config                                                 */
/* ================================================================ */

const NAV_ITEMS = [
  { href: "/prices", label: "Live Prices", Icon: TrendingUp },
  { href: "/discussions", label: "Discussions", Icon: MessageSquare },
  { href: "/learn", label: "Learn", Icon: BookOpen },
  { href: "/rewards", label: "Rewards", Icon: Trophy },
  { href: "/terminal", label: "Terminal", Icon: TerminalIcon },
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
      <nav
        className={`fixed top-0 left-0 right-0 z-50 h-16 sm:h-20 border-b border-zinc-200 dark:border-zinc-800 backdrop-blur-xl ${
          isTerminal
            ? "bg-white/70 dark:bg-zinc-900/40"
            : "bg-white/80 dark:bg-[#050505]/80"
        }`}
      >
        <div className="max-w-[1600px] mx-auto px-4 h-full flex items-center justify-between gap-4">

          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="bg-blue-600 p-1.5 rounded-lg shadow-lg shadow-blue-500/20 group-hover:scale-105 transition-transform">
              <Zap className="w-5 h-5 text-white" fill="white" />
            </div>
            <span className="hidden lg:block text-lg font-black uppercase tracking-tighter text-zinc-900 dark:text-white">
              SwapSmith
            </span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex flex-1 justify-center">
            <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800/40 p-1 rounded-xl border border-zinc-200 dark:border-zinc-800">
              <Link
                href="/"
                className={`nav-btn ${pathname === "/" && "nav-active"}`}
              >
                <Home className="w-4 h-4" /> Home
              </Link>
              
              {NAV_ITEMS.map(({ href, label, Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className={`nav-btn ${pathname === href && "nav-active"}`}
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

          {/* Right Actions */}
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-3">
              <WalletConnector />
              <ThemeToggle />
            </div>

            {/* Profile */}
            <div className="relative">
              <button
                onClick={() => setShowProfileMenu((v) => !v)}
                className="rounded-full overflow-hidden"
              >
                {profileImageUrl ? (
                  <Image
                    src={profileImageUrl}
                    alt="Profile"
                    width={36}
                    height={36}
                    className="rounded-full object-cover"
                    unoptimized
                  />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                    <User className="w-4 h-4 text-white" />
                  </div>
                )}
              </button>

              {showProfileMenu && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowProfileMenu(false)}
                  />
                  <div className="absolute right-0 mt-2 w-52 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xl z-50">
                    {[
                      { href: "/profile", label: "Profile", Icon: User },
                      { href: "/rewards", label: "Rewards", Icon: Trophy },
                      { href: "/learn", label: "Learn", Icon: BookOpen },
                      { href: "/about", label: "About", Icon: Info },
                    ].map(({ href, label, Icon }) => (
                      <Link
                        key={href}
                        href={href}
                        onClick={() => setShowProfileMenu(false)}
                        className="flex items-center gap-3 px-4 py-2.5 text-sm font-semibold hover:bg-zinc-100 dark:hover:bg-zinc-800"
                      >
                        <Icon className="w-4 h-4" /> {label}
                      </Link>
                    ))}

                    <div className="h-px bg-zinc-200 dark:bg-zinc-800 my-1" />

                    <button
                      onClick={() => {
                        setShowProfileMenu(false);
                        logout();
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10"
                    >
                      <LogOut className="w-4 h-4" /> Logout
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden p-2 rounded-xl bg-zinc-100 dark:bg-zinc-800"
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

      {/* ========================= MOBILE DRAWER ========================= */}
      {mobileMenuOpen && (
        <>
<<<<<<< HEAD
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60]" onClick={() => setMobileMenuOpen(false)} />
          <div className="fixed top-0 right-0 bottom-0 w-[85%] max-w-sm bg-white dark:bg-zinc-900 shadow-2xl z-[70] animate-in slide-in-from-right">
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
                {[ {href: "/", label: "Home", Icon: Home}, ...NAV_ITEMS].map((item) => (
                   <Link key={item.href} href={item.href} className={`flex items-center gap-4 p-4 rounded-2xl text-lg font-bold transition-all ${pathname === item.href ? "bg-blue-600 text-white shadow-lg" : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"}`}>
                     <item.Icon className="w-6 h-6" /> {item.label}
                   </Link>
                ))}
              </div>
              <div className="pt-6 border-t border-zinc-100 dark:border-zinc-800 space-y-4">
                <WalletConnector />
                <div className="flex justify-center"><ThemeToggle /></div>
=======
          <div
            className="fixed inset-0 bg-black/60 z-[60]"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="fixed top-0 right-0 bottom-0 w-[85%] max-w-sm bg-white dark:bg-zinc-900 z-[70] shadow-2xl p-6">
            <div className="flex justify-between mb-6">
              <span className="font-black text-xl">MENU</span>
              <button onClick={() => setMobileMenuOpen(false)}>
                <X />
              </button>
            </div>

            <div className="space-y-2">
              {[{ href: "/", label: "Home", Icon: Home }, ...NAV_ITEMS].map(
                ({ href, label, Icon }) => (
                  <Link
                    key={href}
                    href={href}
                    className={`flex items-center gap-4 p-4 rounded-xl font-bold ${
                      pathname === href
                        ? "bg-blue-600 text-white"
                        : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    }`}
                  >
                    <Icon className="w-6 h-6" /> {label}
                  </Link>
                )
              )}
            </div>

            <div className="mt-6 pt-6 border-t border-zinc-200 dark:border-zinc-800 space-y-4">
              <WalletConnector />
              <div className="flex justify-center">
                <ThemeToggle />
>>>>>>> e13d029883d08432b4edf70fe3b1e5900f450853
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}