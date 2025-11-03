export function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={("rounded-md border border-gray-200 bg-white ") + (className || "")}>{children}</div>;
}

export function CardHeader({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={("border-b border-gray-200 px-3 sm:px-4 py-2 sm:py-3 ") + (className || "")}>{children}</div>;
}

export function CardBody({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={("p-3 sm:p-4 ") + (className || "")}>{children}</div>;
}


