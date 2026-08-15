import { z } from "zod";
import { slugSchema } from "../../lib/validation/forms";
import type { RichNode } from "../../lib/validation/content";

export const adminPostSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(1, "Вкажіть службову назву").max(200),
  h1: z.string().trim().min(1, "Вкажіть заголовок H1").max(200),
  slug: slugSchema,
  excerpt: z.string().trim().min(1, "Додайте короткий опис").max(1000),
  type: z.enum(["ARTICLE", "CITY_PAGE", "LANDING", "STATISTICS", "TOOL", "AI_TOOL", "GUIDE"]),
  body: z.string().trim().min(1, "Напишіть текст статті").max(100_000),
  metaTitle: z.string().trim().max(300).optional(),
  metaDescription: z.string().trim().max(500).optional(),
  canonicalUrl: z.union([z.literal(""), z.string().url("Canonical URL має бути повною адресою")]),
  robotsIndex: z.boolean(),
  robotsFollow: z.boolean(),
  sitemapEnabled: z.boolean(),
  maxImagePreview: z.enum(["none", "standard", "large"]),
  schemaType: z.enum(["Article", "WebPage", "SoftwareApplication", "WebApplication"]),
  openGraphTitle: z.string().trim().max(300).optional(),
  openGraphDescription: z.string().trim().max(500).optional(),
  openGraphImageId: z.union([z.literal(""), z.string().uuid()]),
  categoryIds: z.array(z.string().uuid()).max(50),
  cityIds: z.array(z.string().uuid()).max(50),
});

export function structuredContentFromText(body: string): RichNode {
  const blocks: RichNode[] = [];
  for (const block of body.split(/\n{2,}/).map((value) => value.trim()).filter(Boolean)) {
    const heading = /^(#{2,4})\s+(.+)$/s.exec(block);
    if (heading) {
      blocks.push({
        type: "heading",
        attrs: { level: heading[1].length },
        content: [{ type: "text", text: heading[2].trim() }],
      });
      continue;
    }
    const items = block.split("\n").filter((line) => line.startsWith("- "));
    if (items.length && items.length === block.split("\n").length) {
      blocks.push({
        type: "bulletList",
        content: items.map((item) => ({
          type: "listItem",
          content: [{ type: "paragraph", content: [{ type: "text", text: item.slice(2) }] }],
        })),
      });
      continue;
    }
    blocks.push({ type: "paragraph", content: [{ type: "text", text: block }] });
  }
  return { type: "doc", content: blocks };
}

export function textFromStructuredContent(value: unknown): string {
  if (!value || typeof value !== "object") return "";
  const node = value as RichNode;
  const text = (item: RichNode): string => item.text ?? item.content?.map(text).join("") ?? "";
  return (node.content ?? [])
    .map((item) => {
      if (item.type === "heading") return `${"#".repeat(Number(item.attrs?.level) || 2)} ${text(item)}`;
      if (item.type === "bulletList") return item.content?.map((listItem) => `- ${text(listItem)}`).join("\n") ?? "";
      return text(item);
    })
    .join("\n\n");
}
