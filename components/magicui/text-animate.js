import { motion } from "framer-motion";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs) {
    return twMerge(clsx(inputs));
}

const animationVariants = {
    fadeIn: {
        container: {},
        item: {
            hidden: { opacity: 0 },
            visible: { opacity: 1 },
        },
    },
    blurIn: {
        container: {},
        item: {
            hidden: { opacity: 0, filter: "blur(8px)" },
            visible: { opacity: 1, filter: "blur(0px)" },
        },
    },
    slideUp: {
        container: {},
        item: {
            hidden: { opacity: 0, y: 15 },
            visible: { opacity: 1, y: 0 },
        },
    },
    blurInUp: {
        container: {},
        item: {
            hidden: { opacity: 0, y: 15, filter: "blur(6px)" },
            visible: { opacity: 1, y: 0, filter: "blur(0px)" },
        },
    },
};

export function TextAnimate({
    text,
    type = "char", // "char" | "word"
    animation = "fadeIn", // "fadeIn" | "blurIn" | "slideUp" | "blurInUp"
    delay = 0,
    duration = 0.3,
    stagger = 0.03,
    className,
    ...props
}) {
    const selectedVariant = animationVariants[animation] || animationVariants.fadeIn;
    const items = type === "word" ? text.split(" ") : text.split("");

    const containerVariants = {
        hidden: {},
        visible: {
            transition: {
                staggerChildren: stagger,
                delayChildren: delay,
            },
        },
    };

    const itemVariants = {
        hidden: selectedVariant.item.hidden,
        visible: {
            ...selectedVariant.item.visible,
            transition: {
                duration: duration,
                ease: "easeOut",
            },
        },
    };

    return (
        <motion.span
            className={cn("inline-flex flex-wrap", className)}
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            {...props}
        >
            {items.map((item, idx) => (
                <motion.span
                    key={idx}
                    variants={itemVariants}
                    className="inline-block"
                    style={{ whiteSpace: "pre" }}
                >
                    {item}
                    {type === "word" && idx < items.length - 1 ? " " : ""}
                </motion.span>
            ))}
        </motion.span>
    );
}
