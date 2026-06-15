// @vitest-environment happy-dom

import { act } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import authPagesSource from "../src/features/blog/auth/AuthPages.tsx?raw";
import { UserProfilePage } from "../src/features/blog/auth/AuthPages";
import profilePageSource from "../src/features/admin/system/ProfilePage.tsx?raw";
import {
  BLOG_SESSION_CHANGE_EVENT,
  BLOG_SESSION_STORAGE_KEY,
} from "../src/shared/auth/blog-session";
import { ThemeProviderLite } from "../src/shared/theme/ThemeProviderLite";

type TestBlogUser = {
  avatarUrl: string | null;
  blogUrl: string | null;
  commentEmailNotificationsEnabled?: boolean;
  createdAt: string;
  description: string;
  email: string | null;
  id: string;
  lastLoginAt: string | null;
  lastLoginDevice: string | null;
  lastLoginIp: string | null;
  lastLoginLocation: string | null;
  name: string | null;
  role: "admin" | "user";
  tags: string[];
  username: string;
};

type TestBlogSession = {
  token: string;
  user: TestBlogUser;
};

type ReactActGlobal = typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

const originalFetch = globalThis.fetch;
const mountedRoots: Root[] = [];
(globalThis as ReactActGlobal).IS_REACT_ACT_ENVIRONMENT = true;

function createTestUser(overrides: Partial<TestBlogUser> = {}): TestBlogUser {
  return {
    avatarUrl: null,
    blogUrl: null,
    commentEmailNotificationsEnabled: true,
    createdAt: "2026-06-12T00:00:00.000Z",
    description: "",
    email: "reader@example.com",
    id: "front-user-1",
    lastLoginAt: null,
    lastLoginDevice: null,
    lastLoginIp: null,
    lastLoginLocation: null,
    name: "读者",
    role: "user",
    tags: [],
    username: "reader",
    ...overrides,
  };
}

function createTestSession(
  token = "front-token",
  userOverrides: Partial<TestBlogUser> = {},
): TestBlogSession {
  return {
    token,
    user: createTestUser(userOverrides),
  };
}

function writeStoredSession(session: TestBlogSession) {
  window.localStorage.setItem(BLOG_SESSION_STORAGE_KEY, JSON.stringify(session));
}

function readStoredSession() {
  const rawSession = window.localStorage.getItem(BLOG_SESSION_STORAGE_KEY);
  return rawSession ? (JSON.parse(rawSession) as TestBlogSession) : null;
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

function createDeferredResponse() {
  let resolvePromise: ((response: Response) => void) | null = null;
  let rejectPromise: ((error: Error) => void) | null = null;
  const promise = new Promise<Response>((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });

  return {
    promise,
    reject(error: Error) {
      if (!rejectPromise) throw new Error("deferred response is not ready");
      rejectPromise(error);
    },
    resolve(response: Response) {
      if (!resolvePromise) throw new Error("deferred response is not ready");
      resolvePromise(response);
    },
  };
}

function installProfileFetchMock(
  handlePreferencePatch: (init: RequestInit) => Promise<Response> | Response,
) {
  const preferencePatchRequests: RequestInit[] = [];
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const method = init.method ?? "GET";

    if (url.endsWith("/me/") && method === "GET") {
      return jsonResponse({ user: createTestUser() });
    }

    if (url.endsWith("/me/preferences") && method === "PATCH") {
      preferencePatchRequests.push(init);
      return handlePreferencePatch(init);
    }

    return jsonResponse({ message: `Unhandled request: ${method} ${url}` }, 500);
  });
  globalThis.fetch = fetchMock;

  return { fetchMock, preferencePatchRequests };
}

async function flushReactWork() {
  await act(async () => {
    await new Promise((resolve) => window.setTimeout(resolve, 0));
  });
}

async function renderUserProfilePage() {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  mountedRoots.push(root);

  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={["/profile?panel=preferences"]}>
        <ThemeProviderLite>
          <UserProfilePage />
        </ThemeProviderLite>
      </MemoryRouter>,
    );
  });
  await flushReactWork();

  return container;
}

function getPreferenceSwitch(container: HTMLElement) {
  const preferenceRow = container.querySelector(".account-preference-list .switch");
  if (!preferenceRow) throw new Error("preference row was not rendered");

  const switchElement = preferenceRow.querySelector('[role="switch"], input, button');
  if (!(switchElement instanceof HTMLElement)) {
    throw new Error("preference switch was not rendered");
  }

  return switchElement;
}

async function clickPreferenceSwitch(container: HTMLElement) {
  const switchElement = getPreferenceSwitch(container);
  await act(async () => {
    switchElement.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  await flushReactWork();
}

async function clickSavePreferencesButton(container: HTMLElement) {
  const saveButton = [...container.querySelectorAll("button")].find((button) =>
    button.textContent?.includes("保存偏好设置"),
  );
  if (!saveButton) throw new Error("save preferences button was not rendered");

  await act(async () => {
    saveButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  await flushReactWork();
}

async function confirmPreferenceSaveDialog() {
  const confirmButton = [...document.body.querySelectorAll("button")].find((button) =>
    button.textContent?.includes("确认保存"),
  );
  if (!confirmButton) throw new Error("confirm preferences button was not rendered");

  await act(async () => {
    confirmButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  await flushReactWork();
}

afterEach(async () => {
  await act(async () => {
    for (const root of mountedRoots.splice(0)) {
      root.unmount();
    }
  });
  document.body.innerHTML = "";
  window.localStorage.clear();
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("admin comment notification preferences", () => {
  it("adds a comment email notification switch to the profile preferences", () => {
    expect(profilePageSource).toContain('title="偏好设置"');
    expect(profilePageSource).not.toContain('title="偏好"');
    expect(profilePageSource).toContain("评论邮件通知");
    expect(profilePageSource).toContain("接收全站文章和留言板的新评论、新回复邮件。");
    expect(profilePageSource).toContain("/me/preferences");
    expect(profilePageSource).toContain("commentEmailNotificationsEnabled");
    expect(profilePageSource).toMatch(
      /import\s*{[\s\S]*\bSwitch\b[\s\S]*}\s*from "@heroui\/react"/,
    );
    expect(profilePageSource).toContain("<Switch");
    expect(profilePageSource).toContain("<Switch.Control>");
    expect(profilePageSource).toContain("isSelected={commentEmailNotificationsDraft}");
    expect(profilePageSource).toContain("onChange={setCommentEmailNotificationsDraft}");
    expect(profilePageSource).toContain("isDisabled={isLoading || isSavingPreferences");
    expect(profilePageSource).toContain('className="settings-form__submit"');
    expect(profilePageSource).toContain("保存偏好设置");
    expect(profilePageSource).toContain('onPress={() => setPendingSave("preferences")}');
    expect(profilePageSource).toContain("确认保存偏好设置？");
    expect(profilePageSource).toContain("void saveCommentEmailNotificationPreference();");
  });

  it("saves the admin comment notification preference only from the save button", () => {
    expect(profilePageSource).toMatch(
      /adminFetch<\{ user: AdminProfile \}>\("\/me\/preferences", \{\s+body: \{ commentEmailNotificationsEnabled: commentEmailNotificationsDraft \},\s+method: "PATCH",\s+\}\)/,
    );
    expect(profilePageSource).toContain("setProfile(response.user)");
    expect(profilePageSource).toContain(
      "setCommentEmailNotificationsDraft(response.user.commentEmailNotificationsEnabled)",
    );
    expect(profilePageSource).toContain("syncAdminSession(response.user)");
    expect(profilePageSource).toMatch(/showOperationToast\("评论邮件通知偏好已保存", "success"\)/);
    expect(profilePageSource).toMatch(
      /showOperationToast\(\s+error instanceof Error \? error\.message : "评论邮件通知偏好保存失败",\s+"danger",\s+\)/,
    );
  });
});

describe("front comment notification preferences", () => {
  it("adds a comment reply email notification switch to the personal center preferences", () => {
    expect(authPagesSource).toMatch(/import\s*{[\s\S]*\bSwitch\b[\s\S]*}\s*from "@heroui\/react"/);
    expect(authPagesSource).toContain('type ProfilePanelMode = "email" | "password" |');
    expect(authPagesSource).toContain('"preferences"');
    expect(authPagesSource).toMatch(
      /readProfilePanelMode\(value: string \| null\): ProfilePanelMode \| null \{[\s\S]*value === "preferences"/,
    );
    expect(authPagesSource).toMatch(
      /<Accordion\.Item[\s\S]*id="preferences"[\s\S]*偏好设置[\s\S]*<Switch/,
    );
    expect(authPagesSource).toContain('className="account-preference-list settings-form"');
    expect(authPagesSource).toContain("<Switch.Control>");
    expect(authPagesSource).toContain("<Switch.Thumb />");
    expect(authPagesSource).toContain("评论回复邮件通知");
    expect(authPagesSource).toContain("自己的评论收到直接回复时，通过邮箱通知我。");
    expect(authPagesSource).toContain("isSelected={commentEmailNotificationsDraft}");
    expect(authPagesSource).toContain("isDisabled={isSavingPreferences}");
    expect(authPagesSource).toContain("onChange={setCommentEmailNotificationsDraft}");
    expect(authPagesSource).toContain('className="settings-form__submit"');
    expect(authPagesSource).toContain("保存偏好设置");
    expect(authPagesSource).toContain(
      'onPress={() => setPendingProfileAction("save-preferences")}',
    );
    expect(authPagesSource).toContain("确认保存偏好设置？");
    expect(authPagesSource).toContain("void saveCommentEmailNotificationPreference();");
  });

  it("parses and saves the current user's comment notification preference", () => {
    expect(authPagesSource).toContain("commentEmailNotificationsEnabled: boolean;");
    expect(authPagesSource).toContain(
      "commentEmailNotificationsEnabled: readBoolean(value.commentEmailNotificationsEnabled, true)",
    );
    expect(authPagesSource).toMatch(
      /authJsonRequest<unknown>\("\/me\/preferences", \{\s+body: \{ commentEmailNotificationsEnabled: nextValue \},\s+method: "PATCH",\s+token,\s+\}\)/,
    );
    expect(authPagesSource).toContain("return parseMeResponse(payload)");
  });

  it("keeps the front preference as a draft until the save button is pressed", () => {
    expect(authPagesSource).toContain(
      "const [isSavingPreferences, setIsSavingPreferences] = useState(false);",
    );
    expect(authPagesSource).toContain(
      "const [commentEmailNotificationsDraft, setCommentEmailNotificationsDraft] = useState(true);",
    );
    expect(authPagesSource).toContain("const previousSession = session;");
    expect(authPagesSource).toContain("const requestToken = previousSession.token;");
    expect(authPagesSource).toContain("function updateSessionForToken(");
    expect(authPagesSource).toContain("window.setTimeout(() => {");
    expect(authPagesSource).toContain(
      "if (!storedSession || storedSession.token !== expectedToken) return;",
    );
    expect(authPagesSource).toContain("writeBlogSession(createNextSession(storedSession));");
    expect(authPagesSource).toMatch(
      /updateCurrentBlogUserPreferences\(\s+requestToken,\s+commentEmailNotificationsDraft,\s+\)/,
    );
    expect(authPagesSource).toMatch(
      /showOperationToast\("评论回复邮件通知偏好已保存", "success"\)/,
    );
    expect(authPagesSource).toContain("评论回复邮件通知偏好保存失败");
    expect(authPagesSource).toContain("setIsSavingPreferences(false);");
  });

  it("sends the front preference PATCH and persists the success response", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const legacySession = createTestSession();
    delete legacySession.user.commentEmailNotificationsEnabled;
    writeStoredSession(legacySession);
    const { preferencePatchRequests } = installProfileFetchMock(() =>
      jsonResponse({
        user: createTestUser({ commentEmailNotificationsEnabled: false }),
      }),
    );

    const container = await renderUserProfilePage();
    expect(container.textContent).toContain("偏好设置");
    expect(container.textContent).toContain("评论回复邮件通知");
    expect(readStoredSession()?.user.commentEmailNotificationsEnabled).toBe(true);

    await clickPreferenceSwitch(container);

    expect(preferencePatchRequests).toHaveLength(0);
    expect(readStoredSession()?.user.commentEmailNotificationsEnabled).toBe(true);

    await clickSavePreferencesButton(container);

    expect(document.body.textContent).toContain("确认保存偏好设置？");
    expect(preferencePatchRequests).toHaveLength(0);

    await confirmPreferenceSaveDialog();

    expect(preferencePatchRequests).toHaveLength(1);
    expect(preferencePatchRequests[0]?.method).toBe("PATCH");
    expect(preferencePatchRequests[0]?.body).toBe(
      JSON.stringify({ commentEmailNotificationsEnabled: false }),
    );
    expect(preferencePatchRequests[0]?.headers).toMatchObject({
      Authorization: "Bearer front-token",
      "Content-Type": "application/json",
    });
    expect(readStoredSession()?.user.commentEmailNotificationsEnabled).toBe(false);
    expect(consoleError).not.toHaveBeenCalled();
  });

  it("rolls back the front preference after a non-auth save failure", async () => {
    writeStoredSession(createTestSession());
    installProfileFetchMock(() => jsonResponse({ message: "保存失败" }, 500));

    const container = await renderUserProfilePage();
    await clickPreferenceSwitch(container);
    await clickSavePreferencesButton(container);
    await confirmPreferenceSaveDialog();

    expect(readStoredSession()?.token).toBe("front-token");
    expect(readStoredSession()?.user.commentEmailNotificationsEnabled).toBe(true);
  });

  it("does not resurrect an expired or replaced session after preference save settles", async () => {
    writeStoredSession(createTestSession());
    installProfileFetchMock(() => jsonResponse({ message: "登录已过期" }, 401));

    let container = await renderUserProfilePage();
    await clickPreferenceSwitch(container);
    await clickSavePreferencesButton(container);
    await confirmPreferenceSaveDialog();

    expect(window.localStorage.getItem(BLOG_SESSION_STORAGE_KEY)).toBeNull();

    await act(async () => {
      for (const root of mountedRoots.splice(0)) {
        root.unmount();
      }
    });
    document.body.innerHTML = "";
    vi.restoreAllMocks();

    const deferredPreferenceSave = createDeferredResponse();
    const replacementSession = createTestSession("replacement-token", {
      email: "other@example.com",
      id: "front-user-2",
      username: "other-reader",
    });
    writeStoredSession(createTestSession());
    installProfileFetchMock(() => deferredPreferenceSave.promise);

    container = await renderUserProfilePage();
    await clickPreferenceSwitch(container);
    await clickSavePreferencesButton(container);
    await confirmPreferenceSaveDialog();
    writeStoredSession(replacementSession);
    window.dispatchEvent(new Event(BLOG_SESSION_CHANGE_EVENT));
    await flushReactWork();

    await act(async () => {
      deferredPreferenceSave.resolve(
        jsonResponse({ user: createTestUser({ commentEmailNotificationsEnabled: false }) }),
      );
      await Promise.resolve();
    });

    expect(readStoredSession()?.token).toBe("replacement-token");
  });
});
