export interface LineItem {
  id: string
  description: string
  quantity: number
  unitPrice: number
  taxRate?: number  // undefined = hérite du taux global de la facture
}

export type DueDatePreset = "15" | "30" | "45" | "60" | "custom"

export interface InvoiceData {
  // Expéditeur
  senderName: string
  senderCompany: string
  senderAddress: string
  senderEmail: string
  senderPhone: string
  senderSiret: string
  senderLegalForm: string
  senderVatNumber: string
  // Client
  clientName: string
  clientCompany: string
  clientAddress: string
  clientEmail: string
  // Facture
  invoiceNumber: string
  invoiceDate: string
  dueDate: string
  dueDatePreset: DueDatePreset
  // Lignes
  lineItems: LineItem[]
  // Finances
  taxRate: number
  vatExempt: boolean
  discountPercent: number
  // Médias
  logoUrl: string
  // Notes
  notes: string
  paymentTerms: string
}
