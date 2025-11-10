export class Urls {

    static host = 'http://localhost:8086/';

    static getUrl(action: string): string {
        return `${Urls.host}api/${action}`;
    }

    static getWebSocket(action: string): string {
        //return `ws${Urls.host.substr(4)}${action}`;
        return `ws://10.1.96.130:9999/${action}`;
    }
} 