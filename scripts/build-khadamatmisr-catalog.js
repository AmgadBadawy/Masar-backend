'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const { validateCatalog, isOfficialSourceUrl } = require('./lib/service-data-validation');

const BASE_URL = 'https://www.khadamatmisr.gov.eg';
const LIST_URL = `${BASE_URL}/serviceslist`;
const VERIFIED_AT = new Date().toISOString().slice(0, 10);
const REQUEST_DELAY_MS = 350;
const MAX_RETRIES = 2;

const CATEGORY_SLUGS = new Map([
  ['الشهر العقاري و التوثيق', 'real-estate-notarization'],
  ['الأحوال المدنية', 'civil-status'],
  ['الأدلة الجنائية', 'criminal-evidence'],
  ['النيابة العامة المصرية', 'public-prosecution'],
  ['الإدارة العامة للجوازات والهجرة والجنسية', 'passports-immigration-nationality'],
  ['الإدارة العامة للمرور', 'traffic'],
  ['وزارة التضامن الاجتماعي', 'social-solidarity'],
  ['التأمينات الاجتماعية', 'social-insurance'],
  ['الدفع الإلكتروني', 'electronic-payments'],
]);

function pause(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function decodeEntities(value) {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&[rl]rm;/gi, '');
}

function textFromHtml(value) {
  return decodeEntities(
    value
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>|<\/li>|<\/h[1-6]>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\u00a0/g, ' '),
  )
    .replace(/[•◦]/g, '\n')
    .replace(/[\t\r ]+/g, ' ')
    .replace(/\n\s*/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n');
}

function normalizeText(value) {
  return textFromHtml(value).replace(/\s+/g, ' ').trim();
}

function extractCategoryTabs(html) {
  const tabs = new Map();
  const pattern = /<button\b(?=[^>]*data-bs-target="#([^"]+)")[^>]*>([\s\S]*?)<\/button>/gi;

  for (const match of html.matchAll(pattern)) {
    const panelId = match[1];
    const categoryName = normalizeText(match[2]);
    if (CATEGORY_SLUGS.has(categoryName)) {
      tabs.set(panelId, categoryName);
    }
  }

  return tabs;
}

function extractPanels(html) {
  const markers = [...html.matchAll(/id="([^"]+)"\s+role="tabpanel"/gi)];
  const panels = new Map();

  markers.forEach((marker, index) => {
    const start = marker.index;
    const end = markers[index + 1]?.index ?? html.length;
    panels.set(marker[1], html.slice(start, end));
  });

  return panels;
}

function extractServiceLinks(panelHtml) {
  const services = [];
  const itemPattern = /<div\b[^>]*class="[^"]*\bserviceItem\b[^"]*"[^>]*>([\s\S]*?)<\/div>/gi;

  for (const item of panelHtml.matchAll(itemPattern)) {
    const titleMatch = item[1].match(/<h6\b[^>]*>([\s\S]*?)<\/h6>/i);
    const hrefMatch = item[1].match(/href="(\/node\/\d+)"/i);
    const title = titleMatch ? normalizeText(titleMatch[1]) : '';

    if (title && hrefMatch) {
      services.push({ title, sourceUrl: new URL(hrefMatch[1], BASE_URL).toString() });
    }
  }

  return services;
}

function extractPageTitle(html) {
  const title = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '';
  return normalizeText(title).replace(/\s*\|\s*مركز خدمات مصر\s*$/, '').trim();
}

function extractDocuments(html) {
  const documentsPane = html.match(
    /<div\b[^>]*\bid="v-pills-profile"[^>]*>([\s\S]*?)<\/div>\s*<!--\s*tab2\s*-->/i,
  )?.[1];
  if (!documentsPane) return [];

  const heading = documentsPane.match(/<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/i)?.[1];
  if (normalizeText(heading ?? '') !== 'المستندات المطلوبة') return [];

  const documentLines = textFromHtml(documentsPane)
    .split('\n')
    .map((name) => name.replace(/^[-–—]\s*/, '').trim())
    .filter((name) => name && name !== 'المستندات المطلوبة');

  return documentLines
    .map((name) => ({ name }));
}

async function fetchOfficial(url) {
  let lastError;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { Accept: 'text/html,application/xhtml+xml' },
        signal: AbortSignal.timeout(20000),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return await response.text();
    } catch (error) {
      lastError = error;
      if (attempt < MAX_RETRIES) await pause(800 * (attempt + 1));
    }
  }

  throw lastError;
}

function toSlug(categoryName) {
  const slug = CATEGORY_SLUGS.get(categoryName);
  if (!slug) throw new Error(`Unsupported official category "${categoryName}".`);
  return slug;
}

function toServiceRecord({ title, sourceUrl, category }) {
  return {
    title,
    sourceUrl,
    category,
    categorySlug: toSlug(category),
  };
}

function createSlug(sourceUrl) {
  const nodeId = new URL(sourceUrl).pathname.match(/\/node\/(\d+)/)?.[1];
  if (!nodeId) throw new Error(`Could not derive stable identity from ${sourceUrl}.`);
  return `khadamat-misr-${nodeId}`;
}

function normalizeLegacyNeedsReview(record) {
  const missingRequiredFields = record?.missingRequiredFields;
  const onlyPreviouslyRequiredOptionalFields =
    Array.isArray(missingRequiredFields)
    && missingRequiredFields.length === 2
    && missingRequiredFields.includes('summary')
    && missingRequiredFields.includes('authority');

  if (
    !onlyPreviouslyRequiredOptionalFields
    || !record
    || !isOfficialSourceUrl(record.sourceUrl)
    || !CATEGORY_SLUGS.has(record.category)
    || !Array.isArray(record.extractedDocuments)
  ) {
    return undefined;
  }

  return {
    title: record.title,
    slug: createSlug(record.sourceUrl),
    category: toSlug(record.category),
    documents: record.extractedDocuments,
    steps: [],
    verification: {
      verifiedAt: record.verifiedAt,
      sourceTitle: `مركز خدمات مصر — ${record.title}`,
      sourceUrl: record.sourceUrl,
    },
  };
}

function readNumericOption(name, fallback) {
  const value = process.argv.find((argument) => argument.startsWith(`--${name}=`));
  if (!value) return fallback;

  const parsed = Number.parseInt(value.slice(name.length + 3), 10);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`--${name} must be a non-negative integer.`);
  }

  return parsed;
}

async function assembleCatalogue(appDir, discoveredCount) {
  const batchDirectory = path.join(appDir, 'data', 'research', 'khadamatmisr-batches');
  const batchFiles = (await fs.readdir(batchDirectory))
    .filter((file) => file.endsWith('.validated.json'))
    .sort((left, right) => Number.parseInt(left, 10) - Number.parseInt(right, 10));
  const batches = await Promise.all(
    batchFiles.map(async (file) => JSON.parse(await fs.readFile(path.join(batchDirectory, file), 'utf8'))),
  );
  const coveredIndexes = new Set();
  for (const batch of batches) {
    const recordCount = batch.verified.length + batch.needsReview.length;
    if (batch.discovered !== discoveredCount || batch.recordCount !== recordCount) {
      throw new Error(`Invalid batch metadata at start index ${batch.startIndex}.`);
    }

    for (let index = batch.startIndex; index < batch.startIndex + recordCount; index += 1) {
      if (coveredIndexes.has(index)) {
        throw new Error(`Overlapping batch coverage at catalog index ${index}.`);
      }
      coveredIndexes.add(index);
    }
  }
  const verified = [];
  const needsReview = [];
  for (const batch of batches) {
    verified.push(...batch.verified);
    for (const record of batch.needsReview) {
      // Batch 0 predates the approved optional summary/authority contract.  Its
      // page title and documents were already read from the official page, so
      // promote only records blocked exclusively by those formerly-required
      // fields.  The historical checkpoint is never changed.
      const normalized = normalizeLegacyNeedsReview(record);
      if (normalized) {
        verified.push(normalized);
      } else {
        needsReview.push(record);
      }
    }
  }

  if (coveredIndexes.size !== discoveredCount || [...coveredIndexes].some((index) => !Number.isInteger(index) || index < 0 || index >= discoveredCount)) {
    throw new Error(
      `Batch coverage is incomplete: expected ${discoveredCount}, found ${coveredIndexes.size}.`,
    );
  }

  const allSourceUrls = new Set();
  for (const service of [...verified, ...needsReview]) {
    const sourceUrl = service.verification?.sourceUrl ?? service.sourceUrl;
    if (!isOfficialSourceUrl(sourceUrl)) {
      throw new Error(`Non-official source URL "${sourceUrl}" in batch output.`);
    }
    if (allSourceUrls.has(sourceUrl)) {
      throw new Error(`Duplicate source URL "${sourceUrl}" across batches.`);
    }
    allSourceUrls.add(sourceUrl);
  }

  const usedCategorySlugs = new Set(verified.map((service) => service.category));
  const categories = [...CATEGORY_SLUGS.entries()]
    .filter(([, slug]) => usedCategorySlugs.has(slug))
    .map(([name, slug]) => ({ name, slug }));
  const catalogue = {
    contentType: 'api::service.service',
    categories,
    data: verified,
  };
  const catalogueErrors = validateCatalog(catalogue);
  if (catalogueErrors.length > 0) {
    throw new Error(`Final catalogue validation failed:\n${catalogueErrors.join('\n')}`);
  }
  const manifest = {
    source: LIST_URL,
    verifiedAt: VERIFIED_AT,
    discovered: discoveredCount,
    verified: verified.map((service) => ({
      title: service.title,
      sourceUrl: service.verification.sourceUrl,
      sourceDomain: new URL(service.verification.sourceUrl).hostname,
      category: service.category,
      verifiedAt: service.verification.verifiedAt,
      importStatus: 'verified',
      notes: 'Title and required documents were read from the official service page.',
    })),
    needsReview,
  };

  await fs.writeFile(path.join(appDir, 'data', 'research', 'khadamatmisr-validated-catalogue.json'), `${JSON.stringify(catalogue, null, 2)}\n`);
  await fs.writeFile(path.join(appDir, 'data', 'research', 'khadamatmisr-manifest-v2.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Verified for import: ${verified.length}`);
  console.log(`Needs review: ${needsReview.length}`);
}

async function main() {
  const appDir = path.resolve(__dirname, '..');
  const listHtml = await fetchOfficial(LIST_URL);
  const tabs = extractCategoryTabs(listHtml);
  const panels = extractPanels(listHtml);
  const discovered = new Map();

  for (const [panelId, category] of tabs) {
    const panel = panels.get(panelId);
    if (!panel) throw new Error(`Official category panel "${panelId}" was not found.`);

    for (const service of extractServiceLinks(panel)) {
      const prior = discovered.get(service.sourceUrl);
      if (prior && prior.category !== category) {
        throw new Error(`Conflicting categories for ${service.sourceUrl}: ${prior.category} / ${category}.`);
      }
      discovered.set(service.sourceUrl, toServiceRecord({ ...service, category }));
    }
  }

  const records = [...discovered.values()];
  if (process.argv.includes('--assemble')) {
    await assembleCatalogue(appDir, records.length);
    return;
  }

  const startIndex = readNumericOption('start', 0);
  const limit = readNumericOption('limit', records.length);
  const recordsToProcess = records.slice(startIndex, startIndex + limit);
  const verified = [];
  const needsReview = [];

  for (let index = 0; index < recordsToProcess.length; index += 1) {
    const record = recordsToProcess[index];
    process.stdout.write(`[${startIndex + index + 1}/${records.length}] ${record.title}\n`);

    try {
      const html = await fetchOfficial(record.sourceUrl);
      const pageTitle = extractPageTitle(html);
      if (!pageTitle || pageTitle !== record.title) {
        throw new Error(`Official page title mismatch: "${pageTitle || 'missing'}".`);
      }

      verified.push({
        title: record.title,
        slug: createSlug(record.sourceUrl),
        category: record.categorySlug,
        documents: extractDocuments(html),
        steps: [],
        verification: {
          verifiedAt: VERIFIED_AT,
          sourceTitle: `مركز خدمات مصر — ${pageTitle}`,
          sourceUrl: record.sourceUrl,
        },
      });
    } catch (error) {
      needsReview.push({
        title: record.title,
        sourceUrl: record.sourceUrl,
        sourceDomain: new URL(record.sourceUrl).hostname,
        category: record.category,
        verifiedAt: VERIFIED_AT,
        importStatus: 'needs-review',
        notes: error instanceof Error ? error.message : String(error),
      });
    }

    if (index < recordsToProcess.length - 1) await pause(REQUEST_DELAY_MS);
  }

  const batchDirectory = path.join(appDir, 'data', 'research', 'khadamatmisr-batches');
  await fs.mkdir(batchDirectory, { recursive: true });
  await fs.writeFile(
    path.join(batchDirectory, `${startIndex}.validated.json`),
    `${JSON.stringify({ source: LIST_URL, discovered: records.length, startIndex, recordCount: recordsToProcess.length, verified, needsReview }, null, 2)}\n`,
  );
  console.log(`Batch verified: ${verified.length}`);
  console.log(`Batch needs review: ${needsReview.length}`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = {
  createSlug,
  extractDocuments,
  extractPageTitle,
  extractServiceLinks,
  textFromHtml,
};
