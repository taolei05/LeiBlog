import { jwt } from "@elysiajs/jwt";
import { Elysia, status, t } from "elysia";
import { adminJwtSchema, extractBearerToken, isAuthJwtPayload } from "../auth/session";
import { readAdminSession } from "../auth/service";
import { env } from "../../shared/env";
import { subscriptionCategories, subscriptionInputSchema, SubscriptionError } from "./domain";
import { getExchangeRates } from "./exchange-rates";
import {
  deleteSubscription,
  deleteSubscriptionAttachment,
  downloadSubscriptionAttachment,
  listSubscriptions,
  saveSubscription,
  uploadSubscriptionAttachment,
} from "./service";

const idSchema = t.String({ format: "uuid" });
export const adminSubscriptionRoutes = new Elysia({ prefix: "/api/admin/subscriptions" })
  .use(jwt({ name: "subscriptionJwt", secret: env.jwtSecret, schema: adminJwtSchema }))
  .derive(async ({ headers, subscriptionJwt }) => {
    const token = extractBearerToken(headers.authorization);
    const payload = token === undefined ? undefined : await subscriptionJwt.verify(token);
    if (!isAuthJwtPayload(payload)) return { subscriptionAdminId: undefined };
    const session = await readAdminSession({ sessionId: payload.sid });
    return { subscriptionAdminId: session?.userId === payload.sub ? session.userId : undefined };
  })
  .onBeforeHandle(({ subscriptionAdminId }) => {
    if (subscriptionAdminId === undefined)
      return status(401, { message: "Administrator session required." });
  })
  .onError(({ error }) => {
    if (error instanceof SubscriptionError) return status(error.status, { message: error.message });
  })
  .get("/", ({ query }) => listSubscriptions(query), {
    query: t.Object({
      search: t.Optional(t.String({ maxLength: 200 })),
      category: t.Optional(
        t.Union([t.Literal("all"), ...subscriptionCategories.map((v) => t.Literal(v))]),
      ),
      status: t.Optional(
        t.Union([
          t.Literal("all"),
          t.Literal("normal"),
          t.Literal("expiring"),
          t.Literal("expired"),
        ]),
      ),
      page: t.Optional(t.Numeric({ minimum: 1, maximum: 100000, multipleOf: 1 })),
      pageSize: t.Optional(t.Numeric({ minimum: 1, maximum: 100, multipleOf: 1 })),
    }),
  })
  .get("/exchange-rates", async () => ({ ok: true, item: await getExchangeRates() }))
  .post(
    "/",
    ({ body, subscriptionAdminId }) =>
      saveSubscription({ input: body, userId: subscriptionAdminId! }),
    { body: subscriptionInputSchema },
  )
  .put(
    "/:id",
    ({ body, params, subscriptionAdminId }) =>
      saveSubscription({ id: params.id, input: body, userId: subscriptionAdminId! }),
    { params: t.Object({ id: idSchema }), body: subscriptionInputSchema },
  )
  .delete("/:id", ({ params }) => deleteSubscription(params.id), {
    params: t.Object({ id: idSchema }),
  })
  .post(
    "/:id/attachments",
    ({ params, body }) => uploadSubscriptionAttachment({ id: params.id, file: body.file }),
    {
      params: t.Object({ id: idSchema }),
      body: t.Object({ file: t.File({ maxSize: 5 * 1024 * 1024 }) }),
    },
  )
  .get("/:id/attachments/:attachmentId", ({ params }) => downloadSubscriptionAttachment(params), {
    params: t.Object({ id: idSchema, attachmentId: idSchema }),
  })
  .delete("/:id/attachments/:attachmentId", ({ params }) => deleteSubscriptionAttachment(params), {
    params: t.Object({ id: idSchema, attachmentId: idSchema }),
  });
