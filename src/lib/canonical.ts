const projectAliases = new Set(['project-z0iz5.vercel.app', 'autocare-garaj-roomlyy.vercel.app']);
const projectDeployment = /^autocare-garaj-[a-z0-9]+-roomlyy\.vercel\.app$/;
/** Normalize document navigation only. Never widen authentication/CSRF trust. */
export function canonicalDocumentURL(
  requestURL: string,
  method: string,
  appURL: string,
  environment?: string,
): URL | null {
  if (environment !== 'production' || !['GET', 'HEAD'].includes(method)) return null;
  const source = new URL(requestURL);
  const target = new URL(appURL);
  if (source.origin === target.origin || target.protocol !== 'https:') return null;
  if (source.pathname.startsWith('/api/') || source.pathname.startsWith('/_next/')) return null;
  if (!projectAliases.has(source.hostname) && !projectDeployment.test(source.hostname)) return null;
  target.pathname = source.pathname;
  target.search = source.search;
  target.hash = '';
  return target;
}
