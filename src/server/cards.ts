// The card contract. Defined once in Zod; schemas/card.schema.json is emitted from it and diffed in a test.
// Nothing here claims to be how real Alexa+ renders cards: the simulator is the reference renderer.
import { z } from "zod";

export const SlotStateSchema = z.enum(["taken", "missed", "due", "upcoming", "nodata", "overdue"]);

export const CardSchema = z.object({
  ui: z.enum(["card", "carousel"]).describe("card = a single panel, carousel = a row of items such as days"),
  layout: z.enum(["panel", "week-strip", "list", "timeline"]).optional().describe("hint for renderers; a week-strip is a 7-column strip, not a swipe carousel"),
  title: z.string().max(120),
  text: z.string().max(600).describe("plain text fallback, always present"),
  items: z.array(z.object({
    label: z.string().max(80),
    value: z.string().max(200).optional(),
    state: SlotStateSchema.optional(),
    meta: z.string().max(200).optional(),
    doses: z.array(z.object({ item: z.string(), hhmm: z.string(), state: SlotStateSchema })).optional(),
  })).max(50),
  actions: z.array(z.object({ label: z.string().max(40), tool: z.string(), args: z.record(z.string(), z.string()).optional() })).max(6),
  timeline: z.object({
    title: z.string(),
    status: z.string(),
    events: z.array(z.object({ time: z.string(), label: z.string(), kind: z.enum(["done", "alert", "plain"]) })),
  }).optional(),
  data: z.record(z.string(), z.unknown()).optional().describe("tool-specific extras such as a schedule proposal version"),
});

export type Card = z.infer<typeof CardSchema>;

export function cardJsonSchema(): unknown {
  return z.toJSONSchema(CardSchema, { target: "draft-2020-12" });
}
