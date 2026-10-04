'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { validateCatalog } = require('../scripts/lib/service-data-validation');

function service(overrides = {}) {
  return {
    title: 'خدمة رسمية',
    slug: 'khadamat-misr-999',
    summary: 'وصف منشور رسميًا.',
    category: 'civil-status',
    authority: 'جهة حكومية منشورة',
    documents: [{ name: 'بطاقة المواطن' }],
    steps: [],
    verification: {
      verifiedAt: '2026-09-24',
      sourceTitle: 'مركز خدمات مصر — خدمة رسمية',
      sourceUrl: 'https://www.khadamatmisr.gov.eg/node/999',
    },
    ...overrides,
  };
}

function catalog(data) {
  return {
    categories: [{ slug: 'civil-status', name: 'الأحوال المدنية' }],
    data,
  };
}

test('accepts a well-formed official catalogue record', () => {
  assert.deepEqual(validateCatalog(catalog([service()])), []);
});

test('rejects a non-official or insecure source URL', () => {
  const errors = validateCatalog(catalog([
    service({
      verification: {
        ...service().verification,
        sourceUrl: 'http://example.com/service',
      },
    }),
  ]));

  assert.match(errors.join('\n'), /HTTPS Khadamat Misr URL/);
});

test('rejects duplicate source URLs, slugs, and titles', () => {
  const errors = validateCatalog(catalog([
    service(),
    service({ title: 'خدمة رسمية', slug: 'khadamat-misr-999' }),
  ]));

  assert.match(errors.join('\n'), /duplicate service slug/);
  assert.match(errors.join('\n'), /duplicate service title/);
  assert.match(errors.join('\n'), /duplicate service source URL/);
});

test('accepts an official service without unpublished summary or authority', () => {
  const record = service();
  delete record.summary;
  delete record.authority;

  assert.deepEqual(validateCatalog(catalog([record])), []);
});

test('rejects a record that lacks a required category or has an empty optional authority', () => {
  const errors = validateCatalog(catalog([
    service({ category: 'unknown', authority: '' }),
  ]));

  assert.match(errors.join('\n'), /authority must be a non-empty string/);
  assert.match(errors.join('\n'), /references missing category/);
});

test('rejects a slug that does not match its stable official node ID', () => {
  const errors = validateCatalog(catalog([
    service({ slug: 'other-service' }),
  ]));

  assert.match(errors.join('\n'), /slug must match the stable source node ID/);
});

test('rejects using a category slug as an authority', () => {
  const errors = validateCatalog(catalog([
    service({ authority: 'civil-status' }),
  ]));

  assert.match(errors.join('\n'), /authority must not repeat the category/);
});
