import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { loadSubscriptionAttachmentPreviewResource } from "./attachment-preview";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const parameters = {
  subscriptionId: "subscription-id",
  attachmentId: "private-invoice",
  fileName: "invoice.pdf",
  token: "test-token",
  signal: new AbortController().signal,
};

describe("private subscription attachment previews", () => {
  it("loads PDF with administrator credentials and releases its local URL", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response("%PDF-1.7\nprivate invoice"));
    vi.stubGlobal("fetch", fetcher);
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:https://blog.test/pdf");
    const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    const resource = await loadSubscriptionAttachmentPreviewResource({
      ...parameters,
      kind: "pdf",
    });
    expect(resource).toMatchObject({
      kind: "pdf",
      url: "blob:https://blog.test/pdf#leiblog-preview.pdf",
    });
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toContain("/api/admin/subscriptions/subscription-id/attachments/private-invoice");
    expect(init?.credentials).toBe("include");
    expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer test-token");
    expect(init?.signal).toBe(parameters.signal);
    expect(fetcher).toHaveBeenCalledTimes(1);
    resource.dispose();
    expect(revoke).toHaveBeenCalledWith("blob:https://blog.test/pdf");
  });
  it("previews images locally and retains text without interpreting HTML", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("image", { headers: { "Content-Type": "image/png" } })),
    );
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:https://blog.test/image");
    const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    const image = await loadSubscriptionAttachmentPreviewResource({ ...parameters, kind: "image" });
    expect(image).toMatchObject({ kind: "image", url: "blob:https://blog.test/image" });
    image.dispose();
    expect(revoke).toHaveBeenCalledWith("blob:https://blog.test/image");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("<script>private text</script>")),
    );
    expect(
      await loadSubscriptionAttachmentPreviewResource({ ...parameters, kind: "text" }),
    ).toMatchObject({ kind: "text", text: "<script>private text</script>" });
  });
  it("rejects revoked permissions, invalid PDF data and unsafe image types", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({ message: "Administrator session required." }, { status: 401 }),
      ),
    );
    await expect(
      loadSubscriptionAttachmentPreviewResource({ ...parameters, kind: "pdf" }),
    ).rejects.toThrow("Administrator session required");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("<html>Login</html>")),
    );
    await expect(
      loadSubscriptionAttachmentPreviewResource({ ...parameters, kind: "pdf" }),
    ).rejects.toThrow("Invalid PDF");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("<svg />", { headers: { "Content-Type": "image/svg+xml" } })),
    );
    await expect(
      loadSubscriptionAttachmentPreviewResource({ ...parameters, kind: "image" }),
    ).rejects.toThrow("Invalid image");
  });
  it("restores a safe image MIME type for the real attachment download response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response("image", { headers: { "Content-Type": "application/octet-stream" } }),
      ),
    );
    const create = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:https://blog.test/image");
    const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    const resource = await loadSubscriptionAttachmentPreviewResource({
      ...parameters,
      fileName: "invoice.PNG",
      kind: "image",
    });
    expect(create.mock.calls[0]?.[0]).toMatchObject({ type: "image/png" });
    resource.dispose();
    expect(revoke).toHaveBeenCalledWith("blob:https://blog.test/image");
  });
  it("releases no resources after a response arrives for a closed preview", async () => {
    const controller = new AbortController();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        controller.abort();
        return new Response("%PDF-1.7");
      }),
    );
    const create = vi.spyOn(URL, "createObjectURL");
    await expect(
      loadSubscriptionAttachmentPreviewResource({
        ...parameters,
        kind: "pdf",
        signal: controller.signal,
      }),
    ).rejects.toThrow();
    expect(create).not.toHaveBeenCalled();
  });
  it("cancels a closed preview before creating an object URL", async () => {
    const controller = new AbortController();
    controller.abort();
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    await expect(
      loadSubscriptionAttachmentPreviewResource({
        ...parameters,
        kind: "pdf",
        signal: controller.signal,
      }),
    ).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
  });
});
