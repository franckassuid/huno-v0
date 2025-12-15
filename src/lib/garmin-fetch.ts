
import fs from 'fs';
import path from 'path';
import { AxiosInstance } from 'axios';

// --- CONFIGURATION ---
const LOG_FILE_NDJSON = path.resolve(process.cwd(), 'garmin-debug.ndjson');
const LOG_FILE_SUMMARY = path.resolve(process.cwd(), 'garmin-debug-summary.json');
const DEBUG_MODE = process.env.GARMIN_DEBUG === '1';

// --- TYPES ---

export interface GarminFetchOptions {
    client: AxiosInstance;
    url: string;
    featureName: string; // e.g., "dailyWellness.sleep"
    params?: any;
}

export interface LogEvent {
    type: 'start' | 'end' | 'error';
    requestId: string;
    featureName: string;
    timestamp: string;
    // ... specific fields
    details?: any;
}

interface SummaryData {
    successCount: number;
    errorCount: number;
    lastStatus: number | null;
    lastErrorType: string | null;
    p95Latency: number | null; // Placeholder, simplified for now
    lastResponseSnippet: string | null;
    latencies: number[];
}

interface SummaryFile {
    [featureName: string]: SummaryData;
}

// --- LOGGING HELPERS ---

function appendLog(event: LogEvent, context: any = {}) {
    const entry = {
        ...event,
        ...context
    };
    try {
        fs.appendFileSync(LOG_FILE_NDJSON, JSON.stringify(entry) + '\n');
    } catch (e) {
        console.error("Failed to write to NDJSON log:", e);
    }
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
        console.error("Failed to write summary log:", e);
    }
}

function safeStringify(obj: any, limit: number): string {
    try {
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
    const start = Date.now();
    const proxyInfo = getProxyInfo();

    // 1. Log START
    const logStart: LogEvent = {
        type: 'start',
        requestId,
        featureName,
        timestamp: new Date().toISOString(),
        details: {
            url: url.split('?')[0],
            method: 'GET',
            dateParam: params?.date || 'N/A',
        }
    };
    appendLog(logStart);

    console.log(`[garminFetch] ${featureName} -> ${url}`);

    let responseSnippet: string | null = null;
    let status = 0;
    let success = false;
    let size = 0;
    let errorType: string | null = null;
    let data: any;

    try {
        let res: any;
        let headers: any = {};

        // Execute Fetch
        try {
            res = await client.get(url, { params });
        } catch (e) { throw e; }

        const duration = Date.now() - start;
        success = true;

        // Handle Response (Wrapped or Unwrapped)
        if (res && typeof res === 'object' && 'status' in res && 'headers' in res) {
            status = res.status;
            data = res.data;
            headers = res.headers;
        } else {
            // Assume it is the data directly (interceptor unwrapped it)
            status = 200; // Assume success if code reached here
            data = res;
            // Headers lost
        }

        const dataStr = typeof data !== 'undefined' ? JSON.stringify(data) : "";
        size = dataStr ? dataStr.length : 0;
        responseSnippet = safeStringify(data, 500);

        // Check for "200 but body empty" or logic errors
        if (status === 200 && (!data || (typeof data === 'object' && Object.keys(data).length === 0))) {
            // Maybe warning?
        }

        const filteredHeaders = {
            'content-type': headers['content-type'],
            'date': headers['date'],
            'server': headers['server'],
            'cf-ray': headers['cf-ray'],
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
                bodySnippet: DEBUG_MODE ? responseSnippet : (status !== 200 ? responseSnippet : null),
            }
        };
        appendLog(logEnd);
        updateSummary(featureName, true, status, null, duration, responseSnippet);

        return data;

    } catch (error: any) {
        const duration = Date.now() - start;
        status = error.response?.status || 500;
        success = false;

        // Determine Error Type
        if (status === 401) errorType = '401';
        else if (status === 403) errorType = '403';
        else if (status === 429) errorType = '429';
        else if (error.code === 'ECONNABORTED') errorType = 'timeout';
        else if (error.message && error.message.includes('JSON')) errorType = 'parse';
        else errorType = 'other';

        responseSnippet = safeStringify(error.response?.data || error.message, 500);

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
