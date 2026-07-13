import { motion, AnimatePresence } from "framer-motion";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs) {
    return twMerge(clsx(inputs));
}

export default function GradualSpacing({
    text,
    duration = 0.5,
    delayMultiple = 0.04,
    framerProps = {
        hidden: { opacity: 0, x: -20 },
        visible: { opacity: 1, x: 0 },
    },
    className,
}) {
    if (!text) return null;
    return (
        <div className="flex justify-center flex-wrap select-none">
            <AnimatePresence>
                {text.split("").map((char, i) => (
                    <motion.span
                        key={i}
                        initial="hidden"
                        animate="visible"
                        exit="hidden"
                        variants={framerProps}
                        transition={{ duration, delay: i * delayMultiple }}
                        className={cn("drop-shadow-sm", className)}
                    >
                        {char === " " ? "\u00A0" : char}
                    </motion.span>
                ))}
            </AnimatePresence>
        </div>
    );
}
