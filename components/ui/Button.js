'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils'; // Assuming you might have a utils file, I'll create it too or inline clsx
// import { clsx } from 'clsx';
// import { twMerge } from 'tailwind-merge';

export default function Button({ children, className, isLoading, ...props }) {
    return (
        <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className={cn(
                "px-6 py-2.5 rounded-lg font-medium transition-all duration-300 bg-white text-gray-900 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 border border-transparent hover:border-white/10",
                className
            )}
            disabled={isLoading}
            {...props}
        >
            {isLoading && (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            )}
            {children}
        </motion.button>
    );
}
