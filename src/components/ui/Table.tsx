export function Table({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className="overflow-auto rounded-md border border-gray-200">
      <table className={("min-w-full divide-y divide-gray-200 ") + (className || "")}>{children}</table>
    </div>
  );
}

export function THead({ children }: { children: React.ReactNode }) {
  return (
    <thead className="bg-gray-50 text-center text-xs font-medium uppercase tracking-wider text-gray-600">
      {children}
    </thead>
  );
}

export function TBody({ children }: { children: React.ReactNode }) {
  return <tbody className="divide-y divide-gray-200 bg-white text-xs sm:text-sm text-gray-900 text-center">{children}</tbody>;
}


