import { useMemo, useRef, useState } from "react"
import { Printer, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { InvoiceData } from "@/types/invoice"

// Hex pour compatibilité html2canvas (pas oklch)
const ACCENT = "#d4e52a"
const syneFontStyle: React.CSSProperties = { fontFamily: "'Syne', sans-serif" }
const geistFontStyle: React.CSSProperties = { fontFamily: "'Geist Variable', sans-serif" }
const accentBorderStyle: React.CSSProperties = { borderColor: ACCENT }
const accentBgStyle: React.CSSProperties = { background: ACCENT }

function formatDate(dateStr: string) {
  if (!dateStr) return "—"
  const parts = dateStr.split("-")
  if (parts.length !== 3) return "—"
  const [year, month, day] = parts
  if (!year || !month || !day) return "—"
  return `${day}/${month}/${year}`
}

function formatAmount(n: number) {
  return n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function round2(n: number) {
  return Math.round(n * 100) / 100
}

interface InvoicePreviewProps {
  data: InvoiceData
}

export function InvoicePreview({ data }: InvoicePreviewProps) {
  const docRef = useRef<HTMLDivElement>(null)
  const [downloading, setDownloading] = useState(false)

  const { subtotal, discountAmount, taxByRate, total } = useMemo(() => {
    const subtotal = round2(data.lineItems.reduce((s, i) => s + i.quantity * i.unitPrice, 0))
    const discountAmount = round2(subtotal * (data.discountPercent / 100))
    const discountFactor = 1 - data.discountPercent / 100

    const taxByRate: Record<number, number> = {}
    if (!data.vatExempt) {
      for (const item of data.lineItems) {
        const rate = item.taxRate ?? data.taxRate
        if (rate <= 0) continue
        const itemHT = round2(item.quantity * item.unitPrice * discountFactor)
        taxByRate[rate] = round2((taxByRate[rate] ?? 0) + round2(itemHT * rate / 100))
      }
    }

    const totalTax = round2(Object.values(taxByRate).reduce((s, v) => s + v, 0))
    const total = round2(subtotal - discountAmount + totalTax)
    return { subtotal, discountAmount, taxByRate, total }
  }, [data.lineItems, data.discountPercent, data.taxRate, data.vatExempt])

  const downloadPDF = async () => {
    if (!docRef.current) return
    setDownloading(true)
    try {
      const [{ toPng }, { default: jsPDF }] = await Promise.all([
        import("html-to-image"),
        import("jspdf"),
      ])
      const dataUrl = await toPng(docRef.current, {
        quality: 1,
        pixelRatio: 2,
        backgroundColor: "#ffffff",
      })
      const img = new Image()
      img.src = dataUrl
      await new Promise<void>((resolve) => { img.onload = () => resolve() })
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
      const pdfW = pdf.internal.pageSize.getWidth()
      const pdfH = (img.height * pdfW) / img.width
      pdf.addImage(dataUrl, "PNG", 0, 0, pdfW, pdfH)
      pdf.save(`facture-${data.invoiceNumber || "XXX"}.pdf`)
    } catch (err) {
      console.error("Erreur PDF:", err)
      alert("Impossible de générer le PDF. Utilise le bouton Imprimer à la place.")
    } finally {
      setDownloading(false)
    }
  }

  const legalFormLabel = {
    "auto-entrepreneur": "Auto-entrepreneur",
    sasu: "SASU",
    eurl: "EURL",
    sarl: "SARL",
    sas: "SAS",
    sa: "SA",
    autre: "Autre",
  }[data.senderLegalForm] ?? data.senderLegalForm

  return (
    <div className="min-h-full p-4 lg:p-8 flex flex-col items-center">

      {/* Boutons actions */}
      <div className="no-print w-full max-w-2xl flex justify-end gap-2 mb-4">
        <Button
          onClick={() => window.print()}
          variant="outline"
          size="sm"
          className="gap-2 border-primary/50 text-primary hover:bg-primary hover:text-primary-foreground font-semibold"
        >
          <Printer size={14} />
          Imprimer
        </Button>
        <Button
          onClick={downloadPDF}
          disabled={downloading}
          size="sm"
          className="gap-2 font-semibold"
        >
          <Download size={14} />
          {downloading ? "Génération…" : "Télécharger PDF"}
        </Button>
      </div>

      {/* ── DOCUMENT FACTURE ── */}
      <div
        ref={docRef}
        className="w-full max-w-2xl bg-white text-gray-900 rounded-lg shadow-2xl overflow-hidden"
        style={geistFontStyle}
      >

        {/* En-tête */}
        <div className="px-10 pt-10 pb-6">
          <div className="flex items-start justify-between gap-6">
            {/* Logo ou nom société */}
            <div>
              {data.logoUrl ? (
                <img
                  src={data.logoUrl}
                  alt="Logo"
                  className="h-14 max-w-[160px] object-contain mb-1"
                />
              ) : (
                <p className="text-2xl font-bold leading-tight" style={syneFontStyle}>
                  {data.senderCompany || "Votre Société"}
                </p>
              )}
              {data.senderName && (
                <p className="text-sm text-gray-500 mt-0.5">{data.senderName}</p>
              )}
            </div>

            {/* FACTURE + numéro */}
            <div className="text-right shrink-0">
              <p className="text-3xl font-extrabold tracking-tight text-gray-900" style={syneFontStyle}>
                FACTURE
              </p>
              <p className="text-lg font-bold tabular-nums mt-0.5 text-gray-600" style={syneFontStyle}>
                #{data.invoiceNumber || "XXX"}
              </p>
            </div>
          </div>

          <div className="h-[3px] mt-6 rounded-full" style={accentBgStyle} />
        </div>

        {/* Expéditeur + Client */}
        <div className="px-10 py-4 grid grid-cols-2 gap-8">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-gray-400 mb-2" style={syneFontStyle}>
              De
            </p>
            <p className="text-sm font-semibold">{data.senderCompany || "—"}</p>
            {data.senderName && data.senderCompany && (
              <p className="text-xs text-gray-500">{data.senderName}</p>
            )}
            {data.senderAddress && (
              <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{data.senderAddress}</p>
            )}
            {data.senderEmail && <p className="text-xs text-gray-500">{data.senderEmail}</p>}
            {data.senderPhone && <p className="text-xs text-gray-500">{data.senderPhone}</p>}
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-gray-400 mb-2" style={syneFontStyle}>
              Facturé à
            </p>
            <p className="text-sm font-semibold">{data.clientCompany || data.clientName || "—"}</p>
            {data.clientCompany && data.clientName && (
              <p className="text-xs text-gray-500">{data.clientName}</p>
            )}
            {data.clientAddress && (
              <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{data.clientAddress}</p>
            )}
            {data.clientEmail && <p className="text-xs text-gray-500">{data.clientEmail}</p>}
          </div>
        </div>

        {/* Dates */}
        <div className="px-10 py-3 flex gap-10 bg-gray-50">
          <div>
            <p className="text-[10px] text-gray-400 uppercase tracking-wider">Date d'émission</p>
            <p className="text-sm font-semibold mt-0.5">{formatDate(data.invoiceDate)}</p>
          </div>
          <div>
            <p className="text-[10px] text-gray-400 uppercase tracking-wider">Date d'échéance</p>
            <p className="text-sm font-semibold mt-0.5">{formatDate(data.dueDate)}</p>
          </div>
          {data.paymentTerms && (
            <div>
              <p className="text-[10px] text-gray-400 uppercase tracking-wider">Paiement</p>
              <p className="text-sm font-semibold mt-0.5">{data.paymentTerms}</p>
            </div>
          )}
        </div>

        {/* Tableau prestations */}
        <div className="px-10 py-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-gray-200">
                <th className="text-left text-[10px] font-bold uppercase tracking-wider text-gray-400 pb-2" style={syneFontStyle}>
                  Description
                </th>
                <th className="text-center text-[10px] font-bold uppercase tracking-wider text-gray-400 pb-2 w-14" style={syneFontStyle}>
                  Qté
                </th>
                <th className="text-right text-[10px] font-bold uppercase tracking-wider text-gray-400 pb-2 w-24" style={syneFontStyle}>
                  P.U. HT
                </th>
                <th className="text-right text-[10px] font-bold uppercase tracking-wider text-gray-400 pb-2 w-24" style={syneFontStyle}>
                  Total HT
                </th>
              </tr>
            </thead>
            <tbody>
              {data.lineItems.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-gray-300 text-xs italic">
                    Aucune prestation ajoutée
                  </td>
                </tr>
              ) : (
                data.lineItems.map((item) => (
                  <tr key={item.id} className="border-b border-gray-100">
                    <td className="py-3 text-gray-800">
                      {item.description || <span className="text-gray-300 italic">Sans description</span>}
                    </td>
                    <td className="py-3 text-center text-gray-600 tabular-nums">{item.quantity}</td>
                    <td className="py-3 text-right text-gray-600 tabular-nums">
                      {formatAmount(item.unitPrice)} €
                    </td>
                    <td className="py-3 text-right font-semibold tabular-nums">
                      {formatAmount(round2(item.quantity * item.unitPrice))} €
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Totaux */}
        <div className="px-10 pb-8">
          <div className="ml-auto w-72 space-y-2 text-sm">
            <div className="flex justify-between text-gray-600">
              <span>Sous-total HT</span>
              <span className="tabular-nums">{formatAmount(subtotal)} €</span>
            </div>
            {data.discountPercent > 0 && (
              <div className="flex justify-between text-gray-500">
                <span>Remise ({data.discountPercent}%)</span>
                <span className="tabular-nums">−{formatAmount(discountAmount)} €</span>
              </div>
            )}
            {data.vatExempt ? (
              <div className="flex justify-between text-gray-500 text-xs italic">
                <span>TVA</span>
                <span>Non applicable</span>
              </div>
            ) : Object.keys(taxByRate).length === 0 ? null : (
              Object.entries(taxByRate)
                .sort(([a], [b]) => Number(a) - Number(b))
                .map(([rate, amount]) => (
                  <div key={rate} className="flex justify-between text-gray-600">
                    <span>TVA {rate}%</span>
                    <span className="tabular-nums">{formatAmount(amount)} €</span>
                  </div>
                ))
            )}
            <div className="flex justify-between pt-3 border-t-2" style={accentBorderStyle}>
              <span className="font-extrabold text-base whitespace-nowrap" style={syneFontStyle}>TOTAL TTC</span>
              <span className="font-extrabold text-base tabular-nums whitespace-nowrap" style={syneFontStyle}>
                {formatAmount(total)} €
              </span>
            </div>
          </div>
        </div>

        {/* Exonération TVA */}
        {data.vatExempt && (
          <div className="px-10 pb-4">
            <p className="text-xs text-gray-500 italic">
              Exonéré de TVA, art. 293B du CGI
            </p>
          </div>
        )}

        {/* Notes */}
        {data.notes && (
          <div className="px-10 pb-6 border-t border-gray-100 pt-5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1" style={syneFontStyle}>
              Notes
            </p>
            <p className="text-xs text-gray-600 leading-relaxed">{data.notes}</p>
          </div>
        )}

        {/* Mentions légales */}
        <div className="px-10 pb-8 pt-4 border-t border-gray-100 bg-gray-50">
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2" style={syneFontStyle}>
            Mentions légales
          </p>
          <div className="space-y-0.5 text-[10px] text-gray-500 leading-relaxed">
            {data.senderCompany && (
              <p>{data.senderCompany}{legalFormLabel ? ` — ${legalFormLabel}` : ""}</p>
            )}
            {data.senderSiret && <p>SIRET : {data.senderSiret}</p>}
            {!data.vatExempt && data.senderVatNumber && (
              <p>N° TVA intracommunautaire : {data.senderVatNumber}</p>
            )}
            {data.senderAddress && <p>{data.senderAddress}</p>}
            <p className="pt-1">
              En cas de retard de paiement, une pénalité égale à 3 fois le taux d'intérêt légal
              sera appliquée, ainsi qu'une indemnité forfaitaire de recouvrement de <strong>40 €</strong> (art. L441-10 du Code de commerce).
            </p>
          </div>
        </div>

      </div>
    </div>
  )
}
