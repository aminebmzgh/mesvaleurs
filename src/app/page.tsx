import {
  ArrowRightIcon,
  BanknoteIcon,
  CheckIcon,
  LandmarkIcon,
  PrinterIcon,
  ScaleIcon,
  ShieldCheckIcon,
  SparklesIcon,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { BrandMark } from "@/components/brand";
import { FeatureComparison, PlanCards } from "@/components/pricing-table";
import { SiteFooter } from "@/components/site-footer";
import { buttonVariants } from "@/components/ui/button";
import { PLANS, SALES_EMAIL, TRIAL_DAYS, TRIAL_PLAN } from "@/lib/billing/plans";
import { appConfig } from "@/lib/config";
import { cn } from "@/lib/utils";

// Les visiteurs connectés sont envoyés vers leur tableau de bord par le proxy.
export const metadata: Metadata = {
  title: { absolute: `${appConfig.name} · Chèques et LCN des entreprises marocaines` },
  description: `Émettez, imprimez et suivez vos chèques et LCN jusqu'à l'encaissement : rapprochement bancaire, impayés, délais de paiement. Essai gratuit de ${TRIAL_DAYS} jours.`,
  alternates: { canonical: "/" },
};

const SIGNUP = "/inscription";

const FEATURES = [
  {
    icon: PrinterIcon,
    title: "Paiements et impression",
    text: "Préparez vos chèques, LCN et virements, puis imprimez-les sur les formules de votre banque, sans ressaisie.",
  },
  {
    icon: BanknoteIcon,
    title: "Encaissements et remises",
    text: "Suivez les valeurs reçues, préparez vos bordereaux de remise et sachez ce qui reste à encaisser.",
  },
  {
    icon: LandmarkIcon,
    title: "Rapprochement bancaire",
    text: "Importez vos relevés (Excel, CSV, PDF ou par e-mail) : chaque opération est rapprochée de son paiement.",
  },
  {
    icon: ScaleIcon,
    title: "Impayés et délais de paiement",
    text: "Rejets et oppositions selon la loi 71-24, délais et pénalités de la loi 69-21 : les échéances sont suivies pour vous.",
  },
  {
    icon: SparklesIcon,
    title: "Assistant IA",
    text: "Lecture automatique des factures et relevés, réponses à vos questions et points d'attention du mois.",
  },
  {
    icon: ShieldCheckIcon,
    title: "Sécurité",
    text: "Double authentification, double signature avec plafonds, journal d'audit et données hébergées en Europe.",
  },
] as const;

const FAQ = [
  {
    question: "Que se passe-t-il après l'essai ?",
    answer: `Pendant ${TRIAL_DAYS} jours, toutes les fonctionnalités de l'offre ${PLANS[TRIAL_PLAN].label} sont ouvertes, sans carte bancaire. Ensuite, votre entreprise passe à l'offre Gratuit, sans perte de données : rien n'est supprimé, seuls les ajouts au-delà des limites sont bloqués.`,
  },
  {
    question: "Puis-je changer d'offre ?",
    answer: "Oui, à tout moment, à la hausse comme à la baisse. Vos données sont conservées quelle que soit l'offre.",
  },
  {
    question: "Mes données sont-elles en sécurité ?",
    answer:
      "Les données de chaque entreprise sont isolées et hébergées dans l'Union européenne (Paris). La double authentification, les rôles et le journal d'audit protègent les accès. Aucune donnée n'est revendue.",
  },
  {
    question: "Comment payer mon abonnement ?",
    answer: `Le paiement en ligne arrive bientôt. D'ici là, écrivez-nous à ${SALES_EMAIL} pour souscrire une offre payante.`,
  },
  {
    question: "Quelles banques sont prises en charge ?",
    answer:
      "Les formules de chèques et de LCN des banques marocaines s'impriment grâce à des modèles ajustables avec un éditeur visuel. Les relevés s'importent quel que soit votre établissement.",
  },
] as const;

export default function HomePage() {
  return (
    <div className="flex min-h-svh flex-col">
      <header className="sticky top-0 z-10 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
          <Link href="/" aria-label={`${appConfig.name}, accueil`}>
            <BrandMark />
          </Link>
          <nav aria-label="Navigation principale" className="flex items-center gap-1 sm:gap-2">
            <a href="#fonctionnalites" className={cn(buttonVariants({ variant: "ghost" }), "hidden md:inline-flex")}>
              Fonctionnalités
            </a>
            <a href="#tarifs" className={cn(buttonVariants({ variant: "ghost" }), "hidden md:inline-flex")}>
              Tarifs
            </a>
            <Link href="/connexion" className={buttonVariants({ variant: "ghost" })}>
              Se connecter
            </Link>
            <Link href={SIGNUP} className={cn(buttonVariants(), "hidden sm:inline-flex")}>
              Essai gratuit
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <section className="border-b bg-muted/30">
          <div className="mx-auto flex max-w-4xl flex-col items-center gap-6 px-4 py-20 text-center sm:py-28">
            <p className="rounded-full border bg-background px-3 py-1 text-xs font-medium text-muted-foreground">
              Pour les entreprises marocaines
            </p>
            <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
              Vos chèques et effets, maîtrisés de l&apos;émission à l&apos;encaissement
            </h1>
            <p className="max-w-2xl text-lg text-pretty text-muted-foreground">
              {appConfig.name} prépare, imprime et suit vos chèques et LCN, rapproche vos relevés bancaires et vous
              alerte avant chaque échéance.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link href={SIGNUP} className={buttonVariants({ size: "lg" })}>
                Commencer l&apos;essai gratuit
                <ArrowRightIcon aria-hidden />
              </Link>
              <a href="#tarifs" className={buttonVariants({ size: "lg", variant: "outline" })}>
                Voir les tarifs
              </a>
            </div>
            <ul className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
              {[`${TRIAL_DAYS} jours d'essai de l'offre ${PLANS[TRIAL_PLAN].label}`, "Sans carte bancaire", "Données hébergées en Europe"].map(
                (item) => (
                  <li key={item} className="flex items-center gap-1.5">
                    <CheckIcon className="size-4 text-primary" aria-hidden />
                    {item}
                  </li>
                ),
              )}
            </ul>
          </div>
        </section>

        <section id="fonctionnalites" className="scroll-mt-16">
          <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-20">
            <div className="flex max-w-2xl flex-col gap-3">
              <h2 className="text-3xl font-semibold tracking-tight">Tout le cycle de vos règlements</h2>
              <p className="text-muted-foreground">
                De la facture fournisseur au relevé bancaire, chaque étape est suivie au même endroit, pour toute
                l&apos;équipe.
              </p>
            </div>
            <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map(({ icon: Icon, title, text }) => (
                <li key={title} className="flex flex-col gap-3 rounded-xl border p-6">
                  <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <h3 className="font-semibold">{title}</h3>
                  <p className="text-sm text-muted-foreground">{text}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="tarifs" className="scroll-mt-16 border-y bg-muted/30">
          <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-20">
            <div className="flex max-w-2xl flex-col gap-3">
              <h2 className="text-3xl font-semibold tracking-tight">Tarifs</h2>
              <p className="text-muted-foreground">
                Prix hors taxes. Paiement annuel : 2 mois offerts. Chaque nouvelle entreprise profite de {TRIAL_DAYS}{" "}
                jours d&apos;essai de l&apos;offre {PLANS[TRIAL_PLAN].label}.
              </p>
            </div>
            <PlanCards
              footer={(plan) => (
                <Link
                  href={SIGNUP}
                  className={cn(buttonVariants({ variant: plan === "business" ? "default" : "outline" }), "w-full")}
                >
                  {plan === "free" ? "Commencer gratuitement" : "Essayer gratuitement"}
                </Link>
              )}
            />
            <div className="flex flex-col gap-4">
              <h3 className="text-xl font-semibold">Comparatif détaillé</h3>
              <div className="bg-background">
                <FeatureComparison />
              </div>
            </div>
          </div>
        </section>

        <section id="questions" className="scroll-mt-16">
          <div className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-20">
            <h2 className="text-3xl font-semibold tracking-tight">Questions fréquentes</h2>
            <div className="flex flex-col divide-y rounded-xl border">
              {FAQ.map(({ question, answer }) => (
                <details key={question} className="group px-5 py-4">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium [&::-webkit-details-marker]:hidden">
                    {question}
                    <span aria-hidden className="text-muted-foreground transition-transform group-open:rotate-45">
                      +
                    </span>
                  </summary>
                  <p className="pt-3 text-sm text-muted-foreground">{answer}</p>
                </details>
              ))}
            </div>
            <div className="flex flex-col items-center gap-4 rounded-xl bg-primary px-6 py-10 text-center text-primary-foreground">
              <h2 className="text-2xl font-semibold">Prêt à reprendre la main sur vos règlements ?</h2>
              <Link href={SIGNUP} className={buttonVariants({ size: "lg", variant: "secondary" })}>
                Commencer l&apos;essai gratuit
                <ArrowRightIcon aria-hidden />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
