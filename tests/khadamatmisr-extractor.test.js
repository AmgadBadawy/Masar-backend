'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  extractDocuments,
  extractPageTitle,
} = require('../scripts/build-khadamatmisr-catalog');

const servicePage = `
  <html><head><title>توكيل عام قضايا | مركز خدمات مصر</title></head><body>
    <div class="tab-pane fade show active" id="v-pills-profile" role="tabpanel">
      <h5>المستندات المطلوبة</h5>
      • صورة ضوئية لبطاقة المواطن<br>
      • صور ضوئية للمحامي /محاميين<br>
      • سند الصفة التوكيل عن الغير
    </div>
    <!-- tab2 -->
    <div id="v-pills-settings2"><h5>مراكز "خدمات مصر"</h5>القاهرة</div>
    <footer>عن "خدمات مصر"</footer>
  </body></html>
`;

test('extracts the official page identity from the document title', () => {
  assert.equal(extractPageTitle(servicePage), 'توكيل عام قضايا');
});

test('extracts only items in the documents tab', () => {
  assert.deepEqual(extractDocuments(servicePage), [
    { name: 'صورة ضوئية لبطاقة المواطن' },
    { name: 'صور ضوئية للمحامي /محاميين' },
    { name: 'سند الصفة التوكيل عن الغير' },
  ]);
});

test('does not treat service centers or footer content as documents', () => {
  const withoutDocumentTab = servicePage.replace('المستندات المطلوبة', 'قنوات الخدمة');
  assert.deepEqual(extractDocuments(withoutDocumentTab), []);
});
