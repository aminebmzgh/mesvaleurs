"use client";

import { ImageIcon, Loader2Icon, MinusIcon, PlusIcon, PrinterIcon, SaveIcon, Trash2Icon } from "lucide-react";
import { type KeyboardEvent, type PointerEvent, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PRINT_FIELD_LABELS, PRINT_FIELDS, type PrintField, type PrintZone } from "@/lib/printing/fields";
import { crossingSegments, layoutInstrument, type PrintData } from "@/lib/printing/layout";
import { measureFor } from "@/lib/printing/measure";
import { BACKGROUND_MAX_BYTES, BACKGROUND_MIME_TYPES, backgroundPath, type TemplateInput } from "@/lib/printing/schemas";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { deleteTemplate, saveTemplate, setTemplateBackground } from "../actions";

const PT_TO_MM = 25.4 / 72;
const ZOOMS = [2, 3, 4, 5, 6];
const round = (value: number) => Math.round(value * 10) / 10;

type Drag = { index: number; mode: "move" | "resize"; startX: number; startY: number; zone: PrintZone };

export function TemplateEditor({
  templateId,
  organizationId,
  type,
  initial,
  backgroundUrl,
  sample,
}: {
  templateId: string;
  organizationId: string;
  type: "check" | "lcn";
  initial: TemplateInput;
  backgroundUrl: string | null;
  sample: PrintData;
}) {
  const [draft, setDraft] = useState(initial);
  const [dirty, setDirty] = useState(false);
  const [selected, setSelected] = useState<number | null>(0);
  const [zoom, setZoom] = useState(4);
  const [pending, startTransition] = useTransition();
  const drag = useRef<Drag | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  // Mêmes métriques que le PDF : l'aperçu coupe les lignes comme l'impression
  const measure = useMemo(() => measureFor(draft.options.font), [draft.options.font]);

  const update = (changes: Partial<TemplateInput>) => {
    setDraft((current) => ({ ...current, ...changes }));
    setDirty(true);
  };
  const updateZone = (index: number, changes: Partial<PrintZone>) =>
    update({ zones: draft.zones.map((zone, i) => (i === index ? { ...zone, ...changes } : zone)) });

  const preview = useMemo(
    () => layoutInstrument(sample, draft.zones, draft.options, measure),
    [sample, draft.zones, draft.options, measure],
  );
  const zone = selected !== null ? draft.zones[selected] : undefined;
  const unusedFields = PRINT_FIELDS.filter((field) => !draft.zones.some((z) => z.field === field));

  // Déplacement et redimensionnement à la souris
  const onPointerDown = (event: PointerEvent, index: number, mode: Drag["mode"]) => {
    event.preventDefault();
    event.stopPropagation();
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    setSelected(index);
    drag.current = { index, mode, startX: event.clientX, startY: event.clientY, zone: draft.zones[index] };
  };
  const onPointerMove = (event: PointerEvent) => {
    const current = drag.current;
    if (!current) {
      return;
    }
    const dx = (event.clientX - current.startX) / zoom;
    const dy = (event.clientY - current.startY) / zoom;
    if (current.mode === "move") {
      updateZone(current.index, {
        x: round(Math.min(Math.max(current.zone.x + dx, 0), draft.widthMm - current.zone.width)),
        y: round(Math.min(Math.max(current.zone.y + dy, 1), draft.heightMm)),
      });
    } else {
      updateZone(current.index, { width: round(Math.min(Math.max(current.zone.width + dx, 5), draft.widthMm - current.zone.x)) });
    }
  };
  const onPointerUp = () => {
    drag.current = null;
  };

  // Réglage fin au clavier : flèches 0,5 mm, Maj + flèches 0,1 mm
  const onKeyDown = (event: KeyboardEvent) => {
    if (selected === null || !zone) {
      return;
    }
    const step = event.shiftKey ? 0.1 : 0.5;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const move = moves[event.key];
    if (move) {
      event.preventDefault();
      updateZone(selected, { x: round(Math.max(zone.x + move[0], 0)), y: round(Math.max(zone.y + move[1], 1)) });
    }
  };

  const save = () =>
    startTransition(async () => {
      const result = await saveTemplate(templateId, draft);
      if (result.error) {
        toast.error(result.error);
      } else {
        setDirty(false);
        toast.success("Modèle enregistré.");
      }
    });

  const uploadBackground = (file: File) => {
    if (!(BACKGROUND_MIME_TYPES as readonly string[]).includes(file.type)) {
      toast.error("Format non accepté : JPEG ou PNG.");
      return;
    }
    if (file.size > BACKGROUND_MAX_BYTES) {
      toast.error("Fichier trop volumineux : 10 Mo maximum.");
      return;
    }
    startTransition(async () => {
      const path = backgroundPath(organizationId, templateId, file.type, crypto.randomUUID());
      const { error } = await createClient().storage.from("modeles-impression").upload(path, file, { contentType: file.type });
      if (error) {
        toast.error("L'envoi du scan a échoué.");
        return;
      }
      const result = await setTemplateBackground(templateId, path);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Scan de la formule enregistré.");
      }
    });
  };

  const numberInput = (label: string, value: number, onChange: (v: number) => void, props: { min?: number; max?: number; step?: number } = {}) => {
    // Identifiant dérivé du libellé : relie le champ à son libellé (accessibilité)
    const id = `num-${label.normalize("NFD").replace(/[^A-Za-z0-9]+/g, "-").toLowerCase()}`;
    return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        id={id}
        type="number"
        value={value}
        step={props.step ?? 0.1}
        min={props.min}
        max={props.max}
        onChange={(event) => {
          const next = Number(event.target.value);
          if (Number.isFinite(next)) {
            onChange(round(next));
          }
        }}
      />
    </Field>
    );
  };

  return (
    <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_22rem]">
      <Card>
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle>{draft.name}</CardTitle>
            <CardDescription>
              {draft.widthMm} × {draft.heightMm} mm · cliquez une zone puis déplacez-la, ou utilisez les flèches du clavier.
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="icon-sm" aria-label="Zoom arrière" disabled={zoom === ZOOMS[0]} onClick={() => setZoom(ZOOMS[ZOOMS.indexOf(zoom) - 1])}>
              <MinusIcon aria-hidden />
            </Button>
            <Button variant="outline" size="icon-sm" aria-label="Zoom avant" disabled={zoom === ZOOMS.at(-1)} onClick={() => setZoom(ZOOMS[ZOOMS.indexOf(zoom) + 1])}>
              <PlusIcon aria-hidden />
            </Button>
            <input
              ref={fileInput}
              type="file"
              accept={BACKGROUND_MIME_TYPES.join(",")}
              className="sr-only"
              aria-label="Choisir le scan de la formule"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) {
                  uploadBackground(file);
                }
              }}
            />
            <Button variant="outline" size="sm" disabled={pending} onClick={() => fileInput.current?.click()}>
              <ImageIcon aria-hidden />
              {backgroundUrl ? "Remplacer le scan" : "Importer le scan de la formule"}
            </Button>
            <Button size="sm" disabled={pending || !dirty} onClick={save}>
              {pending ? <Loader2Icon className="animate-spin" aria-hidden /> : <SaveIcon aria-hidden />}
              Enregistrer
            </Button>
            <a
              href={dirty ? undefined : `/comptes-bancaires/modeles/${templateId}/test`}
              target="_blank"
              rel="noopener"
              aria-disabled={dirty}
              title={dirty ? "Enregistrez avant l'impression test" : undefined}
              className={buttonVariants({ variant: "secondary", size: "sm", className: dirty ? "pointer-events-none opacity-50" : "" })}
            >
              <PrinterIcon aria-hidden />
              Impression test
            </a>
          </div>
        </CardHeader>
        <CardContent className="overflow-auto">
          <div
            role="application"
            aria-label="Éditeur de la formule"
            tabIndex={0}
            onKeyDown={onKeyDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerDown={() => setSelected(null)}
            className="relative select-none rounded-sm border bg-white outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            style={{
              width: draft.widthMm * zoom,
              height: draft.heightMm * zoom,
              backgroundImage: backgroundUrl ? `url("${backgroundUrl}")` : undefined,
              backgroundSize: "100% 100%",
            }}
          >
            {!backgroundUrl && (
              <p className="absolute inset-x-0 bottom-2 text-center text-xs text-neutral-400">
                Importez le scan de la formule pour placer les zones précisément.
              </p>
            )}
            {draft.zones.map((z, index) => {
              // Barrement : zone tracée (deux traits obliques), sa hauteur suit sa largeur
              const crossing = z.field === "crossing";
              const heightMm = crossing ? z.width * 0.35 : z.fontSize * PT_TO_MM;
              const placed = preview.texts.find((t) => t.zone === z);
              const overflowing = preview.overflow.includes(z.field);
              return (
                <div
                  key={`${z.field}-${index}`}
                  onPointerDown={(event) => onPointerDown(event, index, "move")}
                  className={cn(
                    "absolute cursor-move border border-dashed",
                    index === selected ? "border-blue-600 bg-blue-500/10" : "border-blue-400/60 hover:bg-blue-500/5",
                    overflowing && "border-red-500",
                  )}
                  style={{
                    left: (z.x + draft.offsetXMm) * zoom,
                    top: (z.y + draft.offsetYMm - heightMm) * zoom,
                    width: z.width * zoom,
                    height: heightMm * zoom * (crossing ? 1 : 1.15),
                  }}
                  title={PRINT_FIELD_LABELS[z.field]}
                >
                  {crossing && (
                    <svg className="pointer-events-none absolute inset-0 size-full overflow-visible" aria-hidden>
                      {crossingSegments(z).map((segment, i) => (
                        <line
                          key={i}
                          x1={(segment.x1 - z.x) * zoom}
                          y1={(segment.y1 - z.y + heightMm) * zoom}
                          x2={(segment.x2 - z.x) * zoom}
                          y2={(segment.y2 - z.y + heightMm) * zoom}
                          stroke="#b91c1c"
                          strokeWidth={1.5}
                        />
                      ))}
                    </svg>
                  )}
                  <span
                    className="pointer-events-none absolute bottom-0 whitespace-nowrap leading-none text-red-700"
                    style={{
                      fontFamily: draft.options.font === "courier" ? "Courier New, monospace" : "Helvetica, Arial, sans-serif",
                      fontSize: (placed?.fontSize ?? z.fontSize) * PT_TO_MM * zoom,
                      left: z.align === "left" ? 0 : undefined,
                      right: z.align === "right" ? 0 : undefined,
                      width: z.align === "center" ? "100%" : undefined,
                      textAlign: z.align,
                    }}
                  >
                    {placed?.text ?? ""}
                  </span>
                  <span
                    onPointerDown={(event) => onPointerDown(event, index, "resize")}
                    className="absolute -right-1 top-0 h-full w-2 cursor-ew-resize"
                    aria-hidden
                  />
                </div>
              );
            })}
          </div>
          {preview.overflow.length > 0 && (
            <p className="mt-2 text-sm text-destructive">
              Texte trop long, même réduit : {preview.overflow.map((f) => PRINT_FIELD_LABELS[f]).join(", ")}. Élargissez la zone.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-col gap-4">
        <Card size="sm">
          <CardHeader>
            <CardTitle>Zone sélectionnée</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {zone && selected !== null ? (
              <>
                <p className="font-medium">{PRINT_FIELD_LABELS[zone.field]}</p>
                <div className="grid grid-cols-2 gap-3">
                  {numberInput("X (mm)", zone.x, (x) => updateZone(selected, { x }), { min: 0 })}
                  {numberInput("Ligne de base Y (mm)", zone.y, (y) => updateZone(selected, { y }), { min: 1 })}
                  {numberInput("Largeur de la zone (mm)", zone.width, (width) => updateZone(selected, { width }), { min: 5 })}
                  {numberInput("Taille (pt)", zone.fontSize, (fontSize) => updateZone(selected, { fontSize }), { min: 5, max: 24, step: 0.5 })}
                </div>
                <Field>
                  <FieldLabel htmlFor="zone-align">Alignement</FieldLabel>
                  <select
                    id="zone-align"
                    className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
                    value={zone.align}
                    onChange={(event) => updateZone(selected, { align: event.target.value as PrintZone["align"] })}
                  >
                    <option value="left">Gauche</option>
                    <option value="center">Centre</option>
                    <option value="right">Droite</option>
                  </select>
                </Field>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-fit"
                  onClick={() => {
                    update({ zones: draft.zones.filter((_, i) => i !== selected) });
                    setSelected(null);
                  }}
                >
                  <Trash2Icon aria-hidden />
                  Retirer cette zone
                </Button>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Cliquez une zone sur la formule.</p>
            )}
            {unusedFields.length > 0 && (
              <Field>
                <FieldLabel htmlFor="add-zone">Ajouter une zone</FieldLabel>
                <select
                  id="add-zone"
                  className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
                  value=""
                  onChange={(event) => {
                    const field = event.target.value as PrintField;
                    if (!field) {
                      return;
                    }
                    update({ zones: [...draft.zones, { field, x: 10, y: 15, width: 60, fontSize: 10, align: "left" }] });
                    setSelected(draft.zones.length);
                  }}
                >
                  <option value="">Choisir…</option>
                  {unusedFields.map((field) => (
                    <option key={field} value={field}>
                      {PRINT_FIELD_LABELS[field]}
                    </option>
                  ))}
                </select>
              </Field>
            )}
          </CardContent>
        </Card>

        <Card size="sm">
          <CardHeader>
            <CardTitle>Formule et imprimante</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Field>
              <FieldLabel htmlFor="template-name">Nom du modèle</FieldLabel>
              <Input id="template-name" value={draft.name} maxLength={120} onChange={(event) => update({ name: event.target.value })} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              {numberInput("Largeur de la formule (mm)", draft.widthMm, (widthMm) => update({ widthMm }), { min: 50, max: 300 })}
              {numberInput("Hauteur de la formule (mm)", draft.heightMm, (heightMm) => update({ heightMm }), { min: 30, max: 300 })}
              {numberInput("Décalage X (mm)", draft.offsetXMm, (offsetXMm) => update({ offsetXMm }), { min: -30, max: 30 })}
              {numberInput("Décalage Y (mm)", draft.offsetYMm, (offsetYMm) => update({ offsetYMm }), { min: -30, max: 30 })}
            </div>
            <FieldDescription>
              Le décalage déplace toutes les zones d&apos;un bloc pour compenser votre imprimante : positif vers la droite et
              vers le bas.
            </FieldDescription>
            <Field>
              <FieldLabel htmlFor="amount-frame">Encadrement du montant en chiffres</FieldLabel>
              <select
                id="amount-frame"
                className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
                value={draft.options.amountFrame}
                onChange={(event) => update({ options: { ...draft.options, amountFrame: event.target.value as "#" | "*" | "none" } })}
              >
                <option value="#">#1 234,56#</option>
                <option value="*">*1 234,56*</option>
                <option value="none">Aucun</option>
              </select>
            </Field>
            <Field>
              <FieldLabel htmlFor="font">Police</FieldLabel>
              <select
                id="font"
                className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
                value={draft.options.font}
                onChange={(event) => update({ options: { ...draft.options, font: event.target.value as "helvetica" | "courier" } })}
              >
                <option value="helvetica">Helvetica</option>
                <option value="courier">Courier (chasse fixe)</option>
              </select>
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4 accent-primary"
                checked={draft.options.uppercase}
                onChange={(event) => update({ options: { ...draft.options, uppercase: event.target.checked } })}
              />
              Tout en majuscules
            </label>
          </CardContent>
        </Card>

        <Button
          variant="ghost"
          className="w-fit text-destructive"
          disabled={pending}
          onClick={() => {
            if (window.confirm(`Supprimer ce modèle ? Les ${type === "check" ? "chéquiers" : "carnets"} qui l'utilisent reviendront au modèle par défaut de leur banque.`)) {
              startTransition(async () => {
                const result = await deleteTemplate(templateId);
                if (result?.error) {
                  toast.error(result.error);
                }
              });
            }
          }}
        >
          <Trash2Icon aria-hidden />
          Supprimer le modèle
        </Button>
      </div>
    </div>
  );
}
