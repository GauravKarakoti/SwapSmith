"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { useState, useEffect } from "react";
import {
  Zap,
  User,
  LogOut,
  Home,
  TrendingUp,
  Terminal as TerminalIcon,
  MessageSquare,
  BookOpen,
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

  useEffect(() => {
    const loadProfileImage = () => {
      if (user?.uid) {
        const savedImage = localStorage.getItem(`profile-image-${user.uid}`);
        setProfileImageUrl(savedImage);
      } else setProfileImageUrl(null);
    };

    loadProfileImage();

    const handleProfileImageChange = () => loadProfileImage();
    window.addEventListener("profileImageChanged", handleProfileImageChange);
    return () =>
      window.removeEventListener(
        "profileImageChanged",
        handleProfileImageChange
      );
  }, [user?.uid]);

  const linkBase =
    "flex items-center gap-1.5 text-sm font-semibold px-2 sm:px-3 py-2 rounded-lg transition-all duration-200";

  const linkStyle = (route: string) =>
    pathname === route
      ? "text-blue-600 dark:text-cyan-400"
      : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800";

  return (
    <nav
      className={`fixed top-0 w-full z-50 backdrop-blur-xl border-b
      bg-white/70 dark:bg-[#030308]/70
      border-zinc-200 dark:border-zinc-800
      ${isTerminal ? "h-16" : "h-16 sm:h-20"}`}
    >
      <div
        className={`${
          isTerminal ? "px-4" : "max-w-7xl mx-auto px-4 sm:px-6"
        } h-full flex justify-between items-center`}
      >
        {/* LEFT */}
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="flex items-center gap-2 group hover:opacity-80 transition"
          >
            <div className="bg-blue-600 p-1.5 rounded-lg shadow-lg shadow-blue-600/20">
              <Zap className="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="white" />
            </div>

            <span className="text-sm sm:text-lg font-black tracking-tighter uppercase text-zinc-900 dark:text-white">
              SwapSmith
            </span>
          </Link>

          {/* Terminal system status */}
          {isTerminal && (
            <div className="hidden xs:flex items-center gap-3 px-3 py-1.5 rounded-lg backdrop-blur
            bg-white/70 dark:bg-zinc-900/50
            border border-zinc-200 dark:border-zinc-800">
              <div className="p-1.5 bg-blue-500/10 rounded-lg">
                <Zap className="w-3 h-3 text-blue-400" />
              </div>

              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
                  System Ready
                </span>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT */}
        <div className="flex items-center gap-2 sm:gap-4">
          <Link href="/" className={`${linkBase} ${linkStyle("/")}`}>
            <Home className="w-4 h-4" />
            <span className="hidden sm:inline">Home</span>
          </Link>

          <Link
            href="/prices"
            className={`${linkBase} ${
              pathname === "/prices"
                ? "text-white bg-gradient-to-r from-blue-600 to-cyan-500 shadow-md"
                : linkStyle("/prices")
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            <span className="hidden sm:inline">Live Prices</span>
          </Link>

          <Link
            href="/discussions"
            className={`${linkBase} ${
              pathname === "/discussions"
                ? "text-white bg-gradient-to-r from-blue-600 to-cyan-500 shadow-md"
                : linkStyle("/discussions")
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span className="hidden sm:inline">Discussions</span>
          </Link>

          <Link href="/learn" className={`${linkBase} ${linkStyle("/learn")}`}>
            <span className="hidden sm:inline">Learn</span>
          </Link>

          <Link
            href="/terminal"
            className={`${linkBase} ${linkStyle("/terminal")}`}
          >
            <TerminalIcon className="w-4 h-4" />
            <span className="hidden sm:inline">Terminal</span>
          </Link>

          <Link href="/about" className={`${linkBase} ${linkStyle("/about")}`}>
            <span className="hidden sm:inline">About</span>
          </Link>

          <div className="flex items-center gap-3">
            <div className="h-6 w-px bg-zinc-200 dark:bg-zinc-800 hidden sm:block" />

            <WalletConnector />
            <ThemeToggle />

            {/* PROFILE */}
            <div className="relative">
              <button
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                className="flex items-center gap-2 p-1.5 rounded-full transition hover:bg-zinc-100 dark:hover:bg-zinc-800"
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

                  <div className="absolute right-0 mt-2 w-48 rounded-xl overflow-hidden z-50 backdrop-blur-xl
                  bg-white dark:bg-zinc-900
                  border border-zinc-200 dark:border-zinc-800 shadow-xl">
                    <Link
                      href="/profile"
                      onClick={() => setShowProfileMenu(false)}
                      className="flex items-center gap-3 px-4 py-3 text-sm
                      text-zinc-700 dark:text-zinc-200
                      hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    >
                      <User className="w-4 h-4" />
                      Profile
                    </Link>

                    <Link
                      href="/learn"
                      onClick={() => setShowProfileMenu(false)}
                      className="flex items-center gap-3 px-4 py-3 text-sm
                      text-zinc-700 dark:text-zinc-200
                      hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    >
                      <BookOpen className="w-4 h-4" />
                      Learning Center
                    </Link>

                    <div className="h-px bg-zinc-200 dark:bg-zinc-800" />

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
      </div>
    </nav>
  );
}
