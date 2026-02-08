export async function GET({ url, fetch }) {
    const targetUrl = new URL(url.pathname.replace('/api', '/api'), 'https://manami-stage.altersense.net');
    targetUrl.search = url.search;

    const response = await fetch(targetUrl.toString());

    return new Response(response.body, {
        status: response.status,
        headers: response.headers
    });
}
