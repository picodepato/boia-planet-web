/**
 * `muestra` links (plan 007 T82, P15). Until Álvaro sends a real link the
 * content uses a sandbox one under `SAMPLE_LINK_BASE`, and the page marks it
 * «muestra» inside the link. example.com/.net/.org are reserved (RFC 2606):
 * they can never be BOIA's, so a link there is `muestra` wherever it comes
 * from (the sample content or an Admin edit), and pasting the real URL
 * removes the mark. No zod here: the landing imports this in its critical
 * path.
 */
export const SAMPLE_LINK_BASE = 'https://example.com/boia-sandbox';

/** Is this link (URL, `mailto:` or email) on example.com/.net/.org? */
export const isSampleLink = (link?: string | null): boolean =>
  !!link && /(^|[/@.])example\.(com|net|org)([:/?#]|$)/i.test(link);
