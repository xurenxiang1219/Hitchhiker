export class Urls {

    // Use relative base so dev server proxy (client/package.json -> proxy) forwards to backend
    // This avoids CORS issues between 127.0.0.1 and localhost
    static host = '/';

    static getUrl(action: string): string {
        return `${Urls.host}api/${action}`;
    }

    static getWebSocket(action: string): string {
        const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
        const host = window.location.host; // includes hostname:port of current page
        // Keep same-origin WS; dev server will proxy WS if configured
        return `${protocol}://${host}/${action}`;
    }
}