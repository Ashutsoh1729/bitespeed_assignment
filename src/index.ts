import { handleRequest } from "./logic";

const PORT = process.env.PORT || 3000;

const server = Bun.serve({
    port: PORT,
    async fetch(req) {
        const url = new URL(req.url);

        // POST /identify
        if (req.method === "POST" && url.pathname === "/identify") {
            try {
                const body = await req.json();
                const { email, phoneNumber } = body as {
                    email?: string;
                    phoneNumber?: string;
                };

                const response = await handleRequest(email, phoneNumber);
                return Response.json(response, { status: 200 });
            } catch (err: any) {
                const message = err?.message || "Internal server error";
                const status = message.includes("required") ? 400 : 500;
                return Response.json({ error: message }, { status });
            }
        }

        // Health check
        if (req.method === "GET" && url.pathname === "/") {
            return Response.json({ status: "ok" });
        }

        // 404 for everything else
        return Response.json({ error: "Not found" }, { status: 404 });
    },
});

console.log(`🚀 Server running at http://localhost:${server.port}`);
