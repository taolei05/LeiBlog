import { Elysia } from "elysia";

import { getRequestMeta } from "../../auth/service";

export const requestContext = new Elysia({ name: "leiblog-request-context" }).derive(
  { as: "scoped" },
  ({ headers, request, server }) => ({
    requestMeta: getRequestMeta({
      headers,
      requestIp: server?.requestIP(request)?.address,
    }),
  })
);
