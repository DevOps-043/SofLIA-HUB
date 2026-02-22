/**
 * AutoDevWeb — Web research and npm audit functions for AutoDevService.
 * Pattern extracted from whatsapp-agent.ts webSearch/readWebpage functions.
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { NpmAuditVulnerability, NpmOutdatedPackage } from './autodev-types';

const execFileAsync = promisify(execFile);

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// ─── Web Search ────────────────────────────────────────────────────

export async function webSearch(
  query: string,
): Promise<{ success: boolean; results?: string; error?: string }> {
  try {
    const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const resp = await fetch(searchUrl, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(15_000),
    });

    if (!resp.ok) {
      // Fallback to Google
      const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}&num=8&hl=es`;
      const gResp = await fetch(googleUrl, {
        headers: { 'User-Agent': USER_AGENT },
        signal: AbortSignal.timeout(15_000),
      });
      const html = await gResp.text();
      return { success: true, results: stripHtml(html).slice(0, 5000) };
    }

    const html = await resp.text();
    return { success: true, results: stripHtml(html).slice(0, 6000) };
  } catch (err: any) {
    return { success: false, error: `Web search failed: ${err.message}` };
  }
}

// ─── Read Webpage ──────────────────────────────────────────────────

export async function readWebpage(
  url: string,
): Promise<{ success: boolean; content?: string; error?: string }> {
  try {
    const resp = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'es-MX,es;q=0.9,en;q=0.8',
      },
      signal: AbortSignal.timeout(20_000),
    });

    if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);

    const html = await resp.text();
    return { success: true, content: stripHtml(html).slice(0, 8000) };
  } catch (err: any) {
    return { success: false, error: `Read webpage failed: ${err.message}` };
  }
}

// ─── NPM Audit ─────────────────────────────────────────────────────

export async function npmAudit(
  repoPath: string,
): Promise<{ success: boolean; vulnerabilities: NpmAuditVulnerability[]; error?: string }> {
  try {
    let stdout: string;
    try {
      const result = await execFileAsync('npm', ['audit', '--json'], {
        cwd: repoPath,
        maxBuffer: 10 * 1024 * 1024,
        timeout: 60_000,
        shell: true,
      });
      stdout = result.stdout;
    } catch (err: any) {
      // npm audit exits with non-zero when vulnerabilities exist
      stdout = err.stdout || '{}';
    }

    const data = JSON.parse(stdout);
    const vulns: NpmAuditVulnerability[] = [];

    if (data.vulnerabilities) {
      for (const [name, info] of Object.entries(data.vulnerabilities) as any[]) {
        vulns.push({
          name,
          severity: info.severity || 'info',
          title: info.via?.[0]?.title || info.via?.[0] || 'Unknown',
          url: info.via?.[0]?.url || '',
          range: info.range || '',
          fixAvailable: !!info.fixAvailable,
        });
      }
    }

    // Sort: critical > high > moderate > low
    const severityOrder: Record<string, number> = { critical: 0, high: 1, moderate: 2, low: 3, info: 4 };
    vulns.sort((a, b) => (severityOrder[a.severity] ?? 5) - (severityOrder[b.severity] ?? 5));

    return { success: true, vulnerabilities: vulns };
  } catch (err: any) {
    return { success: false, vulnerabilities: [], error: `npm audit failed: ${err.message}` };
  }
}

// ─── NPM Outdated ──────────────────────────────────────────────────

export async function npmOutdated(
  repoPath: string,
): Promise<{ success: boolean; packages: NpmOutdatedPackage[]; error?: string }> {
  try {
    let stdout: string;
    try {
      const result = await execFileAsync('npm', ['outdated', '--json'], {
        cwd: repoPath,
        maxBuffer: 10 * 1024 * 1024,
        timeout: 60_000,
        shell: true,
      });
      stdout = result.stdout;
    } catch (err: any) {
      // npm outdated exits with non-zero when packages are outdated
      stdout = err.stdout || '{}';
    }

    const data = JSON.parse(stdout);
    const packages: NpmOutdatedPackage[] = [];

    for (const [name, info] of Object.entries(data) as any[]) {
      packages.push({
        name,
        current: info.current || 'unknown',
        wanted: info.wanted || 'unknown',
        latest: info.latest || 'unknown',
        type: info.type === 'devDependencies' ? 'devDependencies' : 'dependencies',
      });
    }

    return { success: true, packages };
  } catch (err: any) {
    return { success: false, packages: [], error: `npm outdated failed: ${err.message}` };
  }
}

// ─── Fetch npm package info ────────────────────────────────────────

export async function fetchNpmPackageInfo(
  packageName: string,
): Promise<{ success: boolean; version?: string; description?: string; homepage?: string; error?: string }> {
  try {
    const resp = await fetch(`https://registry.npmjs.org/${encodeURIComponent(packageName)}/latest`, {
      signal: AbortSignal.timeout(10_000),
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json() as any;
    return {
      success: true,
      version: data.version,
      description: data.description,
      homepage: data.homepage || data.repository?.url || '',
    };
  } catch (err: any) {
    return { success: false, error: `npm registry fetch failed: ${err.message}` };
  }
}

// ─── HTML Cleanup ──────────────────────────────────────────────────

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
    .replace(/<footer[\s\S]*?<\/footer>/gi, ' ')
    .replace(/<header[\s\S]*?<\/header>/gi, ' ')
    .replace(/<aside[\s\S]*?<\/aside>/gi, ' ')
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}
