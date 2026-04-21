import { Trash2, RotateCcw, FileText } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { SavedInvoice } from "@/types/invoice"

interface Props {
  invoices: SavedInvoice[]
  onReuse: (id: string) => void
  onDelete: (id: string) => void
}

function calcTotalHT(inv: SavedInvoice): number {
  const lines = Array.isArray(inv.data?.lineItems) ? inv.data.lineItems : []
  const subtotal = lines.reduce(
    (acc, l) => acc + (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0),
    0
  )
  return subtotal * (1 - (Number(inv.data?.discountPercent) || 0) / 100)
}

function fmt(n: number): string {
  return n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtDate(d: string): string {
  if (!d) return ""
  const [y, m, day] = d.split("-")
  return `${day}/${m}/${y}`
}

export function InvoiceDashboard({ invoices, onReuse, onDelete }: Props) {
  if (invoices.length === 0) {
    return (
      <div className="invoice-page flex items-center justify-center min-h-[60vh]">
        <div className="text-center text-muted-foreground">
          <FileText className="mx-auto mb-3 opacity-30" size={48} />
          <p className="text-lg font-medium">Aucune facture sauvegardée</p>
          <p className="text-sm mt-1">Créez et sauvegardez une facture pour la retrouver ici.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="invoice-page">
      <div className="a4-paper mx-auto my-8">
        <h2 className="text-xl font-semibold mb-6" style={{ fontFamily: "var(--font-heading)" }}>
          Mes Factures
        </h2>
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b text-muted-foreground">
              <th className="text-left py-2 pr-4 font-medium">N° Facture</th>
              <th className="text-left py-2 pr-4 font-medium">Client</th>
              <th className="text-left py-2 pr-4 font-medium">Date</th>
              <th className="text-right py-2 pr-4 font-medium">Total HT</th>
              <th className="text-right py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv) => {
              const client = inv.data.clientCompany || inv.data.clientName || "—"
              const totalHT = calcTotalHT(inv)
              return (
                <tr key={inv.id} className="border-b hover:bg-muted/30 transition-colors">
                  <td className="py-3 pr-4 font-mono font-medium">{inv.data.invoiceNumber}</td>
                  <td className="py-3 pr-4">{client}</td>
                  <td className="py-3 pr-4 text-muted-foreground">{fmtDate(inv.data.invoiceDate)}</td>
                  <td className="py-3 pr-4 text-right font-medium">{fmt(totalHT)} €</td>
                  <td className="py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onReuse(inv.id)}
                        title="Réutiliser cette facture"
                      >
                        <RotateCcw size={14} />
                        Réutiliser
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onDelete(inv.id)}
                        title="Supprimer"
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
