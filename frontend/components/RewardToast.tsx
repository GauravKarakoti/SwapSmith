'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, X, Sparkles } from 'lucide-react';

interface RewardNotification {
  message: string;
  points: number;
  tokens?: string;
}

// Generate static sparkle positions
const generateSparklePositions = () => 
  [...Array(5)].map(() => ({
    x: Math.random() * 100 - 50,
    y: Math.random() * 100 - 50,
    left: Math.random() * 100,
    top: Math.random() * 100,
  }));

export default function RewardToast() {
  const [notification, setNotification] = useState<RewardNotification | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [sparklePositions] = useState(generateSparklePositions);

  useEffect(() => {
    const handleRewardEarned = (event: CustomEvent<RewardNotification>) => {
      setNotification(event.detail);
      setIsVisible(true);

      // Auto-hide after 5 seconds
      setTimeout(() => {
        setIsVisible(false);
        setTimeout(() => setNotification(null), 300);
      }, 5000);
    };

    window.addEventListener('rewardEarned', handleRewardEarned as EventListener);
    return () => {
      window.removeEventListener('rewardEarned', handleRewardEarned as EventListener);
    };
  }, []);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(() => setNotification(null), 300);
  };

  return (
    <AnimatePresence>
      {notification && isVisible && (
        <motion.div
          initial={{ opacity: 0, y: -100, scale: 0.8 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -100, scale: 0.8 }}
          transition={{ type: 'spring', duration: 0.5 }}
          className="fixed top-20 right-4 z-[100] max-w-md"
        >
          <div className="bg-gradient-to-r from-yellow-900/90 via-orange-900/90 to-yellow-900/90 backdrop-blur-xl border border-yellow-500/50 rounded-xl shadow-2xl shadow-yellow-500/20 overflow-hidden">
            {/* Animated background sparkles */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <div className="absolute top-0 left-0 w-full h-full">
                {sparklePositions.map((pos, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{
                      opacity: [0, 1, 0],
                      scale: [0, 1, 0],
                      x: [0, pos.x],
                      y: [0, pos.y],
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      delay: i * 0.3,
                    }}
                    className="absolute"
                    style={{
                      left: `${pos.left}%`,
                      top: `${pos.top}%`,
                    }}
                  >
                    <Sparkles className="w-4 h-4 text-yellow-300" />
                  </motion.div>
                ))}
              </div>
            </div>

            <div className="relative p-4 flex items-start gap-4">
              {/* Trophy Icon */}
              <motion.div
                initial={{ rotate: -180, scale: 0 }}
                animate={{ rotate: 0, scale: 1 }}
                transition={{ type: 'spring', delay: 0.2 }}
                className="flex-shrink-0 p-3 bg-yellow-500/20 rounded-full"
              >
                <Trophy className="w-6 h-6 text-yellow-400" />
              </motion.div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <h4 className="text-lg font-bold text-white mb-1">
                  🎉 Reward Earned!
                </h4>
                <p className="text-sm text-yellow-100/90 mb-2">
                  {notification.message}
                </p>
                <div className="flex items-center gap-3">
                  <span className="px-3 py-1 bg-yellow-500/20 border border-yellow-500/30 rounded-full text-sm font-bold text-yellow-300">
                    +{notification.points} Points
                  </span>
                  {notification.tokens && (
                    <span className="px-3 py-1 bg-green-500/20 border border-green-500/30 rounded-full text-sm font-bold text-green-300">
                      +{notification.tokens} Tokens
                    </span>
                  )}
                </div>
              </div>

              {/* Close Button */}
              <button
                onClick={handleClose}
                className="flex-shrink-0 p-1 rounded-lg hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5 text-yellow-200" />
              </button>
            </div>

            {/* Progress bar for auto-hide */}
            <motion.div
              initial={{ width: '100%' }}
              animate={{ width: '0%' }}
              transition={{ duration: 5, ease: 'linear' }}
              className="h-1 bg-yellow-400/50"
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
