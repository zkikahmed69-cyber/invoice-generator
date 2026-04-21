import { useState, useEffect } from "react"
import { InvoiceDocument } from "@/components/InvoiceDocument"
import type { InvoiceData } from "@/types/invoice"

const STORAGE_KEY = "atelier_invoice_v2"
const NUM_KEY = "atelier_last_invoice_num"

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

function App() {
  const [invoice, setInvoice] = useState<InvoiceData>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) return { ...createDefault(), ...JSON.parse(raw) }
    } catch { /* ignore */ }
    return createDefault()
  })

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(invoice))
      localStorage.setItem(NUM_KEY, invoice.invoiceNumber)
    } catch { /* quota */ }
  }, [invoice])

  const reset = () => {
    localStorage.removeItem(STORAGE_KEY)
    setInvoice(createDefault())
  }

  return <InvoiceDocument data={invoice} onChange={setInvoice} onReset={reset} />
}

export default App
