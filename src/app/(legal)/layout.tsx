import Link from "next/link";
import { BrandMark } from "@/components/brand";

export default function LegalLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="mx-auto flex min-h-svh max-w-3xl flex-col gap-8 px-4 py-10">
      <Link href="/">
        <BrandMark />
      </Link>
      <article className="flex flex-col gap-4 text-sm leading-relaxed [&_h1]:text-2xl [&_h1]:font-semibold [&_h2]:mt-4 [&_h2]:text-lg [&_h2]:font-medium">
        {children}
      </article>
    </div>
  );
}
