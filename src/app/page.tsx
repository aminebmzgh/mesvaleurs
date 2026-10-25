import { redirect } from "next/navigation";

// La racine est redirigée par le proxy selon la session ; ceci est une sécurité.
export default function HomePage() {
  redirect("/tableau-de-bord");
}
