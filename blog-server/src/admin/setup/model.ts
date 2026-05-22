import { t } from "elysia";

import { UserProfileSchema } from "../../shared/types/user";

export const SetupStep = t.Union([
  t.Literal("admin"),
  t.Literal("site-info"),
  t.Literal("site-config"),
  t.Literal("filing"),
  t.Literal("complete"),
  t.Literal("completed"),
]);

export const SetupStatusResponse = t.Object({
  ok: t.Boolean(),
  isCompleted: t.Boolean(),
  currentStep: SetupStep,
  completedAt: t.Nullable(t.String()),
  steps: t.Array(
    t.Object({
      key: SetupStep,
      title: t.String(),
      isCompleted: t.Boolean(),
    })
  ),
});

export const SetupDemoSessionResponse = t.Object({
  ok: t.Boolean(),
  token: t.String(),
  user: UserProfileSchema,
});

export const SetupAdminBody = t.Object({
  username: t.String({ minLength: 2, maxLength: 60 }),
  password: t.String({ minLength: 8, maxLength: 128 }),
  email: t.Optional(t.String({ format: "email", maxLength: 254 })),
  name: t.Optional(t.String({ maxLength: 80 })),
  tags: t.Optional(t.Array(t.String({ maxLength: 40 }), { maxItems: 12 })),
  description: t.Optional(t.String({ maxLength: 1000 })),
  avatarUrl: t.Optional(t.String({ maxLength: 2048 })),
});

export const SetupSiteInfoBody = t.Object({
  siteName: t.String({ minLength: 1, maxLength: 120 }),
  description: t.Optional(t.String({ maxLength: 2000 })),
  logoDarkUrl: t.Optional(t.String({ maxLength: 2048 })),
  logoLightUrl: t.Optional(t.String({ maxLength: 2048 })),
  faviconUrl: t.Optional(t.String({ maxLength: 2048 })),
  establishedAt: t.String(),
});

export const SetupSiteConfigBody = t.Object({
  seoTitle: t.Optional(t.String({ maxLength: 160 })),
  seoDescription: t.Optional(t.String({ maxLength: 300 })),
  seoKeywords: t.Optional(t.Array(t.String({ maxLength: 60 }), { maxItems: 30 })),
  copyright: t.Optional(t.String({ maxLength: 500 })),
  resendDomain: t.Optional(t.String({ maxLength: 255 })),
  resendApiKey: t.Optional(t.String({ maxLength: 1000 })),
  deeplApiKey: t.Optional(t.String({ maxLength: 1000 })),
  ipgeolocationApiKey: t.Optional(t.String({ maxLength: 1000 })),
  commentsEnabled: t.Boolean(),
});

export const SetupFilingBody = t.Object({
  icpNumber: t.Optional(t.String({ maxLength: 120 })),
  icpUrl: t.Optional(t.String({ maxLength: 2048 })),
  policeNumber: t.Optional(t.String({ maxLength: 120 })),
  policeUrl: t.Optional(t.String({ maxLength: 2048 })),
});

export const SetupUploadBody = t.Object({
  file: t.File(),
  fileName: t.Optional(t.String({ maxLength: 255 })),
  folderSlug: t.Union([t.Literal("avatars"), t.Literal("site")]),
});

export const SetupUploadResponse = t.Object({
  ok: t.Boolean(),
  accessUrl: t.String(),
});
