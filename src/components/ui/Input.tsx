import React from "react";

export default function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={
        "block w-full rounded-md border border-gray-300 bg-white px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm text-gray-900 focus:border-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-400 " +
        (props.className || "")
      }
    />
  );
}




