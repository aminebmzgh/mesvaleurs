"use client";

import { RotateCwIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ReloadButton() {
  return (
    <Button variant="outline" onClick={() => window.location.reload()}>
      <RotateCwIcon aria-hidden />
      Réessayer
    </Button>
  );
}
