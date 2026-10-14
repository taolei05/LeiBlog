export type UploadProgress = {
  id: string;
  fileName: string;
  loaded: number;
  total?: number;
  phase: "uploading" | "processing" | "complete" | "error";
};

export type UploadProgressHandler = (progress: UploadProgress) => void;

type UploadFileRequestParameters<Result> = {
  body: FormData;
  file: File;
  headers?: HeadersInit;
  onProgress?: UploadProgressHandler;
  readResponse: (response: Response) => Promise<Result>;
  url: string;
};

export const uploadFileRequest = async <Result>({
  body,
  file,
  headers: inputHeaders,
  onProgress,
  readResponse,
  url,
}: UploadFileRequestParameters<Result>): Promise<Result> => {
  let progress: UploadProgress = {
    id: crypto.randomUUID(),
    fileName: file.name,
    loaded: 0,
    phase: "uploading",
  };
  const report = (update: Partial<UploadProgress>) => {
    progress = { ...progress, ...update };
    onProgress?.(progress);
  };
  const headers = new Headers(inputHeaders);
  if (headers.get("authorization")?.trim() === "Bearer") {
    headers.delete("authorization");
  }
  report({});
  try {
    const response =
      typeof XMLHttpRequest === "undefined"
        ? await globalThis.fetch(url, { body, headers, method: "POST", credentials: "include" })
        : await new Promise<Response>((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.upload.addEventListener("progress", (event) => {
              report({
                loaded: event.loaded,
                total: event.lengthComputable && event.total > 0 ? event.total : undefined,
              });
            });
            xhr.upload.addEventListener("load", () => report({ phase: "processing" }));
            xhr.addEventListener("load", () => {
              try {
                resolve(
                  new Response(xhr.responseText || null, {
                    status: xhr.status,
                    headers: { "Content-Type": xhr.getResponseHeader("Content-Type") ?? "" },
                  }),
                );
              } catch (error) {
                reject(error);
              }
            });
            xhr.addEventListener("error", () =>
              reject(new Error("Upload failed. Check your connection.")),
            );
            xhr.addEventListener("timeout", () =>
              reject(new Error("Upload timed out. Please try again.")),
            );
            xhr.addEventListener("abort", () =>
              reject(new DOMException("Upload cancelled.", "AbortError")),
            );
            xhr.open("POST", url);
            xhr.withCredentials = true;
            xhr.timeout = 10 * 60 * 1000;
            headers.forEach((value, name) => xhr.setRequestHeader(name, value));
            xhr.send(body);
          });
    report({ phase: "processing" });
    const result = await readResponse(response);
    report({ phase: "complete" });
    return result;
  } catch (error) {
    report({ phase: "error" });
    throw error;
  }
};
