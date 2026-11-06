import Link from "next/link";
import { BrandMark } from "@/components/brand";
import { SiteFooter } from "@/components/site-footer";

export default function LegalLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-svh flex-col">
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-10">
        <Link href="/" className="self-start">
          <BrandMark />
        </Link>
        <article className="flex flex-col gap-4 text-sm leading-relaxed [&_a]:underline [&_h1]:text-2xl [&_h1]:font-semibold [&_h2]:mt-4 [&_h2]:text-lg [&_h2]:font-medium [&_ul]:flex [&_ul]:list-disc [&_ul]:flex-col [&_ul]:gap-1 [&_ul]:pl-5">
          {children}
        </article>
      </div>
      <SiteFooter />
    </div>
  );
}
