import { memo } from "react"
import { Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { LineItem } from "@/types/invoice"

export function getLineItemGrid(vatExempt: boolean) {
  return vatExempt
    ? "grid grid-cols-[2fr_70px_100px_90px_36px] gap-2 items-center"
    : "grid grid-cols-[2fr_60px_88px_62px_80px_36px] gap-2 items-center"
}

export const LINE_ITEM_GRID = getLineItemGrid(false)

interface LineItemRowProps {
  item: LineItem
  vatExempt: boolean
  defaultTaxRate: number
  onChange: (item: LineItem) => void
  onRemove: () => void
}

export const LineItemRow = memo(function LineItemRow({
  item, vatExempt, defaultTaxRate, onChange, onRemove,
}: LineItemRowProps) {
  const total = item.quantity * item.unitPrice

  const handleNum = (field: "quantity" | "unitPrice") =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value
      const num = raw === "" ? 0 : Math.max(0, parseFloat(raw) || 0)
      onChange({ ...item, [field]: num })
    }

  const handleTaxRate = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value
    if (raw === "") {
      const { taxRate: _removed, ...rest } = item
      onChange(rest as LineItem)
    } else {
      onChange({ ...item, taxRate: Math.max(0, Math.min(100, parseFloat(raw) || 0)) })
    }
  }

  return (
    <div className={getLineItemGrid(vatExempt)}>
      <Input
        placeholder="Description de la prestation"
        value={item.description}
        onChange={(e) => onChange({ ...item, description: e.target.value })}
      />
      <Input
        type="number"
        min="0"
        step="1"
        placeholder="Qté"
        value={item.quantity || ""}
        onChange={handleNum("quantity")}
        className="text-center"
      />
      <Input
        type="number"
        min="0"
        step="0.01"
        placeholder="Prix"
        value={item.unitPrice || ""}
        onChange={handleNum("unitPrice")}
      />
      {!vatExempt && (
        <div className="relative">
          <Input
            type="number"
            min="0"
            max="100"
            step="0.1"
            placeholder={String(defaultTaxRate)}
            value={item.taxRate !== undefined ? item.taxRate : ""}
            onChange={handleTaxRate}
            className="pr-5 text-right"
          />
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
            %
          </span>
        </div>
      )}
      <span className="text-sm text-right text-muted-foreground tabular-nums pr-1">
        {total.toFixed(2)} €
      </span>
      <Button
        variant="ghost"
        size="icon"
        onClick={onRemove}
        aria-label="Supprimer cette ligne"
        className="text-muted-foreground hover:text-destructive h-8 w-8"
      >
        <Trash2 size={14} />
      </Button>
    </div>
  )
})
