import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { loadDocumentPreviewResource } from "./document-preview-resource";

afterEach(() => vi.unstubAllGlobals());

describe("local document preview resources", () => {
  const parameters = { mediaId: "private-file", token: "", signal: new AbortController().signal };
  it("reads PDF through the authenticated endpoint and releases its object URL", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("%PDF-1.7\nexample")),
    );
    const create = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:https://blog.test/id");
    const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    try {
      const result = await loadDocumentPreviewResource({ ...parameters, kind: "pdf" });
      expect(result).toMatchObject({
        kind: "pdf",
        url: "blob:https://blog.test/id#leiblog-preview.pdf",
      });
      expect(create.mock.calls[0]?.[0]).toMatchObject({ type: "application/pdf" });
      result.dispose();
      expect(revoke).toHaveBeenCalledWith("blob:https://blog.test/id");
    } finally {
      create.mockRestore();
      revoke.mockRestore();
    }
  });
  it("keeps text as text rather than interpreting markup", async () => {
    const text = "# Contract\n<script>alert(1)</script>";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(text)),
    );
    expect(await loadDocumentPreviewResource({ ...parameters, kind: "text" })).toMatchObject({
      kind: "text",
      text,
    });
  });
  it("rejects an HTML/login response masquerading as a PDF", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("<html>Login</html>")),
    );
    await expect(loadDocumentPreviewResource({ ...parameters, kind: "pdf" })).rejects.toThrow(
      "Invalid PDF",
    );
  });
  it("does not create a URL when the read is cancelled", async () => {
    const controller = new AbortController();
    controller.abort();
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    await expect(
      loadDocumentPreviewResource({ ...parameters, kind: "pdf", signal: controller.signal }),
    ).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
  });
});
