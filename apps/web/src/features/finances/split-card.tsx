"use client";

import { useState } from "react";
import {
  BOARD_CURRENCIES,
  BPS_WHOLE,
  equalSplit,
  isValidSplit,
  type FinanceMemberRef,
  type SplitShare,
} from "@artist/shared";
import {
  useFinanceSplit,
  usePermissions,
  useUpdateFinanceSettings,
  useUpdateFinanceSplit,
} from "@artist/api-client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { OptionSelect, memberNamer } from "./finance-bits";

const FUND = "fund";
const pct = (bps: number) => String(bps / 100);
const toBps = (text: string) => Math.round(Number(text) * 100);

/**
 * The board's default split and currency. A change applies to money logged
 * from now on — each entry keeps the split it was written with.
 */
export function SplitCard({
  boardId,
  members,
  currency,
}: {
  boardId: string;
  members: FinanceMemberRef[];
  currency: string;
}) {
  const split = useFinanceSplit(boardId);
  if (!split.data) return <Skeleton className="h-64" />;
  return (
    <SplitForm
      key={JSON.stringify(split.data.shares)}
      boardId={boardId}
      members={members}
      currency={currency}
      shares={split.data.shares}
      isDefault={split.data.isDefault}
    />
  );
}

function SplitForm({
  boardId,
  members,
  currency,
  shares,
  isDefault,
}: {
  boardId: string;
  members: FinanceMemberRef[];
  currency: string;
  shares: SplitShare[];
  isDefault: boolean;
}) {
  const { can } = usePermissions();
  const manages = can("finance.manage");
  const save = useUpdateFinanceSplit(boardId);
  const saveSettings = useUpdateFinanceSettings(boardId);
  const name = memberNamer(members);

  const initial = () => {
    const byId = new Map(shares.map((s) => [s.userId ?? FUND, s.shareBps]));
    const values: Record<string, string> = {
      [FUND]: pct(byId.get(FUND) ?? 0),
    };
    for (const m of members) values[m.id] = pct(byId.get(m.id) ?? 0);
    return values;
  };
  const [values, setValues] = useState<Record<string, string>>(initial);

  const draft: SplitShare[] = Object.entries(values)
    .map(([key, text]) => ({
      userId: key === FUND ? null : key,
      shareBps: toBps(text),
    }))
    .filter((s) => s.shareBps !== 0 || s.userId === null);
  const total = draft.reduce(
    (sum, s) => sum + (Number.isFinite(s.shareBps) ? s.shareBps : 0),
    0,
  );
  const valid = isValidSplit(draft);

  const evenWithFund = () => {
    const fund = toBps(values[FUND] || "0");
    const even = equalSplit(
      members.map((m) => m.id),
      Number.isFinite(fund) ? fund : 0,
    );
    const next: Record<string, string> = { [FUND]: "0" };
    for (const m of members) next[m.id] = "0";
    for (const s of even) next[s.userId ?? FUND] = pct(s.shareBps);
    setValues(next);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>How money is split</CardTitle>
        <CardDescription>
          {isDefault
            ? "Nobody has set a split yet, so everyone gets an equal share."
            : "Applies to money logged from now on. Past entries keep their split."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <ul className="flex flex-col gap-2">
          {[FUND, ...members.map((m) => m.id)].map((key) => (
            <li key={key} className="flex items-center gap-3">
              <span className="flex-1 text-sm">
                {key === FUND ? "Band fund" : name(key)}
              </span>
              {manages ? (
                <div className="flex items-center gap-1">
                  <Input
                    className="h-8 w-20 text-right"
                    inputMode="decimal"
                    aria-label={`${key === FUND ? "Band fund" : name(key)} share`}
                    value={values[key] ?? "0"}
                    onChange={(e) =>
                      setValues((prev) => ({ ...prev, [key]: e.target.value }))
                    }
                  />
                  <span className="text-sm text-muted-foreground">%</span>
                </div>
              ) : (
                <span className="text-sm tabular-nums">{values[key] ?? "0"}%</span>
              )}
            </li>
          ))}
        </ul>

        {manages && (
          <>
            <p
              className={
                valid ? "text-xs text-muted-foreground" : "text-xs text-destructive"
              }
            >
              Total {(total / 100).toFixed(2).replace(/\.00$/, "")}%
              {valid ? "" : ` — needs to be exactly ${BPS_WHOLE / 100}%`}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={evenWithFund}>
                Split the rest evenly
              </Button>
              <Button
                size="sm"
                disabled={!valid || save.isPending}
                onClick={() =>
                  save.mutate({ shares: draft.filter((s) => s.shareBps > 0) })
                }
              >
                {save.isPending ? "Saving…" : "Save split"}
              </Button>
            </div>
            <Field className="max-w-48">
              <FieldLabel htmlFor="finance-currency">Currency</FieldLabel>
              <OptionSelect
                id="finance-currency"
                value={currency}
                onChange={(v) =>
                  saveSettings.mutate({
                    currency: v as (typeof BOARD_CURRENCIES)[number],
                  })
                }
                options={BOARD_CURRENCIES.map((c) => ({ value: c, label: c }))}
              />
            </Field>
          </>
        )}
      </CardContent>
    </Card>
  );
}
