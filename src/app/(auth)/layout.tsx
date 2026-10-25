import Link from "next/link";
import { BrandMark } from "@/components/brand";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted/40 px-4 py-10">
      <BrandMark />
      <main className="w-full max-w-sm">{children}</main>
      <footer className="flex gap-4 text-xs text-muted-foreground">
        <Link href="/mentions-legales" className="hover:underline">
          Mentions légales
        </Link>
        <Link href="/confidentialite" className="hover:underline">
          Confidentialité
        </Link>
      </footer>
    </div>
  );
}
