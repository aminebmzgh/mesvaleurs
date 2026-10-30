import { ImageResponse } from "next/og";

/** Icônes de l'application installée (manifeste, écran d'accueil iOS). */
const ICONS = {
  "icon-192.png": { size: 192, maskable: false },
  "icon-512.png": { size: 512, maskable: false },
  "maskable-512.png": { size: 512, maskable: true },
  "apple-touch-icon.png": { size: 180, maskable: true },
} as const;

type IconName = keyof typeof ICONS;

export function generateStaticParams() {
  return Object.keys(ICONS).map((name) => ({ name }));
}

export async function GET(_request: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  if (!Object.hasOwn(ICONS, name)) {
    return new Response("Introuvable", { status: 404 });
  }
  const { size, maskable } = ICONS[name as IconName];
  // Icône « maskable » : fond plein jusqu'au bord, pictogramme dans la zone sûre (80 %)
  const glyph = Math.round(size * (maskable ? 0.5 : 0.56));
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: maskable ? "#171717" : "transparent",
      }}
    >
      <div
        style={{
          width: maskable ? "100%" : "88%",
          height: maskable ? "100%" : "88%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#171717",
          borderRadius: maskable ? 0 : size * 0.2,
        }}
      >
        <svg width={glyph} height={glyph} viewBox="0 0 24 24" fill="none" stroke="#fafafa" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z" />
          <path d="M14 8H8" />
          <path d="M16 12H8" />
          <path d="M13 16H8" />
        </svg>
      </div>
    </div>,
    { width: size, height: size },
  );
}
