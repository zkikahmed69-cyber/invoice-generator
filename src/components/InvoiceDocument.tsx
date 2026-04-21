import { useRef, useState, useMemo, useCallback } from "react"
import { Trash2, Plus, Upload, RefreshCw, Download, Settings2 } from "lucide-react"
import type { InvoiceData, LineItem } from "@/types/invoice"

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function r2(n: number) { return Math.round(n * 100) / 100 }

// ─── Champ texte éditable inline ─────────────────────────────────────────────

interface FProps {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  className?: string
  type?: string
}
function F({ value, onChange, placeholder = "", className = "", type = "text" }: FProps) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`editable ${className}`}
    />
  )
}

// ─── Champ nombre éditable inline ────────────────────────────────────────────

interface NProps {
  value: number
  onChange: (v: number) => void
  placeholder?: string
  min?: number
  max?: number
  step?: number
  className?: string
}
function N({ value, onChange, placeholder = "0", min = 0, max, step = 1, className = "" }: NProps) {
  return (
    <input
      type="number"
      value={value || ""}
      min={min}
      max={max}
      step={step}
      onChange={(e) => {
        if (e.target.value === "") { onChange(0); return }
        const n = parseFloat(e.target.value) || 0
        const clamped = max !== undefined ? Math.min(max, Math.max(min, n)) : Math.max(min, n)
        onChange(clamped)
      }}
      placeholder={placeholder}
      className={`editable tabular-nums ${className}`}
    />
  )
}

// ─── Ligne de date (label + input date) ──────────────────────────────────────

function DateRow({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center justify-end gap-3">
      <span className="text-xs text-gray-400 shrink-0 text-right">{label}</span>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="editable text-sm text-gray-700 text-right w-36"
      />
    </div>
  )
}

// ─── Options TVA ─────────────────────────────────────────────────────────────

const TVA_OPTIONS = [
  { label: "20%", rate: 20, exempt: false },
  { label: "10%", rate: 10, exempt: false },
  { label: "5.5%", rate: 5.5, exempt: false },
  { label: "0%", rate: 0, exempt: false },
  { label: "Exonéré (art. 293B)", rate: 0, exempt: true },
]

// ─── Composant principal ──────────────────────────────────────────────────────

interface Props {
  data: InvoiceData
  onChange: (data: InvoiceData) => void
  onReset: () => void
}

export function InvoiceDocument({ data, onChange, onReset }: Props) {
  const docRef = useRef<HTMLDivElement>(null)
  const logoRef = useRef<HTMLInputElement>(null)
  const [downloading, setDownloading] = useState(false)
  const [showTvaMenu, setShowTvaMenu] = useState(false)

  // ── Mise à jour d'un champ ──
  function upd<K extends keyof InvoiceData>(field: K, value: InvoiceData[K]) {
    onChange({ ...data, [field]: value })
  }

  // ── Lignes de prestation ──
  const updateItem = useCallback(
    (id: string, item: LineItem) =>
      onChange({ ...data, lineItems: data.lineItems.map((i) => (i.id === id ? item : i)) }),
    [data, onChange]
  )
  const removeItem = useCallback(
    (id: string) => onChange({ ...data, lineItems: data.lineItems.filter((i) => i.id !== id) }),
    [data, onChange]
  )
  const addItem = useCallback(
    () =>
      onChange({
        ...data,
        lineItems: [
          ...data.lineItems,
          { id: crypto.randomUUID(), description: "", quantity: 1, unitPrice: 0 },
        ],
      }),
    [data, onChange]
  )

  // ── Logo ──
  const handleLogo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => upd("logoUrl", ev.target?.result as string)
    reader.readAsDataURL(file)
    e.target.value = ""
  }

  // ── Calculs ──
  const { subtotal, discountAmount, taxByRate, total } = useMemo(() => {
    const subtotal = r2(data.lineItems.reduce((s, i) => s + i.quantity * i.unitPrice, 0))
    const discountAmount = r2(subtotal * (data.discountPercent / 100))
    const discountFactor = 1 - data.discountPercent / 100
    const taxByRate: Record<number, number> = {}
    if (!data.vatExempt) {
      for (const item of data.lineItems) {
        const rate = item.taxRate ?? data.taxRate
        if (rate <= 0) continue
        const ht = r2(item.quantity * item.unitPrice * discountFactor)
        taxByRate[rate] = r2((taxByRate[rate] ?? 0) + r2(ht * rate / 100))
      }
    }
    const totalTax = r2(Object.values(taxByRate).reduce((s, v) => s + v, 0))
    const total = r2(subtotal - discountAmount + totalTax)
    return { subtotal, discountAmount, taxByRate, total }
  }, [data.lineItems, data.discountPercent, data.taxRate, data.vatExempt])

  // ── Téléchargement PDF ──
  const downloadPDF = async () => {
    if (!docRef.current) return
    setDownloading(true)
    const el = docRef.current
    const prevWidth = el.style.width
    const prevMaxWidth = el.style.maxWidth
    try {
      const [{ toSvg }, { default: jsPDF }] = await Promise.all([
        import("html-to-image"),
        import("jspdf"),
      ])
      // Forcer 794px pour la capture (évite le rognage sur petits écrans)
      el.style.width = "794px"
      el.style.maxWidth = "794px"
      const W = 794
      const H = el.scrollHeight

      const svgUrl = await toSvg(el, {
        backgroundColor: "#ffffff",
        skipFonts: true,
        filter: (node: Node) => {
          if (!(node instanceof Element)) return true
          return !node.classList.contains("no-export")
        },
      })

      el.style.width = prevWidth
      el.style.maxWidth = prevMaxWidth

      // img.decode() bloque sur Chrome avec oklch — on utilise onload seul
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image()
        image.onload = () => resolve(image)
        image.onerror = reject
        image.src = svgUrl
      })

      const RATIO = 2
      const canvas = document.createElement("canvas")
      canvas.width = W * RATIO
      canvas.height = H * RATIO
      const ctx = canvas.getContext("2d")!
      ctx.fillStyle = "#ffffff"
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

      const pngUrl = canvas.toDataURL("image/png")
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
      const pdfW = pdf.internal.pageSize.getWidth()
      const pdfH = (H / W) * pdfW
      pdf.addImage(pngUrl, "PNG", 0, 0, pdfW, pdfH)
      pdf.save(`facture-${data.invoiceNumber || "XXX"}.pdf`)
    } catch (err) {
      el.style.width = prevWidth
      el.style.maxWidth = prevMaxWidth
      console.error("Erreur PDF:", err)
      alert("Impossible de générer le PDF.")
    } finally {
      setDownloading(false)
    }
  }

  const legalLabel =
    ({
      "auto-entrepreneur": "Auto-entrepreneur",
      sasu: "SASU",
      eurl: "EURL",
      sarl: "SARL",
      sas: "SAS",
      sa: "SA",
    } as Record<string, string>)[data.senderLegalForm] ?? data.senderLegalForm

  const tvaLabel = data.vatExempt ? "Exonéré" : data.taxRate > 0 ? `${data.taxRate}%` : "0%"

  return (
    <div className="flex flex-col" style={{ minHeight: "100vh" }}>

      {/* ── HEADER ──────────────────────────────────────────────────────────── */}
      <header className="no-print sticky top-0 z-50 bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <span className="text-sm font-medium text-gray-500">Générateur de facture</span>

        <div className="flex items-center gap-2">

          {/* Bouton TVA */}
          <div className="relative">
            <button
              onClick={() => setShowTvaMenu(!showTvaMenu)}
              onBlur={(e) => {
                if (!e.currentTarget.parentElement?.contains(e.relatedTarget)) {
                  setTimeout(() => setShowTvaMenu(false), 150)
                }
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"
            >
              <Settings2 size={13} />
              TVA · {tvaLabel}
            </button>
            {showTvaMenu && (
              <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-50 min-w-[190px]">
                {TVA_OPTIONS.map((opt) => {
                  const active =
                    opt.exempt ? data.vatExempt : !data.vatExempt && data.taxRate === opt.rate
                  return (
                    <button
                      key={opt.label}
                      onMouseDown={() => {
                        onChange({
                          ...data,
                          taxRate: opt.rate,
                          vatExempt: opt.exempt,
                          lineItems: data.lineItems.map(({ taxRate: _r, ...rest }) => rest as LineItem),
                        })
                        setShowTvaMenu(false)
                      }}
                      className={`w-full text-left px-4 py-2 text-sm transition-colors hover:bg-gray-50 ${
                        active ? "font-semibold text-gray-900" : "text-gray-600"
                      }`}
                    >
                      {opt.label}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Réinitialiser */}
          <button
            onClick={onReset}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"
          >
            <RefreshCw size={13} />
            Réinitialiser
          </button>

          {/* Télécharger PDF */}
          <button
            onClick={downloadPDF}
            disabled={downloading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-gray-900 rounded-md hover:bg-gray-700 disabled:opacity-50 transition-colors"
          >
            <Download size={13} />
            {downloading ? "Génération…" : "Télécharger PDF"}
          </button>
        </div>
      </header>

      {/* ── PAGE ────────────────────────────────────────────────────────────── */}
      <main className="invoice-page flex-1">
        <div ref={docRef} className="a4-paper">

          {/* ── EN-TÊTE FACTURE ─────────────────────────────────────────────── */}
          <div className="flex items-start justify-between gap-8 mb-8">

            {/* Gauche : titre + numéro */}
            <div>
              <h1
                style={{
                  fontFamily: "'Syne', sans-serif",
                  fontSize: "3rem",
                  fontWeight: 900,
                  letterSpacing: "-0.025em",
                  lineHeight: 1,
                  color: "#111827",
                  userSelect: "none",
                }}
              >
                FACTURE
              </h1>
              <div className="flex items-center gap-1 mt-2">
                <span className="text-sm text-gray-400">N°</span>
                <F
                  value={data.invoiceNumber}
                  onChange={(v) => upd("invoiceNumber", v)}
                  placeholder="FA-2026-001"
                  className="text-sm font-semibold text-gray-700 w-36"
                />
              </div>
            </div>

            {/* Droite : logo + dates */}
            <div className="flex flex-col items-end gap-3 shrink-0">

              {/* Logo */}
              <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={handleLogo} />
              {data.logoUrl ? (
                <div className="relative group cursor-pointer" onClick={() => logoRef.current?.click()}>
                  <img src={data.logoUrl} alt="Logo" className="h-14 max-w-[180px] object-contain" />
                  <div className="no-export absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity rounded text-white text-xs font-medium">
                    Changer
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => logoRef.current?.click()}
                  className="no-export h-11 w-36 border-2 border-dashed border-gray-200 rounded flex items-center justify-center gap-1.5 text-gray-400 text-xs hover:border-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
                >
                  <Upload size={13} />
                  Uploader un logo
                </button>
              )}

              {/* Dates */}
              <div className="space-y-1.5">
                <DateRow
                  label="Date d'émission"
                  value={data.invoiceDate}
                  onChange={(v) => upd("invoiceDate", v)}
                />
                <DateRow
                  label="Date d'échéance"
                  value={data.dueDate}
                  onChange={(v) => upd("dueDate", v)}
                />
                <DateRow
                  label="Date de prestation"
                  value={data.serviceDate ?? ""}
                  onChange={(v) => upd("serviceDate", v)}
                />
              </div>
            </div>
          </div>

          {/* ── SÉPARATEUR ──────────────────────────────────────────────────── */}
          <div className="h-px bg-gray-900 mb-8" />

          {/* ── EXPÉDITEUR + CLIENT ─────────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-10 mb-10">

            {/* Expéditeur */}
            <div className="space-y-0.5 text-sm">
              <F
                value={data.senderCompany}
                onChange={(v) => upd("senderCompany", v)}
                placeholder="Votre société"
                className="text-base font-bold text-gray-900"
              />
              <F
                value={data.senderName}
                onChange={(v) => upd("senderName", v)}
                placeholder="Votre nom"
                className="text-gray-600"
              />
              <F
                value={data.senderAddress}
                onChange={(v) => upd("senderAddress", v)}
                placeholder="Adresse"
                className="text-gray-600"
              />
              <div className="flex gap-2">
                <F
                  value={data.senderZip ?? ""}
                  onChange={(v) => upd("senderZip", v)}
                  placeholder="Code postal"
                  className="text-gray-600 w-24"
                />
                <F
                  value={data.senderCity ?? ""}
                  onChange={(v) => upd("senderCity", v)}
                  placeholder="Ville"
                  className="text-gray-600 flex-1"
                />
              </div>
              <div className="flex items-center gap-2 pt-1">
                <span className="text-xs text-gray-400 shrink-0 w-16">SIRET</span>
                <F
                  value={data.senderSiret}
                  onChange={(v) => upd("senderSiret", v)}
                  placeholder="123 456 789 00000"
                  className="text-gray-600 text-xs"
                />
              </div>
              {!data.vatExempt && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 shrink-0 w-16">N° TVA</span>
                  <F
                    value={data.senderVatNumber}
                    onChange={(v) => upd("senderVatNumber", v)}
                    placeholder="FR12345678901"
                    className="text-gray-600 text-xs"
                  />
                </div>
              )}
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400 shrink-0 w-16">Statut</span>
                <F
                  value={data.senderLegalForm}
                  onChange={(v) => upd("senderLegalForm", v)}
                  placeholder="Auto-entrepreneur, SASU…"
                  className="text-gray-600 text-xs"
                />
              </div>
              <F
                value={data.senderEmail}
                onChange={(v) => upd("senderEmail", v)}
                placeholder="email@exemple.fr"
                className="text-gray-500 text-xs pt-0.5"
              />
              <F
                value={data.senderPhone}
                onChange={(v) => upd("senderPhone", v)}
                placeholder="+33 6 00 00 00 00"
                className="text-gray-500 text-xs"
              />
            </div>

            {/* Client */}
            <div className="space-y-0.5 text-sm">
              <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-gray-400 mb-3">
                Facturé à
              </p>
              <F
                value={data.clientCompany}
                onChange={(v) => upd("clientCompany", v)}
                placeholder="Société cliente"
                className="text-base font-bold text-gray-900"
              />
              <F
                value={data.clientName}
                onChange={(v) => upd("clientName", v)}
                placeholder="Nom du contact"
                className="text-gray-600"
              />
              <F
                value={data.clientAddress}
                onChange={(v) => upd("clientAddress", v)}
                placeholder="Adresse"
                className="text-gray-600"
              />
              <div className="flex gap-2">
                <F
                  value={data.clientZip ?? ""}
                  onChange={(v) => upd("clientZip", v)}
                  placeholder="Code postal"
                  className="text-gray-600 w-24"
                />
                <F
                  value={data.clientCity ?? ""}
                  onChange={(v) => upd("clientCity", v)}
                  placeholder="Ville"
                  className="text-gray-600 flex-1"
                />
              </div>
              <div className="flex items-center gap-2 pt-1">
                <span className="text-xs text-gray-400 shrink-0 w-16">SIREN</span>
                <F
                  value={data.clientSiren ?? ""}
                  onChange={(v) => upd("clientSiren", v)}
                  placeholder="123 456 789"
                  className="text-gray-600 text-xs"
                />
              </div>
            </div>
          </div>

          {/* ── TABLEAU DES PRESTATIONS ─────────────────────────────────────── */}
          <table className="w-full text-sm mb-1" style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #111827" }}>
                <th className="text-left text-xs font-semibold text-gray-500 pb-2 pr-3">
                  Description
                </th>
                <th className="text-center text-xs font-semibold text-gray-500 pb-2 w-14">
                  Qté
                </th>
                <th className="text-right text-xs font-semibold text-gray-500 pb-2 w-28 px-1">
                  Prix unit. HT
                </th>
                {!data.vatExempt && (
                  <th className="text-right text-xs font-semibold text-gray-500 pb-2 w-20 px-1">
                    TVA %
                  </th>
                )}
                <th className="text-right text-xs font-semibold text-gray-500 pb-2 w-28 pl-2">
                  Total HT
                </th>
                <th className="no-export w-8 pb-2" />
              </tr>
            </thead>
            <tbody>
              {data.lineItems.map((item) => {
                const effectiveTax = item.taxRate ?? data.taxRate
                return (
                  <tr key={item.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                    <td className="py-2 pr-3">
                      <F
                        value={item.description}
                        onChange={(v) => updateItem(item.id, { ...item, description: v })}
                        placeholder="Description de la prestation"
                      />
                    </td>
                    <td className="py-2 px-1">
                      <N
                        value={item.quantity}
                        onChange={(v) => updateItem(item.id, { ...item, quantity: v })}
                        step={1}
                        className="text-center"
                      />
                    </td>
                    <td className="py-2 px-1">
                      <N
                        value={item.unitPrice}
                        onChange={(v) => updateItem(item.id, { ...item, unitPrice: v })}
                        step={0.01}
                        placeholder="0,00"
                        className="text-right"
                      />
                    </td>
                    {!data.vatExempt && (
                      <td className="py-2 px-1">
                        <div className="relative">
                          <N
                            value={effectiveTax}
                            onChange={(v) => updateItem(item.id, { ...item, taxRate: v })}
                            max={100}
                            step={0.1}
                            className="text-right pr-5"
                          />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">
                            %
                          </span>
                        </div>
                      </td>
                    )}
                    <td className="py-2 pl-2 text-right font-medium text-gray-800 tabular-nums whitespace-nowrap">
                      {fmt(r2(item.quantity * item.unitPrice))} €
                    </td>
                    <td className="py-2 no-export">
                      <button
                        onClick={() => removeItem(item.id)}
                        aria-label="Supprimer cette ligne"
                        className="text-gray-300 hover:text-red-500 transition-colors p-0.5"
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {/* Ajouter une ligne */}
          <button
            onClick={addItem}
            className="no-export flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-700 transition-colors mt-2 mb-8"
          >
            <Plus size={13} />
            Ajouter une ligne
          </button>

          {/* ── TOTAUX ──────────────────────────────────────────────────────── */}
          <div className="flex justify-end mb-8">
            <div className="w-72 space-y-2 text-sm">
              <div className="flex justify-between text-gray-600">
                <span>Total HT</span>
                <span className="tabular-nums">{fmt(subtotal)} €</span>
              </div>
              {data.discountPercent > 0 && (
                <div className="flex justify-between text-gray-500">
                  <span>Remise ({data.discountPercent}%)</span>
                  <span className="tabular-nums">−{fmt(discountAmount)} €</span>
                </div>
              )}
              {data.vatExempt ? (
                <div className="flex justify-between text-gray-400 text-xs italic">
                  <span>TVA</span>
                  <span>Non applicable</span>
                </div>
              ) : (
                Object.entries(taxByRate)
                  .sort(([a], [b]) => Number(a) - Number(b))
                  .map(([rate, amount]) => (
                    <div key={rate} className="flex justify-between text-gray-600">
                      <span>TVA {rate}%</span>
                      <span className="tabular-nums">{fmt(amount)} €</span>
                    </div>
                  ))
              )}
              <div
                className="flex justify-between pt-3 mt-1"
                style={{ borderTop: "2px solid #111827" }}
              >
                <span
                  className="font-bold text-base text-gray-900"
                  style={{ fontFamily: "'Syne', sans-serif" }}
                >
                  TOTAL TTC
                </span>
                <span
                  className="font-bold text-base tabular-nums whitespace-nowrap text-gray-900"
                  style={{ fontFamily: "'Syne', sans-serif" }}
                >
                  {fmt(total)} €
                </span>
              </div>
            </div>
          </div>

          {/* ── CONDITIONS & NOTES ──────────────────────────────────────────── */}
          <div
            className="border-t border-gray-100 pt-4 mb-4 text-xs space-y-1.5"
          >
            <div className="flex items-center gap-2 text-gray-600">
              <span className="text-gray-400 shrink-0 w-24">Paiement</span>
              <F
                value={data.paymentTerms}
                onChange={(v) => upd("paymentTerms", v)}
                placeholder="Virement bancaire sous 30 jours"
                className="text-gray-600"
              />
            </div>
            <div className="flex items-start gap-2 text-gray-600">
              <span className="text-gray-400 shrink-0 w-24 pt-0.5">Notes</span>
              <textarea
                value={data.notes}
                onChange={(e) => upd("notes", e.target.value)}
                placeholder="Merci pour votre confiance…"
                rows={2}
                className="editable text-gray-600 resize-none flex-1"
              />
            </div>
          </div>

          {/* ── MENTIONS LÉGALES ────────────────────────────────────────────── */}
          <div className="border-t border-gray-100 pt-4 text-[10px] text-gray-400 space-y-0.5 leading-relaxed">
            {(data.senderCompany || legalLabel) && (
              <p>{[data.senderCompany, legalLabel].filter(Boolean).join(" — ")}</p>
            )}
            {data.senderSiret && <p>SIRET : {data.senderSiret}</p>}
            {!data.vatExempt && data.senderVatNumber && (
              <p>N° TVA intracommunautaire : {data.senderVatNumber}</p>
            )}
            {data.vatExempt && (
              <p className="italic">Exonéré de TVA, art. 293B du CGI</p>
            )}
            {(data.senderAddress || data.senderZip || data.senderCity) && (
              <p>
                {[data.senderAddress, [data.senderZip, data.senderCity].filter(Boolean).join(" ")]
                  .filter(Boolean)
                  .join(", ")}
              </p>
            )}
            {(data.senderEmail || data.senderPhone) && (
              <p>{[data.senderEmail, data.senderPhone].filter(Boolean).join(" · ")}</p>
            )}
            <p className="mt-1">
              En cas de retard de paiement, une pénalité de 3 fois le taux d'intérêt légal sera appliquée,
              ainsi qu'une indemnité forfaitaire de recouvrement de <strong>40 €</strong> (art. L441-10 C. com.).
            </p>
          </div>

        </div>
      </main>
    </div>
  )
}
