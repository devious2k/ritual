import { formatDate } from '@/lib/utils';

export interface WebsiteConfig {
  heroTitle: string;
  heroSubtitle: string;
  welcomeTitle: string;
  welcomeBody: string;
  visitingTitle: string;
  visitingBody: string;
  contactEmail: string;
  contactPhone: string;
  showMeetings: boolean;
}

export interface LodgeWebsiteLodge {
  id: string;
  name: string;
  number: string;
  venue?: string | null;
  venueAddress?: string | null;
  meetingDay?: string | null;
  meetingMonths?: string | null;
  diningCost?: number | null;
  tylerPhone?: string | null;
  crestUrl?: string | null;
  settings?: {
    website?: Partial<WebsiteConfig>;
    [key: string]: unknown;
  } | null;
}

export interface LodgeWebsiteMeeting {
  id: string;
  type: string;
  date: string;
  startTime?: string | null;
  venue?: string | null;
  ceremonyType?: string | null;
}

export interface PublicLodgeSiteResponse {
  lodge: LodgeWebsiteLodge;
  meetings: LodgeWebsiteMeeting[];
}

export const defaultWebsiteConfig: WebsiteConfig = {
  heroTitle: 'A warm welcome to our lodge',
  heroSubtitle:
    'A modern home for brotherhood, ritual, and charitable purpose in our local community.',
  welcomeTitle: 'What to expect',
  welcomeBody:
    'We meet regularly through the Masonic season, combining ceremony, fellowship, and a festive board after the meeting. Visitors and prospective members are always welcome to get in touch.',
  visitingTitle: 'Thinking of visiting or joining?',
  visitingBody:
    'If you would like to visit the lodge, learn more about our meetings, or enquire about Freemasonry, please use the contact details below and we will be glad to hear from you.',
  contactEmail: '',
  contactPhone: '',
  showMeetings: true,
};

export function meetingTypeLabel(type: string): string {
  return type
    .split('_')
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(' ');
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatMeetingMeta(lodge: LodgeWebsiteLodge, meeting: LodgeWebsiteMeeting) {
  return [meeting.startTime || '', meeting.venue || lodge.venue || ''].filter(Boolean).join(' • ');
}

function formatMeetingPattern(lodge: LodgeWebsiteLodge) {
  return [lodge.meetingDay, lodge.meetingMonths].filter(Boolean).join(' • ') || 'Please enquire for details';
}

function formatVenue(lodge: LodgeWebsiteLodge) {
  return [lodge.venue, lodge.venueAddress].filter(Boolean).join(', ') || 'Venue details available on request';
}

function formatDining(lodge: LodgeWebsiteLodge) {
  return lodge.diningCost != null ? `Dining from £${lodge.diningCost.toFixed(2)}` : 'Dining arranged after meetings';
}

function meetingDateParts(date: string) {
  const asDate = new Date(date);
  return {
    day: new Intl.DateTimeFormat('en-GB', { day: '2-digit' }).format(asDate),
    month: new Intl.DateTimeFormat('en-GB', { month: 'short' }).format(asDate),
  };
}

function lodgeInitials(lodge: LodgeWebsiteLodge) {
  return lodge.name
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

const siteStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400&family=Crimson+Text:ital,wght@0,400;0,600;1,400&family=Source+Sans+3:wght@300;400;600;700&display=swap');

  :root {
    --navy: #0d1f3c;
    --navy-mid: #162d56;
    --navy-light: #1e3a6e;
    --gold: #c9a84c;
    --gold-light: #e2c06b;
    --gold-pale: #f5e9c8;
    --cream: #faf7f2;
    --off-white: #f4f1eb;
    --steel: #8a929e;
    --brick: #8b4a3a;
    --text-dark: #1a1a2e;
    --text-mid: #3d4458;
    --text-light: #6b7280;
    --border: #ddd5c0;
    --card-bg: #ffffff;
    --shadow: 0 4px 24px rgba(13,31,60,0.10);
    --shadow-lg: 0 8px 40px rgba(13,31,60,0.18);
  }

  * { box-sizing: border-box; }
  html { scroll-behavior: smooth; }
  body.lk-public-body,
  .lk-public {
    margin: 0;
    font-family: 'Source Sans 3', sans-serif;
    background: var(--cream);
    color: var(--text-dark);
    font-size: 17px;
    line-height: 1.7;
  }
  .lk-public h1,
  .lk-public h2,
  .lk-public h3,
  .lk-public h4 {
    margin: 0;
    font-family: 'Playfair Display', Georgia, serif;
    line-height: 1.2;
    color: var(--navy);
  }
  .lk-public p { margin: 0; }
  .lk-public .serif-body {
    font-family: 'Crimson Text', Georgia, serif;
    font-size: 1.15em;
  }
  .lk-public a { color: inherit; }
  .lk-public .site-header {
    position: sticky;
    top: 0;
    z-index: 30;
    background: var(--navy);
    border-bottom: 2px solid var(--gold);
    box-shadow: 0 4px 30px rgba(0,0,0,0.18);
  }
  .lk-public .header-inner {
    max-width: 1200px;
    margin: 0 auto;
    height: 68px;
    padding: 0 24px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20px;
  }
  .lk-public .logo-block {
    display: flex;
    align-items: center;
    gap: 14px;
    text-decoration: none;
  }
  .lk-public .logo-emblem {
    width: 44px;
    height: 44px;
    border-radius: 999px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--gold);
    color: var(--navy);
    border: 2px solid var(--gold-light);
    box-shadow: 0 0 0 3px rgba(201,168,76,0.2);
    font-family: 'Playfair Display', Georgia, serif;
    font-size: 1.05rem;
    font-weight: 700;
    overflow: hidden;
  }
  .lk-public .logo-emblem img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .lk-public .logo-name {
    color: white;
    font-family: 'Playfair Display', Georgia, serif;
    font-size: 1rem;
    font-weight: 700;
    line-height: 1.1;
  }
  .lk-public .logo-sub {
    color: var(--gold);
    font-size: 0.7rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }
  .lk-public nav {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-wrap: wrap;
  }
  .lk-public nav a {
    text-decoration: none;
    font-size: 0.8rem;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: rgba(255,255,255,0.82);
    padding: 6px 10px;
    border-radius: 4px;
  }
  .lk-public nav a:hover {
    color: var(--gold);
    background: rgba(201,168,76,0.1);
  }
  .lk-public .nav-cta {
    margin-left: 8px;
    background: var(--gold);
    color: var(--navy);
    font-weight: 700;
  }
  .lk-public .hero {
    position: relative;
    min-height: 92vh;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    background: linear-gradient(135deg, #0a1628 0%, #0d1f3c 40%, #162d56 70%, #1a3560 100%);
  }
  .lk-public .hero-pattern {
    position: absolute;
    inset: 0;
    opacity: 0.04;
    background-image:
      repeating-linear-gradient(45deg, var(--gold) 0, var(--gold) 1px, transparent 0, transparent 50%),
      repeating-linear-gradient(-45deg, var(--gold) 0, var(--gold) 1px, transparent 0, transparent 50%);
    background-size: 20px 20px;
  }
  .lk-public .hero-compass {
    position: absolute;
    right: 5%;
    top: 50%;
    transform: translateY(-50%);
    font-size: 22rem;
    opacity: 0.04;
    color: var(--gold);
    user-select: none;
    pointer-events: none;
    line-height: 1;
  }
  .lk-public .hero-content {
    position: relative;
    z-index: 2;
    text-align: center;
    max-width: 840px;
    padding: 64px 24px;
  }
  .lk-public .hero-badge,
  .lk-public .section-label,
  .lk-public .eyebrow {
    display: inline-block;
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: var(--gold);
  }
  .lk-public .hero-badge {
    margin-bottom: 2rem;
    padding: 6px 20px;
    border: 1px solid var(--gold);
    border-radius: 2px;
  }
  .lk-public .hero h1 {
    font-size: clamp(2.6rem, 5vw, 4rem);
    color: white;
    line-height: 1.12;
    text-shadow: 0 2px 20px rgba(0,0,0,0.45);
  }
  .lk-public .hero h1 em {
    color: var(--gold);
    font-style: normal;
  }
  .lk-public .hero-sub {
    max-width: 620px;
    margin: 1.25rem auto 0;
    color: rgba(255,255,255,0.78);
    font-family: 'Crimson Text', Georgia, serif;
    font-size: clamp(1.12rem, 2vw, 1.38rem);
    line-height: 1.6;
  }
  .lk-public .hero-divider,
  .lk-public .gold-rule {
    width: 56px;
    height: 3px;
    border-radius: 2px;
    background: var(--gold);
  }
  .lk-public .hero-divider {
    margin: 2rem auto 2.25rem;
  }
  .lk-public .hero-btns {
    display: flex;
    justify-content: center;
    gap: 1rem;
    flex-wrap: wrap;
  }
  .lk-public .btn-primary,
  .lk-public .btn-outline {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 14px 28px;
    text-decoration: none;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    font-size: 0.88rem;
    border-radius: 3px;
    transition: all 0.25s;
    border: 2px solid transparent;
  }
  .lk-public .btn-primary {
    background: var(--gold);
    color: var(--navy);
    border-color: var(--gold);
    font-weight: 700;
  }
  .lk-public .btn-primary:hover {
    background: var(--gold-light);
    border-color: var(--gold-light);
    transform: translateY(-1px);
    box-shadow: 0 6px 20px rgba(201,168,76,0.35);
  }
  .lk-public .btn-outline {
    color: white;
    border-color: rgba(255,255,255,0.45);
    font-weight: 600;
  }
  .lk-public .btn-outline:hover {
    border-color: white;
    background: rgba(255,255,255,0.08);
    transform: translateY(-1px);
  }
  .lk-public section {
    padding: 80px 24px;
  }
  .lk-public .section-inner {
    max-width: 1160px;
    margin: 0 auto;
  }
  .lk-public .section-heading {
    font-size: clamp(1.95rem, 3vw, 2.8rem);
    color: var(--navy);
  }
  .lk-public .section-sub {
    margin-top: 1rem;
    margin-bottom: 2.5rem;
    max-width: 700px;
    color: var(--text-mid);
    font-family: 'Crimson Text', Georgia, serif;
    font-size: 1.1rem;
    line-height: 1.65;
  }
  .lk-public .bg-white { background: white; }
  .lk-public .bg-cream { background: var(--cream); }
  .lk-public .bg-off { background: var(--off-white); }
  .lk-public .bg-navy {
    background: linear-gradient(160deg, #0d1f3c 0%, #162d56 100%);
  }
  .lk-public .bg-navy .section-heading,
  .lk-public .bg-navy h3,
  .lk-public .bg-navy p,
  .lk-public .bg-navy .glance-val {
    color: white;
  }
  .lk-public .bg-navy .section-sub,
  .lk-public .bg-navy .glance-label {
    color: rgba(255,255,255,0.72);
  }
  .lk-public .card-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
    gap: 1.5rem;
  }
  .lk-public .card {
    background: var(--card-bg);
    border-radius: 6px;
    border: 1px solid var(--border);
    padding: 2rem;
    box-shadow: var(--shadow);
  }
  .lk-public .card-icon {
    width: 52px;
    height: 52px;
    margin-bottom: 1rem;
    border-radius: 999px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--navy);
    color: var(--gold);
    font-size: 1.35rem;
  }
  .lk-public .card h3 {
    font-size: 1.14rem;
    margin-bottom: 0.6rem;
  }
  .lk-public .card .eyebrow {
    margin-bottom: 0.6rem;
  }
  .lk-public .card p {
    color: var(--text-mid);
    font-size: 0.96rem;
    line-height: 1.65;
  }
  .lk-public .split-grid {
    display: grid;
    grid-template-columns: 1.2fr 0.8fr;
    gap: 2rem;
    align-items: start;
  }
  .lk-public .feature-panel {
    background: white;
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 2rem;
    box-shadow: var(--shadow);
  }
  .lk-public .feature-panel p + p {
    margin-top: 1rem;
  }
  .lk-public .feature-list {
    list-style: none;
    padding: 0;
    margin: 1.5rem 0 0;
    display: grid;
    gap: 0.85rem;
  }
  .lk-public .feature-list li {
    padding: 0.95rem 1rem;
    border-radius: 4px;
    border: 1px solid var(--border);
    background: var(--off-white);
    color: var(--text-mid);
  }
  .lk-public .timeline {
    display: grid;
    gap: 1rem;
  }
  .lk-public .timeline-item {
    display: grid;
    grid-template-columns: 90px 1fr;
    gap: 1rem;
    align-items: start;
    padding: 1.2rem 0;
    border-bottom: 1px solid var(--border);
  }
  .lk-public .timeline-item:last-child {
    border-bottom: none;
  }
  .lk-public .timeline-label {
    color: var(--gold);
    font-size: 0.76rem;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }
  .lk-public .timeline-copy h3 {
    font-size: 1.05rem;
    margin-bottom: 0.4rem;
  }
  .lk-public .timeline-copy p {
    color: var(--text-mid);
    font-size: 0.96rem;
  }
  .lk-public .glance-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
    gap: 1px;
    background: var(--border);
    border: 1px solid var(--border);
    border-radius: 8px;
    overflow: hidden;
    box-shadow: var(--shadow);
  }
  .lk-public .glance-item {
    background: white;
    padding: 2rem 1.5rem;
    text-align: center;
  }
  .lk-public .glance-icon {
    font-size: 2rem;
    color: var(--gold);
    line-height: 1;
  }
  .lk-public .glance-label {
    margin-top: 0.75rem;
    font-size: 0.72rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--steel);
    font-weight: 600;
  }
  .lk-public .glance-val {
    margin-top: 0.45rem;
    font-family: 'Playfair Display', Georgia, serif;
    font-size: 1.05rem;
    color: var(--navy);
    font-weight: 600;
    line-height: 1.3;
  }
  .lk-public .master-wrap {
    display: grid;
    grid-template-columns: 280px 1fr;
    gap: 3rem;
    align-items: start;
  }
  .lk-public .master-portrait {
    background: var(--off-white);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 1.5rem;
    text-align: center;
    box-shadow: var(--shadow);
  }
  .lk-public .portrait-placeholder {
    width: 100%;
    aspect-ratio: 3 / 4;
    margin-bottom: 1rem;
    border-radius: 4px;
    border: 2px solid var(--gold);
    background: linear-gradient(160deg, var(--navy-mid), var(--navy-light));
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--gold);
    font-size: 3.5rem;
    overflow: hidden;
  }
  .lk-public .portrait-placeholder.has-image {
    background: white;
    padding: 18px;
  }
  .lk-public .portrait-placeholder img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
  .lk-public .master-caption {
    color: var(--steel);
    font-size: 0.82rem;
    font-style: italic;
  }
  .lk-public .pull-quote {
    margin: 1.75rem 0 0;
    padding: 1rem 2rem;
    border-left: 4px solid var(--gold);
    background: var(--off-white);
    border-radius: 0 4px 4px 0;
  }
  .lk-public .pull-quote p {
    font-family: 'Crimson Text', Georgia, serif;
    font-size: 1.2rem;
    font-style: italic;
    color: var(--navy);
    line-height: 1.6;
  }
  .lk-public .pull-quote cite {
    display: block;
    margin-top: 0.75rem;
    font-size: 0.85rem;
    font-style: normal;
    color: var(--steel);
  }
  .lk-public .event-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  .lk-public .event-item {
    display: flex;
    align-items: center;
    gap: 1.5rem;
    padding: 1.2rem 1.5rem;
    background: white;
    border: 1px solid var(--border);
    border-left: 4px solid var(--gold);
    border-radius: 4px;
    box-shadow: var(--shadow);
  }
  .lk-public .event-date {
    min-width: 60px;
    padding: 8px 10px;
    background: var(--navy);
    border-radius: 4px;
    text-align: center;
    color: var(--gold);
    font-family: 'Playfair Display', Georgia, serif;
  }
  .lk-public .event-month {
    display: block;
    font-size: 0.7rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }
  .lk-public .event-day {
    font-size: 1.5rem;
    font-weight: 700;
    line-height: 1;
  }
  .lk-public .event-details h4 {
    font-size: 1rem;
    color: var(--navy);
    margin-bottom: 0.25rem;
  }
  .lk-public .event-details p {
    font-size: 0.9rem;
    color: var(--text-light);
  }
  .lk-public .event-badge {
    margin-left: auto;
    white-space: nowrap;
    padding: 3px 10px;
    border-radius: 12px;
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .lk-public .badge-member {
    background: var(--navy);
    color: var(--gold);
  }
  .lk-public .badge-open {
    background: var(--gold-pale);
    color: var(--navy);
    border: 1px solid var(--gold);
  }
  .lk-public .steps {
    display: flex;
    flex-direction: column;
  }
  .lk-public .step {
    display: flex;
    gap: 1.5rem;
    align-items: flex-start;
    padding: 1.5rem 0;
    border-bottom: 1px solid var(--border);
  }
  .lk-public .step:last-child {
    border-bottom: none;
  }
  .lk-public .step-num {
    min-width: 48px;
    height: 48px;
    border-radius: 999px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--gold);
    color: var(--navy);
    font-family: 'Playfair Display', Georgia, serif;
    font-size: 1.2rem;
    font-weight: 700;
  }
  .lk-public .step-content h4 {
    margin-bottom: 0.4rem;
    font-size: 1.05rem;
  }
  .lk-public .step-content p {
    font-size: 0.95rem;
    color: var(--text-mid);
  }
  .lk-public .contact-grid {
    display: grid;
    grid-template-columns: 1fr 400px;
    gap: 3rem;
    align-items: start;
  }
  .lk-public .contact-panel {
    background: white;
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 2rem;
    box-shadow: var(--shadow);
  }
  .lk-public .contact-panel p {
    color: var(--text-mid);
  }
  .lk-public .contact-links {
    display: flex;
    flex-direction: column;
    gap: 0.9rem;
    margin-top: 1.5rem;
  }
  .lk-public .contact-link {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    width: fit-content;
    padding: 10px 14px;
    border-radius: 999px;
    text-decoration: none;
    background: var(--off-white);
    color: var(--navy);
    border: 1px solid var(--border);
    font-weight: 600;
  }
  .lk-public .contact-aside {
    background: var(--navy);
    border-radius: 6px;
    padding: 2rem;
    color: rgba(255,255,255,0.85);
  }
  .lk-public .contact-aside h3 {
    color: white;
    margin-bottom: 1rem;
  }
  .lk-public .contact-detail {
    display: flex;
    gap: 14px;
    align-items: flex-start;
    padding: 1rem 0;
    border-bottom: 1px solid rgba(255,255,255,0.1);
  }
  .lk-public .contact-detail:last-of-type {
    border-bottom: none;
  }
  .lk-public .contact-detail .icon {
    color: var(--gold);
    font-size: 1.2rem;
    flex-shrink: 0;
  }
  .lk-public .contact-detail strong {
    display: block;
    color: white;
    font-size: 0.82rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .lk-public .cta-band {
    padding: 3.5rem 2rem;
    text-align: center;
    background: linear-gradient(135deg, #c9a84c 0%, #e2c06b 100%);
  }
  .lk-public .cta-band h2 {
    color: var(--navy);
    margin-bottom: 0.8rem;
  }
  .lk-public .cta-band p {
    max-width: 560px;
    margin: 0 auto 2rem;
    color: rgba(13,31,60,0.75);
    font-family: 'Crimson Text', Georgia, serif;
    font-size: 1.1rem;
  }
  .lk-public footer {
    background: #08131f;
    color: rgba(255,255,255,0.6);
    padding: 3rem 2rem 1.5rem;
    font-size: 0.88rem;
  }
  .lk-public .footer-inner {
    max-width: 1160px;
    margin: 0 auto;
  }
  .lk-public .footer-grid {
    display: grid;
    grid-template-columns: 2fr 1fr 1fr;
    gap: 3rem;
    margin-bottom: 2.5rem;
  }
  .lk-public .footer-brand p {
    margin-top: 0.8rem;
    max-width: 340px;
    line-height: 1.6;
  }
  .lk-public .footer-col h4 {
    margin-bottom: 0.8rem;
    padding-bottom: 0.5rem;
    color: white;
    font-size: 0.95rem;
    border-bottom: 1px solid rgba(201,168,76,0.3);
  }
  .lk-public .footer-col ul {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .lk-public .footer-col a {
    color: rgba(255,255,255,0.55);
    text-decoration: none;
  }
  .lk-public .footer-col a:hover {
    color: var(--gold);
  }
  .lk-public .footer-bottom {
    border-top: 1px solid rgba(255,255,255,0.1);
    padding-top: 1.2rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
  }
  .lk-public .footer-gold { color: var(--gold); }
  .lk-public .ugle-note {
    color: rgba(255,255,255,0.35);
    font-size: 0.78rem;
  }
  @media (max-width: 960px) {
    .lk-public .master-wrap,
    .lk-public .contact-grid,
    .lk-public .footer-grid,
    .lk-public .split-grid {
      grid-template-columns: 1fr;
    }
    .lk-public .event-item {
      flex-direction: column;
      align-items: flex-start;
    }
    .lk-public .event-badge {
      margin-left: 0;
    }
  }
  @media (max-width: 760px) {
    .lk-public .header-inner {
      height: auto;
      padding-top: 16px;
      padding-bottom: 16px;
      align-items: flex-start;
      flex-direction: column;
    }
    .lk-public nav {
      width: 100%;
    }
    .lk-public .hero {
      min-height: auto;
      padding: 4rem 0;
    }
    .lk-public .hero-compass {
      display: none;
    }
    .lk-public section {
      padding: 64px 20px;
    }
  }
`;

export function buildWebsiteConfig(
  lodge: LodgeWebsiteLodge,
  override?: Partial<WebsiteConfig>,
): WebsiteConfig {
  return {
    ...defaultWebsiteConfig,
    contactPhone: lodge.tylerPhone || '',
    ...(lodge.settings?.website || {}),
    ...(override || {}),
  };
}

function buildMeetingsMarkup(lodge: LodgeWebsiteLodge, meetings: LodgeWebsiteMeeting[]) {
  if (meetings.length === 0) {
    return `<div class="event-item"><div class="event-details"><h4>Upcoming meetings available on request</h4><p>Please contact the lodge for the next date and dining details.</p></div><span class="event-badge badge-open">Enquire</span></div>`;
  }

  return meetings
    .map((meeting) => {
      const parts = meetingDateParts(meeting.date);
      return `
        <article class="event-item">
          <div class="event-date">
            <span class="event-month">${escapeHtml(parts.month)}</span>
            <span class="event-day">${escapeHtml(parts.day)}</span>
          </div>
          <div class="event-details">
            <h4>${escapeHtml(meeting.ceremonyType || meetingTypeLabel(meeting.type))}</h4>
            <p>${escapeHtml(formatDate(meeting.date))}</p>
            <p>${escapeHtml(formatMeetingMeta(lodge, meeting) || 'Please enquire for time and venue')}</p>
          </div>
          <span class="event-badge badge-open">${escapeHtml(meetingTypeLabel(meeting.type))}</span>
        </article>
      `;
    })
    .join('\n');
}

function buildNewsMarkup(lodge: LodgeWebsiteLodge, meetings: LodgeWebsiteMeeting[]) {
  const nextMeeting = meetings[0];
  const nextMeetingLabel = nextMeeting
    ? `${formatDate(nextMeeting.date)}${nextMeeting.ceremonyType ? ` • ${nextMeeting.ceremonyType}` : ''}`
    : 'Dates announced through the summons and members area';

  return [
    {
      title: 'Next meeting announced',
      body: `Our next lodge night is ${nextMeetingLabel}. Brethren can review details and dining replies in the members area.`,
      badge: 'Diary',
    },
    {
      title: 'Festive board preparations',
      body: `Dining arrangements are being organised for ${lodge.name}. Please send apologies and dining replies in good time so the evening can be properly prepared.`,
      badge: 'Dining',
    },
    {
      title: 'Visitors welcome by arrangement',
      body: 'Brethren from other lodges are warmly invited to enquire in advance so we can help with protocol, timing, and festive board arrangements.',
      badge: 'Visitors',
    },
  ]
    .map(
      (item) => `
        <article class="card">
          <div class="eyebrow">${escapeHtml(item.badge)}</div>
          <h3>${escapeHtml(item.title)}</h3>
          <p>${escapeHtml(item.body)}</p>
        </article>
      `,
    )
    .join('\n');
}

function buildFaqMarkup() {
  return [
    {
      question: 'Do I need to be a Freemason to contact the lodge?',
      answer:
        'No. We welcome respectful enquiries from people who want to understand Freemasonry, ask about visiting, or explore membership in due course.',
    },
    {
      question: 'Can brethren from other lodges visit?',
      answer:
        'Yes, visiting brethren are welcome by prior arrangement. Please get in touch so we can confirm the meeting, dining details, and any formalities.',
    },
    {
      question: 'What happens after a meeting?',
      answer:
        'Following the work of the evening, brethren and guests usually retire to the festive board for dining, fellowship, and conversation.',
    },
    {
      question: 'How do members reply for dining?',
      answer:
        'Members can sign in through the members area to view the calendar, open the next meeting, and send their RSVP for dining.',
    },
  ]
    .map(
      (item) => `
        <article class="card">
          <div class="eyebrow">FAQ</div>
          <h3>${escapeHtml(item.question)}</h3>
          <p>${escapeHtml(item.answer)}</p>
        </article>
      `,
    )
    .join('\n');
}

export function generateWebsiteHtml(
  lodge: LodgeWebsiteLodge,
  website: WebsiteConfig,
  meetings: LodgeWebsiteMeeting[],
) {
  const visibleMeetings = website.showMeetings ? meetings.slice(0, 4) : [];
  const crestMarkup = lodge.crestUrl
    ? `<img src="${escapeHtml(lodge.crestUrl)}" alt="${escapeHtml(`${lodge.name} crest`)}" />`
    : escapeHtml(lodgeInitials(lodge));

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(lodge.name)} No. ${escapeHtml(lodge.number)}</title>
  <style>${siteStyles}</style>
</head>
<body class="lk-public-body">
  <div class="lk-public">
    <header class="site-header">
      <div class="header-inner">
        <a class="logo-block" href="#top">
          <div class="logo-emblem">${crestMarkup}</div>
          <div>
            <div class="logo-name">${escapeHtml(lodge.name)} No. ${escapeHtml(lodge.number)}</div>
            <div class="logo-sub">Middlesbrough Freemasons</div>
          </div>
        </a>
        <nav>
          <a href="#about">About</a>
          <a href="#meetings">Meetings</a>
          <a href="#news">News</a>
          <a href="#freemasonry">Freemasonry</a>
          <a href="#visiting">Visiting</a>
          <a href="/login?redirect=/member-area">Members</a>
          <a href="#contact" class="nav-cta">Contact</a>
        </nav>
      </div>
    </header>

    <section class="hero" id="top">
      <div class="hero-pattern"></div>
      <div class="hero-compass">✦</div>
      <div class="hero-content">
        <div class="hero-badge">United Grand Lodge Tradition</div>
        <h1>${escapeHtml(website.heroTitle).replace(/Lodge/i, '<em>Lodge</em>')}</h1>
        <p class="hero-sub">${escapeHtml(website.heroSubtitle)}</p>
        <div class="hero-divider"></div>
        <div class="hero-btns">
          <a class="btn-primary" href="#contact">Arrange a Visit</a>
          <a class="btn-outline" href="#meetings">Upcoming Meetings</a>
          <a class="btn-outline" href="/login?redirect=/member-area">Members Area</a>
        </div>
      </div>
    </section>

    <section class="bg-white" id="about">
      <div class="section-inner">
        <div class="section-label">At a glance</div>
        <div class="gold-rule"></div>
        <h2 class="section-heading">${escapeHtml(website.welcomeTitle)}</h2>
        <p class="section-sub">${escapeHtml(website.welcomeBody)}</p>
        <div class="glance-grid">
          <div class="glance-item">
            <div class="glance-icon">◇</div>
            <div class="glance-label">Meeting pattern</div>
            <div class="glance-val">${escapeHtml(formatMeetingPattern(lodge))}</div>
          </div>
          <div class="glance-item">
            <div class="glance-icon">⌂</div>
            <div class="glance-label">Venue</div>
            <div class="glance-val">${escapeHtml(formatVenue(lodge))}</div>
          </div>
          <div class="glance-item">
            <div class="glance-icon">✦</div>
            <div class="glance-label">Festive board</div>
            <div class="glance-val">${escapeHtml(formatDining(lodge))}</div>
          </div>
          <div class="glance-item">
            <div class="glance-icon">✉</div>
            <div class="glance-label">Enquiries</div>
            <div class="glance-val">${escapeHtml(website.contactEmail || website.contactPhone || 'Please contact the lodge')}</div>
          </div>
        </div>
      </div>
    </section>

    <section class="bg-cream">
      <div class="section-inner">
        <div class="master-wrap">
          <aside class="master-portrait">
            <div class="portrait-placeholder${lodge.crestUrl ? ' has-image' : ''}">${crestMarkup}</div>
            <div class="master-caption">A lodge of welcome, fellowship, and careful ritual.</div>
          </aside>
          <div>
            <div class="section-label">Welcome</div>
            <div class="gold-rule"></div>
            <h2 class="section-heading">${escapeHtml(lodge.name)} No. ${escapeHtml(lodge.number)}</h2>
            <p class="section-sub">${escapeHtml(website.visitingBody)}</p>
            <div class="pull-quote">
              <p>"We aim to combine dignity in ceremony with warmth in fellowship, making every meeting both purposeful and memorable."</p>
              <cite>${escapeHtml(lodge.name)} website preview</cite>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="bg-off" id="meetings">
      <div class="section-inner">
        <div class="section-label">Upcoming meetings</div>
        <div class="gold-rule"></div>
        <h2 class="section-heading">Dates for your diary</h2>
        <p class="section-sub">The lodge meets in regular season with ceremony, business, and a festive board after the meeting.</p>
        <div class="event-list">
          ${buildMeetingsMarkup(lodge, visibleMeetings)}
        </div>
      </div>
    </section>

    <section class="bg-white" id="news">
      <div class="section-inner">
        <div class="section-label">News and events</div>
        <div class="gold-rule"></div>
        <h2 class="section-heading">Life in and around the lodge</h2>
        <p class="section-sub">A good lodge website should feel active and local. Alongside our meetings, we place value on fellowship, visitors, and keeping brethren informed about what lies ahead.</p>
        <div class="card-grid">
          ${buildNewsMarkup(lodge, visibleMeetings)}
        </div>
      </div>
    </section>

    <section class="bg-white" id="members">
      <div class="section-inner">
        <div class="section-label">Members area</div>
        <div class="gold-rule"></div>
        <h2 class="section-heading">Calendar, meetings, and dining RSVP</h2>
        <p class="section-sub">Brethren can sign in to the lodge members area to view upcoming events, open meeting details, and send dining replies in advance of the festive board.</p>
        <div class="card-grid">
          <article class="card">
            <div class="card-icon">📅</div>
            <h3>Upcoming calendar</h3>
            <p>See the next meetings and key lodge dates in one focused calendar-style view.</p>
          </article>
          <article class="card">
            <div class="card-icon">✦</div>
            <h3>Meeting details</h3>
            <p>Open the next ceremony or regular meeting directly from the member hub.</p>
          </article>
          <article class="card">
            <div class="card-icon">🍽</div>
            <h3>Dining RSVP</h3>
            <p>Confirm if you are dining, note guest numbers, and keep the festive board organised.</p>
          </article>
        </div>
        <div style="margin-top: 2rem;">
          <a class="btn-primary" href="/login?redirect=/member-area">Open Members Area</a>
        </div>
      </div>
    </section>

    <section class="bg-off" id="charity">
      <div class="section-inner">
        <div class="section-label">Charity and community</div>
        <div class="gold-rule"></div>
        <h2 class="section-heading">Freemasonry expressed in service</h2>
        <p class="section-sub">Our meetings are important, but they are not the whole story. The spirit of the lodge is also seen in practical support, local goodwill, and looking after one another well.</p>
        <div class="split-grid">
          <div class="feature-panel">
            <p class="serif-body">The charitable side of lodge life often happens quietly: supporting local causes, helping brethren and families, and contributing to wider Masonic appeals when there is a need.</p>
            <p>For many members, this balance of ceremony, fellowship, and useful service is one of the reasons lodge life remains so meaningful over time.</p>
          </div>
          <div class="feature-panel">
            <div class="eyebrow">Community focus</div>
            <ul class="feature-list">
              <li>Support for local charitable causes and appeals</li>
              <li>Care for brethren, widows, and families when needed</li>
              <li>Hospitality for visitors and encouragement for new members</li>
            </ul>
          </div>
        </div>
      </div>
    </section>

    <section class="bg-white" id="freemasonry">
      <div class="section-inner">
        <div class="section-label">What is Freemasonry?</div>
        <div class="gold-rule"></div>
        <h2 class="section-heading">A tradition of character, learning, and fellowship</h2>
        <p class="section-sub">Freemasonry brings people together in a structured tradition that encourages integrity, self-improvement, friendship, and charitable purpose. It is lived through regular meetings, shared standards, and support for one another.</p>
        <div class="timeline">
          <div class="timeline-item">
            <div class="timeline-label">Principles</div>
            <div class="timeline-copy">
              <h3>Character and responsibility</h3>
              <p>Members are encouraged to act with honesty, kindness, restraint, and care for others in both private and public life.</p>
            </div>
          </div>
          <div class="timeline-item">
            <div class="timeline-label">Meetings</div>
            <div class="timeline-copy">
              <h3>Ceremony with meaning</h3>
              <p>The ceremonial side of the craft gives structure and continuity to the lodge, while also teaching through shared experience and reflection.</p>
            </div>
          </div>
          <div class="timeline-item">
            <div class="timeline-label">Fellowship</div>
            <div class="timeline-copy">
              <h3>Friendship across generations</h3>
              <p>Lodge life creates a place where men of different ages and backgrounds can meet in goodwill, eat together, and build lasting regard.</p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="bg-white" id="visiting">
      <div class="section-inner">
        <div class="section-label">Visiting and joining</div>
        <div class="gold-rule"></div>
        <h2 class="section-heading">${escapeHtml(website.visitingTitle)}</h2>
        <p class="section-sub">${escapeHtml(website.visitingBody)}</p>
        <div class="card-grid">
          <article class="card">
            <div class="card-icon">1</div>
            <h3>Make contact</h3>
            <p>Send a short note introducing yourself and your interest in visiting or learning more about the lodge.</p>
          </article>
          <article class="card">
            <div class="card-icon">2</div>
            <h3>Meet the brethren</h3>
            <p>We can arrange an informal conversation so you can understand the lodge, the venue, and the spirit of our meetings.</p>
          </article>
          <article class="card">
            <div class="card-icon">3</div>
            <h3>Join us in due course</h3>
            <p>If it feels right for both sides, we will guide you carefully through the next steps toward a visit or membership enquiry.</p>
          </article>
        </div>
      </div>
    </section>

    <section class="bg-off" id="faq">
      <div class="section-inner">
        <div class="section-label">Questions</div>
        <div class="gold-rule"></div>
        <h2 class="section-heading">Frequently asked questions</h2>
        <p class="section-sub">A few practical answers for prospective members, visitors, and brethren planning their next meeting with us.</p>
        <div class="card-grid">
          ${buildFaqMarkup()}
        </div>
      </div>
    </section>

    <section class="bg-navy">
      <div class="section-inner">
        <div class="section-label">The evening</div>
        <div class="gold-rule"></div>
        <h2 class="section-heading">Ritual, fellowship, and the festive board</h2>
        <p class="section-sub">A typical meeting brings together formal ceremony, lodge business, conversation with visiting brethren, and dining afterwards.</p>
        <div class="steps">
          <div class="step">
            <div class="step-num">1</div>
            <div class="step-content">
              <h4>Gather and open the lodge</h4>
              <p>Brethren meet at the hall, prepare for the evening, and open the lodge with dignity and order.</p>
            </div>
          </div>
          <div class="step">
            <div class="step-num">2</div>
            <div class="step-content">
              <h4>Conduct ceremony and business</h4>
              <p>The evening’s work may include degree ceremony, ballots, notices, and the regular business of the lodge.</p>
            </div>
          </div>
          <div class="step">
            <div class="step-num">3</div>
            <div class="step-content">
              <h4>Retire to dining</h4>
              <p>After the meeting, brethren and guests continue the evening together at the festive board.</p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="bg-white" id="contact">
      <div class="section-inner">
        <div class="section-label">Contact</div>
        <div class="gold-rule"></div>
        <h2 class="section-heading">Get in touch with the lodge</h2>
        <p class="section-sub">If you would like to arrange a visit, enquire about membership, or ask about an upcoming meeting, we would be pleased to hear from you.</p>
        <div class="contact-grid">
          <div class="contact-panel">
            <h3>Start the conversation</h3>
            <p class="serif-body">We welcome sincere enquiries from prospective members, visitors, and brethren from other lodges.</p>
            <div class="contact-links">
              ${website.contactEmail ? `<a class="contact-link" href="mailto:${escapeHtml(website.contactEmail)}">✉ ${escapeHtml(website.contactEmail)}</a>` : ''}
              ${website.contactPhone || lodge.tylerPhone ? `<a class="contact-link" href="tel:${escapeHtml(website.contactPhone || lodge.tylerPhone || '')}">☎ ${escapeHtml(website.contactPhone || lodge.tylerPhone || '')}</a>` : ''}
            </div>
          </div>
          <aside class="contact-aside">
            <h3>Lodge details</h3>
            <div class="contact-detail">
              <div class="icon">⌂</div>
              <div>
                <strong>Venue</strong>
                <p>${escapeHtml(formatVenue(lodge))}</p>
              </div>
            </div>
            <div class="contact-detail">
              <div class="icon">◇</div>
              <div>
                <strong>Meeting pattern</strong>
                <p>${escapeHtml(formatMeetingPattern(lodge))}</p>
              </div>
            </div>
            <div class="contact-detail">
              <div class="icon">✦</div>
              <div>
                <strong>Dining</strong>
                <p>${escapeHtml(formatDining(lodge))}</p>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </section>

    <section class="cta-band">
      <h2>Interested in visiting ${escapeHtml(lodge.name)}?</h2>
      <p>Use the contact details above and we will be glad to help you learn more about the lodge and its meetings.</p>
      <a class="btn-primary" href="#contact">Contact the Lodge</a>
    </section>

    <footer>
      <div class="footer-inner">
        <div class="footer-grid">
          <div class="footer-brand">
            <h4>${escapeHtml(lodge.name)} No. ${escapeHtml(lodge.number)}</h4>
            <p>A lodge website generated from LodgeKey for local enquiries, visiting brethren, and upcoming meeting information.</p>
          </div>
          <div class="footer-col">
            <h4>Navigate</h4>
            <ul>
              <li><a href="#about">About</a></li>
              <li><a href="#meetings">Meetings</a></li>
              <li><a href="#news">News</a></li>
              <li><a href="#freemasonry">Freemasonry</a></li>
              <li><a href="#visiting">Visiting</a></li>
              <li><a href="/login?redirect=/member-area">Members</a></li>
              <li><a href="#contact">Contact</a></li>
            </ul>
          </div>
          <div class="footer-col">
            <h4>Details</h4>
            <ul>
              <li><a href="#contact">${escapeHtml(lodge.venue || 'Lodge venue')}</a></li>
              <li><a href="#meetings">${escapeHtml(lodge.meetingDay || 'Meeting dates')}</a></li>
              <li><a href="#contact">${escapeHtml(website.contactEmail || website.contactPhone || 'Enquiries')}</a></li>
            </ul>
          </div>
        </div>
        <div class="footer-bottom">
          <p><span class="footer-gold">${escapeHtml(lodge.name)} No. ${escapeHtml(lodge.number)}</span></p>
          <p class="ugle-note">Website preview generated by LodgeKey</p>
        </div>
      </div>
    </footer>
  </div>
</body>
</html>`;
}

export function LodgeWebsiteView({
  lodge,
  website,
  meetings,
}: {
  lodge: LodgeWebsiteLodge;
  website: WebsiteConfig;
  meetings: LodgeWebsiteMeeting[];
}) {
  const visibleMeetings = website.showMeetings ? meetings.slice(0, 4) : [];

  return (
    <div className="lk-public">
      <style>{siteStyles}</style>

      <header className="site-header">
        <div className="header-inner">
          <a className="logo-block" href="#top">
            <div className="logo-emblem">
              {lodge.crestUrl ? (
                <img src={lodge.crestUrl} alt={`${lodge.name} crest`} />
              ) : (
                lodgeInitials(lodge)
              )}
            </div>
            <div>
              <div className="logo-name">
                {lodge.name} No. {lodge.number}
              </div>
              <div className="logo-sub">Middlesbrough Freemasons</div>
            </div>
          </a>

          <nav>
            <a href="#about">About</a>
            <a href="#meetings">Meetings</a>
            <a href="#news">News</a>
            <a href="#freemasonry">Freemasonry</a>
            <a href="#visiting">Visiting</a>
            <a href="/login?redirect=/member-area">Members</a>
            <a href="#contact" className="nav-cta">
              Contact
            </a>
          </nav>
        </div>
      </header>

      <section className="hero" id="top">
        <div className="hero-pattern" />
        <div className="hero-compass">✦</div>
        <div className="hero-content">
          <div className="hero-badge">United Grand Lodge Tradition</div>
          <h1>
            {website.heroTitle.includes('Lodge') ? (
              <>
                {website.heroTitle.split('Lodge')[0]}
                <em>Lodge</em>
                {website.heroTitle.split('Lodge').slice(1).join('Lodge')}
              </>
            ) : (
              website.heroTitle
            )}
          </h1>
          <p className="hero-sub">{website.heroSubtitle}</p>
          <div className="hero-divider" />
          <div className="hero-btns">
            <a className="btn-primary" href="#contact">
              Arrange a Visit
            </a>
            <a className="btn-outline" href="#meetings">
              Upcoming Meetings
            </a>
            <a className="btn-outline" href="/login?redirect=/member-area">
              Members Area
            </a>
          </div>
        </div>
      </section>

      <section className="bg-white" id="about">
        <div className="section-inner">
          <div className="section-label">At a glance</div>
          <div className="gold-rule" />
          <h2 className="section-heading">{website.welcomeTitle}</h2>
          <p className="section-sub">{website.welcomeBody}</p>

          <div className="glance-grid">
            <div className="glance-item">
              <div className="glance-icon">◇</div>
              <div className="glance-label">Meeting pattern</div>
              <div className="glance-val">{formatMeetingPattern(lodge)}</div>
            </div>
            <div className="glance-item">
              <div className="glance-icon">⌂</div>
              <div className="glance-label">Venue</div>
              <div className="glance-val">{formatVenue(lodge)}</div>
            </div>
            <div className="glance-item">
              <div className="glance-icon">✦</div>
              <div className="glance-label">Festive board</div>
              <div className="glance-val">{formatDining(lodge)}</div>
            </div>
            <div className="glance-item">
              <div className="glance-icon">✉</div>
              <div className="glance-label">Enquiries</div>
              <div className="glance-val">
                {website.contactEmail || website.contactPhone || 'Please contact the lodge'}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-cream">
        <div className="section-inner">
          <div className="master-wrap">
            <aside className="master-portrait">
              <div className={`portrait-placeholder${lodge.crestUrl ? ' has-image' : ''}`}>
                {lodge.crestUrl ? (
                  <img src={lodge.crestUrl} alt={`${lodge.name} crest`} />
                ) : (
                  lodgeInitials(lodge)
                )}
              </div>
              <div className="master-caption">
                A lodge of welcome, fellowship, and careful ritual.
              </div>
            </aside>

            <div>
              <div className="section-label">Welcome</div>
              <div className="gold-rule" />
              <h2 className="section-heading">
                {lodge.name} No. {lodge.number}
              </h2>
              <p className="section-sub">{website.visitingBody}</p>
              <div className="pull-quote">
                <p>
                  "We aim to combine dignity in ceremony with warmth in fellowship, making every
                  meeting both purposeful and memorable."
                </p>
                <cite>{lodge.name} website preview</cite>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-off" id="meetings">
        <div className="section-inner">
          <div className="section-label">Upcoming meetings</div>
          <div className="gold-rule" />
          <h2 className="section-heading">Dates for your diary</h2>
          <p className="section-sub">
            The lodge meets in regular season with ceremony, business, and a festive board after
            the meeting.
          </p>

          <div className="event-list">
            {visibleMeetings.length > 0 ? (
              visibleMeetings.map((meeting) => {
                const parts = meetingDateParts(meeting.date);
                return (
                  <article key={meeting.id} className="event-item">
                    <div className="event-date">
                      <span className="event-month">{parts.month}</span>
                      <span className="event-day">{parts.day}</span>
                    </div>
                    <div className="event-details">
                      <h4>{meeting.ceremonyType || meetingTypeLabel(meeting.type)}</h4>
                      <p>{formatDate(meeting.date)}</p>
                      <p>{formatMeetingMeta(lodge, meeting) || 'Please enquire for time and venue'}</p>
                    </div>
                    <span className="event-badge badge-open">{meetingTypeLabel(meeting.type)}</span>
                  </article>
                );
              })
            ) : (
              <article className="event-item">
                <div className="event-details">
                  <h4>Upcoming meetings available on request</h4>
                  <p>Please contact the lodge for the next date and dining details.</p>
                </div>
                <span className="event-badge badge-open">Enquire</span>
              </article>
            )}
          </div>
        </div>
      </section>

      <section className="bg-white" id="news">
        <div className="section-inner">
          <div className="section-label">News and events</div>
          <div className="gold-rule" />
          <h2 className="section-heading">Life in and around the lodge</h2>
          <p className="section-sub">
            A good lodge website should feel active and local. Alongside our meetings, we place
            value on fellowship, visitors, and keeping brethren informed about what lies ahead.
          </p>
          <div
            className="card-grid"
            dangerouslySetInnerHTML={{ __html: buildNewsMarkup(lodge, visibleMeetings) }}
          />
        </div>
      </section>

      <section className="bg-white" id="members">
        <div className="section-inner">
          <div className="section-label">Members area</div>
          <div className="gold-rule" />
          <h2 className="section-heading">Calendar, meetings, and dining RSVP</h2>
          <p className="section-sub">
            Brethren can sign in to the lodge members area to view upcoming events, open meeting
            details, and send dining replies in advance of the festive board.
          </p>
          <div className="card-grid">
            <article className="card">
              <div className="card-icon">📅</div>
              <h3>Upcoming calendar</h3>
              <p>See the next meetings and key lodge dates in one focused calendar-style view.</p>
            </article>
            <article className="card">
              <div className="card-icon">✦</div>
              <h3>Meeting details</h3>
              <p>Open the next ceremony or regular meeting directly from the member hub.</p>
            </article>
            <article className="card">
              <div className="card-icon">🍽</div>
              <h3>Dining RSVP</h3>
              <p>
                Confirm if you are dining, note guest numbers, and keep the festive board
                organised.
              </p>
            </article>
          </div>
          <div className="mt-8">
            <a className="btn-primary" href="/login?redirect=/member-area">
              Open Members Area
            </a>
          </div>
        </div>
      </section>

      <section className="bg-off" id="charity">
        <div className="section-inner">
          <div className="section-label">Charity and community</div>
          <div className="gold-rule" />
          <h2 className="section-heading">Freemasonry expressed in service</h2>
          <p className="section-sub">
            Our meetings are important, but they are not the whole story. The spirit of the lodge
            is also seen in practical support, local goodwill, and looking after one another well.
          </p>
          <div className="split-grid">
            <div className="feature-panel">
              <p className="serif-body">
                The charitable side of lodge life often happens quietly: supporting local causes,
                helping brethren and families, and contributing to wider Masonic appeals when there
                is a need.
              </p>
              <p>
                For many members, this balance of ceremony, fellowship, and useful service is one
                of the reasons lodge life remains so meaningful over time.
              </p>
            </div>
            <div className="feature-panel">
              <div className="eyebrow">Community focus</div>
              <ul className="feature-list">
                <li>Support for local charitable causes and appeals</li>
                <li>Care for brethren, widows, and families when needed</li>
                <li>Hospitality for visitors and encouragement for new members</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white" id="freemasonry">
        <div className="section-inner">
          <div className="section-label">What is Freemasonry?</div>
          <div className="gold-rule" />
          <h2 className="section-heading">A tradition of character, learning, and fellowship</h2>
          <p className="section-sub">
            Freemasonry brings people together in a structured tradition that encourages integrity,
            self-improvement, friendship, and charitable purpose. It is lived through regular
            meetings, shared standards, and support for one another.
          </p>
          <div className="timeline">
            <div className="timeline-item">
              <div className="timeline-label">Principles</div>
              <div className="timeline-copy">
                <h3>Character and responsibility</h3>
                <p>
                  Members are encouraged to act with honesty, kindness, restraint, and care for
                  others in both private and public life.
                </p>
              </div>
            </div>
            <div className="timeline-item">
              <div className="timeline-label">Meetings</div>
              <div className="timeline-copy">
                <h3>Ceremony with meaning</h3>
                <p>
                  The ceremonial side of the craft gives structure and continuity to the lodge,
                  while also teaching through shared experience and reflection.
                </p>
              </div>
            </div>
            <div className="timeline-item">
              <div className="timeline-label">Fellowship</div>
              <div className="timeline-copy">
                <h3>Friendship across generations</h3>
                <p>
                  Lodge life creates a place where men of different ages and backgrounds can meet
                  in goodwill, eat together, and build lasting regard.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white" id="visiting">
        <div className="section-inner">
          <div className="section-label">Visiting and joining</div>
          <div className="gold-rule" />
          <h2 className="section-heading">{website.visitingTitle}</h2>
          <p className="section-sub">{website.visitingBody}</p>

          <div className="card-grid">
            <article className="card">
              <div className="card-icon">1</div>
              <h3>Make contact</h3>
              <p>
                Send a short note introducing yourself and your interest in visiting or learning
                more about the lodge.
              </p>
            </article>
            <article className="card">
              <div className="card-icon">2</div>
              <h3>Meet the brethren</h3>
              <p>
                We can arrange an informal conversation so you can understand the lodge, the venue,
                and the spirit of our meetings.
              </p>
            </article>
            <article className="card">
              <div className="card-icon">3</div>
              <h3>Join us in due course</h3>
              <p>
                If it feels right for both sides, we will guide you carefully through the next
                steps toward a visit or membership enquiry.
              </p>
            </article>
          </div>
        </div>
      </section>

      <section className="bg-off" id="faq">
        <div className="section-inner">
          <div className="section-label">Questions</div>
          <div className="gold-rule" />
          <h2 className="section-heading">Frequently asked questions</h2>
          <p className="section-sub">
            A few practical answers for prospective members, visitors, and brethren planning their
            next meeting with us.
          </p>
          <div
            className="card-grid"
            dangerouslySetInnerHTML={{ __html: buildFaqMarkup() }}
          />
        </div>
      </section>

      <section className="bg-navy">
        <div className="section-inner">
          <div className="section-label">The evening</div>
          <div className="gold-rule" />
          <h2 className="section-heading">Ritual, fellowship, and the festive board</h2>
          <p className="section-sub">
            A typical meeting brings together formal ceremony, lodge business, conversation with
            visiting brethren, and dining afterwards.
          </p>

          <div className="steps">
            <div className="step">
              <div className="step-num">1</div>
              <div className="step-content">
                <h4>Gather and open the lodge</h4>
                <p>Brethren meet at the hall, prepare for the evening, and open the lodge with dignity and order.</p>
              </div>
            </div>
            <div className="step">
              <div className="step-num">2</div>
              <div className="step-content">
                <h4>Conduct ceremony and business</h4>
                <p>The evening’s work may include degree ceremony, ballots, notices, and the regular business of the lodge.</p>
              </div>
            </div>
            <div className="step">
              <div className="step-num">3</div>
              <div className="step-content">
                <h4>Retire to dining</h4>
                <p>After the meeting, brethren and guests continue the evening together at the festive board.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white" id="contact">
        <div className="section-inner">
          <div className="section-label">Contact</div>
          <div className="gold-rule" />
          <h2 className="section-heading">Get in touch with the lodge</h2>
          <p className="section-sub">
            If you would like to arrange a visit, enquire about membership, or ask about an
            upcoming meeting, we would be pleased to hear from you.
          </p>

          <div className="contact-grid">
            <div className="contact-panel">
              <h3>Start the conversation</h3>
              <p className="serif-body">
                We welcome sincere enquiries from prospective members, visitors, and brethren from
                other lodges.
              </p>

              <div className="contact-links">
                {website.contactEmail ? (
                  <a className="contact-link" href={`mailto:${website.contactEmail}`}>
                    ✉ {website.contactEmail}
                  </a>
                ) : null}
                {website.contactPhone || lodge.tylerPhone ? (
                  <a className="contact-link" href={`tel:${website.contactPhone || lodge.tylerPhone || ''}`}>
                    ☎ {website.contactPhone || lodge.tylerPhone}
                  </a>
                ) : null}
              </div>
            </div>

            <aside className="contact-aside">
              <h3>Lodge details</h3>
              <div className="contact-detail">
                <div className="icon">⌂</div>
                <div>
                  <strong>Venue</strong>
                  <p>{formatVenue(lodge)}</p>
                </div>
              </div>
              <div className="contact-detail">
                <div className="icon">◇</div>
                <div>
                  <strong>Meeting pattern</strong>
                  <p>{formatMeetingPattern(lodge)}</p>
                </div>
              </div>
              <div className="contact-detail">
                <div className="icon">✦</div>
                <div>
                  <strong>Dining</strong>
                  <p>{formatDining(lodge)}</p>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </section>

      <section className="cta-band">
        <h2>Interested in visiting {lodge.name}?</h2>
        <p>
          Use the contact details above and we will be glad to help you learn more about the lodge
          and its meetings.
        </p>
        <a className="btn-primary" href="#contact">
          Contact the Lodge
        </a>
      </section>

      <footer>
        <div className="footer-inner">
          <div className="footer-grid">
            <div className="footer-brand">
              <h4>
                {lodge.name} No. {lodge.number}
              </h4>
              <p>
                A lodge website generated from LodgeKey for local enquiries, visiting brethren, and
                upcoming meeting information.
              </p>
            </div>
            <div className="footer-col">
              <h4>Navigate</h4>
              <ul>
              <li><a href="#about">About</a></li>
              <li><a href="#meetings">Meetings</a></li>
              <li><a href="#news">News</a></li>
              <li><a href="#freemasonry">Freemasonry</a></li>
              <li><a href="#visiting">Visiting</a></li>
              <li><a href="/login?redirect=/member-area">Members</a></li>
              <li><a href="#contact">Contact</a></li>
            </ul>
            </div>
            <div className="footer-col">
              <h4>Details</h4>
              <ul>
                <li><a href="#contact">{lodge.venue || 'Lodge venue'}</a></li>
                <li><a href="#meetings">{lodge.meetingDay || 'Meeting dates'}</a></li>
                <li><a href="#contact">{website.contactEmail || website.contactPhone || 'Enquiries'}</a></li>
              </ul>
            </div>
          </div>
          <div className="footer-bottom">
            <p>
              <span className="footer-gold">
                {lodge.name} No. {lodge.number}
              </span>
            </p>
            <p className="ugle-note">Website preview generated by LodgeKey</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
