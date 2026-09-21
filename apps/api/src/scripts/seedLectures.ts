/**
 * Seed the lecture library from a season manifest.
 *
 *   SEASON_DIR=~/Projects/vulcan-lectures pnpm tsx src/scripts/seedLectures.ts
 *
 * Papers are loaded as platform library entries (lodgeId null), so every lodge
 * on the platform sees them and any Director of Ceremonies can copy one into
 * his own library to edit. Re-running updates in place — the unique key is
 * (lodgeId, slug).
 */
import { PrismaClient } from '@prisma/client';
import { readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { homedir } from 'node:os';

const prisma = new PrismaClient();

const CATEGORY: Record<string, string> = {
  Lore: 'LORE',
  Ritual: 'RITUAL',
  Symbolism: 'SYMBOLISM',
  Responsibilities: 'RESPONSIBILITIES',
  History: 'HISTORY',
};

function expand(p: string) {
  return p.startsWith('~') ? join(homedir(), p.slice(1)) : resolve(p);
}

/** Pull the section spine out of a script: "### 4:00 — Part Two: the word". */
function parseSpine(md: string) {
  const out: { time: string; heading: string }[] = [];
  const re = /^###\s*([\d:]+)\s*—\s*(.+)$/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(md))) out.push({ time: m[1], heading: m[2].trim() });
  return out;
}

async function main() {
  const dir = expand(process.env.SEASON_DIR || '~/Projects/vulcan-lectures');
  const manifestPath = join(dir, 'season.json');
  if (!existsSync(manifestPath)) {
    throw new Error(`No season.json at ${manifestPath}. Set SEASON_DIR.`);
  }

  const season = JSON.parse(readFileSync(manifestPath, 'utf8'));
  console.log(`\nSeeding "${season.series}" — ${season.lectures.length} papers\n`);

  let created = 0;
  let updated = 0;

  for (const lec of season.lectures) {
    const scriptPath = join(dir, 'scripts', `${String(lec.no).padStart(2, '0')}-${lec.id}.md`);
    const scriptMd = existsSync(scriptPath) ? readFileSync(scriptPath, 'utf8') : null;
    const spine = scriptMd ? parseSpine(scriptMd) : [];

    const sources = scriptMd
      ? (scriptMd.match(/##\s*Sources\s*\n([\s\S]*?)(?=\n##\s|$)/)?.[1] ?? '')
          .split('\n')
          .filter((l) => l.trim().startsWith('-'))
          .map((l) => l.trim().slice(1).trim().replace(/\*\*?(.+?)\*\*?/g, '$1'))
      : [];

    const data = {
      slug: lec.id,
      number: lec.no,
      series: season.series,
      title: lec.title,
      subtitle: lec.subtitle ?? null,
      category: (CATEGORY[lec.category] ?? 'LORE') as never,
      minutes: lec.minutes,
      summary: lec.summary,
      object: lec.object ?? null,
      takeaways: (lec.takeaways ?? []) as never,
      spine: spine as never,
      sources: sources as never,
      scriptMd,
      handoutUrl: `/handouts/${String(lec.no).padStart(2, '0')}-${lec.id}.pdf`,
      notes: season.note ?? null,
    };

    const existing = await prisma.lecture.findFirst({
      where: { lodgeId: null, slug: lec.id },
    });

    if (existing) {
      await prisma.lecture.update({ where: { id: existing.id }, data });
      updated++;
      console.log(`  ~ ${String(lec.no).padStart(2, '0')}  ${lec.title}`);
    } else {
      await prisma.lecture.create({ data: { ...data, lodgeId: null } });
      created++;
      console.log(`  + ${String(lec.no).padStart(2, '0')}  ${lec.title}`);
    }
  }

  console.log(`\n${created} created, ${updated} updated.\n`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
