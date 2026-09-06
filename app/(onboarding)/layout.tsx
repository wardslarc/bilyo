export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col justify-center items-center p-4 sm:p-6 bg-[var(--color-paper)]">
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
