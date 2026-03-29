# Corporate Proxy Setup (Cloudflare Workers)

If your corporate firewall blocks standard CORS proxies like `corsproxy.io` and restricts browser extensions, the safest, most reliable workaround is to deploy your own private serverless proxy. It takes 2 minutes and is completely free.

## How to deploy a Private Proxy

1. Go to [Cloudflare Workers](https://workers.cloudflare.com/) and sign up for a free account.
2. Click **Create Application** -> **Create Worker**.
3. Name it something like `vt-proxy` and click **Deploy**.
4. Click **Edit Code**.
5. Replace everything in `worker.js` with the code below:

```javascript
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const targetUrl = url.searchParams.get("url");
    
    // 1. Handle Preflight OPTIONS requests for CORS
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, HEAD, POST, OPTIONS",
          "Access-Control-Allow-Headers": "x-apikey, Accept",
        }
      });
    }

    if (!targetUrl) {
      return new Response("Missing url parameter. Usage: /?url=https://...", {status: 400});
    }

    // 2. Build the request to VirusTotal
    const newRequest = new Request(targetUrl, {
      method: request.method,
      headers: request.headers
    });
    
    // Remove headers that might cause VirusTotal to reject the request
    newRequest.headers.delete("origin");
    newRequest.headers.delete("referer");

    // 3. Fetch data from VirusTotal
    const response = await fetch(newRequest);
    const newResponse = new Response(response.body, response);
    
    // 4. Attach CORS headers to response so the browser accepts it
    newResponse.headers.set("Access-Control-Allow-Origin", "*");
    newResponse.headers.set("Access-Control-Allow-Methods", "GET, HEAD, POST, OPTIONS");
    newResponse.headers.set("Access-Control-Allow-Headers", "x-apikey, Accept");
    
    return newResponse;
  }
}
```

6. Click **Save and Deploy**.
7. Copy your worker's live URL (it will look like `https://vt-proxy.<your-username>.workers.dev`).

## Using it in IOC Hunter

1. Open the [Bulk IOC Hunter](https://naseeeeef.github.io/ioc-hunter/) app.
2. Click the **Settings (Gear Icon)** in the top right.
3. Paste the worker URL into the **Custom Proxy URL** field. 
    *(Example: `https://vt-proxy.myname.workers.dev/`)*
4. Click Save! The application will now route all traffic securely through your private worker, completely bypassing your corporate firewall blocks.
