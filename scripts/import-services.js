'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { createStrapi } = require('@strapi/strapi');
const { validateCatalog } = require('./lib/service-data-validation');

const SERVICE_UID = 'api::service.service';
const CATEGORY_UID = 'api::category.category';

function importFilePath(appDir) {
  const option = process.argv.find((argument) => argument.startsWith('--file='));
  return option
    ? path.resolve(appDir, option.slice('--file='.length))
    : path.join(appDir, 'data', 'research', 'khadamatmisr-validated-catalogue.json');
}

function optionalFields(service) {
  return Object.fromEntries(
    ['summary', 'authority', 'fees', 'expectedTime', 'onlineAvailability']
      .map((field) => [field, service[field] ?? null]),
  );
}

function serviceData(service, categoryDocumentId) {
  const data = {
    title: service.title,
    slug: service.slug,
    category: { connect: [categoryDocumentId] },
    verification: {
      verifiedAt: service.verification.verifiedAt,
      sourceTitle: service.verification.sourceTitle,
      sourceUrl: service.verification.sourceUrl,
    },
    ...optionalFields(service),
  };

  // This catalogue is the sole verified source for these records. Undefined
  // optional fields are deliberately written as null: retaining a prior value
  // would make Masar claim the official page publishes a fact it does not.
  data.documents = service.documents;
  data.steps = service.steps;

  return data;
}

async function findOne(documents, filters, label, populate) {
  const matches = await documents.findMany({ filters, status: 'draft', ...(populate && { populate }) });
  if (matches.length > 1) throw new Error(`Multiple ${label} records matched a supposedly stable identity.`);
  return matches[0];
}

async function findExistingService(documents, service) {
  const populate = { documents: true, steps: true, verification: true, category: true };
  const bySlug = await findOne(documents, { slug: { $eq: service.slug } }, `service slug "${service.slug}"`, populate);
  const bySource = await findOne(
    documents,
    { verification: { sourceUrl: { $eq: service.verification.sourceUrl } } },
    `service source URL "${service.verification.sourceUrl}"`,
    populate,
  );

  if (bySlug && bySource && bySlug.documentId !== bySource.documentId) {
    throw new Error(`Slug/source identity conflict for "${service.title}"; no changes were made for this record.`);
  }
  return bySlug ?? bySource;
}

async function upsertCategory(documents, category) {
  const existing = await findOne(documents, { slug: { $eq: category.slug } }, `category slug "${category.slug}"`);
  const data = { name: category.name, slug: category.slug };
  if (existing) {
    await documents.update({ documentId: existing.documentId, data, status: 'published' });
    return { ...existing, ...data };
  }
  return documents.create({ data, status: 'published' });
}

async function pruneEmptyNonOfficialCategories(categoryDocuments, serviceDocuments, officialSlugs) {
  const categories = await categoryDocuments.findMany({ status: 'draft' });
  let removed = 0;
  for (const category of categories) {
    if (officialSlugs.has(category.slug)) continue;
    const services = await serviceDocuments.findMany({
      filters: { category: { slug: { $eq: category.slug } } },
      status: 'draft',
      pagination: { pageSize: 1 },
    });
    if (services.length === 0) {
      await categoryDocuments.delete({ documentId: category.documentId });
      removed += 1;
    }
  }
  return removed;
}

async function main() {
  const appDir = path.resolve(__dirname, '..');
  const distDir = path.join(appDir, 'dist');
  const filePath = importFilePath(appDir);
  if (!fs.existsSync(filePath)) throw new Error(`Import file not found:\n${filePath}`);
  if (!fs.existsSync(distDir)) throw new Error('The Strapi build was not found. Run "npm run build" first.');

  const payload = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  if (payload.contentType !== SERVICE_UID) throw new Error(`Invalid contentType. Expected "${SERVICE_UID}".`);
  const validationErrors = validateCatalog(payload);
  if (validationErrors.length > 0) throw new Error(`Import aborted: catalogue validation failed:\n${validationErrors.join('\n')}`);

  const strapi = await createStrapi({ appDir, distDir }).load();
  try {
    const categoryDocuments = strapi.documents(CATEGORY_UID);
    const serviceDocuments = strapi.documents(SERVICE_UID);
    const categoriesBySlug = new Map();
    for (const category of [...payload.categories].sort((left, right) => left.slug.localeCompare(right.slug))) {
      categoriesBySlug.set(category.slug, await upsertCategory(categoryDocuments, category));
    }

    let created = 0;
    let updated = 0;
    for (const service of [...payload.data].sort((left, right) => left.slug.localeCompare(right.slug))) {
      const category = categoriesBySlug.get(service.category);
      if (!category?.documentId) throw new Error(`Category "${service.category}" has no documentId.`);
      const existing = await findExistingService(serviceDocuments, service);
      const data = serviceData(service, category.documentId);
      if (existing) {
        await serviceDocuments.update({ documentId: existing.documentId, data, status: 'published' });
        updated += 1;
      } else {
        await serviceDocuments.create({ data, status: 'published' });
        created += 1;
      }
    }

    const removedEmptyCategories = await pruneEmptyNonOfficialCategories(
      categoryDocuments,
      serviceDocuments,
      new Set(payload.categories.map((category) => category.slug)),
    );
    console.log(JSON.stringify({ created, updated, imported: payload.data.length, removedEmptyCategories }, null, 2));
  } finally {
    await strapi.destroy();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = { importFilePath, optionalFields, serviceData };
