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
  Menu,
  X,
  Info,
} from "lucide-react";
import Image from "next/image";
import { useAuth } from "@/hooks/useAuth";
import WalletConnector from "./WalletConnector";

export default function Navbar() {
  const pathname = usePathname();
  const { logout, user } = useAuth();
  const isTerminal = pathname === "/terminal";
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [profileImageUrl, setProfileImageUrl] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Close mobile menu on route change or when resizing to desktop
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);
  useEffect(() => {
    const handler = () => {
      if (typeof window !== "undefined" && window.innerWidth >= 768) setMobileMenuOpen(false);
    };
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  // Load profile image from localStorage and listen for changes
  useEffect(() => {
    const loadProfileImage = () => {
      if (user?.uid) {
        const savedImage = localStorage.getItem(`profile-image-${user.uid}`);
        setProfileImageUrl(savedImage);
      } else {
        setProfileImageUrl(null);
      }
    };

    loadProfileImage();

    // Listen for custom event when profile image changes
    const handleProfileImageChange = () => {
      loadProfileImage();
    };

    window.addEventListener('profileImageChanged', handleProfileImageChange);
    return () => window.removeEventListener('profileImageChanged', handleProfileImageChange);
  }, [user?.uid]);

  const navLink = (href: string, label: string, Icon: ComponentType<{ className?: string }>, active?: boolean) => (
    <Link
      href={href}
      className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-colors ${
        active ? "bg-zinc-800 text-white" : "text-zinc-400 hover:bg-zinc-800 hover:text-white"
      }`}
      onClick={() => setMobileMenuOpen(false)}
    >
      <Icon className="w-5 h-5 shrink-0" />
      {label}
    </Link>
  );

  return (
    <>
    <nav
      className={`fixed top-0 left-0 right-0 z-50 w-full max-w-[100vw] border-b border-zinc-800 backdrop-blur-xl ${
        isTerminal ? "h-16 bg-zinc-900/30" : "h-16 sm:h-20 bg-[#050505]/80"
      }`}
    >
      <div
        className={`${isTerminal ? "px-4" : "w-full max-w-[100vw] md:max-w-7xl md:mx-auto px-4 sm:px-6"} h-full flex justify-between items-center min-w-0`}
      > 
        {/* LEFT SECTION */}

        <div className="flex items-center gap-4 min-w-0 shrink">
          {/* Logo - Always visible */}
          <Link
            href="/"
            className="flex items-center gap-2 group hover:opacity-80 transition-opacity"
          >
            <div className="bg-blue-600 p-1.5 rounded-lg shadow-lg shadow-blue-600/20">
              <Zap
                className="w-4 h-4 sm:w-5 sm:h-5 text-white"
                fill="white"
              />
            </div>

            <span className="text-sm sm:text-lg font-black tracking-tighter uppercase text-white truncate">
              SwapSmith
            </span>
          </Link>

          {/* System Status (Terminal Style - High Tech) */}

          {isTerminal && (
            <div className="hidden sm:flex items-center gap-3 px-3 py-1.5 bg-zinc-900/50 border border-zinc-800 rounded-lg">
              <div className="p-1.5 bg-blue-500/10 rounded-lg">
                <Zap className="w-3 h-3 text-blue-400" />
              </div>

              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />

                <span className="text-[10px] text-emerald-500/80 font-bold uppercase tracking-widest">
                  System Ready
                </span>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT SECTION */}

        <div className="flex items-center gap-2 sm:gap-4 min-w-0 shrink">
          {/* Desktop Nav Links - hidden on mobile */}
          <div className="hidden md:flex items-center gap-0.5">
            <Link
              href="/"
              className={`flex items-center gap-1.5 text-sm font-semibold transition-colors px-2 sm:px-3 py-2 rounded-lg ${
                pathname === "/" ? "text-white" : "text-zinc-400 hover:text-white hover:bg-zinc-800"
              }`}
            >
              <Home className="w-4 h-4" />
              <span className="hidden sm:inline">Home</span>
            </Link>

            <Link
              href="/prices"
              className={`flex items-center gap-1.5 text-sm font-semibold transition-colors px-2 sm:px-3 py-2 rounded-lg ${
                pathname === "/prices"
                  ? "text-white bg-blue-600"
                  : "text-zinc-400 hover:text-white hover:bg-zinc-800"
              }`}
            >
              <TrendingUp className="w-4 h-4" />
              <span className="hidden sm:inline">Live Prices</span>
            </Link>

            <Link
              href="/discussions"
              className={`flex items-center gap-1.5 text-sm font-semibold transition-colors px-2 sm:px-3 py-2 rounded-lg ${
                pathname === "/discussions"
                  ? "text-white bg-blue-600"
                  : "text-zinc-400 hover:text-white hover:bg-zinc-800"
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              <span className="hidden sm:inline">Discussions</span>
            </Link>

            <Link
              href="/learn"
              className={`flex items-center gap-1.5 text-sm font-semibold transition-colors px-2 sm:px-3 py-2 rounded-lg ${
                pathname === "/learn"
                  ? "text-white bg-blue-600"
                  : "text-zinc-400 hover:text-white hover:bg-zinc-800"
              }`}
            >
              <BookOpen className="w-4 h-4" />
              <span className="hidden sm:inline">Learn</span>
            </Link>

            <Link
              href="/terminal"
              className={`flex items-center gap-1.5 text-sm font-semibold transition-colors px-2 sm:px-3 py-2 rounded-lg ${
                pathname === "/terminal"
                  ? "text-white"
                  : "text-zinc-400 hover:text-white hover:bg-zinc-800"
              }`}
            >
              <TerminalIcon className="w-4 h-4" />
              <span className="hidden sm:inline">Terminal</span>
            </Link>

            <Link
              href="/about"
              className={`flex items-center gap-1.5 text-sm font-semibold transition-colors px-2 sm:px-3 py-2 rounded-lg ${
                pathname === "/about"
                  ? "text-white"
                  : "text-zinc-400 hover:text-white hover:bg-zinc-800"
              }`}
            >
              <Info className="w-4 h-4" />
              <span className="hidden sm:inline">About</span>
            </Link>
          </div>

          {/* Mobile menu button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen((o) => !o)}
            className="md:hidden p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>

          <div className="flex items-center gap-2 sm:gap-3">
            <div className="h-6 w-px bg-zinc-800 hidden sm:block" />

            {/* Connect Wallet: hidden in navbar on mobile, shown in toggle menu */}
            <div className="hidden md:block">
              <WalletConnector />
            </div>

            <div className="relative">
              <button
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                className="flex items-center gap-2 p-1.5 hover:bg-zinc-800 rounded-full transition-colors"
                title="Profile Menu"
              >
                {profileImageUrl ? (
                  <div className="relative w-8 h-8 rounded-full overflow-hidden border-2 border-blue-500">
                    <Image
                      src={profileImageUrl}
                      alt="Profile"
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  </div>
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
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
                  <div className="absolute right-0 mt-2 w-48 bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl overflow-hidden z-50">
                    <Link
                      href="/profile"
                      onClick={() => setShowProfileMenu(false)}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-zinc-800 transition-colors text-sm text-zinc-200"
                    >
                      <User className="w-4 h-4" />
                      <span>Profile</span>
                    </Link>
                    <Link
                      href="/learn"
                      onClick={() => setShowProfileMenu(false)}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-zinc-800 transition-colors text-sm text-zinc-200"
                    >
                      <BookOpen className="w-4 h-4" />
                      <span>Learning Center</span>
                    </Link>
                    <div className="h-px bg-zinc-800" />
                    <button
                      onClick={() => {
                        setShowProfileMenu(false);
                        logout();
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-red-500/10 transition-colors text-sm text-red-400"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Logout</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </nav>

    {/* Mobile menu overlay and panel */}
    {mobileMenuOpen && (
      <>
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
        <div
          className="fixed top-0 left-0 bottom-0 w-full max-w-[300px] bg-zinc-900/98 border-r border-zinc-800 shadow-2xl z-50 md:hidden flex flex-col pt-20 px-4 overflow-y-auto"
          role="dialog"
          aria-label="Mobile menu"
        >
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            className="absolute top-4 right-4 p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
            aria-label="Close menu"
          >
            <X className="w-6 h-6" />
          </button>
          <div className="mb-4 pb-4 border-b border-zinc-800">
            <WalletConnector />
          </div>
          <nav className="flex flex-col gap-1">
            {navLink("/", "Home", Home, pathname === "/")}
            {navLink("/prices", "Live Prices", TrendingUp, pathname === "/prices")}
            {navLink("/discussions", "Discussions", MessageSquare, pathname === "/discussions")}
            {navLink("/learn", "Learn", BookOpen, pathname === "/learn")}
            {navLink("/terminal", "Terminal", TerminalIcon, pathname === "/terminal")}
            {navLink("/about", "About", Info, pathname === "/about")}
          </nav>
        </div>
      </>
    )}
    </>
  );
}
