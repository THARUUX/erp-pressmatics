'use client';

import { cn } from '@/lib/utils';

export default function Input({ className, label, error, hidden, ...props }) {
    return (
        <div className={cn(hidden ? "hidden" : "flex flex-col gap-1.5 w-full")}>
            {label && <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>}
            <input
                className={cn(
                    "px-4 py-2.5 rounded-lg border border-white/10 bg-secondary text-white focus:ring-2 focus:ring-white/20 focus:border-white/50 transition-all outline-none placeholder:text-gray-500",
                    error && "border-red-500 focus:border-red-500 focus:ring-red-500/20",
                    className
                )}
                {...props}
            />
            {error && <span className="text-sm text-red-500">{error}</span>}
        </div>
    );
}
