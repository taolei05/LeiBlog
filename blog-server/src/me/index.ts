import { Elysia } from "elysia";

import { meCommentsModule } from "./comments";
import {
  ChangePasswordBody,
  ConfirmEmailChangeBody,
  EmailChangeCodeBody,
  EmailChangeCodeResponse,
  MeResponse,
  OkResponse,
  UpdateMeBody,
} from "./model";
import {
  changeMyPassword,
  confirmEmailChange,
  getUserProfile,
  requestEmailChangeCode,
  updateMe,
} from "./service";
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
    user: await updateMe(currentUser, body),
  }), {
    body: UpdateMeBody,
    response: {
      200: MeResponse,
    },
  })
  .post("/email-change-code", ({ currentUser, body }) => (
    requestEmailChangeCode(currentUser.id, body)
  ), {
    body: EmailChangeCodeBody,
    response: {
      200: EmailChangeCodeResponse,
    },
  })
  .patch("/email", async ({ currentUser, body }) => ({
    ok: true,
    user: await confirmEmailChange(currentUser.id, body),
  }), {
    body: ConfirmEmailChangeBody,
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
