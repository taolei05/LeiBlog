import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { uploadFileRequest } from "./upload-request";
import type { UploadProgress } from "./upload-request";

class TestUploadRequest extends EventTarget {
  static instances: TestUploadRequest[] = [];
  upload = new EventTarget();
  withCredentials = false;
  timeout = 0;
  status = 200;
  responseText = '{"ok":true}';
  open = vi.fn();
  send = vi.fn();
  setRequestHeader = vi.fn();
  getResponseHeader = () => "application/json";
  constructor() {
    super();
    TestUploadRequest.instances.push(this);
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
  TestUploadRequest.instances = [];
});

describe("real upload progress transport", () => {
  const start = (
    readResponse = async (response: Response): Promise<unknown> => response.json(),
  ) => {
    vi.stubGlobal("XMLHttpRequest", TestUploadRequest);
    const progress: UploadProgress[] = [];
    const file = new File(["test"], "photo.png");
    const body = new FormData();
    body.set("file", file);
    const promise = uploadFileRequest({
      file,
      body,
      url: "/api/upload",
      headers: { Authorization: "Bearer ", "X-Setup-Token": "test-only-token" },
      onProgress: (value) => progress.push(value),
      readResponse,
    });
    const xhr = TestUploadRequest.instances[0];
    if (xhr === undefined) throw new Error("Upload was not started");
    return { body, promise, progress, xhr };
  };

  it("reports byte progress, then processing, and only completes after response validation", async () => {
    const { body, promise, progress, xhr } = start();
    expect(xhr.open).toHaveBeenCalledWith("POST", "/api/upload");
    expect(xhr.send).toHaveBeenCalledWith(body);
    expect(xhr.withCredentials).toBe(true);
    expect(xhr.setRequestHeader).toHaveBeenCalledExactlyOnceWith(
      "x-setup-token",
      "test-only-token",
    );
    xhr.upload.dispatchEvent(
      Object.assign(new Event("progress"), {
        loaded: 25,
        total: 100,
        lengthComputable: true,
      }),
    );
    expect(progress.at(-1)).toMatchObject({ loaded: 25, total: 100, phase: "uploading" });
    xhr.upload.dispatchEvent(new Event("load"));
    expect(progress.at(-1)?.phase).toBe("processing");
    expect(progress.some((item) => item.phase === "complete")).toBe(false);
    xhr.dispatchEvent(new Event("load"));
    expect(await promise).toEqual({ ok: true });
    expect(progress.at(-1)?.phase).toBe("complete");
    expect(new Set(progress.map((item) => item.id)).size).toBe(1);
  });

  it("keeps progress indeterminate when the browser cannot compute a length", async () => {
    const { promise, progress, xhr } = start();
    xhr.upload.dispatchEvent(
      Object.assign(new Event("progress"), {
        loaded: 20,
        total: 0,
        lengthComputable: false,
      }),
    );
    expect(progress.at(-1)?.total).toBeUndefined();
    xhr.dispatchEvent(new Event("load"));
    await promise;
  });

  it.each(["error", "timeout", "abort"])("reports %s without a false success", async (event) => {
    const { promise, progress, xhr } = start();
    const rejection = expect(promise).rejects.toThrow();
    xhr.dispatchEvent(new Event(event));
    await rejection;
    expect(progress.at(-1)?.phase).toBe("error");
    expect(progress.some((item) => item.phase === "complete")).toBe(false);
  });

  it("does not call a malformed or rejected response a completed upload", async () => {
    const { promise, progress, xhr } = start(async () => {
      throw new Error("Invalid response");
    });
    const rejection = expect(promise).rejects.toThrow("Invalid response");
    xhr.dispatchEvent(new Event("load"));
    await rejection;
    expect(progress.at(-1)?.phase).toBe("error");
  });
});
