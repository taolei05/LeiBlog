import { Elysia } from "elysia";

import { meCommentsModule } from "./comments";
import { ChangePasswordBody, MeResponse, OkResponse, UpdateMeBody } from "./model";
import { changeMyPassword, getUserProfile, updateMe } from "./service";
import { authContext } from "../shared/auth/plugin";

export const meModule = new Elysia({ prefix: "/api/me" })
  .use(authContext)
  .use(meCommentsModule)
  .get("/", async ({ currentUser }) => ({
    ok: true,
    user: await getUserProfile(currentUser.id),
  }), {
    response: {
      200: MeResponse,
    },
  })
  .patch("/", async ({ currentUser, body }) => ({
    ok: true,
    user: await updateMe(currentUser.id, body),
  }), {
    body: UpdateMeBody,
    response: {
      200: MeResponse,
    },
  })
  .patch("/password", ({ currentUser, body }) => changeMyPassword(currentUser.id, body), {
    body: ChangePasswordBody,
    response: {
      200: OkResponse,
    },
  });
