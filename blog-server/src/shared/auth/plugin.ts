import { bearer } from "@elysiajs/bearer";
import { jwt } from "@elysiajs/jwt";
import { Elysia } from "elysia";

import { appConfig } from "../config";
import { resolveAuthUser } from ".";

export const jwtPlugin = new Elysia({ name: "leiblog-jwt" }).use(
  jwt({
    name: "jwt",
    secret: appConfig.jwtSecret,
  })
);

export const authContext = new Elysia({ name: "leiblog-auth-context" })
  .use(bearer())
  .use(jwtPlugin)
  .derive({ as: "scoped" }, async ({ bearer, jwt }) => ({
    currentUser: await resolveAuthUser(bearer, jwt),
    accessToken: bearer,
  }));
