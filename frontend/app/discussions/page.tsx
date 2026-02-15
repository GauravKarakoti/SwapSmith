"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import Navbar from "@/components/Navbar";
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
  X
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
    
    if (!user) {
      alert("Please login to post a message");
      return;
    }

    if (newMessage.trim().length < 5) {
      alert("Message must be at least 5 characters");
      return;
    }

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
        
        // Optimistically add the new message to the list immediately
        if (result.discussion) {
          setDiscussions(prev => [result.discussion, ...prev]);
        }
        
        setNewMessage("");
        setShowMessageBox(false);
        
        // Fetch to ensure sync with server
        setTimeout(() => fetchDiscussions(), 500);
      } else {
        const errorData = await response.json();
        alert(`Failed to post: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error("Error posting message:", error);
      alert("Failed to post message");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!user) return;

    if (!confirm("Are you sure you want to delete this message?")) {
      return;
    }

    try {
      // Optimistically remove from UI
      setDiscussions(prev => prev.filter(d => d.id !== id));
      
      const response = await fetch(
        `/api/discussions?id=${id}&userId=${user.uid}`,
        { method: "DELETE" }
      );

      if (!response.ok) {
        // Revert on error
        alert("Failed to delete message");
        fetchDiscussions();
      }
    } catch (error) {
      console.error("Error deleting message:", error);
      alert("Failed to delete message");
      fetchDiscussions();
    }
  };

  const handleLike = async (id: number) => {
    try {
      // Optimistically update UI
      setDiscussions(prev => prev.map(d => 
        d.id === id 
          ? { ...d, likes: String(parseInt(d.likes || '0') + 1) }
          : d
      ));
      
      const response = await fetch("/api/discussions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });

      if (!response.ok) {
        // Revert on error
        fetchDiscussions();
      }
    } catch (error) {
      console.error("Error liking message:", error);
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
      <div className="min-h-screen bg-[#050505] pt-24 pb-12">
        <div className="w-full max-w-[1800px] mx-auto px-6 lg:px-12">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl sm:text-5xl font-black text-white mb-3 flex items-center gap-3">
              <MessageSquare className="w-10 h-10 text-blue-500" />
              Community Discussions
            </h1>
            <p className="text-zinc-400 text-lg">
              Join the conversation, share ideas, and get help from the SwapSmith community
            </p>
          </div>

          {/* Main Layout: Sidebar (1/4) + Discussion Area (3/4) */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* SIDEBAR - 1/4 */}
            <div className="lg:col-span-1 space-y-4">
              {/* GitHub Discussions */}
              <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5 backdrop-blur-sm">
                <div className="flex items-center gap-2 mb-3">
                  <Github className="w-5 h-5 text-white" />
                  <h3 className="text-white font-bold">GitHub Discussions</h3>
                </div>
                <p className="text-sm text-zinc-400 mb-4">
                  Join our official GitHub discussions for technical topics
                </p>
                <a
                  href="https://github.com/GauravKarakoti/swapsmith/discussions"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full bg-zinc-800 hover:bg-zinc-700 text-white text-sm font-semibold py-2.5 px-3 rounded-lg transition-colors text-center"
                >
                  View on GitHub →
                </a>
              </div>

              {/* Crypto News/Trends */}
              <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5 backdrop-blur-sm">
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp className="w-5 h-5 text-green-500" />
                  <h3 className="text-white font-bold">Crypto Trends</h3>
                </div>
                <div className="space-y-3">
                  <div className="text-xs text-zinc-400 pb-3 border-b border-zinc-800">
                    <div className="flex justify-between mb-1">
                      <span className="text-white font-medium">Bitcoin (BTC)</span>
                      <span className="text-green-500 font-semibold">+3.2%</span>
                    </div>
                    <div className="text-zinc-500">$92,450</div>
                  </div>
                  <div className="text-xs text-zinc-400 pb-3 border-b border-zinc-800">
                    <div className="flex justify-between mb-1">
                      <span className="text-white font-medium">Ethereum (ETH)</span>
                      <span className="text-red-500 font-semibold">-1.5%</span>
                    </div>
                    <div className="text-zinc-500">$3,280</div>
                  </div>
                  <div className="text-xs text-zinc-400 pb-3">
                    <div className="flex justify-between mb-1">
                      <span className="text-white font-medium">Solana (SOL)</span>
                      <span className="text-green-500 font-semibold">+5.8%</span>
                    </div>
                    <div className="text-zinc-500">$145</div>
                  </div>
                </div>
              </div>

              {/* Community Stats */}
              <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5 backdrop-blur-sm">
                <div className="flex items-center gap-2 mb-4">
                  <Users className="w-5 h-5 text-purple-500" />
                  <h3 className="text-white font-bold">Community</h3>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between text-zinc-400">
                    <span>Total Posts</span>
                    <span className="text-white font-bold">{discussions.length}</span>
                  </div>
                  <div className="flex justify-between text-zinc-400">
                    <span>Active Today</span>
                    <span className="text-white font-bold">
                      {discussions.filter(d => {
                        const today = new Date();
                        const postDate = new Date(d.createdAt);
                        return postDate.toDateString() === today.toDateString();
                      }).length}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* MAIN DISCUSSION AREA - 3/4 */}
            <div className="lg:col-span-3">
              {/* Category Tabs & New Message Button */}
              <div className="mb-6 flex items-center justify-between gap-4">
                <div className="flex items-center gap-2 overflow-x-auto pb-2">
                  {["all", "general", "crypto", "help", "announcement"].map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-all ${
                        selectedCategory === cat
                          ? "bg-blue-600 text-white shadow-lg shadow-blue-600/30"
                          : "bg-zinc-800/50 text-zinc-400 hover:bg-zinc-700 hover:text-white"
                      }`}
                    >
                      {cat.charAt(0).toUpperCase() + cat.slice(1)}
                    </button>
                  ))}
                </div>

                {user && (
                  <button
                    onClick={() => setShowMessageBox(!showMessageBox)}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg text-sm font-bold transition-all shadow-lg shadow-blue-600/30 whitespace-nowrap"
                  >
                    {showMessageBox ? (
                      <>
                        <X className="w-4 h-4" />
                        Cancel
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4" />
                        New Message
                      </>
                    )}
                  </button>
                )}
              </div>

              {/* Dynamic Post New Message Box */}
              {showMessageBox && user && (
                <div className="bg-zinc-900/80 border border-zinc-700 rounded-xl p-5 mb-6 backdrop-blur-sm shadow-xl">
                  <form onSubmit={handleSubmit}>
                    <textarea
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="Share your thoughts, ask a question, or start a discussion..."
                      className="w-full bg-zinc-800/50 text-white placeholder-zinc-500 rounded-lg p-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[120px] resize-none border border-zinc-700"
                      autoFocus
                    />
                    <div className="flex justify-between items-center mt-4">
                      <span className="text-xs text-zinc-500">
                        {newMessage.length} / 5000 characters
                      </span>
                      <button
                        type="submit"
                        disabled={submitting || newMessage.trim().length < 5}
                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-700 disabled:cursor-not-allowed text-white px-5 py-2.5 rounded-lg text-sm font-bold transition-all shadow-lg"
                      >
                        <Send className="w-4 h-4" />
                        {submitting ? "Posting..." : "Post Message"}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {!user && (
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 mb-6 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-yellow-200 text-sm font-semibold">Login Required</p>
                    <p className="text-yellow-200/70 text-xs mt-1">
                      Please login to post messages and participate in discussions
                    </p>
                  </div>
                </div>
              )}

              {/* Discussion List */}
              <div className="space-y-4">
                {loading ? (
                  <div className="text-center py-16">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500 mx-auto"></div>
                    <p className="text-zinc-400 mt-4 text-sm">Loading discussions...</p>
                  </div>
                ) : discussions.length === 0 ? (
                  <div className="text-center py-16 bg-zinc-900/50 border border-zinc-800 rounded-xl">
                    <MessageSquare className="w-16 h-16 text-zinc-700 mx-auto mb-4" />
                    <p className="text-zinc-400 text-lg font-medium">No discussions yet. Be the first to post!</p>
                  </div>
                ) : (
                  discussions.map((discussion) => (
                    <div
                      key={discussion.id}
                      className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5 hover:border-zinc-700 hover:bg-zinc-900/70 transition-all backdrop-blur-sm"
                    >
                      {/* Header */}
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-11 h-11 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg">
                            <span className="text-white font-bold text-base">
                              {discussion.username.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <p className="text-white font-semibold text-sm">{discussion.username}</p>
                            <div className="flex items-center gap-2 text-xs text-zinc-500">
                              <Clock className="w-3 h-3" />
                              {formatTimeAgo(discussion.createdAt)}
                              <span className="text-zinc-700">•</span>
                              <span className="px-2 py-0.5 bg-zinc-800/70 rounded text-zinc-400 font-medium">
                                {discussion.category}
                              </span>
                            </div>
                          </div>
                        </div>
                        {user?.uid === discussion.userId && (
                          <button
                            onClick={() => handleDelete(discussion.id)}
                            className="text-zinc-500 hover:text-red-500 transition-colors p-2 hover:bg-red-500/10 rounded-lg"
                            title="Delete message"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      {/* Content */}
                      <p className="text-zinc-300 text-sm leading-relaxed whitespace-pre-wrap mb-4">
                        {discussion.content}
                      </p>

                      {/* Actions */}
                      <div className="flex items-center gap-4 pt-3 border-t border-zinc-800">
                        <button
                          onClick={() => handleLike(discussion.id)}
                          className="flex items-center gap-2 text-zinc-400 hover:text-blue-500 transition-colors text-sm font-medium"
                        >
                          <ThumbsUp className="w-4 h-4" />
                          <span>{parseInt(discussion.likes || '0')}</span>
                        </button>
                      </div>
                    </div>
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
