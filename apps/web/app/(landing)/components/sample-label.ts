import type { CSSProperties } from 'react';
import { t } from '../../../lib/landing/texts';

/**
 * The «muestra» mark of a sandbox link (plan 007 T82, P15), by key: set on
 * `.landing-root`, the CSS puts it after every link to example.com/.net/.org
 * (landing.css), so a link is marked until its real URL is in the content.
 */
export const SAMPLE_LABEL_STYLE = {
  '--sample-label': JSON.stringify(t('link.sample')),
} as CSSProperties;
