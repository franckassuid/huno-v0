
import fs from 'fs';
import path from 'path';
import { AxiosInstance } from 'axios';

// --- CONFIGURATION ---
// --- CONFIGURATION ---
// Vercel only allows writing to /tmp
const LOG_FILE_NDJSON = path.join('/tmp', 'garmin-debug.ndjson');
const LOG_FILE_SUMMARY = path.join('/tmp', 'garmin-debug-summary.json');
const DEBUG_MODE = process.env.GARMIN_DEBUG === '1';

// --- TYPES ---
// ... (Types remain)

// --- LOGGING HELPERS ---
function appendLog(event: LogEvent, context: any = {}) {
    // Only file logging if local or explicit
    // Use console for Vercel
    const entry = { ...event, ...context };

    if (DEBUG_MODE || event.type === 'error' || event.type === 'end') {
        // Safe console log
        const d = event.details || {};
        const safeDetails = {
            ...d,
            // Mask headers
            headers: d.headers ? Object.keys(d.headers).reduce((acc: any, key) => {
                if (['authorization', 'cookie', 'set-cookie'].includes(key.toLowerCase())) {
                    acc[key] = '[REDACTED]';
                } else {
                    acc[key] = d.headers[key];
                }
                return acc;
            }, {}) : null
        };

        if (event.type === 'error') {
            console.error(`[GARMIN:ERROR] ${event.featureName} ${event.requestId}`, JSON.stringify(safeDetails));
        } else if (DEBUG_MODE) {
            console.log(`[GARMIN:DEBUG] ${event.type.toUpperCase()} ${event.featureName} ${event.requestId}`, JSON.stringify(safeDetails));
        } else if (event.type === 'end' && !DEBUG_MODE) {
            // Brief success log
            console.log(`[GARMIN:INFO] ${event.featureName} Status:${d.status} Size:${d.responseSize} Time:${d.timeMs}ms`);
        }
    }

    try {
        fs.appendFileSync(LOG_FILE_NDJSON, JSON.stringify(entry) + '\n');
    } catch (e) { }
}

function updateSummary(featureName: string, success: boolean, status: number, errorType: string | null, latency: number, snippet: string | null) {
    let summary: SummaryFile = {};
    try {
        if (fs.existsSync(LOG_FILE_SUMMARY)) {
            summary = JSON.parse(fs.readFileSync(LOG_FILE_SUMMARY, 'utf8'));
        }
    } catch (e) { }

    if (!summary[featureName]) {
        summary[featureName] = {
            successCount: 0,
            errorCount: 0,
            lastStatus: null,
            lastErrorType: null,
            p95Latency: null,
            lastResponseSnippet: null,
            latencies: []
        };
    }

    const s = summary[featureName];
    if (success) s.successCount++;
    else s.errorCount++;

    s.lastStatus = status;
    s.lastErrorType = errorType;
    s.lastResponseSnippet = snippet;
    s.latencies.push(latency);

    // Keep latencies manageable ?
    if (s.latencies.length > 100) s.latencies = s.latencies.slice(-100);

    // Calc P95 (Simplified)
    const sorted = [...s.latencies].sort((a, b) => a - b);
    const p95Index = Math.ceil(sorted.length * 0.95) - 1;
    s.p95Latency = sorted[p95Index >= 0 ? p95Index : 0];

    try {
        fs.writeFileSync(LOG_FILE_SUMMARY, JSON.stringify(summary, null, 2));
    } catch (e) {
        // console.error("Failed to write summary log:", e);
    }
}

function safeStringify(obj: any, limit: number): string {
    try {
        if (typeof obj === 'string') return obj.slice(0, limit);
        const s = JSON.stringify(obj);
        if (s.length > limit) return s.slice(0, limit) + '...';
        return s;
    } catch (e) {
        return String(obj).slice(0, limit);
    }
}

const generateUUID = () => crypto.randomUUID();

// --- PROXY DETECTION ---
function getProxyInfo() {
    // Attempt to detect if current request is using proxy.
    // 'undici' global dispatcher or 'global-agent' env vars.
    return {
        proxyUsed: !!(process.env.PROXY_URL || process.env.HTTPS_PROXY || process.env.HTTP_PROXY),
        proxyHost: process.env.PROXY_URL ? new URL(process.env.PROXY_URL).host : null
    };
}

// --- MAIN WRAPPER ---

export async function garminFetch(options: GarminFetchOptions) {
    const { client, url, featureName, params } = options;
    const requestId = generateUUID();
    const proxyInfo = getProxyInfo();

    const MAX_RETRIES = 2;
    let attempt = 0;
    let lastError: any;

    while (attempt <= MAX_RETRIES) {
        const start = Date.now();
        attempt++;

        // 1. Log START
        if (DEBUG_MODE) {
            const logStart: LogEvent = {
                type: 'start',
                requestId,
                featureName,
                timestamp: new Date().toISOString(),
                details: {
                    url: url.split('?')[0],
                    method: 'GET',
                    dateParam: params?.date || 'N/A',
                    attempt
                }
            };
            appendLog(logStart);
        }

        try {
            let res: any;

            // Execute Fetch
            try {
                res = await client.get(url, { params });
            } catch (e) { throw e; }

            const duration = Date.now() - start;

            let status = 200;
            let data: any;
            let headers: any = {};

            // Handle Response (Wrapped or Unwrapped)
            if (res && typeof res === 'object' && 'status' in res && 'headers' in res) {
                status = res.status;
                data = res.data;
                headers = res.headers;
            } else {
                status = 200;
                data = res;
            }

            const dataStr = typeof data !== 'undefined' ? JSON.stringify(data) : "undefined";
            const size = dataStr ? dataStr.length : 0;
            const responseSnippet = safeStringify(data, 2000); // 2000 chars as requested

            // Check for potential Auth Challenge (HTML response)
            const isHtml = typeof data === 'string' && data.trim().startsWith('<');
            const contentType = headers['content-type'] || 'unknown';

            const filteredHeaders = {
                'content-type': contentType,
                'date': headers['date'],
                'cf-ray': headers['cf-ray'],
                'has-set-cookie': !!headers['set-cookie']
            };

            // 2. Log END
            const logEnd: LogEvent = {
                type: 'end',
                requestId,
                featureName,
                timestamp: new Date().toISOString(),
                details: {
                    status,
                    timeMs: duration,
                    responseSize: size,
                    proxyUsed: proxyInfo.proxyUsed,
                    headers: filteredHeaders,
                    bodySnippet: responseSnippet,
                    isHtmlChallenge: isHtml
                }
            };
            appendLog(logEnd);
            updateSummary(featureName, true, status, null, duration, responseSnippet);

            return data;

        } catch (error: any) {
            const duration = Date.now() - start;
            const status = error.response?.status || 500;
            let errorType = 'other';

            if (status === 401) errorType = '401';
            else if (status === 403) errorType = '403';
            else if (status === 429) errorType = '429';
            else if (error.code === 'ECONNABORTED') errorType = 'timeout';

            const shouldRetry = (status === 429 || status === 403 || status >= 500) && attempt <= MAX_RETRIES;

            lastError = error;

            if (shouldRetry) {
                console.warn(`[GARMIN] Retrying ${featureName} (Attempt ${attempt}/${MAX_RETRIES}) after error: ${status}`);
                await new Promise(r => setTimeout(r, attempt * 500)); // Backoff
                continue;
            }

            const responseSnippet = safeStringify(error.response?.data || error.message, 500);

            // 2. Log ERROR
            const logError: LogEvent = {
                type: 'error',
                requestId,
                featureName,
                timestamp: new Date().toISOString(),
                details: {
                    status,
                    timeMs: duration,
                    errorType,
                    message: error.message,
                    bodySnippet: responseSnippet,
                    headers: error.response?.headers ? {
                        'content-type': error.response.headers['content-type'],
                        'cf-ray': error.response.headers['cf-ray'],
                    } : null
                }
            };
            appendLog(logError);
            updateSummary(featureName, false, status, errorType, duration, responseSnippet);

            throw error;
        }
    }
    // If all retries fail, throw the last error
    throw lastError;
}
