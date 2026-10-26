import { z } from "zod";

export const LinkParentKinds = ["TASK", "EVENT", "GOAL", "REMINDER"] as const;
export type LinkParentKind = (typeof LinkParentKinds)[number];

export const linkParentSchema = z.object({
  kind: z.enum(LinkParentKinds),
  parentId: z.uuid(),
});
export type LinkParentDto = z.infer<typeof linkParentSchema>;

/** Pasted Drive/Sheets addresses often omit the scheme. Only web URLs open. */
export const itemLinkUrlSchema = z
  .string()
  .trim()
  .min(1, "Enter a link")
  .max(2048)
  .transform((value) =>
    /^[a-z][a-z\d+.-]*:/i.test(value) ? value : `https://${value}`,
  )
  .pipe(
    z.url({ protocol: /^https?$/, error: "Enter a valid http or https link" }),
  )
  .refine((value) => {
    try {
      const url = new URL(value);
      return !url.username && !url.password;
    } catch {
      return false;
    }
  }, "Use a link without a username or password");

export const itemLinkInputSchema = z.object({
  title: z.string().trim().max(200).default(""),
  url: itemLinkUrlSchema,
});
export type ItemLinkInputDto = z.infer<typeof itemLinkInputSchema>;
export const createItemLinkSchema = linkParentSchema.extend(
  itemLinkInputSchema.shape,
);
export type CreateItemLinkDto = z.infer<typeof createItemLinkSchema>;

export interface ItemLinkDto {
  id: string;
  title: string;
  url: string;
  createdById: string;
  createdAt: string;
}
