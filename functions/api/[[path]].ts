interface PagesEnv {
  BACKEND_ORIGIN?: string;
}

interface PagesContext {
  request: Request;
  env: PagesEnv;
}

function backendUrl(request: Request, origin: string) {
  const incoming = new URL(request.url);
  const backend = new URL(origin);
  backend.pathname = incoming.pathname;
  backend.search = incoming.search;
  return backend;
}

export async function onRequest(context: PagesContext) {
  const origin = context.env.BACKEND_ORIGIN?.trim();
  if (!origin) {
    return Response.json(
      { error: "BACKEND_ORIGIN chưa được cấu hình trên Cloudflare Pages." },
      { status: 503 },
    );
  }

  let target: URL;
  try {
    target = backendUrl(context.request, origin);
    if (!/^https?:$/.test(target.protocol)) throw new Error("Invalid backend origin");
  } catch {
    return Response.json({ error: "BACKEND_ORIGIN không hợp lệ." }, { status: 500 });
  }

  const headers = new Headers(context.request.headers);
  headers.delete("host");
  headers.delete("content-length");
  headers.set("X-Forwarded-Host", new URL(context.request.url).host);
  headers.set("X-Forwarded-Proto", new URL(context.request.url).protocol.slice(0, -1));

  try {
    const upstream = await fetch(target, {
      method: context.request.method,
      headers,
      body: ["GET", "HEAD"].includes(context.request.method)
        ? undefined
        : context.request.body,
      redirect: "manual",
    });
    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: upstream.headers,
    });
  } catch {
    return Response.json(
      { error: "Không thể kết nối tới backend Python." },
      { status: 502 },
    );
  }
}
