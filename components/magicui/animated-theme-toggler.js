import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FiSun, FiMoon } from "react-icons/fi";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs) {
    return twMerge(clsx(inputs));
}

export function AnimatedThemeToggler({ dark, toggleTheme, className }) {
    return (
        <button
            onClick={toggleTheme}
            className={cn(
                "w-10 h-10 rounded-2xl flex items-center justify-center border transition-all duration-300 shadow-sm relative overflow-hidden focus:outline-none",
                dark 
                    ? "bg-white/[0.04] border-white/10 text-white/70 hover:text-white hover:bg-white/10" 
                    : "bg-white border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-50",
                className
            )}
            title="Toggle theme"
        >
            <AnimatePresence mode="wait" initial={false}>
                <motion.div
                    key={dark ? "dark" : "light"}
                    initial={{ y: -12, opacity: 0, rotate: -90 }}
                    animate={{ y: 0, opacity: 1, rotate: 0 }}
                    exit={{ y: 12, opacity: 0, rotate: 90 }}
                    transition={{ duration: 0.25, ease: "easeOut" }}
                    className="flex items-center justify-center absolute"
                >
                    {dark ? (
                        <FiSun className="w-[18px] h-[18px] text-amber-300" />
                    ) : (
                        <FiMoon className="w-[18px] h-[18px] text-indigo-650" />
                    )}
                </motion.div>
            </AnimatePresence>
        </button>
    );
}
