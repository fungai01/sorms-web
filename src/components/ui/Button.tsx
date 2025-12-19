import clsx from "clsx";
import React from "react";

type Variant = "primary" | "secondary" | "danger" | "ghost";

export default function Button({
  children,
  className,
  variant = "primary",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  const baseStyles = "inline-flex items-center justify-center gap-1 sm:gap-2 rounded-md px-2.5 sm:px-3.5 py-1.5 sm:py-2 text-xs sm:text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap";

  const styles: Record<Variant, string> = {
    primary:
      // Soft blue primary based on CSS variable (blue-400) with a slightly darker hover
      "bg-primary text-primary-foreground hover:bg-primary/90",
    secondary:
      "bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-input-border",
    danger:
      "bg-destructive text-destructive-foreground hover:bg-destructive/90",
    ghost:
      "bg-transparent hover:bg-accent hover:text-accent-foreground",
  };
  return (
    <button
      className={clsx(
        baseStyles,
        styles[variant],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

