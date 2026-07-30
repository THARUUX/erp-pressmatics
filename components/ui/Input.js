'use client';

import { cn } from '@/lib/utils';

export default function Input({ className, label, error, hidden, value, icon: Icon, ...props }) {
    return (
        <div className={cn(hidden ? "hidden" : "flex flex-col gap-1.5 w-full")}>
            {label && <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>}
            <div className="relative flex items-center w-full">
                {Icon && <Icon className="absolute left-3.5 text-gray-500 w-4 h-4 pointer-events-none" />}
                <input
                    value={value ?? ''}
                    className={cn(
                        "px-4 py-2.5 rounded-lg border border-white/10 bg-secondary text-white focus:ring-2 focus:ring-white/20 focus:border-white/50 transition-all outline-none placeholder:text-gray-500 w-full",
                        Icon && "pl-10",
                        error && "border-red-500 focus:border-red-500 focus:ring-red-500/20",
                        className
                    )}
                    {...props}
                />
            </div>
            {error && <span className="text-sm text-red-500">{error}</span>}
        </div>
    );
}
