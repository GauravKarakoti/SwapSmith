// components/ThemeToggle.tsx

'use client';

import { useTheme } from '@/contexts/ThemeContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Sun, Moon } from 'lucide-react';

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <motion.button
      onClick={toggleTheme}
      className="relative w-14 h-7 bg-white/10 dark:bg-white/5 rounded-full border border-white/20 dark:border-white/10 backdrop-blur-sm transition-colors duration-300 hover:bg-white/20 dark:hover:bg-white/10"
      whileTap={{ scale: 0.95 }}
      aria-label="Toggle theme"
    >
      {/* Slider */}
      <motion.div
        className="absolute top-0.5 w-6 h-6 bg-gradient-to-br from-orange-400 to-pink-500 dark:from-blue-400 dark:to-purple-500 rounded-full shadow-lg"
        animate={{
          x: theme === 'dark' ? 28 : 2,
        }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      >
        <AnimatePresence mode="wait">
          {theme === 'dark' ? (
            <motion.div
              key="moon"
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 90, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="flex items-center justify-center h-full"
            >
              <Moon className="w-3.5 h-3.5 text-white" fill="currentColor" />
            </motion.div>
          ) : (
            <motion.div
              key="sun"
              initial={{ rotate: 90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: -90, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="flex items-center justify-center h-full"
            >
              <Sun className="w-3.5 h-3.5 text-white" />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Background Icons */}
      <div className="absolute inset-0 flex items-center justify-between px-1.5 pointer-events-none">
        <Sun className="w-3 h-3 text-orange-400 dark:text-zinc-600 transition-colors" />
        <Moon className="w-3 h-3 text-zinc-600 dark:text-blue-400 transition-colors" />
      </div>
    </motion.button>
  );
}