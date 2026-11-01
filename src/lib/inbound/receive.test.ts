import { describe, expect, it, vi } from "vitest";
import { InboundError, receiveStatements, type ReceiveDeps } from "./receive";

const config = { apiKey: "re_test", domain: "import.mesvaleurs.ma" };

function fakeFetch(email: object, attachments: object[], files: Record<string, string> = {}) {
  return vi.fn<typeof fetch>(async (input) => {
    const url = String(input);
    if (url.endsWith("/attachments")) {
      return Response.json({ object: "list", data: attachments });
    }
    if (url.includes("/emails/receiving/")) {
      return Response.json(email);
    }
    return url in files ? new Response(files[url]) : new Response("introuvable", { status: 404 });
  });
}

const email = { id: "e1", from: "releves@banque.ma", to: ["releves-ab12cd34ef56@import.mesvaleurs.ma"], subject: "Relevé octobre" };
const csv = { id: "a1", filename: "releve.csv", size: 12, content_type: "text/csv", content_disposition: "attachment", download_url: "https://cdn/a1" };

describe("receiveStatements", () => {
  it("range chaque relevé joint dans la boîte de l'entreprise de l'adresse", async () => {
    const saveAttachment = vi.fn<ReceiveDeps["saveAttachment"]>(async () => {});
    const findOrganization = vi.fn(async (token: string) => (token === "ab12cd34ef56" ? "org-1" : null));
    const logo = { ...csv, id: "a2", filename: "logo.png", content_disposition: "inline", download_url: "https://cdn/a2" };
    const result = await receiveStatements("e1", {
      config,
      findOrganization,
      saveAttachment,
      fetchImpl: fakeFetch(email, [csv, logo], { "https://cdn/a1": "date;libellé" }),
    });
    expect(result).toEqual({ status: "saved", organizationId: "org-1", count: 1 });
    expect(saveAttachment).toHaveBeenCalledTimes(1);
    const [organizationId, meta, file] = saveAttachment.mock.calls[0];
    expect(organizationId).toBe("org-1");
    expect(meta).toEqual({ from: "releves@banque.ma", subject: "Relevé octobre" });
    expect(file).toMatchObject({ attachmentId: "a1", filename: "releve.csv", contentType: "text/csv", size: 13 });
  });

  it("adresse absente ou inconnue, aucun relevé joint : ignoré sans rien ranger", async () => {
    const saveAttachment = vi.fn<ReceiveDeps["saveAttachment"]>(async () => {});
    const unknown = await receiveStatements("e1", { config, saveAttachment, findOrganization: async () => null, fetchImpl: fakeFetch(email, [csv]) });
    expect(unknown).toMatchObject({ status: "ignored", reason: "Adresse de réception inconnue ou renouvelée." });
    const other = await receiveStatements("e1", {
      config,
      saveAttachment,
      findOrganization: async () => "org-1",
      fetchImpl: fakeFetch({ ...email, to: ["contact@atlas.ma"] }, [csv]),
    });
    expect(other.status).toBe("ignored");
    const empty = await receiveStatements("e1", { config, saveAttachment, findOrganization: async () => "org-1", fetchImpl: fakeFetch(email, []) });
    expect(empty).toMatchObject({ status: "ignored", reason: "Aucun relevé (PDF, Excel, CSV ou photo) en pièce jointe." });
    expect(saveAttachment).not.toHaveBeenCalled();
  });

  it("téléchargement ou API en échec : erreur, pour que Resend rejoue le webhook", async () => {
    const deps = { config, saveAttachment: async () => {}, findOrganization: async () => "org-1" };
    await expect(receiveStatements("e1", { ...deps, fetchImpl: fakeFetch(email, [csv]) })).rejects.toThrow(InboundError);
    const down = vi.fn<typeof fetch>(async () => new Response("erreur", { status: 500 }));
    await expect(receiveStatements("e1", { ...deps, fetchImpl: down })).rejects.toThrow("Resend 500");
  });
});
