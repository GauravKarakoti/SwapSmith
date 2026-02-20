"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { useState, useEffect } from "react";
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
  { href: "/terminal", label: "Terminal", Icon: TerminalIcon },
  { href: "/contributors", label: "Contributors", Icon: Users },
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

  /* Close mobile menu on route change */
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  /* Load profile image */
  useEffect(() => {
    const loadImage = () => {
      if (!user?.uid) return;
      const img = localStorage.getItem(`profile-image-${user.uid}`);
      setProfileImageUrl(img);
    };

    loadImage();
    window.addEventListener("profileImageChanged", loadImage);
    return () =>
      window.removeEventListener("profileImageChanged", loadImage);
  }, [user?.uid]);

  return (
    <>
      {/* ========================= NAVBAR ========================= */}
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
                </Link>
              ))}
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
      </nav>

      {/* ========================= MOBILE DRAWER ========================= */}
      {mobileMenuOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60]"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="fixed top-0 right-0 bottom-0 w-[85%] max-w-sm bg-white dark:bg-zinc-900 shadow-2xl z-[70] animate-in slide-in-from-right">
            <div className="p-6 flex flex-col h-full">
              <div className="flex items-center justify-between mb-8">
                <span className="font-black tracking-tighter text-xl">
                  MENU
                </span>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-2 rounded-full bg-zinc-100 dark:bg-zinc-800"
                >
                  <X />
                </button>
              </div>

              <div className="space-y-2 flex-1">
                {[{ href: "/", label: "Home", Icon: Home }, ...NAV_ITEMS].map(
                  ({ href, label, Icon }) => (
                    <Link
                      key={href}
                      href={href}
                      className={`flex items-center gap-4 p-4 rounded-2xl text-lg font-bold transition-all ${
                        pathname === href
                          ? "bg-blue-600 text-white shadow-lg"
                          : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                      }`}
                    >
                      <Icon className="w-6 h-6" /> {label}
                    </Link>
                  )
                )}
              </div>

              <div className="pt-6 border-t border-zinc-100 dark:border-zinc-800 space-y-4">
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