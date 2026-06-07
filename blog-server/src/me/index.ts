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
  UploadAvatarBody,
  UploadAvatarResponse,
} from "./model";
import {
  changeMyPassword,
  confirmEmailChange,
  getUserProfile,
  requestEmailChangeCode,
  updateMe,
  uploadMyAvatar,
} from "./service";
import { authContext } from "../shared/auth/plugin";
import {
  enforceEmailChangeCodeRateLimit,
  enforceUploadRateLimit,
} from "../shared/http/rate-limit";
import { requestContext } from "../shared/http/plugin";

export const meModule = new Elysia({ prefix: "/api/me" })
  .use(requestContext)
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
  .post("/avatar", async ({ currentUser, body, requestMeta }) => {
    await enforceUploadRateLimit("avatar", currentUser.id, requestMeta);
    return uploadMyAvatar(currentUser.id, body);
  }, {
    body: UploadAvatarBody,
    response: {
      200: UploadAvatarResponse,
    },
  })
  .post("/email-change-code", async ({ currentUser, body, requestMeta }) => {
    await enforceEmailChangeCodeRateLimit(currentUser.id, body.email, requestMeta);
    return requestEmailChangeCode(currentUser.id, body);
  }, {
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
