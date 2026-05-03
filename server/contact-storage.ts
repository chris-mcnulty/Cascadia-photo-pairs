import { db } from "./db";
import { eq, and, sql, inArray, desc, ilike, or, type SQL } from "drizzle-orm";
import {
  contacts,
  contactLists,
  contactListMembers,
  emailCampaigns,
  emailCampaignRecipients,
  type Contact,
  type InsertContact,
  type ContactList,
  type InsertContactList,
  type EmailCampaign,
  type InsertEmailCampaign,
  type EmailCampaignRecipient,
} from "@shared/schema";
import { generateUnsubscribeToken } from "./campaign-service";

export const contactStorage = {
  // ---------------- Contacts ----------------
  async list(filters: {
    search?: string;
    source?: string;
    optIn?: "all" | "in" | "out";
    listId?: string;
    tag?: string;
  } = {}): Promise<Array<Contact & { listIds: string[] }>> {
    const where: SQL[] = [];
    if (filters.search) {
      const s = `%${filters.search.toLowerCase()}%`;
      const c = or(
        ilike(contacts.email, s),
        ilike(contacts.firstName, s),
        ilike(contacts.lastName, s),
      );
      if (c) where.push(c);
    }
    if (filters.source) where.push(eq(contacts.source, filters.source));
    if (filters.optIn === "in") where.push(eq(contacts.marketingOptIn, true));
    if (filters.optIn === "out") {
      const c = or(
        eq(contacts.marketingOptIn, false),
        sql`${contacts.unsubscribedAt} is not null`,
      );
      if (c) where.push(c);
    }
    if (filters.tag) {
      where.push(sql`${contacts.tags} @> ARRAY[${filters.tag}]::text[]`);
    }

    let rows: Contact[];
    if (filters.listId) {
      const memberContactIds = await db
        .select({ id: contactListMembers.contactId })
        .from(contactListMembers)
        .where(eq(contactListMembers.listId, filters.listId));
      const ids = memberContactIds.map((r) => r.id);
      if (ids.length === 0) return [];
      where.push(inArray(contacts.id, ids));
    }

    rows = await db
      .select()
      .from(contacts)
      .where(where.length ? and(...where) : undefined)
      .orderBy(desc(contacts.createdAt))
      .limit(2000);

    if (rows.length === 0) return [];
    const memberRows = await db
      .select()
      .from(contactListMembers)
      .where(inArray(contactListMembers.contactId, rows.map((r) => r.id)));
    const byContact = new Map<string, string[]>();
    for (const m of memberRows) {
      if (!byContact.has(m.contactId)) byContact.set(m.contactId, []);
      byContact.get(m.contactId)!.push(m.listId);
    }
    return rows.map((r) => ({ ...r, listIds: byContact.get(r.id) || [] }));
  },

  async get(id: string): Promise<Contact | undefined> {
    const [row] = await db.select().from(contacts).where(eq(contacts.id, id));
    return row;
  },

  async getByEmail(email: string): Promise<Contact | undefined> {
    const [row] = await db
      .select()
      .from(contacts)
      .where(sql`lower(${contacts.email}) = ${email.toLowerCase()}`);
    return row;
  },

  async getByToken(token: string): Promise<Contact | undefined> {
    const [row] = await db.select().from(contacts).where(eq(contacts.unsubscribeToken, token));
    return row;
  },

  async create(input: InsertContact): Promise<Contact> {
    const lowered = input.email.trim().toLowerCase();
    const [row] = await db
      .insert(contacts)
      .values({
        ...input,
        email: lowered,
        unsubscribeToken: generateUnsubscribeToken(),
      })
      .returning();
    return row;
  },

  async createOrUpdateMembership(input: InsertContact, listId?: string): Promise<Contact> {
    return await db.transaction(async (tx) => {
      const lowered = input.email.trim().toLowerCase();
      const [row] = await tx
        .insert(contacts)
        .values({ ...input, email: lowered, unsubscribeToken: generateUnsubscribeToken() })
        .returning();
      if (listId) {
        await tx.execute(sql`
          INSERT INTO contact_list_members (list_id, contact_id)
          VALUES (${listId}, ${row.id})
          ON CONFLICT (list_id, contact_id) DO NOTHING
        `);
      }
      return row;
    });
  },

  async update(id: string, updates: Partial<InsertContact>): Promise<Contact | undefined> {
    const patch: Partial<InsertContact> & { updatedAt: Date } = {
      ...updates,
      updatedAt: new Date(),
    };
    if (typeof updates.email === "string") patch.email = updates.email.trim().toLowerCase();
    const [row] = await db.update(contacts).set(patch).where(eq(contacts.id, id)).returning();
    return row;
  },

  async setOptIn(id: string, optIn: boolean): Promise<Contact | undefined> {
    const [row] = await db
      .update(contacts)
      .set({
        marketingOptIn: optIn,
        unsubscribedAt: optIn ? null : new Date(),
        updatedAt: new Date(),
      })
      .where(eq(contacts.id, id))
      .returning();
    return row;
  },

  async bulkSetOptIn(ids: string[], optIn: boolean): Promise<number> {
    if (ids.length === 0) return 0;
    const r = await db
      .update(contacts)
      .set({
        marketingOptIn: optIn,
        unsubscribedAt: optIn ? null : new Date(),
        updatedAt: new Date(),
      })
      .where(inArray(contacts.id, ids));
    return r.rowCount || 0;
  },

  async listTags(): Promise<string[]> {
    const result = await db.execute(sql`
      SELECT DISTINCT unnest(tags) AS tag FROM contacts WHERE array_length(tags, 1) > 0 ORDER BY tag
    `);
    const rows = (result as unknown as { rows: Array<{ tag: string }> }).rows;
    return rows.map((r) => r.tag);
  },

  async getCampaignsForContact(contactId: string): Promise<Array<EmailCampaignRecipient & { campaignName: string; campaignSubject: string }>> {
    const rows = await db
      .select({
        id: emailCampaignRecipients.id,
        campaignId: emailCampaignRecipients.campaignId,
        contactId: emailCampaignRecipients.contactId,
        email: emailCampaignRecipients.email,
        status: emailCampaignRecipients.status,
        sendgridMessageId: emailCampaignRecipients.sendgridMessageId,
        errorMessage: emailCampaignRecipients.errorMessage,
        sentAt: emailCampaignRecipients.sentAt,
        createdAt: emailCampaignRecipients.createdAt,
        campaignName: emailCampaigns.name,
        campaignSubject: emailCampaigns.subject,
      })
      .from(emailCampaignRecipients)
      .innerJoin(emailCampaigns, eq(emailCampaignRecipients.campaignId, emailCampaigns.id))
      .where(eq(emailCampaignRecipients.contactId, contactId))
      .orderBy(desc(emailCampaignRecipients.createdAt))
      .limit(200);
    return rows;
  },

  async unsubscribeByToken(token: string): Promise<Contact | undefined> {
    const [row] = await db
      .update(contacts)
      .set({
        marketingOptIn: false,
        unsubscribedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(contacts.unsubscribeToken, token))
      .returning();
    return row;
  },

  async delete(id: string): Promise<boolean> {
    return await db.transaction(async (tx) => {
      await tx.delete(contactListMembers).where(eq(contactListMembers.contactId, id));
      const r = await tx.delete(contacts).where(eq(contacts.id, id));
      return (r.rowCount || 0) > 0;
    });
  },

  async importCsv(
    rows: Array<{ email: string; firstName?: string; lastName?: string; tags?: string[]; marketingOptIn?: boolean }>,
  ): Promise<{ created: number; skipped: number }> {
    let created = 0;
    let skipped = 0;
    for (const r of rows) {
      if (!r.email || !r.email.includes("@")) {
        skipped++;
        continue;
      }
      const lowered = r.email.trim().toLowerCase();
      const result = await db.execute(sql`
        INSERT INTO contacts (email, first_name, last_name, source, tags,
                              marketing_opt_in, unsubscribe_token)
        VALUES (${lowered}, ${r.firstName ?? null}, ${r.lastName ?? null}, 'csv',
                ${r.tags ?? []}::text[], ${r.marketingOptIn ?? true},
                ${generateUnsubscribeToken()})
        ON CONFLICT (email) DO NOTHING
        RETURNING id
      `);
      if (((result as { rowCount?: number | null }).rowCount ?? 0) > 0) created++;
      else skipped++;
    }
    return { created, skipped };
  },

  // ---------------- Lists ----------------
  async listLists(): Promise<Array<ContactList & { memberCount: number }>> {
    const lists = await db.select().from(contactLists).orderBy(contactLists.name);
    if (lists.length === 0) return [];
    const counts = await db
      .select({
        listId: contactListMembers.listId,
        n: sql<number>`count(*)::int`,
      })
      .from(contactListMembers)
      .groupBy(contactListMembers.listId);
    const byId = new Map(counts.map((c) => [c.listId, c.n]));
    return lists.map((l) => ({ ...l, memberCount: byId.get(l.id) || 0 }));
  },

  async getList(id: string): Promise<ContactList | undefined> {
    const [row] = await db.select().from(contactLists).where(eq(contactLists.id, id));
    return row;
  },

  async createList(input: InsertContactList): Promise<ContactList> {
    const [row] = await db.insert(contactLists).values(input).returning();
    return row;
  },

  async updateList(id: string, updates: Partial<InsertContactList>): Promise<ContactList | undefined> {
    const [row] = await db.update(contactLists).set(updates).where(eq(contactLists.id, id)).returning();
    return row;
  },

  async deleteList(id: string): Promise<boolean> {
    return await db.transaction(async (tx) => {
      await tx.delete(contactListMembers).where(eq(contactListMembers.listId, id));
      const r = await tx.delete(contactLists).where(eq(contactLists.id, id));
      return (r.rowCount || 0) > 0;
    });
  },

  async addMembers(listId: string, contactIds: string[]): Promise<number> {
    if (contactIds.length === 0) return 0;
    let added = 0;
    await db.transaction(async (tx) => {
      for (const cid of contactIds) {
        const r = await tx.execute(sql`
          INSERT INTO contact_list_members (list_id, contact_id)
          VALUES (${listId}, ${cid})
          ON CONFLICT (list_id, contact_id) DO NOTHING
          RETURNING id
        `);
        if (((r as { rowCount?: number | null }).rowCount ?? 0) > 0) added++;
      }
    });
    return added;
  },

  async removeMembers(listId: string, contactIds: string[]): Promise<number> {
    if (contactIds.length === 0) return 0;
    const r = await db
      .delete(contactListMembers)
      .where(
        and(
          eq(contactListMembers.listId, listId),
          inArray(contactListMembers.contactId, contactIds),
        ),
      );
    return r.rowCount || 0;
  },

  // ---------------- Campaigns ----------------
  async listCampaigns(): Promise<EmailCampaign[]> {
    return await db.select().from(emailCampaigns).orderBy(desc(emailCampaigns.createdAt));
  },

  async getCampaign(id: string): Promise<EmailCampaign | undefined> {
    const [row] = await db.select().from(emailCampaigns).where(eq(emailCampaigns.id, id));
    return row;
  },

  async createCampaign(input: InsertEmailCampaign): Promise<EmailCampaign> {
    const [row] = await db.insert(emailCampaigns).values(input).returning();
    return row;
  },

  async updateCampaign(id: string, updates: Partial<InsertEmailCampaign>): Promise<EmailCampaign | undefined> {
    const [row] = await db
      .update(emailCampaigns)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(emailCampaigns.id, id))
      .returning();
    return row;
  },

  async markCampaignQueued(id: string): Promise<void> {
    await db
      .update(emailCampaigns)
      .set({ status: "queued", updatedAt: new Date() })
      .where(eq(emailCampaigns.id, id));
  },

  async getCampaignsForList(listId: string): Promise<EmailCampaign[]> {
    return await db
      .select()
      .from(emailCampaigns)
      .where(eq(emailCampaigns.listId, listId))
      .orderBy(desc(emailCampaigns.createdAt));
  },

  async deleteCampaign(id: string): Promise<boolean> {
    return await db.transaction(async (tx) => {
      await tx
        .delete(emailCampaignRecipients)
        .where(eq(emailCampaignRecipients.campaignId, id));
      const r = await tx.delete(emailCampaigns).where(eq(emailCampaigns.id, id));
      return (r.rowCount || 0) > 0;
    });
  },

  async getCampaignRecipients(campaignId: string): Promise<EmailCampaignRecipient[]> {
    return await db
      .select()
      .from(emailCampaignRecipients)
      .where(eq(emailCampaignRecipients.campaignId, campaignId))
      .orderBy(desc(emailCampaignRecipients.createdAt))
      .limit(5000);
  },
};
