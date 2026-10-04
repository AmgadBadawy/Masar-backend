'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { optionalFields, serviceData } = require('../scripts/import-services');

const service = {
  title: 'خدمة رسمية',
  slug: 'khadamat-misr-999',
  category: 'civil-status',
  documents: [{ name: 'بطاقة المواطن' }],
  steps: [],
  verification: {
    verifiedAt: '2026-09-24',
    sourceTitle: 'مركز خدمات مصر — خدمة رسمية',
    sourceUrl: 'https://www.khadamatmisr.gov.eg/node/999',
  },
};

test('writes unpublished optional official facts as null instead of preserving stale claims', () => {
  assert.deepEqual(optionalFields(service), {
    summary: null,
    authority: null,
    fees: null,
    expectedTime: null,
    onlineAvailability: null,
  });
});

test('uses the official source data and stable category relation for an update', () => {
  const data = serviceData(service, 'category-document-id');

  assert.deepEqual(data.category, { connect: ['category-document-id'] });
  assert.deepEqual(data.documents, [{ name: 'بطاقة المواطن' }]);
  assert.deepEqual(data.steps, []);
  assert.equal(data.summary, null);
  assert.equal(data.verification.sourceUrl, service.verification.sourceUrl);
});
