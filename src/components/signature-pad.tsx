"use client";

import { EraserIcon } from "lucide-react";
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

export type SignaturePadHandle = {
  isEmpty: () => boolean;
  /** Signature en PNG (trait noir sur fond transparent), à la taille de l'écran. */
  toBlob: () => Promise<Blob | null>;
  clear: () => void;
};

/**
 * Zone de signature au doigt, au stylet ou à la souris (événements pointeur). Le tracé
 * suit la taille affichée : le canevas est redimensionné à la densité de l'écran.
 */
export const SignaturePad = forwardRef<SignaturePadHandle, { label: string; onChange?: (empty: boolean) => void }>(function SignaturePad(
  { label, onChange },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const strokes = useRef(0);
  const [empty, setEmpty] = useState(true);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const resize = () => {
      const ratio = window.devicePixelRatio || 1;
      const { width, height } = canvas.getBoundingClientRect();
      const [targetWidth, targetHeight] = [Math.round(width * ratio), Math.round(height * ratio)];
      // Premier appel de l'observateur, parfois après le début de la signature : rien n'a changé
      if (canvas.width === targetWidth && canvas.height === targetHeight) {
        return;
      }
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const context = canvas.getContext("2d")!;
      context.scale(ratio, ratio);
      context.lineWidth = 2.2;
      context.lineCap = "round";
      context.lineJoin = "round";
      context.strokeStyle = "#111827";
      // Redimensionner efface le tracé
      strokes.current = 0;
      setEmpty(true);
      onChange?.(true);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [onChange]);

  const point = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const clear = () => {
    const canvas = canvasRef.current!;
    canvas.getContext("2d")!.clearRect(0, 0, canvas.width, canvas.height);
    strokes.current = 0;
    setEmpty(true);
    onChange?.(true);
  };

  useImperativeHandle(ref, () => ({
    isEmpty: () => strokes.current === 0,
    toBlob: () => new Promise((resolve) => canvasRef.current!.toBlob(resolve, "image/png")),
    clear,
  }));

  return (
    <div className="flex flex-col gap-2">
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={label}
        className="h-48 w-full touch-none rounded-md border-2 border-dashed bg-white sm:h-56"
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          drawing.current = true;
          const context = event.currentTarget.getContext("2d")!;
          const { x, y } = point(event);
          context.beginPath();
          context.moveTo(x, y);
          // Un simple appui laisse un point
          context.lineTo(x + 0.1, y + 0.1);
          context.stroke();
        }}
        onPointerMove={(event) => {
          if (!drawing.current) {
            return;
          }
          const context = event.currentTarget.getContext("2d")!;
          const { x, y } = point(event);
          context.lineTo(x, y);
          context.stroke();
        }}
        onPointerUp={() => {
          if (drawing.current) {
            drawing.current = false;
            strokes.current += 1;
            if (empty) {
              setEmpty(false);
              onChange?.(false);
            }
          }
        }}
        onPointerCancel={() => {
          drawing.current = false;
        }}
      />
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>Signez dans le cadre, au doigt, au stylet ou à la souris.</span>
        <Button type="button" variant="ghost" size="sm" onClick={clear} disabled={empty}>
          <EraserIcon aria-hidden />
          Effacer
        </Button>
      </div>
    </div>
  );
});
