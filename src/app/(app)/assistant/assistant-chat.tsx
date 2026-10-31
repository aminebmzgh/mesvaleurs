"use client";

import { CircleAlertIcon, Loader2Icon, RotateCcwIcon, SendIcon, SparklesIcon } from "lucide-react";
import Link from "next/link";
import { Fragment, useState, useTransition } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { type Inline, parseMarkdown } from "@/lib/assistant/markdown";
import { MAX_QUESTION_LENGTH, type AssistantTurn } from "@/lib/assistant/run";
import { askAssistant } from "./actions";

const SUGGESTIONS = [
  "Quels chèques ne sont pas encore passés ?",
  "Quelles factures risquent une amende ce trimestre ?",
  "À quel fournisseur dois-je le plus ?",
  "Ma trésorerie tient-elle les 30 prochains jours ?",
];

function InlineContent({ parts }: { parts: Inline[] }) {
  return parts.map((part, index) =>
    part.type === "link" ? (
      <Link key={index} href={part.href} className="font-medium underline underline-offset-2">
        {part.text}
      </Link>
    ) : part.type === "strong" ? (
      <strong key={index}>{part.text}</strong>
    ) : (
      <Fragment key={index}>{part.text}</Fragment>
    ),
  );
}

/** Réponse de l'assistant : Markdown réduit rendu en éléments React. */
function Answer({ text }: { text: string }) {
  return (
    <div className="flex flex-col gap-2">
      {parseMarkdown(text).map((block, index) =>
        block.type === "paragraph" ? (
          <p key={index}>
            <InlineContent parts={block.content} />
          </p>
        ) : block.type === "table" ? (
          <div key={index} className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b">
                  {block.header.map((cell, i) => (
                    <th key={i} className="px-2 py-1 text-start font-medium">
                      <InlineContent parts={cell} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {block.rows.map((row, r) => (
                  <tr key={r} className="border-b last:border-0">
                    {row.map((cell, i) => (
                      <td key={i} className="px-2 py-1 tabular-nums">
                        <InlineContent parts={cell} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : block.ordered ? (
          <ol key={index} className="list-decimal ps-5">
            {block.items.map((item, i) => (
              <li key={i}>
                <InlineContent parts={item} />
              </li>
            ))}
          </ol>
        ) : (
          <ul key={index} className="list-disc ps-5">
            {block.items.map((item, i) => (
              <li key={i}>
                <InlineContent parts={item} />
              </li>
            ))}
          </ul>
        ),
      )}
    </div>
  );
}

export function AssistantChat({ quota, used: initialUsed }: { quota: number; used: number }) {
  const [turns, setTurns] = useState<AssistantTurn[]>([]);
  const [question, setQuestion] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [used, setUsed] = useState(initialUsed);
  const [pending, startTransition] = useTransition();
  const remaining = Math.max(0, quota - used);

  const ask = (text: string) => {
    const content = text.trim();
    if (!content || pending) {
      return;
    }
    const history: AssistantTurn[] = [...turns, { role: "user", content }];
    setTurns(history);
    setQuestion("");
    setError(null);
    startTransition(async () => {
      const reply = await askAssistant(history);
      if ("error" in reply) {
        setError(reply.error);
        // Question non traitée : rendue à l'utilisateur pour la reposer
        setTurns(turns);
        setQuestion(content);
        return;
      }
      setUsed(reply.usage.used);
      setTurns([...history, { role: "assistant", content: reply.answer }]);
    });
  };

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Réponses générées par IA à partir des données de votre entreprise : vérifiez-les avant de décider. Les questions partent vers un
        service situé hors du Maroc (e-mails, téléphones et RIB masqués) ; la conversation n&apos;est pas enregistrée. Questions et
        lectures restantes ce mois : {remaining} sur {quota}.
      </p>

      {turns.length === 0 && (
        <div className="flex flex-wrap gap-2">
          {SUGGESTIONS.map((suggestion) => (
            <Button key={suggestion} variant="outline" size="sm" disabled={pending || remaining === 0} onClick={() => ask(suggestion)}>
              {suggestion}
            </Button>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-3" role="log" aria-label="Conversation avec l'assistant" aria-live="polite">
        {turns.map((turn, index) =>
          turn.role === "user" ? (
            <div key={index} className="ms-auto max-w-[85%] rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground whitespace-pre-wrap">
              {turn.content}
            </div>
          ) : (
            <Card key={index} className="max-w-[95%] py-4" aria-label="Réponse de l'assistant">
              <CardContent className="flex gap-3 text-sm">
                <SparklesIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                <Answer text={turn.content} />
              </CardContent>
            </Card>
          ),
        )}
        {pending && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2Icon className="size-4 animate-spin" aria-hidden />
            L&apos;assistant consulte vos données…
          </p>
        )}
      </div>

      {error && (
        <Alert variant="destructive">
          <CircleAlertIcon aria-hidden />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <form
        className="flex flex-col gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          ask(question);
        }}
      >
        <label htmlFor="assistant-question" className="sr-only">
          Votre question
        </label>
        <Textarea
          id="assistant-question"
          rows={2}
          maxLength={MAX_QUESTION_LENGTH}
          placeholder="Posez votre question : « Combien je dois encore à Sotrama ? »"
          value={question}
          disabled={remaining === 0}
          onChange={(event) => setQuestion(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              ask(question);
            }
          }}
        />
        <div className="flex flex-wrap justify-end gap-2">
          {turns.length > 0 && (
            <Button type="button" variant="ghost" disabled={pending} onClick={() => setTurns([])}>
              <RotateCcwIcon aria-hidden />
              Nouvelle conversation
            </Button>
          )}
          <Button type="submit" disabled={pending || !question.trim() || remaining === 0}>
            {pending ? <Loader2Icon className="animate-spin" aria-hidden /> : <SendIcon aria-hidden />}
            Envoyer
          </Button>
        </div>
      </form>
    </div>
  );
}
