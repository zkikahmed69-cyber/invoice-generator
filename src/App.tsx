import { useState, useEffect } from "react"
import { Eye, FileText } from "lucide-react"
import { Button } from "@/components/ui/button"
import { InvoiceForm } from "@/components/InvoiceForm"
import { InvoicePreview } from "@/components/InvoicePreview"
import type { InvoiceData } from "@/types/invoice"

function localDateStr(offsetDays = 0): string {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return d.toLocaleDateString("en-CA")
}

const SENDER_KEY = "atelier_sender_info"
const INVOICE_NUM_KEY = "atelier_last_invoice_num"

function getNextInvoiceNumber(): string {
  try {
    const last = localStorage.getItem(INVOICE_NUM_KEY)
    if (!last) return "INV-001"
    const match = last.match(/^(.*?)(\d+)$/)
    if (!match) return "INV-001"
    const num = parseInt(match[2]) + 1
    return `${match[1]}${String(num).padStart(match[2].length, "0")}`
  } catch {
    return "INV-001"
  }
}

function getSavedSender(): Partial<InvoiceData> {
  try {
    const raw = localStorage.getItem(SENDER_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function createDefaultInvoice(): InvoiceData {
  const saved = getSavedSender()
  return {
    senderName: saved.senderName ?? "",
    senderCompany: saved.senderCompany ?? "",
    senderAddress: saved.senderAddress ?? "",
    senderEmail: saved.senderEmail ?? "",
    senderPhone: saved.senderPhone ?? "",
    senderSiret: saved.senderSiret ?? "",
    senderLegalForm: saved.senderLegalForm ?? "",
    senderVatNumber: saved.senderVatNumber ?? "",
    clientName: "",
    clientCompany: "",
    clientAddress: "",
    clientEmail: "",
    invoiceNumber: getNextInvoiceNumber(),
    invoiceDate: localDateStr(),
    dueDate: localDateStr(30),
    dueDatePreset: "30",
    lineItems: [{ id: crypto.randomUUID(), description: "", quantity: 1, unitPrice: 0 }],
    taxRate: saved.taxRate ?? 20,
    vatExempt: saved.vatExempt ?? false,
    discountPercent: 0,
    logoUrl: "",
    notes: "",
    paymentTerms: "Virement bancaire",
  }
}

function App() {
  const [invoice, setInvoice] = useState<InvoiceData>(createDefaultInvoice)
  const [showPreview, setShowPreview] = useState(false)

  // Persistance localStorage — infos expéditeur
  useEffect(() => {
    try {
      localStorage.setItem(SENDER_KEY, JSON.stringify({
        senderName: invoice.senderName,
        senderCompany: invoice.senderCompany,
        senderAddress: invoice.senderAddress,
        senderEmail: invoice.senderEmail,
        senderPhone: invoice.senderPhone,
        senderSiret: invoice.senderSiret,
        senderLegalForm: invoice.senderLegalForm,
        senderVatNumber: invoice.senderVatNumber,
        taxRate: invoice.taxRate,
        vatExempt: invoice.vatExempt,
      }))
    } catch { /* quota exceeded */ }
  }, [
    invoice.senderName, invoice.senderCompany, invoice.senderAddress,
    invoice.senderEmail, invoice.senderPhone, invoice.senderSiret,
    invoice.senderLegalForm, invoice.senderVatNumber, invoice.taxRate, invoice.vatExempt,
  ])

  // Persistance numéro de facture
  useEffect(() => {
    try {
      localStorage.setItem(INVOICE_NUM_KEY, invoice.invoiceNumber)
    } catch { /* quota exceeded */ }
  }, [invoice.invoiceNumber])

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* Header */}
      <header className="no-print flex items-center justify-between px-4 md:px-6 py-3 border-b border-border/60 shrink-0">
        <div className="flex items-center gap-2">
          <span
            className="text-sm font-extrabold text-primary uppercase"
            style={{ fontFamily: "'Syne', sans-serif", letterSpacing: "0.12em" }}
          >
            Atelier
          </span>
          <span
            className="text-sm font-extrabold uppercase text-foreground"
            style={{ fontFamily: "'Syne', sans-serif", letterSpacing: "0.12em" }}
          >
            Invoice
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span className="hidden sm:block text-xs text-muted-foreground tabular-nums">
            {invoice.invoiceNumber}
          </span>
          {/* Bouton mobile toggle */}
          <Button
            size="sm"
            variant="outline"
            className="md:hidden gap-2 text-xs"
            onClick={() => setShowPreview(!showPreview)}
          >
            {showPreview ? (
              <><FileText size={14} /> Formulaire</>
            ) : (
              <><Eye size={14} /> Aperçu</>
            )}
          </Button>
        </div>
      </header>

      {/* Layout desktop : 2 colonnes */}
      <div className="flex-1 hidden md:grid md:grid-cols-[460px_1fr] overflow-hidden">
        <aside className="no-print overflow-y-auto border-r border-border/60">
          <InvoiceForm value={invoice} onChange={setInvoice} />
        </aside>
        <main className="overflow-y-auto bg-muted/30">
          <InvoicePreview data={invoice} />
        </main>
      </div>

      {/* Layout mobile : toggle formulaire / aperçu */}
      <div className="flex-1 md:hidden overflow-y-auto">
        {showPreview ? (
          <div className="bg-muted/30 min-h-full">
            <InvoicePreview data={invoice} />
          </div>
        ) : (
          <div className="no-print">
            <InvoiceForm value={invoice} onChange={setInvoice} />
          </div>
        )}
      </div>
    </div>
  )
}

export default App
