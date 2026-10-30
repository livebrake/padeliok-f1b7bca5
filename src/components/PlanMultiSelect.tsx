import { ChevronDown, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";

export const PROMO_PLANS = [["bazinis", "Bazinis"], ["standartinis", "Standartinis"], ["premium", "Premium"]] as const;
export const planName = (k: string) => PROMO_PLANS.find(p => p[0] === k)?.[1] ?? k;

/** Empty value = all plans. */
export function PlanMultiSelect({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const all = value.length === 0 || value.length === PROMO_PLANS.length;
  const toggle = (k: string) => {
    const base = value.length ? value : [];
    const next = base.includes(k) ? base.filter(x => x !== k) : [...base, k];
    onChange(next.length === PROMO_PLANS.length ? [] : next);
  };
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" aria-label="Planai" className="flex min-h-9 w-full items-center gap-1 rounded-md border border-input bg-background px-2 py-1 text-left text-sm">
          <span className="flex flex-1 flex-wrap gap-1">
            {all ? <Badge variant="secondary">Visi planai</Badge> : value.map(k => (
              <Badge key={k} variant="secondary" className="gap-1">{planName(k)}
                <span role="button" aria-label={`Pašalinti ${planName(k)}`} onPointerDown={e => { e.preventDefault(); e.stopPropagation(); toggle(k); }}><X className="h-3 w-3" /></span>
              </Badge>))}
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2" align="start">
        <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted">
          <Checkbox checked={all} onCheckedChange={() => onChange([])} />Visi planai
        </label>
        <div className="my-1 border-t" />
        {PROMO_PLANS.map(([k, l]) => (
          <label key={k} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted">
            <Checkbox checked={!all && value.includes(k)} onCheckedChange={() => toggle(k)} />{l}
          </label>
        ))}
      </PopoverContent>
    </Popover>
  );
}
