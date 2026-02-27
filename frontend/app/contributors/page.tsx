'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { motion, type Variants } from 'framer-motion';
import Image from 'next/image';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import {
  Github,
  ExternalLink,
  GitCommit,
  Users,
  Star,
  GitFork,
  Search,
  Crown,
  Medal,
  Award,
  // ...existing code...
  Code2,
  Heart,
  ArrowUpRight,
  Sparkles,
  Trophy,
} from 'lucide-react';

/* ================================================================ */
/*  Types                                                            */
/* ================================================================ */

interface Contributor {
  login: string;
  avatar_url: string;
  contributions: number;
  html_url: string;
}

/* ================================================================ */
/*  Constants                                                        */
/* ================================================================ */

const REPO_OWNER = 'GauravKarakoti';
const REPO_NAME = 'SwapSmith';
const GITHUB_API = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}`;

/* ================================================================ */
/*  Helpers                                                          */
/* ================================================================ */

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 30 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay, ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number] },
});

const stagger = {
  animate: { transition: { staggerChildren: 0.06 } },
};

const cardVariant: Variants = {
  initial: { opacity: 0, y: 20, scale: 0.95 },
  animate: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.4, ease: 'easeOut' } },
};

function getRankBadge(rank: number) {
  if (rank === 1) return { icon: <Crown className="w-4 h-4" />, color: 'from-amber-400 to-yellow-500', ring: 'ring-amber-400/50', label: 'Top Contributor' };
  if (rank === 2) return { icon: <Medal className="w-4 h-4" />, color: 'from-slate-300 to-slate-400', ring: 'ring-slate-300/50', label: '2nd Place' };
  if (rank === 3) return { icon: <Award className="w-4 h-4" />, color: 'from-amber-600 to-orange-500', ring: 'ring-amber-600/50', label: '3rd Place' };
  return null;
}

/* ================================================================ */
/*  Sub-Components                                                   */
/* ================================================================ */

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <motion.div
      variants={cardVariant}
      className="relative overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/80 p-5 backdrop-blur-sm"
    >
      <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-blue-500/5 to-transparent rounded-bl-full" />
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center text-blue-600 dark:text-blue-400">
          {icon}
        </div>
        <div>
          <p className="text-2xl font-black text-zinc-900 dark:text-white">{value}</p>
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">{label}</p>
        </div>
      </div>
    </motion.div>
  );
}

function TopContributorCard({ contributor, rank }: { contributor: Contributor; rank: number }) {
  const badge = getRankBadge(rank);
  const sizes = rank === 1
    ? { card: 'md:col-span-1', avatar: 'w-24 h-24', text: 'text-xl' }
    : { card: '', avatar: 'w-20 h-20', text: 'text-lg' };

  return (
    <motion.a
      href={contributor.html_url}
      target="_blank"
      rel="noopener noreferrer"
      variants={cardVariant}
      whileHover={{ y: -8, scale: 1.02 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      className={`group relative overflow-hidden rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/80 p-6 backdrop-blur-sm cursor-pointer ${sizes.card}`}
    >
      {/* Glow effect */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/0 via-transparent to-purple-500/0 group-hover:from-blue-500/5 group-hover:to-purple-500/5 transition-all duration-500 " />

      {/* Rank badge */}
      {badge && (
        <div className={`absolute top-4 right-4 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gradient-to-r ${badge.color} text-white text-xs font-bold shadow-lg `}>
          {badge.icon}
          <span className="hidden sm:inline">{badge.label}</span>
        </div>
      )}

      <div className="relative flex flex-col items-center text-center gap-3  mt-3">
        {/* Avatar with rank ring */}
        <div className={`relative rounded-full ${badge ? `ring-4 ${badge.ring}` : ''}`}>
          <Image
            src={contributor.avatar_url}
            alt={contributor.login}
            width={96}
            height={96}
            className={`${sizes.avatar} rounded-full object-cover`}
            unoptimized
          />
          <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-white dark:bg-zinc-900 flex items-center justify-center border-2 border-zinc-200 dark:border-zinc-700">
            <Github className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-300" />
          </div>
        </div>

        {/* Info */}
        <div>
          <h3 className={`${sizes.text} font-bold text-zinc-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors`}>
            {contributor.login}
          </h3>
          <div className="flex items-center justify-center gap-1.5 mt-1">
            <GitCommit className="w-3.5 h-3.5 text-zinc-400" />
            <span className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">
              {contributor.contributions} commits
            </span>
          </div>
        </div>

        {/* View profile link */}
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 opacity-0 group-hover:opacity-100 translate-y-1 group-hover:translate-y-0 transition-all">
          View Profile <ArrowUpRight className="w-3 h-3" />
        </span>
      </div>
    </motion.a>
  );
}

function ContributorCard({ contributor, rank }: { contributor: Contributor; rank: number }) {
  return (
    <motion.a
      href={contributor.html_url}
      target="_blank"
      rel="noopener noreferrer"
      variants={cardVariant}
      whileHover={{ y: -4 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      className="group relative flex items-center gap-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/80 p-4 backdrop-blur-sm hover:border-blue-300 dark:hover:border-blue-600/40 cursor-pointer transition-colors"
    >
      {/* Rank number */}
      <span className="text-sm font-bold text-zinc-300 dark:text-zinc-700 w-6 text-center shrink-0">
        #{rank}
      </span>

      {/* Avatar */}
      <div className="relative shrink-0">
        <Image
          src={contributor.avatar_url}
          alt={contributor.login}
          width={44}
          height={44}
          className="w-11 h-11 rounded-full object-cover ring-2 ring-zinc-100 dark:ring-zinc-800"
          unoptimized
        />
      </div>

      {/* Name & commits */}
      <div className="flex-1 min-w-0">
        <p className="font-bold text-sm text-zinc-900 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
          {contributor.login}
        </p>
        <div className="flex items-center gap-1 mt-0.5">
          <GitCommit className="w-3 h-3 text-zinc-400" />
          <span className="text-xs text-zinc-500 dark:text-zinc-400">{contributor.contributions} commits</span>
        </div>
      </div>

      {/* Contribution bar */}
      <div className="hidden sm:block w-20">
        <div className="h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-500"
            style={{ width: `${Math.min(100, (contributor.contributions / 50) * 100)}%` }}
          />
        </div>
      </div>

      {/* Arrow */}
      <ExternalLink className="w-4 h-4 text-zinc-300 dark:text-zinc-700 group-hover:text-blue-500 transition-colors shrink-0" />
    </motion.a>
  );
}

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/80 p-4 flex items-center gap-4">
      <div className="w-6 h-4 bg-zinc-200 dark:bg-zinc-800 rounded" />
      <div className="w-11 h-11 rounded-full bg-zinc-200 dark:bg-zinc-800" />
      <div className="flex-1 space-y-2">
        <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-24" />
        <div className="h-3 bg-zinc-200 dark:bg-zinc-800 rounded w-16" />
      </div>
    </div>
  );
}

function SkeletonTopCard() {
  return (
    <div className="animate-pulse rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/80 p-6 flex flex-col items-center gap-3">
      <div className="w-24 h-24 rounded-full bg-zinc-200 dark:bg-zinc-800" />
      <div className="h-5 bg-zinc-200 dark:bg-zinc-800 rounded w-28" />
      <div className="h-3 bg-zinc-200 dark:bg-zinc-800 rounded w-20" />
    </div>
  );
}

/* ================================================================ */
/*  Page                                                             */
/* ================================================================ */

export default function ContributorsPage() {
  const [contributors, setContributors] = useState<Contributor[]>([]);
  const [repoData, setRepoData] = useState<{ stars: number; forks: number; issues: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  /* Fetch contributors + repo data */
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [contribRes, repoRes] = await Promise.all([
          fetch(`${GITHUB_API}/contributors?per_page=100`),
          fetch(GITHUB_API),
        ]);

        if (!contribRes.ok) throw new Error('Failed to fetch contributors');

        const contribData: Contributor[] = await contribRes.json();
        setContributors(contribData.filter((c) => c.login && !c.login.includes('[bot]')));

        if (repoRes.ok) {
          const repo = await repoRes.json();
          setRepoData({
            stars: repo.stargazers_count ?? 0,
            forks: repo.forks_count ?? 0,
            issues: repo.open_issues_count ?? 0,
          });
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  /* Derived data */
  const totalCommits = useMemo(() => contributors.reduce((s, c) => s + c.contributions, 0), [contributors]);

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return contributors;
    return contributors.filter((c) => c.login.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [contributors, searchQuery]);

  const topThree = filtered.slice(0, 3);
  const rest = filtered.slice(3);

  return (
    <>
      <Navbar />

      <div className="min-h-screen pt-24 sm:pt-28 pb-20 bg-zinc-50 dark:bg-[#08080f]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">

          {/* ── Hero ── */}
          <motion.section {...fadeUp(0)} className="text-center mb-14">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-50 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/20 mb-5">
              <Heart className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">Open Source Community</span>
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-zinc-900 dark:text-white tracking-tight">
              Our{' '}
              <span className="bg-gradient-to-r from-blue-600 via-indigo-500 to-purple-600 bg-clip-text text-transparent">
                Contributors
              </span>
            </h1>
            <p className="mt-4 text-base sm:text-lg text-zinc-500 dark:text-zinc-400 max-w-2xl mx-auto leading-relaxed">
              SwapSmith is built by an incredible community of developers.
              Every contribution matters — from bug fixes to features.
            </p>

            {/* CTA */}
            <div className="flex flex-wrap items-center justify-center gap-3 mt-8">
              <a
                href={`https://github.com/${REPO_OWNER}/${REPO_NAME}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-bold text-sm hover:opacity-90 transition-opacity shadow-lg shadow-zinc-900/10 dark:shadow-white/10"
              >
                <Github className="w-4 h-4" />
                View on GitHub
              </a>
              <a
                href={`https://github.com/${REPO_OWNER}/${REPO_NAME}/issues`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 font-bold text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                <Sparkles className="w-4 h-4" />
                Start Contributing
              </a>
            </div>
          </motion.section>

          {/* ── Stats ── */}
          <motion.section {...fadeUp(0.1)} variants={stagger} initial="initial" animate="animate" className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-14">
            <StatCard icon={<Users className="w-5 h-5" />} label="Contributors" value={loading ? '—' : contributors.length} />
            <StatCard icon={<GitCommit className="w-5 h-5" />} label="Total Commits" value={loading ? '—' : totalCommits.toLocaleString()} />
            <StatCard icon={<Star className="w-5 h-5" />} label="Stars" value={repoData?.stars ?? '—'} />
            <StatCard icon={<GitFork className="w-5 h-5" />} label="Forks" value={repoData?.forks ?? '—'} />
          </motion.section>

          {/* ── Search ── */}
          {!loading && !error && contributors.length > 0 && (
            <motion.div {...fadeUp(0.15)} className="mb-10">
              <div className="relative max-w-md mx-auto">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <input
                  type="text"
                  placeholder="Search contributors..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all"
                />
              </div>
            </motion.div>
          )}

          {/* ── Error State ── */}
          {error && (
            <motion.div {...fadeUp(0.1)} className="text-center py-16">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-red-50 dark:bg-red-500/10 mb-4">
                <Code2 className="w-7 h-7 text-red-500" />
              </div>
              <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-2">Failed to load contributors</h3>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">{error}</p>
              <button
                onClick={() => window.location.reload()}
                className="px-5 py-2 rounded-xl bg-blue-600 text-white font-bold text-sm hover:bg-blue-700 transition-colors"
              >
                Retry
              </button>
            </motion.div>
          )}

          {/* ── Loading Skeleton ── */}
          {loading && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {Array.from({ length: 3 }).map((_, i) => <SkeletonTopCard key={i} />)}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
              </div>
            </div>
          )}

          {/* ── Top 3 ── */}
          {!loading && !error && topThree.length > 0 && (
            <motion.section {...fadeUp(0.2)} variants={stagger} initial="initial" animate="animate" className="mb-10">
              <div className="flex items-center gap-2 mb-5">
                <Trophy className="w-5 h-5 text-amber-500" />
                <h2 className="text-lg font-bold text-zinc-900 dark:text-white">Top Contributors</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {topThree.map((c, i) => (
                  <TopContributorCard key={c.login} contributor={c} rank={i + 1} />
                ))}
              </div>
            </motion.section>
          )}

          {/* ── All Contributors ── */}
          {!loading && !error && rest.length > 0 && (
            <motion.section {...fadeUp(0.3)} variants={stagger} initial="initial" animate="animate">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-blue-500" />
                  <h2 className="text-lg font-bold text-zinc-900 dark:text-white">All Contributors</h2>
                </div>
                <span className="text-xs font-semibold text-zinc-400 dark:text-zinc-500">{filtered.length} total</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {rest.map((c, i) => (
                  <ContributorCard key={c.login} contributor={c} rank={i + 4} />
                ))}
              </div>
            </motion.section>
          )}

          {/* ── No results ── */}
          {!loading && !error && filtered.length === 0 && searchQuery && (
            <motion.div {...fadeUp(0.1)} className="text-center py-16">
              <Search className="w-10 h-10 text-zinc-300 dark:text-zinc-700 mx-auto mb-4" />
              <p className="text-zinc-500 dark:text-zinc-400 font-medium">
                No contributors found for &quot;{searchQuery}&quot;
              </p>
            </motion.div>
          )}

          {/* ── Contribute CTA ── */}
          {!loading && !error && (
            <motion.section {...fadeUp(0.4)} className="mt-16">
              <div className="relative overflow-hidden rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-zinc-900 dark:via-zinc-900 dark:to-zinc-900 p-8 sm:p-10 text-center">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-72 h-72 bg-blue-400/10 dark:bg-blue-500/5 rounded-full blur-3xl" />
                <div className="relative">
                  <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-100 dark:bg-blue-500/10 mb-4">
                    <Code2 className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <h3 className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-white mb-3">
                    Want to contribute?
                  </h3>
                  <p className="text-zinc-500 dark:text-zinc-400 max-w-lg mx-auto mb-6 text-sm sm:text-base">
                    We welcome all contributions! Check out our open issues, pick one that interests you,
                    and submit a pull request to become part of the SwapSmith community.
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-3">
                    <a
                      href={`https://github.com/${REPO_OWNER}/${REPO_NAME}/issues`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold text-sm hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg shadow-blue-600/20"
                    >
                      <Sparkles className="w-4 h-4" />
                      Browse Issues
                    </a>
                    <a
                      href={`https://github.com/${REPO_OWNER}/${REPO_NAME}/fork`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 font-bold text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                    >
                      <GitFork className="w-4 h-4" />
                      Fork Repository
                    </a>
                  </div>
                </div>
              </div>
            </motion.section>
          )}

        </div>
      </div>

      <Footer />
    </>
  );
}
