import Link from 'next/link';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[var(--color-paper)] flex flex-col justify-between p-4 sm:p-6 lg:p-8">
      <header className="max-w-md w-full mx-auto pt-6 sm:pt-10 flex justify-center">
        <Link href="/" className="flex items-center gap-2 group">
          <span className="font-mono text-xl font-bold tracking-tight text-[var(--color-ink)] group-hover:text-[var(--color-brass)] transition-colors">
            Bilyo<span className="text-[var(--color-brass)]">app.com</span>
          </span>
        </Link>
      </header>

      <main className="w-full max-w-md mx-auto my-auto py-6">{children}</main>

      <footer className="text-center text-xs text-[var(--color-faint)] pb-4">
        &copy; {new Date().getFullYear()} Bilyo. Quotations for Philippine service businesses.
      </footer>
    </div>
  );
}
