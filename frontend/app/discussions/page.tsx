"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import Navbar from "@/components/Navbar";
import { motion, AnimatePresence } from "framer-motion";
import { 
  MessageSquare, 
  Trash2, 
  ThumbsUp, 
  Send, 
  Github,
  TrendingUp,
  AlertCircle,
  Clock,
  Users,
  Plus,
  X,
  MessageCircle
} from "lucide-react";

interface Discussion {
  id: number;
  userId: string;
  username: string;
  content: string;
  category: string;
  likes: string;
  replies: string;
  createdAt: string;
  updatedAt: string;
}

export default function DiscussionsPage() {
  const { user } = useAuth();
  const [discussions, setDiscussions] = useState<Discussion[]>([]);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [submitting, setSubmitting] = useState(false);
  const [showMessageBox, setShowMessageBox] = useState(false);

  // Fetch discussions
  const fetchDiscussions = useCallback(async () => {
    try {
      setLoading(true);
      const url = selectedCategory === "all" 
        ? "/api/discussions?limit=100"
        : `/api/discussions?category=${selectedCategory}&limit=100`;
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.discussions) {
        setDiscussions(data.discussions);
      }
    } catch (error) {
      console.error("Error fetching discussions:", error);
    } finally {
      setLoading(false);
    }
  }, [selectedCategory]);

  useEffect(() => {
    fetchDiscussions();
  }, [fetchDiscussions]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (newMessage.trim().length < 5) return;

    try {
      setSubmitting(true);
      const response = await fetch("/api/discussions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.uid,
          username: user.email?.split("@")[0] || "Anonymous",
          content: newMessage.trim(),
          category: selectedCategory === "all" ? "general" : selectedCategory,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        if (result.discussion) {
          setDiscussions(prev => [result.discussion, ...prev]);
        }
        setNewMessage("");
        setShowMessageBox(false);
        setTimeout(() => fetchDiscussions(), 500);
      }
    } catch (error) {
      console.error("Error posting message:", error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!user || !confirm("Are you sure you want to delete this message?")) return;

    try {
      setDiscussions(prev => prev.filter(d => d.id !== id));
      const response = await fetch(`/api/discussions?id=${id}&userId=${user.uid}`, { method: "DELETE" });
      if (!response.ok) fetchDiscussions();
    } catch {
      fetchDiscussions();
    }
  };

  const handleLike = async (id: number) => {
    try {
      setDiscussions(prev => prev.map(d => 
        d.id === id ? { ...d, likes: String(parseInt(d.likes || '0') + 1) } : d
      ));
      const response = await fetch("/api/discussions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!response.ok) fetchDiscussions();
    } catch {
      fetchDiscussions();
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-primary pt-32 pb-24 transition-colors duration-500">
        <div className="w-full max-w-[1600px] mx-auto px-6 lg:px-12">
          
          {/* Header Section */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-600 rounded-xl shadow-lg shadow-blue-500/20">
                  <MessageSquare className="w-6 h-6 text-white" />
                </div>
                <h1 className="text-4xl md:text-5xl font-black tracking-tighter text-primary">
                  Community <span className="gradient-text">Forum</span>
                </h1>
              </div>
              <p className="text-secondary font-medium max-w-lg">
                Connect with the SwapSmith network. Share insights, strategies, and technical support.
              </p>
            </div>

            {user && (
              <button
                onClick={() => setShowMessageBox(!showMessageBox)}
                className="btn-primary px-6 py-3.5 rounded-2xl flex items-center gap-2 font-bold transition-all active:scale-95"
              >
                {showMessageBox ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                {showMessageBox ? "Cancel Post" : "New Discussion"}
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            
            {/* LEFT SIDEBAR: Stats & External Links */}
            <div className="lg:col-span-1 space-y-6">
              <div className="glow-card rounded-3xl p-6 border-primary bg-secondary/30">
                <div className="flex items-center gap-3 mb-4">
                  <Github className="w-5 h-5 text-primary" />
                  <h3 className="text-primary font-black tracking-tighter text-lg uppercase">Source Feed</h3>
                </div>
                <p className="text-xs font-bold text-muted uppercase tracking-widest leading-relaxed mb-6">
                  Technical requests and dev logs are managed via GitHub.
                </p>
                <a
                  href="https://github.com/GauravKarakoti/swapsmith/discussions"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-primary w-full py-3 rounded-xl flex items-center justify-center gap-2 text-xs font-black uppercase tracking-widest shadow-xl"
                >
                  GitHub Sync <ChevronRight className="w-3 h-3" />
                </a>
              </div>

              <div className="glow-card rounded-3xl p-6 border-primary">
                <div className="flex items-center gap-3 mb-6">
                  <TrendingUp className="w-5 h-5 text-emerald-500" />
                  <h3 className="text-primary font-black tracking-tighter text-lg uppercase">Momentum</h3>
                </div>
                <div className="space-y-4">
                  {[
                    { label: "Bitcoin (BTC)", trend: "+3.2%", color: "text-emerald-500", price: "$92,450" },
                    { label: "Ethereum (ETH)", trend: "-1.5%", color: "text-red-500", price: "$3,280" },
                    { label: "Solana (SOL)", trend: "+5.8%", color: "text-emerald-500", price: "$145" },
                  ].map((coin, i) => (
                    <div key={i} className="pb-3 border-b border-primary last:border-0 last:pb-0">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs font-bold text-primary">{coin.label}</span>
                        <span className={`text-[10px] font-black ${coin.color}`}>{coin.trend}</span>
                      </div>
                      <div className="text-[10px] text-muted font-bold tracking-widest font-mono">{coin.price}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="glass rounded-3xl p-6 border-primary">
                <div className="flex items-center gap-3 mb-4">
                  <Users className="w-5 h-5 text-accent-primary" />
                  <h3 className="text-primary font-black tracking-tighter text-lg uppercase">Network</h3>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted">Total Nodes</span>
                    <span className="text-sm font-black text-primary">{discussions.length}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted">Active Today</span>
                    <span className="text-sm font-black text-emerald-500">
                      {discussions.filter(d => new Date(d.createdAt).toDateString() === new Date().toDateString()).length}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT MAIN AREA: Discussions */}
            <div className="lg:col-span-3 space-y-6">
              
              {/* Category Toggles */}
              <div className="flex items-center gap-2 overflow-x-auto pb-4 no-scrollbar">
                {["all", "general", "crypto", "help", "announcement"].map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] whitespace-nowrap transition-all border ${
                      selectedCategory === cat
                        ? "bg-accent-primary border-accent-primary text-blue-500 shadow-lg shadow-blue-500/20"
                        : "bg-tertiary border-primary text-muted hover:text-primary hover:border-accent-primary"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Compose Box */}
              <AnimatePresence>
                {showMessageBox && user && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="glow-card rounded-[2.5rem] border-primary p-8 mb-8 bg-indigo-600/[0.03] shadow-inner">
                      <form onSubmit={handleSubmit}>
                        <textarea
                          value={newMessage}
                          onChange={(e) => setNewMessage(e.target.value)}
                          placeholder="Broadcast your insight to the terminal..."
                          className="w-full bg-tertiary text-primary placeholder-muted rounded-3xl p-6 text-sm font-medium focus:ring-4 focus:ring-accent-primary/10 transition-all min-h-[160px] resize-none border border-primary shadow-inner outline-none"
                          autoFocus
                        />
                        <div className="flex justify-between items-center mt-6">
                          <span className="text-[10px] font-black text-muted uppercase tracking-widest">
                            Buffer: {newMessage.length} / 5000 units
                          </span>
                          <button
                            type="submit"
                            disabled={submitting || newMessage.trim().length < 5}
                            className="btn-primary flex items-center gap-3 px-8 py-3 rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl disabled:opacity-40"
                          >
                            <Send className="w-4 h-4" />
                            {submitting ? "Transmitting..." : "Execute Post"}
                          </button>
                        </div>
                      </form>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Warning for Guest Users */}
              {!user && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-3xl p-5 mb-8 flex items-start gap-4">
                  <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-amber-600 dark:text-amber-400 text-sm font-black uppercase tracking-tighter">Read-Only Mode</p>
                    <p className="text-amber-700/80 dark:text-amber-200/60 text-xs font-medium mt-1">
                      Wallet authentication is required to participate in governance and community discussions.
                    </p>
                  </div>
                </div>
              )}

              {/* Feed Grid */}
              <div className="space-y-6">
                {loading ? (
                  <div className="text-center py-20 bg-secondary rounded-[2.5rem] border border-primary border-dashed">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-accent-primary mx-auto"></div>
                    <p className="text-muted mt-4 text-[10px] font-black uppercase tracking-widest">Syncing Feed...</p>
                  </div>
                ) : discussions.length === 0 ? (
                  <div className="text-center py-20 bg-secondary rounded-[2.5rem] border border-primary border-dashed">
                    <MessageCircle className="w-16 h-16 text-muted mx-auto mb-4 opacity-20" />
                    <p className="text-secondary font-black text-lg tracking-tighter uppercase">Quiet in the sector.</p>
                    <p className="text-muted text-xs font-bold uppercase tracking-widest mt-2">No active signals found in this category.</p>
                  </div>
                ) : (
                  discussions.map((discussion, index) => (
                    <motion.div
                      layout
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: index * 0.05 }}
                      key={discussion.id}
                      className="glow-card rounded-[2rem] border-primary p-6 hover:bg-section-hover transition-all group"
                    >
                      {/* Message Header */}
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-accent-primary to-accent-tertiary flex items-center justify-center text-white font-black text-xl shadow-lg shadow-blue-500/20 group-hover:scale-105 transition-transform">
                            {discussion.username.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-primary font-black tracking-tighter text-lg">{discussion.username}</p>
                            <div className="flex items-center gap-3 mt-1">
                              <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted uppercase tracking-widest">
                                <Clock className="w-3 h-3" />
                                {formatTimeAgo(discussion.createdAt)}
                              </div>
                              <span className="w-1 h-1 rounded-full bg-border-primary" />
                              <span className="badge px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest">
                                {discussion.category}
                              </span>
                            </div>
                          </div>
                        </div>
                        {user?.uid === discussion.userId && (
                          <button
                            onClick={() => handleDelete(discussion.id)}
                            className="text-muted hover:text-red-500 transition-colors p-2 hover:bg-red-500/10 rounded-xl"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      {/* Content Body */}
                      <div className="px-1 mb-6">
                        <p className="text-secondary text-sm font-medium leading-relaxed whitespace-pre-wrap">
                          {discussion.content}
                        </p>
                      </div>

                      {/* Footer Actions */}
                      <div className="flex items-center gap-4 pt-4 border-t border-primary">
                        <button
                          onClick={() => handleLike(discussion.id)}
                          className="flex items-center gap-2 text-muted hover:text-accent-primary transition-all px-3 py-1.5 rounded-lg bg-secondary/50 border border-primary group/like"
                        >
                          <ThumbsUp className="w-4 h-4 group-hover/like:scale-125 transition-transform" />
                          <span className="text-xs font-black tracking-widest">{parseInt(discussion.likes || '0')}</span>
                        </button>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

const ChevronRight = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" />
  </svg>
);