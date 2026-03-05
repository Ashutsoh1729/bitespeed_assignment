import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
  pgEnum,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

export const linkPrecedenceEnum = pgEnum("link_precedence", [
  "primary",
  "secondary",
]);

export const contacts = pgTable("contacts", {
  id: serial("id").primaryKey(),
  phoneNumber: text("phone_number"),
  email: text("email"),
  linkedId: integer("linked_id").references((): AnyPgColumn => contacts.id),
  linkPrecedence: linkPrecedenceEnum("link_precedence").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  deletedAt: timestamp("deleted_at"),
});
