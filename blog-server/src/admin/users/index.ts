import { Elysia } from "elysia";

import {
  AdminCreateUserBody,
  AdminUpdateUserBody,
  OkResponse,
  UserListQuery,
  UserListResponse,
  UserParams,
  UserResponse,
} from "./model";
import {
  createUserByAdmin,
  deleteUserByAdmin,
  getUserById,
  listUsers,
  updateUserByAdmin,
} from "./service";
import { requireAdmin } from "../../shared/auth";
import { authContext } from "../../shared/auth/plugin";

export const adminUsersModule = new Elysia({ prefix: "/users" })
  .use(authContext)
  .get("/", ({ currentUser, query }) => listUsers(currentUser, query), {
    query: UserListQuery,
    response: {
      200: UserListResponse,
    },
  })
  .post("/", async ({ currentUser, body }) => ({
    ok: true,
    user: await createUserByAdmin(currentUser, body),
  }), {
    body: AdminCreateUserBody,
    response: {
      200: UserResponse,
    },
  })
  .get("/:id", async ({ currentUser, params }) => {
    requireAdmin(currentUser);
    return {
      ok: true,
      user: await getUserById(params.id),
    };
  }, {
    params: UserParams,
    response: {
      200: UserResponse,
    },
  })
  .patch("/:id", async ({ currentUser, params, body }) => ({
    ok: true,
    user: await updateUserByAdmin(currentUser, params.id, body),
  }), {
    params: UserParams,
    body: AdminUpdateUserBody,
    response: {
      200: UserResponse,
    },
  })
  .delete("/:id", ({ currentUser, params }) => deleteUserByAdmin(currentUser, params.id), {
    params: UserParams,
    response: {
      200: OkResponse,
    },
  });
