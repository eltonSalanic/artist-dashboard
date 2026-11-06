import { useState } from "react";
import { View } from "react-native";
import { categoryLabel, formatMoney } from "@artist/shared";
import {
  useFinanceEntry,
  useFinanceSummary,
  usePermissions,
  useRejectFinanceEntry,
} from "@artist/api-client";
import { PosterText } from "@/components/poster-text";
import { TextField } from "@/components/text-field";
import { spacing, useThemeColors } from "@/theme";
import { FormGate } from "./form-gate";
import { FormScreen } from "./form-screen";

/**
 * An admin sends a member's out-of-pocket expense back. Just a note: what the
 * member reads to know what to fix. The entry stops counting until they save
 * it again, which puts it back in front of the admins.
 *
 *   ?id=…  the entry being sent back
 */
export function RejectForm({
  boardId,
  entryId,
}: {
  boardId: string;
  entryId: string;
}) {
  const { can } = usePermissions();
  const entry = useFinanceEntry(boardId, entryId);
  const summary = useFinanceSummary(boardId, {}, can("finance.manage"));
  return (
    <FormGate
      allowed={can("finance.manage")}
      pending={entry.isPending || summary.isPending}
      missing={!entry.data || entry.data.state !== "PENDING"}
      what="entry waiting for approval"
    >
      {entry.data && summary.data && (
        <RejectFields
          boardId={boardId}
          entryId={entryId}
          label={entry.data.description || categoryLabel(entry.data.category)}
          amount={formatMoney(entry.data.amountCents, summary.data.currency)}
          who={
            summary.data.members.find((m) => m.id === entry.data?.handledById)
              ?.displayName ?? "A bandmate"
          }
        />
      )}
    </FormGate>
  );
}

function RejectFields({
  boardId,
  entryId,
  label,
  amount,
  who,
}: {
  boardId: string;
  entryId: string;
  label: string;
  amount: string;
  who: string;
}) {
  const colors = useThemeColors();
  const reject = useRejectFinanceEntry(boardId);
  const [note, setNote] = useState("");

  return (
    <FormScreen
      title="Send back"
      dirty={note !== ""}
      canSave
      saving={reject.isPending}
      onSave={() => reject.mutateAsync({ entryId, note: note.trim() })}
    >
      <View style={{ gap: spacing.md }}>
        <PosterText variant="cardMeta" color={colors.mutedForeground}>
          {`${who} paid ${amount} for ${label}. Sending it back stops it counting until they fix it and save again — then it comes back to you.`}
        </PosterText>
        <TextField
          label="Note to them"
          value={note}
          onChangeText={setNote}
          placeholder="What should they fix? “Add the receipt”, “Was this the band’s?”…"
          multiline
          maxLength={500}
          textAlignVertical="top"
          style={{ minHeight: 96 }}
          autoFocus
        />
      </View>
    </FormScreen>
  );
}
