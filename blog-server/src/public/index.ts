import { Elysia } from "elysia";

import { publicArticlesModule } from "./articles";
import { publicCommentsModule } from "./comments";
import { publicSiteModule } from "./site";

export const publicModule = new Elysia({ prefix: "/api/public" })
  .use(publicSiteModule)
  .use(publicArticlesModule)
  .use(publicCommentsModule)
  .get("/status", () => ({
    ok: true,
    scope: "public",
  }));
