import { useState, useEffect, useCallback, useRef } from "react"
import { InvoiceDocument } from "@/components/InvoiceDocument"
import { InvoiceDashboard } from "@/components/InvoiceDashboard"
import { VoiceAgent } from "@/components/VoiceAgent"
import { Button } from "@/components/ui/button"
import { ButtonGroup } from "@/components/ui/button-group"
import { Save, FilePlus, LayoutList, Check } from "lucide-react"
import type { InvoiceData, SavedInvoice } from "@/types/invoice"

const STORAGE_KEY = "atelier_invoice_v2"
const NUM_KEY = "atelier_last_invoice_num"
const SAVED_KEY = "atelier_saved_invoices"

function localDateStr(offsetDays = 0): string {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return d.toLocaleDateString("en-CA")
}

function nextNumber(): string {
  try {
    const last = localStorage.getItem(NUM_KEY)
    if (!last) {
      const y = new Date().getFullYear()
      return `FA-${y}-001`
    }
    const m = last.match(/^(.*?)(\d+)$/)
    if (!m) return `FA-${new Date().getFullYear()}-001`
    const n = parseInt(m[2]) + 1
    return `${m[1]}${String(n).padStart(m[2].length, "0")}`
  } catch {
    return `FA-${new Date().getFullYear()}-001`
  }
}

function createDefault(): InvoiceData {
  return {
    senderName: "",
    senderCompany: "",
    senderAddress: "",
    senderCity: "",
    senderZip: "",
    senderEmail: "",
    senderPhone: "",
    senderSiret: "",
    senderLegalForm: "",
    senderVatNumber: "",
    clientName: "",
    clientCompany: "",
    clientAddress: "",
    clientCity: "",
    clientZip: "",
    clientEmail: "",
    clientSiren: "",
    invoiceNumber: nextNumber(),
    invoiceDate: localDateStr(),
    dueDate: localDateStr(30),
    dueDatePreset: "30",
    serviceDate: "",
    lineItems: [{ id: crypto.randomUUID(), description: "", quantity: 1, unitPrice: 0 }],
    taxRate: 20,
    vatExempt: false,
    discountPercent: 0,
    logoUrl: "",
    notes: "",
    paymentTerms: "Virement bancaire",
  }
}

function loadSavedInvoices(): SavedInvoice[] {
  try {
    const raw = localStorage.getItem(SAVED_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        return parsed.filter(
          (x) => x && typeof x.id === "string" && x.data && Array.isArray(x.data.lineItems)
        )
      }
    }
  } catch { /* ignore */ }
  return []
}

function App() {
  const [view, setView] = useState<"editor" | "dashboard">("editor")
  const [isSaved, setIsSaved] = useState(false)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [invoice, setInvoice] = useState<InvoiceData>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) return { ...createDefault(), ...JSON.parse(raw) }
    } catch { /* ignore */ }
    return createDefault()
  })

  const [savedInvoices, setSavedInvoices] = useState<SavedInvoice[]>(loadSavedInvoices)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(invoice))
      localStorage.setItem(NUM_KEY, invoice.invoiceNumber)
    } catch { /* quota */ }
  }, [invoice])

  useEffect(() => {
    try {
      localStorage.setItem(SAVED_KEY, JSON.stringify(savedInvoices))
    } catch { /* quota */ }
  }, [savedInvoices])

  const reset = () => {
    localStorage.removeItem(STORAGE_KEY)
    setInvoice(createDefault())
  }

  const saveInvoice = useCallback(() => {
    const entry: SavedInvoice = {
      id: crypto.randomUUID(),
      savedAt: new Date().toISOString(),
      data: invoice,
    }
    setSavedInvoices((prev) => [entry, ...prev])
    setIsSaved(true)
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => setIsSaved(false), 2000)
  }, [invoice])

  const reuseInvoice = useCallback((id: string) => {
    const found = savedInvoices.find((s) => s.id === id)
    if (!found) return
    const preset = found.data.dueDatePreset
    const daysOffset = preset === "custom" ? 30 : parseInt(preset) || 30
    setInvoice({
      ...found.data,
      invoiceNumber: nextNumber(),
      invoiceDate: localDateStr(0),
      dueDate: localDateStr(daysOffset),
      lineItems: found.data.lineItems.map((li) => ({ ...li, id: crypto.randomUUID() })),
    })
    setView("editor")
  }, [savedInvoices])

  const deleteInvoice = useCallback((id: string) => {
    setSavedInvoices((prev) => prev.filter((s) => s.id !== id))
  }, [])

  return (
    <div>
      <nav className="sticky top-0 z-50 bg-white border-b flex items-center justify-between px-4 py-2 no-print">
        <ButtonGroup>
          <Button
            size="sm"
            variant={view === "editor" ? "default" : "outline"}
            onClick={() => setView("editor")}
          >
            <FilePlus size={15} />
            Créer une facture
          </Button>
          <Button
            size="sm"
            variant={view === "dashboard" ? "default" : "outline"}
            onClick={() => setView("dashboard")}
          >
            <LayoutList size={15} />
            Mes Factures
            {savedInvoices.length > 0 && (
              <span className="ml-1 bg-primary/15 text-primary rounded-full text-xs px-1.5 py-0.5 font-medium">
                {savedInvoices.length}
              </span>
            )}
          </Button>
        </ButtonGroup>
        {view === "editor" && (
          <Button size="sm" variant="outline" onClick={saveInvoice} disabled={isSaved}>
            {isSaved ? (
              <>
                <Check size={15} />
                Sauvegardé
              </>
            ) : (
              <>
                <Save size={15} />
                Sauvegarder
              </>
            )}
          </Button>
        )}
      </nav>

      {view === "editor" && (
        <InvoiceDocument data={invoice} onChange={setInvoice} onReset={reset} />
      )}
      {view === "dashboard" && (
        <InvoiceDashboard
          invoices={savedInvoices}
          onReuse={reuseInvoice}
          onDelete={deleteInvoice}
        />
      )}

      <VoiceAgent invoice={invoice} onUpdate={setInvoice} />
    </div>
  )
}

export default App
