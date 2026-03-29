export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const targetUrl = url.searchParams.get("url");
    
    // 1. Handle browser preflight CORS requests 
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, HEAD, POST, OPTIONS",
          "Access-Control-Allow-Headers": "x-apikey, Accept",
        }
      });
    }

    if (!targetUrl) return new Response("Missing url parameter.", {status: 400});

    // 2. Build the secure request to VirusTotal
    const newRequest = new Request(targetUrl, {
      method: request.method,
      headers: request.headers
    });
    
    newRequest.headers.delete("origin");
    newRequest.headers.delete("referer");

    // 3. Fetch data
    const response = await fetch(newRequest);
    const newResponse = new Response(response.body, response);
    
    // 4. Force browser to accept the secure response
    newResponse.headers.set("Access-Control-Allow-Origin", "*");
    newResponse.headers.set("Access-Control-Allow-Methods", "GET, HEAD, POST, OPTIONS");
    newResponse.headers.set("Access-Control-Allow-Headers", "x-apikey, Accept");
    
    return newResponse;
  }
}
