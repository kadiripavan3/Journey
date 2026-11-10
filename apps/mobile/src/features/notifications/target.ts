import type { Href } from 'expo-router';

const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const USERNAME = /^[a-z0-9._]{1,40}$/i;

/** Where the app opens when a notification says nothing this version understands. */
export const FALLBACK: Href = '/activity';

/**
 * Where a notification opens the app. The API sends a path with each push ("/journey/<id>/timeline"); only the
 * screens named here are opened, with ids that look like ids, so a strange or newer path lands on Activity
 * instead of on a missing screen.
 */
export function hrefFor(path: unknown): Href {
  if (typeof path !== 'string') return FALLBACK;
  const [pathname = '', query = ''] = path.split('?');
  const [kind, id, part, extra] = pathname.split('/').filter(Boolean);
  if (extra) return FALLBACK;

  if (kind === 'digest' && !id) return '/digest';
  if (kind === 'activity' && !id) return '/activity';
  if (kind === 'profile' && id && !part && USERNAME.test(id)) return `/profile/${id}`;
  if (!id || !ID.test(id)) return FALLBACK;

  if (kind === 'invitation' && !part) return `/invitation/${id}`;
  if (kind === 'entry' && !part) return query === 'comments=1' ? `/entry/${id}?comments=1` : `/entry/${id}`;
  if (kind === 'journey') {
    if (!part) return `/journey/${id}`;
    if (part === 'timeline') return `/journey/${id}/timeline`;
    if (part === 'people') return `/journey/${id}/people`;
    if (part === 'recap') return `/journey/${id}/recap`;
    if (part === 'add') return `/journey/${id}/add`;
  }
  return FALLBACK;
}
