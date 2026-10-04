'use strict';

const OFFICIAL_HOSTS = new Set([
  'www.khadamatmisr.gov.eg',
  'khadamatmisr.gov.eg',
]);

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isOfficialSourceUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && OFFICIAL_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
}

function nodeIdFromSourceUrl(value) {
  if (!isOfficialSourceUrl(value)) return undefined;

  return new URL(value).pathname.match(/^\/node\/(\d+)$/)?.[1];
}

function validateDocument(document, index, errors) {
  if (!document || typeof document !== 'object' || !isNonEmptyString(document.name)) {
    errors.push(`documents[${index}] must include a non-empty name.`);
    return;
  }

  if (document.description !== undefined && !isNonEmptyString(document.description)) {
    errors.push(`documents[${index}].description must be a non-empty string when present.`);
  }
}

function validateStep(step, index, errors) {
  if (!step || typeof step !== 'object') {
    errors.push(`steps[${index}] must be an object.`);
    return;
  }

  if (!Number.isInteger(step.order) || step.order < 1) {
    errors.push(`steps[${index}].order must be a positive integer.`);
  }

  if (!isNonEmptyString(step.title) || !isNonEmptyString(step.description)) {
    errors.push(`steps[${index}] must include non-empty title and description.`);
  }
}

function validateOptionalString(value, field, errors, serviceTitle) {
  if (value === undefined || value === null) return;

  if (!isNonEmptyString(value)) {
    errors.push(`${field} must be a non-empty string when present for "${serviceTitle ?? 'unknown'}".`);
  }
}

function validateService(service, categories, errors) {
  for (const field of ['title', 'slug', 'category']) {
    if (!isNonEmptyString(service[field])) {
      errors.push(`${field} must be a non-empty string for "${service.title ?? 'unknown'}".`);
    }
  }

  if (!categories.has(service.category)) {
    errors.push(`service "${service.title}" references missing category "${service.category}".`);
  }

  validateOptionalString(service.summary, 'summary', errors, service.title);
  validateOptionalString(service.authority, 'authority', errors, service.title);

  if (!Array.isArray(service.documents)) {
    errors.push(`documents must be an array for "${service.title}".`);
  } else {
    service.documents.forEach((document, index) => validateDocument(document, index, errors));
  }

  if (!Array.isArray(service.steps)) {
    errors.push(`steps must be an array for "${service.title}".`);
  } else {
    service.steps.forEach((step, index) => validateStep(step, index, errors));
  }

  const verification = service.verification;
  if (!verification || typeof verification !== 'object') {
    errors.push(`verification must be present for "${service.title}".`);
    return;
  }

  if (!isNonEmptyString(verification.verifiedAt) || Number.isNaN(Date.parse(`${verification.verifiedAt}T00:00:00Z`))) {
    errors.push(`verification.verifiedAt must be an ISO date for "${service.title}".`);
  }

  if (!isNonEmptyString(verification.sourceTitle)) {
    errors.push(`verification.sourceTitle must be present for "${service.title}".`);
  }

  if (!isOfficialSourceUrl(verification.sourceUrl)) {
    errors.push(`verification.sourceUrl must be an HTTPS Khadamat Misr URL for "${service.title}".`);
  } else {
    const nodeId = nodeIdFromSourceUrl(verification.sourceUrl);
    if (!nodeId) {
      errors.push(`verification.sourceUrl must identify a stable /node/<id> service page for "${service.title}".`);
    } else if (service.slug !== `khadamat-misr-${nodeId}`) {
      errors.push(`slug must match the stable source node ID for "${service.title}".`);
    }
  }

  if (
    isNonEmptyString(service.authority)
    && isNonEmptyString(service.category)
    && service.authority.trim() === service.category.trim()
  ) {
    errors.push(`authority must not repeat the category for "${service.title}".`);
  }
}

function validateCatalog(payload) {
  const errors = [];
  const categorySlugs = new Set();
  const serviceSlugs = new Set();
  const serviceTitles = new Set();
  const sourceUrls = new Set();
  const sourceNodeIds = new Set();

  if (!payload || typeof payload !== 'object' || !Array.isArray(payload.categories) || !Array.isArray(payload.data)) {
    return ['catalogue must include categories and data arrays.'];
  }

  for (const category of payload.categories) {
    if (!category || !isNonEmptyString(category.slug) || !isNonEmptyString(category.name)) {
      errors.push('each category must include non-empty slug and name.');
      continue;
    }

    if (categorySlugs.has(category.slug)) {
      errors.push(`duplicate category slug "${category.slug}".`);
    }
    categorySlugs.add(category.slug);
  }

  for (const service of payload.data) {
    validateService(service, categorySlugs, errors);

    if (serviceSlugs.has(service.slug)) {
      errors.push(`duplicate service slug "${service.slug}".`);
    }
    serviceSlugs.add(service.slug);

    const normalizedTitle = typeof service.title === 'string' ? service.title.trim() : '';
    if (serviceTitles.has(normalizedTitle)) {
      errors.push(`duplicate service title "${normalizedTitle}".`);
    }
    serviceTitles.add(normalizedTitle);

    const sourceUrl = service.verification?.sourceUrl;
    if (isNonEmptyString(sourceUrl) && sourceUrls.has(sourceUrl)) {
      errors.push(`duplicate service source URL "${sourceUrl}".`);
    }
    if (isNonEmptyString(sourceUrl)) {
      sourceUrls.add(sourceUrl);
      const nodeId = nodeIdFromSourceUrl(sourceUrl);
      if (nodeId && sourceNodeIds.has(nodeId)) {
        errors.push(`duplicate stable source node ID "${nodeId}".`);
      }
      if (nodeId) sourceNodeIds.add(nodeId);
    }
  }

  return errors;
}

module.exports = {
  isOfficialSourceUrl,
  nodeIdFromSourceUrl,
  validateCatalog,
};
