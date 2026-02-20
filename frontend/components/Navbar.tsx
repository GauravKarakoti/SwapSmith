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

const NAV_ITEMS = [
  { href: "/prices", label: "Live Prices", Icon: TrendingUp },
  { href: "/discussions", label: "Discussions", Icon: MessageSquare },
  { href: "/terminal", label: "Terminal", Icon: TerminalIcon },
];

export default function Navbar() {
  const pathname = usePathname();
  const { logout, user } = useAuth();
  const isTerminal = pathname === "/terminal";

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [profileImageUrl, setProfileImageUrl] = useState<string | null>(null);

  /* -------------------------------- effects -------------------------------- */

  // Close mobile menu on route change
  useEffect(() => {
    if (mobileMenuOpen) {
      setMobileMenuOpen(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Close mobile menu when resizing to desktop
  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 768) setMobileMenuOpen(false);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Load profile image from localStorage
  useEffect(() => {
    const loadImage = () => {
      if (!user?.uid) return setProfileImageUrl(null);
      setProfileImageUrl(localStorage.getItem(`profile-image-${user.uid}`));
    };

    loadImage();
    window.addEventListener("profileImageChanged", loadImage);
    return () => window.removeEventListener("profileImageChanged", loadImage);
  }, [user?.uid]);

  /* -------------------------------- helpers -------------------------------- */

  const navLink = (
    href: string,
    label: string,
    Icon: ComponentType<{ className?: string }>
  ) => (
    <Link
      href={href}
      onClick={() => setMobileMenuOpen(false)}
      className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-colors ${
        pathname === href
          ? "bg-zinc-800 text-white"
          : "text-zinc-400 hover:bg-zinc-800 hover:text-white"
      }`}
    >
      <Icon className="w-5 h-5" />
      {label}
    </Link>
  );

  /* -------------------------------- render -------------------------------- */

  return (
    <>
      <nav
        className={`fixed top-0 left-0 right-0 z-50 h-16 sm:h-20 border-b border-zinc-800 backdrop-blur-xl ${
          isTerminal ? "bg-zinc-900/40" : "bg-[#050505]/80"
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 h-full flex items-center justify-between">
          {/* LEFT */}
          <Link href="/" className="flex items-center gap-2 group">
            <div className="bg-blue-600 p-1.5 rounded-lg shadow-lg shadow-blue-600/20">
              <Zap className="w-5 h-5 text-white" fill="white" />
            </div>
            <span className="text-lg font-black uppercase tracking-tighter text-white hidden sm:block">
              SwapSmith
            </span>
          </Link>

          {/* CENTER (Desktop) */}
          <div className="hidden md:flex items-center gap-1">
            <Link
              href="/"
              className={`px-3 py-2 rounded-lg text-sm font-semibold ${
                pathname === "/"
                  ? "text-white"
                  : "text-zinc-400 hover:text-white hover:bg-zinc-800"
              }`}
            >
              <Home className="w-4 h-4 inline mr-1" />
              Home
            </Link>

            {NAV_ITEMS.map(({ href, label, Icon }) => (
              <Link
                key={href}
                href={href}
                className={`px-3 py-2 rounded-lg text-sm font-semibold ${
                  pathname === href
                    ? "text-white bg-blue-600"
                    : "text-zinc-400 hover:text-white hover:bg-zinc-800"
                }`}
              >
                <Icon className="w-4 h-4 inline mr-1" />
                {label}
              </Link>
            ))}
          </div>

          {/* RIGHT */}
          <div className="flex items-center gap-3">
            <div className="hidden md:block">
              <WalletConnector />
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
                  <div className="absolute right-0 mt-2 w-48 bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl z-50">
                    <Link
                      href="/profile"
                      className="menu-item"
                      onClick={() => setShowProfileMenu(false)}
                    >
                      <User className="w-4 h-4" /> Profile
                    </Link>
                    <Link
                      href="/rewards"
                      className="menu-item"
                      onClick={() => setShowProfileMenu(false)}
                    >
                      <Trophy className="w-4 h-4" /> Rewards
                    </Link>
                    <Link
                      href="/learn"
                      className="menu-item"
                      onClick={() => setShowProfileMenu(false)}
                    >
                      <BookOpen className="w-4 h-4" /> Learn
                    </Link>
                    <Link
                      href="/about"
                      className="menu-item"
                      onClick={() => setShowProfileMenu(false)}
                    >
                      <Info className="w-4 h-4" /> About
                    </Link>
                    <div className="h-px bg-zinc-800" />
                    <button
                      onClick={() => {
                        setShowProfileMenu(false);
                        logout();
                      }}
                      className="menu-item text-red-400"
                    >
                      <LogOut className="w-4 h-4" /> Logout
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Mobile Toggle */}
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800"
            >
              <Menu />
            </button>
          </div>
        </div>
      </nav>

      {/* MOBILE DRAWER */}
      {mobileMenuOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/60 z-40"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="fixed top-0 left-0 bottom-0 w-[300px] bg-zinc-900 border-r border-zinc-800 z-50 pt-20 px-4">
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="absolute top-4 right-4 p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800"
            >
              <X />
            </button>

            <div className="mb-4">
              <WalletConnector />
            </div>

            <nav className="flex flex-col gap-1">
              {navLink("/", "Home", Home)}
              {NAV_ITEMS.map(({ href, label, Icon }) =>
                navLink(href, label, Icon)
              )}
            </nav>
          </div>
        </>
      )}
    </>
  );
}