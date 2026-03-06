import { db } from "./db/client";
import { eq, or, inArray } from "drizzle-orm";
import { contacts } from "./db/schema";

export interface IdentifyResponse {
    contact: {
        primaryContactId: number;
        emails?: string[]; // primary's email first
        phoneNumbers?: string[]; // primary's phone first
        secondaryContactIds?: number[];
    };
}

export async function handleRequest(
    email?: string,
    phoneNumber?: string,
): Promise<IdentifyResponse> {
    // TODO: Look into this a little more
    if (!email && !phoneNumber) {
        throw new Error("Email or phone number is required");
    }

    // db transaction
    const result = await db.transaction(async (tx) => {
        // check if the contact already exists
        const existingContacts = await tx
            .select()
            .from(contacts)
            .where(
                or(
                    email ? eq(contacts.email, email) : undefined,
                    phoneNumber ? eq(contacts.phoneNumber, phoneNumber) : undefined,
                ),
            );

        // CASE: 1 - No prior data exists
        if (existingContacts.length === 0) {
            // create a new row and then exit
            const newContact = await tx
                .insert(contacts)
                .values({
                    email,
                    phoneNumber,
                    linkPrecedence: "primary",
                })
                .returning();
            // exit the transaction
            return newContact;
        }

        // SUPER CASE: 2, 3, 4 - Prior data exists

        // TODO: One action file is planned for implementation, at  'docs/brainstorm/full_chain_resolution_plan.md
        else {

            // handled cases are - 
            // CASE: 2 - Exact match
            // CASE: 3 - Partial match
            // CASE: 4 - Two separate primaries get linked

            // Edge case: if only secondary contacts were matched,
            // fetch their parent primaries via linkedId
            const secondaryLinkedIds = existingContacts
                .filter(c => c.linkPrecedence === "secondary" && c.linkedId !== null)
                .map(c => c.linkedId!);

            if (secondaryLinkedIds.length > 0) {
                const parentPrimaries = await tx
                    .select()
                    .from(contacts)
                    .where(inArray(contacts.id, secondaryLinkedIds));

                const existingIds = new Set(existingContacts.map(c => c.id));
                for (const p of parentPrimaries) {
                    if (!existingIds.has(p.id)) existingContacts.push(p);
                }
            }

            // no of primary contacts
            const primaryContacts = existingContacts.filter(
                (contact) => contact.linkPrecedence === "primary",
            );


            // case - 2 and 3
            if (primaryContacts.length === 1) {

                // boolean checking if the data is a primay data and already exists
                const isPrimaryData = existingContacts.some(
                    (contact) =>
                        contact.email === email && contact.phoneNumber === phoneNumber,
                );
                if (isPrimaryData) {
                    // exit the transaction
                    return existingContacts;
                }

                // CASE: 3 - Partial match
                else {
                    // create a new row and then exit
                    // find the primary contact
                    const primaryContact = primaryContacts[0]!;
                    const newContact = await tx
                        .insert(contacts)
                        .values({
                            email,
                            phoneNumber,
                            linkPrecedence: "secondary",
                            linkedId: primaryContact.id,
                        })
                        .returning();
                    // exit the transaction
                    return [...existingContacts, ...newContact];
                }

            } else {
                // CASE 4: Multiple primary contacts — link them

                // Sort primaries by createdAt ascending (oldest first)
                const sortedPrimaries = primaryContacts.sort(
                    (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
                );
                const olderPrimary = sortedPrimaries[0]!;
                const newerPrimary = sortedPrimaries[sortedPrimaries.length - 1]!;

                // Downgrade the newer primary to secondary
                await tx
                    .update(contacts)
                    .set({
                        linkPrecedence: "secondary",
                        linkedId: olderPrimary.id,
                        updatedAt: new Date(),
                    })
                    .where(eq(contacts.id, newerPrimary.id));

                // Re-link any secondaries that pointed to the newer primary
                await tx
                    .update(contacts)
                    .set({
                        linkedId: olderPrimary.id,
                        updatedAt: new Date(),
                    })
                    .where(eq(contacts.linkedId, newerPrimary.id));

                // Re-query to get the full updated contact list
                const updatedContacts = await tx
                    .select()
                    .from(contacts)
                    .where(
                        or(
                            eq(contacts.id, olderPrimary.id),
                            eq(contacts.linkedId, olderPrimary.id),
                        ),
                    );

                return updatedContacts;
            }

        }
    })!;

    const primary = result.find(c => c.linkPrecedence === "primary")!;

    const response = {
        contact: {
            primaryContactId: primary.id,
            emails: [primary.email, ...result
                .filter(c => c.id !== primary.id)
                .map(c => c.email)]
                .filter((e): e is string => e !== null),
            phoneNumbers: [primary.phoneNumber, ...result
                .filter(c => c.id !== primary.id)
                .map(c => c.phoneNumber)]
                .filter((p): p is string => p !== null),
            secondaryContactIds: result
                .filter(c => c.linkPrecedence === "secondary")
                .map(c => c.id),
        },
    };

    return response;
}
