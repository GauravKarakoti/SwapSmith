"use client";

import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import {
  Zap,
  ArrowRight,
  PanelLeft,
  HelpCircle,
  LogOut,
  LineChart,
} from "lucide-react";

import { useAuth } from "@/hooks/useAuth";

import WalletConnector from "./WalletConnector";

interface NavbarProps {
  isSidebarOpen?: boolean;

  onToggleSidebar?: () => void;
}

export default function Navbar({
  isSidebarOpen,
  onToggleSidebar,
}: NavbarProps) {
  const router = useRouter();

  const pathname = usePathname();

  const { isAuthenticated, logout } = useAuth();

  const isTerminal = pathname === "/terminal";

  const handleAppClick = () => {
    if (isAuthenticated) {
      router.push("/terminal");
    } else {
      router.push("/login");
    }
  };

  return (
    <nav
      className={`fixed top-0 w-full z-50 border-b border-zinc-800 backdrop-blur-xl ${
        isTerminal ? "h-16 bg-zinc-900/30" : "h-16 sm:h-20 bg-[#050505]/80"
      }`}
    >
      <div
        className={`${isTerminal ? "px-4" : "max-w-7xl mx-auto px-4 sm:px-6"} h-full flex justify-between items-center`}
      >
        {/* LEFT SECTION */}

        <div className="flex items-center gap-4">
          {/* Logo (Hidden in Terminal if Sidebar is open to prevent double branding) */}

          {(!isTerminal || !isSidebarOpen) && (
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

              <span className="text-sm sm:text-lg font-black tracking-tighter uppercase text-white">
                SwapSmith
              </span>
            </Link>
          )}

          {/* System Status (Terminal Style - High Tech) */}

          {isTerminal && (
            <div className="hidden xs:flex items-center gap-3 px-3 py-1.5 bg-zinc-900/50 border border-zinc-800 rounded-lg">
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

        <div className="flex items-center gap-2 sm:gap-4">
          {/* Nav Links */}

          <Link
            href="/"
            className={`text-sm font-semibold transition-colors px-2 sm:px-3 py-2 ${
              pathname === "/" ? "text-white" : "text-zinc-400 hover:text-white"
            }`}
          >
            Home
          </Link>

          <Link
            href="/about"
            className={`flex items-center gap-2 text-sm font-semibold transition-colors px-2 sm:px-3 py-2 ${
              pathname === "/about"
                ? "text-white"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            <HelpCircle className="w-5 h-5" />
            About
          </Link>

          <Link
            href="/prices"
            className={`flex items-center gap-2 text-sm font-semibold transition-colors px-2 sm:px-3 py-2 ${
              pathname === "/prices"
                ? "text-white"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            Live Prices
          </Link>

          <div className="flex items-center gap-3">
            <button className="hidden sm:block p-2 hover:bg-zinc-800 rounded-lg transition-colors">
              <HelpCircle className="w-5 h-5 text-zinc-400 hover:text-white" />
            </button>

            <div className="h-6 w-px bg-zinc-800 hidden sm:block" />

            <WalletConnector />

            <button
              onClick={logout}
              className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-500 rounded-xl transition-all text-xs font-bold uppercase tracking-widest active:scale-95"
              title="Logout Terminal"
            >
              <LogOut className="w-4 h-4" />

              <span className="hidden md:inline">Logout</span>
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
