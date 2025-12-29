"use client";

import React from "react";

type ModalSize = 'sm' | 'md' | 'lg' | 'xl'

export default function Modal({ open, onClose, title, children, footer, size = 'md' }: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: ModalSize;
}) {
  if (!open) return null;
  const sizeClass = size === 'sm' ? 'max-w-md' : size === 'lg' ? 'max-w-3xl' : size === 'xl' ? 'max-w-5xl' : 'max-w-lg'
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className={`relative w-full ${sizeClass} mx-auto my-8 rounded-2xl border border-gray-200 bg-white shadow-sm max-h-[calc(100vh-4rem)] flex flex-col overflow-hidden`}>
        {title ? (
          <div className="border-b border-gray-200 p-4 bg-gradient-to-r from-[hsl(var(--primary))/0.10] to-[hsl(var(--page-bg))]/60">
            <h2 className="text-2xl font-extrabold tracking-tight text-gray-900">{title}</h2>
          </div>
        ) : null}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 pr-2 sm:pr-3 bg-[hsl(var(--page-bg))]/30">{children}</div>
        {footer ? <div className="shrink-0 border-t border-gray-200 p-3 sm:p-4 bg-[hsl(var(--page-bg))]/30">{footer}</div> : null}
      </div>
    </div>
  );
}



