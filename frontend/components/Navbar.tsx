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

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  // Close mobile menu when resizing to desktop
  useEffect(() => {
    const handler = () => {
      if (window.innerWidth >= 768) setMobileMenuOpen(false);
    };
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  // Load profile image from localStorage
  useEffect(() => {
    if (!user?.uid) {
      setProfileImageUrl(null);
      return;
    }

    const loadImage = () => {
      const img = localStorage.getItem(`profile-image-${user.uid}`);
      setProfileImageUrl(img);
    };

    loadImage();
    window.addEventListener("profileImageChanged", loadImage);
    return () => window.removeEventListener("profileImageChanged", loadImage);
  }, [user?.uid]);

  const navLink = (
    href: string,
    label: string,
    Icon: ComponentType<{ className?: string }>,
    active?: boolean
  ) => (
    <Link
      href={href}
      className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-colors ${
        active
          ? "bg-zinc-800 text-white"
          : "text-zinc-400 hover:bg-zinc-800 hover:text-white"
      }`}
      onClick={() => setMobileMenuOpen(false)}
    >
      <Icon className="w-5 h-5" />
      {label}
    </Link>
  );

  return (
    <>
      <nav
        className={`fixed top-0 left-0 right-0 z-50 border-b border-zinc-800 backdrop-blur-xl ${
          isTerminal ? "h-16 bg-zinc-900/40" : "h-16 sm:h-20 bg-[#050505]/80"
        }`}
      >
        <div
          className={`${
            isTerminal
              ? "px-4"
              : "max-w-7xl mx-auto px-4 sm:px-6"
          } h-full flex items-center justify-between`}
        >
          {/* LEFT */}
          <div className="flex items-center gap-4 min-w-0">
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
              href="/rewards"
              className={`flex items-center gap-1.5 text-sm font-semibold transition-colors px-2 sm:px-3 py-2 rounded-lg ${
                pathname === "/rewards"
                  ? "text-white bg-blue-600"
                  : "text-zinc-400 hover:text-white hover:bg-zinc-800"
              }`}
            >
              <BookOpen className="w-4 h-4" />
              <span className="hidden sm:inline">Rewards</span>
            </Link>

            <Link
              href="/terminal"
              className={`flex items-center gap-1.5 text-sm font-semibold transition-colors px-2 sm:px-3 py-2 rounded-lg ${
                pathname === "/terminal"
                  ? "text-white"
                  : "text-zinc-400 hover:text-white hover:bg-zinc-800"
              }`}
            >
              <div className="bg-blue-600 p-1.5 rounded-lg">
                <Zap className="w-4 h-4 text-white" fill="white" />
              </div>
              <span className="text-sm sm:text-lg font-black uppercase tracking-tighter text-white truncate">
                SwapSmith
              </span>
            </Link>

            {isTerminal && (
              <div className="hidden sm:flex items-center gap-3 px-3 py-1.5 bg-zinc-900/50 border border-zinc-800 rounded-lg">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400">
                  System Ready
                </span>
              </div>
            )}
          </div>

          {/* RIGHT */}
          <div className="flex items-center gap-2 sm:gap-4">
            {/* Desktop Links */}
            <div className="hidden md:flex items-center gap-1">
              {[
                ["/", "Home", Home],
                ["/prices", "Live Prices", TrendingUp],
                ["/discussions", "Discussions", MessageSquare],
                ["/learn", "Learn", BookOpen],
                ["/terminal", "Terminal", TerminalIcon],
                ["/about", "About", Info],
              ].map(([href, label, Icon]) => (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition ${
                    pathname === href
                      ? "text-white bg-zinc-800"
                      : "text-zinc-400 hover:text-white hover:bg-zinc-800"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{label}</span>
                </Link>
              ))}
            </div>

            <div className="hidden md:flex items-center gap-3">
              <WalletConnector />
              <ThemeToggle />
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen((v) => !v)}
              className="md:hidden p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X /> : <Menu />}
            </button>

            {/* Profile */}
            <div className="relative">
              <button
                onClick={() => setShowProfileMenu((v) => !v)}
                className="p-1.5 rounded-full hover:bg-zinc-800 transition"
              >
                {profileImageUrl ? (
                  <Image
                    src={profileImageUrl}
                    alt="Profile"
                    width={32}
                    height={32}
                    className="rounded-full object-cover border-2 border-blue-500"
                    unoptimized
                  />
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
                  <div className="absolute right-0 mt-2 w-48 rounded-xl bg-zinc-900 border border-zinc-800 shadow-xl z-50">
                    <Link
                      href="/profile"
                      className="flex items-center gap-3 px-4 py-3 text-sm text-zinc-200 hover:bg-zinc-800"
                      onClick={() => setShowProfileMenu(false)}
                    >
                      <User className="w-4 h-4" />
                      Profile
                    </Link>

                    <Link
                      href="/rewards"
                      onClick={() => setShowProfileMenu(false)}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-zinc-800 transition-colors text-sm text-zinc-200"
                    >
                      <Trophy className="w-4 h-4" />
                      <span>Rewards</span>
                    </Link>
                    <Link
                      href="/learn"
                      className="flex items-center gap-3 px-4 py-3 text-sm text-zinc-200 hover:bg-zinc-800"
                      onClick={() => setShowProfileMenu(false)}
                    >
                      <BookOpen className="w-4 h-4" />
                      Learning Center
                    </Link>
                    <Link
                      href="/about"
                      onClick={() => setShowProfileMenu(false)}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-zinc-800 transition-colors text-sm text-zinc-200"
                    >
                      <Info className="w-4 h-4" />
                      <span>About</span>
                    </Link>
                    <div className="h-px bg-zinc-800" />

                    <button
                      onClick={() => {
                        setShowProfileMenu(false);
                        logout();
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-500 hover:bg-red-500/10"
                    >
                      <LogOut className="w-4 h-4" />
                      Logout
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/60 z-40 md:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="fixed top-0 left-0 bottom-0 w-72 bg-zinc-900 border-r border-zinc-800 z-50 md:hidden pt-20 px-4">
            <div className="mb-4 border-b border-zinc-800 pb-4">
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