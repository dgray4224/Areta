import { Logo } from "@/platform/ui/Logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-neutral-50 dark:bg-neutral-950">
      <Logo size={28} />
      {children}
    </div>
  );
}
