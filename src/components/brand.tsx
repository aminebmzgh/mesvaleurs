import { ReceiptTextIcon } from "lucide-react";
import { appConfig } from "@/lib/config";

/** Logo et nom de l'application. */
export function BrandMark() {
  return (
    <div className="flex items-center gap-2 font-semibold">
      <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <ReceiptTextIcon className="size-4" aria-hidden />
      </span>
      <span className="text-lg">{appConfig.name}</span>
    </div>
  );
}
