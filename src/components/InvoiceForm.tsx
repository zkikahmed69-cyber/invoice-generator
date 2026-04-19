import { useCallback, useRef } from "react"
import { Plus, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { LineItemRow, getLineItemGrid } from "@/components/LineItemRow"
import type { InvoiceData, LineItem, DueDatePreset } from "@/types/invoice"

const LEGAL_FORMS = [
  { value: "auto-entrepreneur", label: "Auto-entrepreneur" },
  { value: "sasu", label: "SASU" },
  { value: "eurl", label: "EURL" },
  { value: "sarl", label: "SARL" },
  { value: "sas", label: "SAS" },
  { value: "sa", label: "SA" },
  { value: "autre", label: "Autre" },
]

const DUE_PRESETS: { label: string; value: DueDatePreset }[] = [
  { label: "15j", value: "15" },
  { label: "30j", value: "30" },
  { label: "45j", value: "45" },
  { label: "60j", value: "60" },
  { label: "Perso", value: "custom" },
]

interface InvoiceFormProps {
  value: InvoiceData
  onChange: (data: InvoiceData) => void
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="text-xs font-extrabold uppercase tracking-[0.15em] text-primary mb-4"
      style={{ fontFamily: "'Syne', sans-serif" }}
    >
      {children}
    </p>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <span className="text-sm font-medium text-foreground/80">{label}</span>
      {children}
    </div>
  )
}

function localDateStr(base: string, offsetDays: number): string {
  const d = new Date(base || Date.now())
  d.setDate(d.getDate() + offsetDays)
  return d.toLocaleDateString("en-CA")
}

export function InvoiceForm({ value, onChange }: InvoiceFormProps) {
  const logoInputRef = useRef<HTMLInputElement>(null)

  const set = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      onChange({ ...value, [e.target.name]: e.target.value })
    },
    [value, onChange]
  )

  const handlePercent = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const num = Math.max(0, Math.min(100, parseFloat(e.target.value) || 0))
      onChange({ ...value, [e.target.name]: num })
    },
    [value, onChange]
  )

  const handleDueDatePreset = useCallback(
    (preset: DueDatePreset) => {
      if (preset === "custom") {
        onChange({ ...value, dueDatePreset: "custom" })
      } else {
        onChange({
          ...value,
          dueDatePreset: preset,
          dueDate: localDateStr(value.invoiceDate, parseInt(preset)),
        })
      }
    },
    [value, onChange]
  )

  const handleLogoUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = (ev) => {
        onChange({ ...value, logoUrl: ev.target?.result as string })
      }
      reader.readAsDataURL(file)
    },
    [value, onChange]
  )

  const updateLineItem = useCallback(
    (id: string, updated: LineItem) =>
      onChange({
        ...value,
        lineItems: value.lineItems.map((item) => (item.id === id ? updated : item)),
      }),
    [value, onChange]
  )

  const removeLineItem = useCallback(
    (id: string) =>
      onChange({ ...value, lineItems: value.lineItems.filter((item) => item.id !== id) }),
    [value, onChange]
  )

  const addLineItem = useCallback(
    () =>
      onChange({
        ...value,
        lineItems: [
          ...value.lineItems,
          { id: crypto.randomUUID(), description: "", quantity: 1, unitPrice: 0 },
        ],
      }),
    [value, onChange]
  )


  return (
    <div className="p-6 space-y-8">

      {/* ── EXPÉDITEUR ───────────────────────────── */}
      <section>
        <SectionTitle>Expéditeur</SectionTitle>
        <div className="space-y-3">

          {/* Logo upload */}
          <div className="flex items-center gap-3">
            {value.logoUrl ? (
              <img
                src={value.logoUrl}
                alt="Logo"
                className="h-12 w-12 object-contain rounded border border-border/60"
              />
            ) : (
              <div className="h-12 w-12 rounded border border-dashed border-border/60 flex items-center justify-center text-muted-foreground">
                <Upload size={16} />
              </div>
            )}
            <div>
              <Button
                variant="outline"
                size="sm"
                className="text-xs gap-1.5"
                onClick={() => logoInputRef.current?.click()}
              >
                <Upload size={12} />
                {value.logoUrl ? "Changer le logo" : "Uploader un logo"}
              </Button>
              {value.logoUrl && (
                <button
                  className="ml-2 text-xs text-muted-foreground hover:text-destructive"
                  onClick={() => onChange({ ...value, logoUrl: "" })}
                >
                  Supprimer
                </button>
              )}
              <input
                ref={logoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleLogoUpload}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Nom">
              <Input name="senderName" value={value.senderName} onChange={set} placeholder="Jean Dupont" />
            </Field>
            <Field label="Société">
              <Input name="senderCompany" value={value.senderCompany} onChange={set} placeholder="Studio XYZ" />
            </Field>
          </div>

          <Field label="Forme juridique">
            <Select
              value={value.senderLegalForm}
              onValueChange={(v) => onChange({ ...value, senderLegalForm: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner…" />
              </SelectTrigger>
              <SelectContent>
                {LEGAL_FORMS.map((f) => (
                  <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Adresse">
            <Input name="senderAddress" value={value.senderAddress} onChange={set} placeholder="12 rue de la Paix, 75001 Paris" />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Email">
              <Input name="senderEmail" type="email" value={value.senderEmail} onChange={set} placeholder="contact@studio.fr" />
            </Field>
            <Field label="Téléphone">
              <Input name="senderPhone" value={value.senderPhone} onChange={set} placeholder="+33 6 00 00 00 00" />
            </Field>
          </div>

          <Field label="Numéro SIRET">
            <Input name="senderSiret" value={value.senderSiret} onChange={set} placeholder="123 456 789 00012" />
          </Field>

          <Field label="N° TVA intracommunautaire">
            <Input
              name="senderVatNumber"
              value={value.senderVatNumber}
              onChange={set}
              placeholder="FR12345678901"
              disabled={value.vatExempt}
              className={value.vatExempt ? "opacity-40" : ""}
            />
          </Field>
        </div>
      </section>

      <Separator />

      {/* ── CLIENT ───────────────────────────────── */}
      <section>
        <SectionTitle>Client</SectionTitle>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nom">
              <Input name="clientName" value={value.clientName} onChange={set} placeholder="Marie Martin" />
            </Field>
            <Field label="Société">
              <Input name="clientCompany" value={value.clientCompany} onChange={set} placeholder="Acme Corp" />
            </Field>
          </div>
          <Field label="Adresse">
            <Input name="clientAddress" value={value.clientAddress} onChange={set} placeholder="45 avenue Victor Hugo, 69001 Lyon" />
          </Field>
          <Field label="Email">
            <Input name="clientEmail" type="email" value={value.clientEmail} onChange={set} placeholder="marie@acme.fr" />
          </Field>
        </div>
      </section>

      <Separator />

      {/* ── FACTURE ──────────────────────────────── */}
      <section>
        <SectionTitle>Facture</SectionTitle>
        <div className="space-y-3">
          <Field label="Numéro de facture">
            <Input name="invoiceNumber" value={value.invoiceNumber} onChange={set} placeholder="INV-001" />
          </Field>

          <Field label="Date d'émission">
            <Input name="invoiceDate" type="date" value={value.invoiceDate} onChange={set} />
          </Field>

          <div>
            <span className="text-sm font-medium text-foreground/80 block mb-1.5">Délai de paiement</span>
            <div className="flex gap-1.5 flex-wrap">
              {DUE_PRESETS.map((p) => (
                <button
                  key={p.value}
                  onClick={() => handleDueDatePreset(p.value)}
                  className={`px-3 py-1.5 rounded text-xs font-semibold border transition-colors ${
                    value.dueDatePreset === p.value
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border text-muted-foreground hover:border-primary/60 hover:text-foreground"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {value.dueDatePreset === "custom" && (
            <Field label="Date d'échéance">
              <Input name="dueDate" type="date" value={value.dueDate} onChange={set} />
            </Field>
          )}
          {value.dueDatePreset !== "custom" && (
            <p className="text-xs text-muted-foreground">
              Échéance : <span className="text-foreground/70 font-medium">{value.dueDate}</span>
            </p>
          )}
        </div>
      </section>

      <Separator />

      {/* ── PRESTATIONS ──────────────────────────── */}
      <section>
        <SectionTitle>Prestations</SectionTitle>
        <div className="space-y-2">
          {value.lineItems.length > 0 && (
            <div className={getLineItemGrid(value.vatExempt).replace("items-center", "")}>
              <span className="text-xs text-muted-foreground">Description</span>
              <span className="text-xs text-muted-foreground text-center">Qté</span>
              <span className="text-xs text-muted-foreground">Prix unit.</span>
              {!value.vatExempt && (
                <span className="text-xs text-muted-foreground text-right">TVA</span>
              )}
              <span className="text-xs text-muted-foreground text-right">Total HT</span>
              <span />
            </div>
          )}
          {value.lineItems.map((item) => (
            <LineItemRow
              key={item.id}
              item={item}
              vatExempt={value.vatExempt}
              defaultTaxRate={value.taxRate}
              onChange={(updated) => updateLineItem(item.id, updated)}
              onRemove={() => removeLineItem(item.id)}
            />
          ))}
          <Button
            variant="outline"
            size="sm"
            onClick={addLineItem}
            className="w-full mt-1 border-dashed text-muted-foreground hover:text-foreground"
          >
            <Plus size={14} className="mr-1" />
            Ajouter une ligne
          </Button>
        </div>
      </section>

      <Separator />

      {/* ── FINANCES ─────────────────────────────── */}
      <section>
        <SectionTitle>Finances</SectionTitle>
        <div className="space-y-3">
          <div className="flex items-center gap-2.5">
            <Checkbox
              id="vatExempt"
              checked={value.vatExempt}
              onCheckedChange={(checked) =>
                onChange({ ...value, vatExempt: !!checked, taxRate: checked ? 0 : 20 })
              }
            />
            <Label htmlFor="vatExempt" className="text-sm font-medium cursor-pointer">
              Sans TVA — art. 293B du CGI
            </Label>
          </div>

          {!value.vatExempt && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="TVA par défaut (%)">
                <Input
                  name="taxRate"
                  type="number" min="0" max="100" step="0.1"
                  value={value.taxRate || ""}
                  onChange={handlePercent}
                  placeholder="20"
                />
              </Field>
              <Field label="Remise (%)">
                <Input
                  name="discountPercent"
                  type="number" min="0" max="100" step="0.1"
                  value={value.discountPercent || ""}
                  onChange={handlePercent}
                  placeholder="0"
                />
              </Field>
            </div>
          )}

          {value.vatExempt && (
            <div className="grid grid-cols-1 gap-3">
              <Field label="Remise (%)">
                <Input
                  name="discountPercent"
                  type="number" min="0" max="100" step="0.1"
                  value={value.discountPercent || ""}
                  onChange={handlePercent}
                  placeholder="0"
                />
              </Field>
            </div>
          )}
        </div>
      </section>

      <Separator />

      {/* ── NOTES ────────────────────────────────── */}
      <section>
        <SectionTitle>Notes</SectionTitle>
        <div className="space-y-3">
          <Field label="Conditions de paiement">
            <Input
              name="paymentTerms"
              value={value.paymentTerms}
              onChange={set}
              placeholder="Virement bancaire sous 30 jours"
            />
          </Field>
          <Field label="Notes / Conditions particulières">
            <Textarea
              name="notes"
              value={value.notes}
              onChange={set}
              placeholder="Merci pour votre confiance. Tout litige sera soumis au tribunal de commerce de Paris."
              rows={4}
            />
          </Field>
        </div>
      </section>

    </div>
  )
}
