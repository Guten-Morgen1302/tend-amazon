// Emits schemas/card.schema.json from the Zod card definition (single source of truth).
import { writeFileSync, mkdirSync } from "node:fs";
import { cardJsonSchema } from "../src/server/cards.js";

mkdirSync("schemas", { recursive: true });
writeFileSync("schemas/card.schema.json", JSON.stringify(cardJsonSchema(), null, 2) + "\n");
console.log("wrote schemas/card.schema.json");
