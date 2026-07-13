import React from "react";
import { motion } from "framer-motion";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs) {
    return twMerge(clsx(inputs));
}

const Dock = React.forwardRef(
    (
        {
            className,
            children,
            iconSize,
            iconMagnification,
            iconDistance,
            ...props
        },
        ref
    ) => {
        return (
            <div
                ref={ref}
                {...props}
                className={cn(
                    "mx-auto flex h-[58px] gap-4 rounded-2xl border border-white/10  p-2 backdrop-blur-[5px] items-center justify-center",
                    className
                )}
            >
                {children}
            </div>
        );
    }
);

Dock.displayName = "Dock";

const DockIcon = ({
    className,
    children,
    ...props
}) => {
    return (
        <motion.div
            whileHover={{ scale: 1.12, y: -2 }}
            whileTap={{ scale: 0.95 }}
            className={cn(
                "flex h-[42px] w-[42px] aspect-square cursor-pointer items-center justify-center rounded-full bg-white/5 border border-white/10 hover:bg-white/10 transition-colors",
                className
            )}
            {...props}
        >
            {children}
        </motion.div>
    );
};

DockIcon.displayName = "DockIcon";

export { Dock, DockIcon };
