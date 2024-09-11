import { eq, inArray } from "drizzle-orm";
import { z } from "zod";
import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "~/server/api/trpc";
import { db, schema } from "~/server/db";
import { images, participants, tickets } from "~/server/db/schema";

export const ticketsRouter = createTRPCRouter({
  create: publicProcedure
    .input(
      z.object({
        orgId: z.number(),
        state: z.string(),
        urgency: z.number(),
        suppUrgency: z.number(),
        title: z.string(),
        description: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [respuesta] = await ctx.db
        .insert(schema.tickets)
        .values(input)
        .returning();
      await ctx.db.insert(schema.events).values({
        userName: "",
        ticketId: respuesta?.id,
        type: "recieved",
        description: "Ticket recibido",
      });
      if (!respuesta) {
        throw new Error("Error al crear el ticket");
      }
    }),

  getById: publicProcedure
    .input(
      z.object({
        id: z.number(),
      }),
    )
    .query(async ({ input, ctx }) => {
      const ticketWithRelations = await ctx.db.query.tickets.findFirst({
        where: eq(tickets.id, input.id),
        with: {
          comments: true,
          images: true,
          participants: true,
        },
      });

      return ticketWithRelations;
    }),
  list: protectedProcedure.query(async ({}) => {
    const tickets = await db.query.tickets.findMany();

    return tickets;
  }),

  getByOrg: publicProcedure
    .input(
      z.object({
        orgId: z.number(),
      }),
    )
    .query(async ({ input, ctx }) => {
      try {
        const ticketWithRelations = await ctx.db.query.tickets.findMany({
          where: eq(tickets.orgId, input.orgId),
          with: {
            comments: true,
            images: true,
            participants: true,
          },
        });

        return ticketWithRelations;
      } catch {
        return null;
      }
    }),

  getByUser: publicProcedure
    .input(
      z.object({
        userName: z.string(),
      }),
    )
    .query(async ({ input, ctx }) => {
      const participantes = await ctx.db.query.participants.findMany({
        where: eq(participants.userName, input.userName),
      });

      const ticketIds = participantes.map(
        (participant) => participant.ticketId,
      );

      if (ticketIds.length === 0) {
        return [];
      }

      // Obtén los tickets con relaciones
      const ticketsWithRelations = await ctx.db.query.tickets.findMany({
        where: inArray(tickets.id, ticketIds),
        with: {
          comments: true,
          images: true,
          participants: true,
        },
      });

      return ticketsWithRelations;
    }),
  update: publicProcedure
    .input(
      z.object({
        id: z.number(),
        orgId: z.number().optional(),
        state: z.string().optional(),
        suppUrgency: z.number().optional(),
        updatedAt: z.date(),
      }),
    )
    .mutation(async ({ input }) => {
      await db.update(tickets).set(input).where(eq(tickets.id, input.id));
    }),

  delete: publicProcedure
    .input(
      z.object({
        id: z.number(),
      }),
    )
    .mutation(async ({ input }) => {
      await db.delete(tickets).where(eq(tickets.id, input.id));
    }),
});
