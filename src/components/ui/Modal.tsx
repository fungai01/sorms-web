"use client";

import React from "react";

type ModalSize = 'sm' | 'md' | 'lg' | 'xl'

export default function Modal({ open, onClose, title, children, footer, size = 'md' }: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: ModalSize;
}) {
  if (!open) return null;
  const sizeClass = size === 'sm' ? 'max-w-md' : size === 'lg' ? 'max-w-3xl' : size === 'xl' ? 'max-w-5xl' : 'max-w-lg'
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className={`relative w-full ${sizeClass} mx-auto my-8 rounded-2xl bg-white border border-gray-200 shadow-xl max-h-[calc(100vh-4rem)] flex flex-col`}>
        <div className="border-b border-gray-200 bg-gray-50 px-5 py-3 rounded-t-2xl">
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        </div>
        <div className="p-4 overflow-y-auto bg-white">{children}</div>
        {footer ? <div className="border-t border-gray-200 bg-gray-50 px-4 py-3 rounded-b-2xl">{footer}</div> : null}
      </div>
    </div>
  );
}



