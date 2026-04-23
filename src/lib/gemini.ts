import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai"
import type { Schema } from "@google/generative-ai"
import type { InvoiceData } from "@/types/invoice"

export type InvoicePatch = Partial<InvoiceData> & { message: string }

export type ChatMessage = {
  role: "user" | "model"
  parts: [{ text: string }]
}

// Schema JSON strictement typé → Gemini retourne du JSON garanti, zéro parsing manuel
const INVOICE_SCHEMA: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    message: { type: SchemaType.STRING, description: "Confirmation courte (1 phrase) de ce qui a été mis à jour" },
    senderName: { type: SchemaType.STRING },
    senderCompany: { type: SchemaType.STRING },
    senderAddress: { type: SchemaType.STRING },
    senderCity: { type: SchemaType.STRING },
    senderZip: { type: SchemaType.STRING },
    senderEmail: { type: SchemaType.STRING },
    senderPhone: { type: SchemaType.STRING },
    senderSiret: { type: SchemaType.STRING },
    senderLegalForm: { type: SchemaType.STRING },
    senderVatNumber: { type: SchemaType.STRING },
    clientName: { type: SchemaType.STRING },
    clientCompany: { type: SchemaType.STRING },
    clientAddress: { type: SchemaType.STRING },
    clientCity: { type: SchemaType.STRING },
    clientZip: { type: SchemaType.STRING },
    clientEmail: { type: SchemaType.STRING },
    clientSiren: { type: SchemaType.STRING },
    invoiceNumber: { type: SchemaType.STRING },
    invoiceDate: { type: SchemaType.STRING },
    dueDate: { type: SchemaType.STRING },
    dueDatePreset: { type: SchemaType.STRING },
    serviceDate: { type: SchemaType.STRING },
    taxRate: { type: SchemaType.NUMBER },
    vatExempt: { type: SchemaType.BOOLEAN },
    discountPercent: { type: SchemaType.NUMBER },
    notes: { type: SchemaType.STRING },
    paymentTerms: { type: SchemaType.STRING },
    lineItems: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          description: { type: SchemaType.STRING },
          quantity: { type: SchemaType.NUMBER },
          unitPrice: { type: SchemaType.NUMBER },
          taxRate: { type: SchemaType.NUMBER },
        },
        required: ["description", "quantity", "unitPrice"],
      },
    },
  },
  required: ["message"],
}

const SYSTEM_PROMPT = `Tu es un assistant de facturation expert. L'utilisateur dicte des informations de facture en français.

RÈGLES STRICTES:
- Retourne UNIQUEMENT les champs explicitement mentionnés dans la commande (les autres doivent être absents du JSON)
- Ne remplis jamais un champ si l'utilisateur ne l'a pas mentionné
- Dates au format YYYY-MM-DD (aujourd'hui = ${new Date().toLocaleDateString("en-CA")})
- dueDatePreset: uniquement "15", "30", "45", "60" ou "custom"
- Pour les lineItems: retourne le tableau COMPLET mis à jour (existant + modifications)
- message: 1 phrase courte de confirmation en français

EXEMPLES:
→ "facture pour la société Acme" : { "clientCompany": "Acme", "message": "Client mis à jour : Acme" }
→ "3 jours de développement à 500 euros HT" : { "lineItems": [{"description": "Développement", "quantity": 3, "unitPrice": 500}], "message": "Prestation ajoutée : 3j × 500€" }
→ "TVA à 10 pourcent" : { "taxRate": 10, "message": "TVA mise à 10%" }
→ "paiement sous 30 jours" : { "dueDatePreset": "30", "message": "Délai de paiement : 30 jours" }
→ "exonéré de TVA" : { "vatExempt": true, "message": "Facture marquée exonérée de TVA (art. 293B)" }`

// Résumé condensé de la facture → contexte pour Gemini sans surcharger les tokens
function summarizeInvoice(invoice: InvoiceData): string {
  const items = invoice.lineItems
    .filter((li) => li.description)
    .map((li) => `  • ${li.description}: ${li.quantity}x${li.unitPrice}€ (TVA ${li.taxRate ?? invoice.taxRate}%)`)
    .join("\n") || "  (aucune prestation)"

  return `État actuel:
- N° facture: ${invoice.invoiceNumber}
- Expéditeur: ${[invoice.senderCompany, invoice.senderName].filter(Boolean).join(" / ") || "(vide)"}
- Client: ${[invoice.clientCompany, invoice.clientName].filter(Boolean).join(" / ") || "(vide)"}
- Prestations:\n${items}
- TVA: ${invoice.taxRate}% | Remise: ${invoice.discountPercent}% | Exonéré: ${invoice.vatExempt}
- Paiement: ${invoice.paymentTerms} | Échéance: ${invoice.dueDatePreset} jours`
}

export async function processVoiceCommand(
  transcript: string,
  currentInvoice: InvoiceData,
  history: ChatMessage[],
  apiKey: string
): Promise<InvoicePatch> {
  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
    systemInstruction: SYSTEM_PROMPT,
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: INVOICE_SCHEMA,
      temperature: 0.1, // réponses précises et stables
    },
  })

  const chat = model.startChat({ history })

  const userMessage = `${summarizeInvoice(currentInvoice)}\n\nCommande: "${transcript}"`
  const result = await chat.sendMessage(userMessage)
  const raw = result.response.text()

  return JSON.parse(raw) as InvoicePatch
}

// Merge intelligent : applique seulement les champs retournés par Gemini
export function applyPatch(current: InvoiceData, patch: InvoicePatch): InvoiceData {
  const { message: _msg, lineItems, ...fields } = patch

  const merged: InvoiceData = { ...current, ...fields }

  if (lineItems && lineItems.length > 0) {
    merged.lineItems = lineItems.map((li) => ({
      id: crypto.randomUUID(),
      description: li.description ?? "",
      quantity: li.quantity ?? 1,
      unitPrice: li.unitPrice ?? 0,
      ...(li.taxRate !== undefined ? { taxRate: li.taxRate } : {}),
    }))
  }

  return merged
}
