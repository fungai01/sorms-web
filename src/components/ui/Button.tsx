import clsx from "clsx";
import React from "react";

type Variant = "primary" | "secondary" | "danger" | "ghost";

export default function Button({
  children,
  className,
  variant = "primary",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  const styles: Record<Variant, string> = {
    primary:
      "bg-gray-900 hover:bg-gray-800 text-white border border-gray-300",
    secondary:
      "bg-white hover:bg-gray-50 text-gray-900 border border-gray-300",
    danger:
      "bg-white hover:bg-gray-50 text-gray-900 border border-gray-300",
    ghost:
      "bg-transparent hover:bg-gray-50 text-gray-700 border-0",
  };
  return (
    <button
      className={clsx(
        "inline-flex items-center justify-center gap-1 sm:gap-2 rounded-md px-2.5 sm:px-3.5 py-1.5 sm:py-2 text-xs sm:text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
        styles[variant],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}




