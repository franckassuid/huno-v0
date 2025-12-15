
import { GarminConnect } from 'garmin-connect';
import { setGlobalDispatcher, ProxyAgent } from 'undici';
import path from 'path';
import fs from 'fs';

// --- CONFIGURATION ---
const SESSION_FILE = path.join('/tmp', 'session.json');

// --- PROXY SETUP ---
export function setupProxy() {
    if (process.env.PROXY_URL) {
        try {
            // 1. Undici (Node 18+)
            try {
                const proxyAgent = new ProxyAgent(process.env.PROXY_URL);
                setGlobalDispatcher(proxyAgent);
            } catch (err) { console.error("Undici setup failed:", err); }

            // 2. Global Agent (Legacy)
            try {
                const { bootstrap } = require('global-agent');
                if (!(global as any).GLOBAL_AGENT) {
                    process.env.GLOBAL_AGENT_HTTP_PROXY = process.env.PROXY_URL;
                    process.env.GLOBAL_AGENT_HTTPS_PROXY = process.env.PROXY_URL;
                    bootstrap();
                }
            } catch (err) { console.error("Global Agent setup failed:", err); }

        } catch (e) {
            console.error("Failed to initialize proxies:", e);
        }
    }
}

// --- CLIENT FACTORY ---
export async function getAuthenticatedGarminClient(email?: string, password?: string): Promise<GarminConnect> {

    // Ensure proxy is set up before any connection
    setupProxy();

    let client: GarminConnect | null = null;
    let loggedIn = false;

    // SCENARIO 1: Explicit Credentials
    if (email && password) {
        const gc = new GarminConnect({ username: email, password });
        try {
            await gc.login();
            gc.exportTokenToFile(SESSION_FILE);
            client = gc;
            loggedIn = true;
        } catch (e) {
            console.error("Login failed:", e);
            throw e;
        }
    }
    // SCENARIO 2: Session Restore
    else {
        const gc = new GarminConnect({ username: 'dummy', password: 'password' });
        if (fs.existsSync(SESSION_FILE)) {
            try {
                gc.loadTokenByFile(SESSION_FILE);
                client = gc;
                loggedIn = true; // Assume valid until proven otherwise
            } catch (e) {
                console.warn("Session restore failed:", e);
            }
        }
    }

    if (!client || !loggedIn) {
        throw new Error('Authentication failed: No credentials provided and no valid session found.');
    }

    // INJECT HEADERS
    if (client.client && client.client.defaults && client.client.defaults.headers) {
        // 4. Inject Verified Headers (from successful cURL)
        // These are critical for accessing the new /gc-api/ endpoints
        client.client.defaults.headers.common['User-Agent'] = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36";
        client.client.defaults.headers.common['NK'] = 'NT'; // Critical Garmin Header
        client.client.defaults.headers.common['accept'] = '*/*';
        client.client.defaults.headers.common['accept-language'] = 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7';
        client.client.defaults.headers.common['origin'] = 'https://connect.garmin.com';
        client.client.defaults.headers.common['referer'] = 'https://connect.garmin.com/modern/';
    }

    // INJECT HEADERS (Essential for bypassing WAF/Empty Responses)
    if (client && client.client) {
        // @ts-ignore
        const headers = client.client.defaults.headers;
        if (headers) {
            const common = headers.common || {};
            const mimicHeaders = {
                'User-Agent': "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36",
                'NK': 'NT',
                'Origin': 'https://connect.garmin.com',
                'Referer': 'https://connect.garmin.com/modern/',
                'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
            };
            Object.assign(common, mimicHeaders);
            headers.common = common; // Re-assign validation

            // Also force on GET specifically just in case
            headers.get = { ...headers.get, ...mimicHeaders };

            console.log("Garmin Client Headers Injected: NK=NT");
        }
    }

    return client;
}
