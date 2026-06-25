const baseUrl = import.meta.env.VITE_API_BASE_URL || 'https://manami-stage.altersense.net';

export async function GET({ url, fetch }) {
    const targetUrl = new URL(url.pathname.replace('/api', '/api'), baseUrl);
    targetUrl.search = url.search;

    const response = await fetch(targetUrl.toString());

    // Create a new Headers object to modify
    const newHeaders = new Headers(response.headers);
    newHeaders.delete('content-encoding');
    newHeaders.delete('content-length');

    return new Response(response.body, {
        status: response.status,
        headers: newHeaders
    });
}
