export function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={("rounded-2xl border border-gray-200 bg-white shadow-sm ") + (className || "")}>{children}</div>;
}

export function CardHeader({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={("border-b border-gray-200 p-3 sm:p-4 ") + (className || "")}>{children}</div>;
}

export function CardBody({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={("p-3 sm:p-4 ") + (className || "")}>{children}</div>;
}

export function CardFooter({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={("border-t border-gray-200 p-3 sm:p-4 ") + (className || "")}>{children}</div>;
}
