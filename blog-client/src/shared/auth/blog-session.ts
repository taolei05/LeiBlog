export const BLOG_SESSION_STORAGE_KEY = "leiblog:blog-session";
export const BLOG_SESSION_CHANGE_EVENT = "leiblog:blog-session-change";

function getBlogSessionStorage() {
  if (typeof window === "undefined") return null;
  if (!("localStorage" in window) || !window.localStorage) return null;

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function notifyBlogSessionChange() {
  if (typeof window === "undefined") return;

  window.dispatchEvent(new Event(BLOG_SESSION_CHANGE_EVENT));
}

export function clearStoredBlogSession() {
  getBlogSessionStorage()?.removeItem(BLOG_SESSION_STORAGE_KEY);
  notifyBlogSessionChange();
}

export function expireBlogSessionForResponse(response: Response, authenticatedRequest: boolean) {
  if (!authenticatedRequest || response.status !== 401) return false;

  clearStoredBlogSession();
  return true;
}
