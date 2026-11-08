import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { browserFixture } from "./fixtures/browser-harness.mjs";

const resources = {};
for (const language of ["en", "lv", "ru"]) resources[language] = { translation: JSON.parse(await readFile(`client/public/locales/${language}/translation.json`, "utf8")) };
const fixture = await browserFixture({ entry: "scripts/fixtures/service-reports.tsx", resources });
const { evaluate, until, set, click, viewport } = fixture;
const folder = process.env.REPORTS_EMPLOYEE_TEST_OUTPUT || "output/reports-employees-check"; await mkdir(folder, { recursive: true });
const rows = async count => { await evaluate(count => { window.expectedReportCount = count; }, count); await until(() => document.querySelectorAll('[data-report-row]').length === window.expectedReportCount, `booking rows ${count}`); };
const groups = async count => { await evaluate(count => { window.expectedReportCount = count; }, count); await until(() => document.querySelectorAll('[data-report-group]').length === window.expectedReportCount, `service groups ${count}`); };
const apply = async language => { await fixture.button(resources[language].translation.reports.show); await fixture.settle(); };
const scope = () => evaluate(() => document.querySelector('[data-testid="report-employee-scope"]').textContent);
const groupIds = () => evaluate(() => [...document.querySelectorAll('[data-report-group]')].map(node => Number(node.dataset.serviceId)).sort((a, b) => a - b));
const assertClean = async () => {
  assert.deepEqual(await evaluate(() => window.phase2Fixture.unexpected), []);
  assert.deepEqual(await evaluate(() => window.phase2Fixture.writes), []);
  assert.equal(await evaluate(() => document.body.textContent.includes('UNSCOPED SECRET')), false);
};
async function download(format, name) {
  await click(`[data-testid="export-${format}"]`);
  await until(() => window.phase2Fixture.downloads.length > 0, `${format} download`);
  const item = await evaluate(() => window.phase2Fixture.downloads.shift());
  const bytes = Buffer.from(item.base64, "base64"); await writeFile(`${folder}/${name}.${format}`, bytes);
  if (format === 'pdf') {
    const text = await evaluate(() => window.phase2Fixture.pdfText);
    assert.ok(text.length > 20);
    assert.ok(text.every(cell => cell.x >= 60 && cell.x + cell.width <= (cell.y === 1150 ? 1624 : 1541)), 'Every PDF heading/cell remains inside printable width');
    assert.ok(text.every(cell => cell.y > 0 && cell.y + cell.height * .3 <= 1160), 'PDF text remains above page bottom');
    const raw = bytes.toString('latin1'); let page = 0;
    for (const match of raw.matchAll(/\/Filter \/DCTDecode \/Length (\d+) >>\nstream\n/g)) {
      const start = match.index + match[0].length;
      await writeFile(`${folder}/${name}-page-${++page}.jpg`, bytes.subarray(start, start + Number(match[1])));
    }
  }
  return bytes;
}
try {
  for (const language of ["en", "lv", "ru"]) for (const width of [390, 1280]) {
    const text = resources[language].translation.reports;
    await viewport(width); await fixture.visit(`/my-services/reports?lang=${language}&company=1`); await rows(6);
    assert.deepEqual(await evaluate(() => [...document.querySelector('#report-employee').options].map(option => option.value)), ['all', '11', '12', 'unassigned']);
    assert.equal(await scope(), text.allEmployees);
    assert.equal(await evaluate(() => [...document.querySelectorAll('[data-report-employee]')].some(node => node.textContent === 'Anna Visible')), true);
    assert.equal(await evaluate(label => [...document.querySelectorAll('[data-report-employee]')].some(node => node.textContent === label), text.unassigned), true);
    await set('report-employee', '11'); await rows(6); assert.equal(await scope(), text.allEmployees, 'Employee selection remains draft until Show report');
    await apply(language); await rows(4); assert.equal(await scope(), 'Anna Visible');
    assert.deepEqual(await evaluate(() => [...document.querySelectorAll('[data-report-employee]')].map(node => node.textContent)), Array(4).fill('Anna Visible'));
    await click(`button[aria-label="${text.graph}"]`);
    await until(() => document.querySelectorAll('[data-graph-currency]').length === 2, 'employee daily graphs rendered');
    await click(`button[aria-label="${text.list}"]`); await rows(4);
    if (width === 1280) {
      for (const format of ['csv', 'xlsx', 'pdf']) {
        const bytes = await download(format, `employee-${language}`);
        if (format !== 'pdf') { assert.ok(bytes.toString('utf8').includes('Anna Visible')); assert.equal(bytes.toString('utf8').includes('Boris Visible'), false); }
      }
    }
    await set('report-type', 'byService'); await groups(5);
    assert.deepEqual(await groupIds(), [101, 101, 102, 103, 999], 'Historical employee rows survive service reassignment and include own zero catalog');
    assert.equal(await evaluate(label => document.querySelector('[data-report-group][data-service-id="103"]').textContent.includes(label), text.noBookings), true);
    await set('report-group-sort', 'fewest');
    assert.equal(await evaluate(() => document.querySelector('[data-report-group]').dataset.serviceId), '103');
    await set('report-employee', '12'); await groups(5); assert.equal(await scope(), 'Anna Visible');
    await apply(language); await groups(3); assert.deepEqual(await groupIds(), [101, 102, 104]);
    await set('report-employee', 'all'); await apply(language); await groups(7);
    assert.deepEqual(await groupIds(), [101, 101, 102, 103, 104, 105, 999]);
    assert.equal(await evaluate(() => document.querySelectorAll('[data-report-group][data-service-id="101"]').length), 2, 'Historical currency preserved');
    await click(`button[aria-label="${text.graph}"]`);
    await until(() => document.querySelectorAll('[data-graph-point]').length === 7, 'named service graphs rendered');
    assert.equal(await evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, `${language}/${width} graph no page overflow`);
    if (language === 'en') await fixture.screenshot(`${folder}/groups-graph-${width}.png`);
    await click(`button[aria-label="${text.list}"]`); await groups(7);
    assert.equal(await evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, `${language}/${width} list scroll stays inside report`);
    if (language === 'en') await fixture.screenshot(`${folder}/groups-list-${width}.png`);
    if (width === 1280) {
      for (const format of ['csv', 'xlsx', 'pdf']) {
        const bytes = await download(format, `groups-${language}`), data = bytes.toString('utf8');
        if (format === 'csv') assert.ok(data.includes('"Massage","101","EUR","2","1","0","1","0","10","0","30","0"'), 'Grouped CSV preserves numeric counts and four buckets');
        if (format === 'xlsx') {
          assert.match(data, /<col min="2" max="12" width="24"/);
          const row = [...data.matchAll(/<row r="\d+">(.*?)<\/row>/g)].map(match => match[1]).find(row => /<c r="B\d+"><v>101<\/v><\/c>/.test(row) && /<t xml:space="preserve">EUR<\/t>/.test(row));
          assert.match(row, /<c r="K\d+"><v>30<\/v><\/c>/, 'Grouped pending revenue is a numeric cell');
          assert.match(row, /<c r="D\d+"><v>2<\/v><\/c>/, 'Booking count is a numeric cell');
        }
        if (format === 'pdf') assert.equal(await evaluate(() => window.phase2Fixture.pdfText.some(cell => cell.text === '40' && cell.x > 1400)), true, 'Final loss column is rendered inside the PDF');
      }
    }
    await set('report-employee', 'unassigned'); await apply(language); await groups(2);
    assert.deepEqual(await groupIds(), [101, 105], 'Shared bookings and unbooked shared services remain represented');
    await assertClean(); console.log(`Passed employee and grouped-service reports ${language}/${width}.`);
  }
  await fixture.visit('/my-services/reports?company=1'); await rows(6);
  await evaluate(() => window.phase2Fixture.setWorkspace('restricted')); await rows(4);
  assert.deepEqual(await evaluate(() => [...document.querySelector('#report-employee').options].map(node => node.value)), ['all', '11', 'unassigned']);
  await set('report-type', 'byService'); await groups(5); assert.deepEqual(await groupIds(), [101, 101, 102, 103, 999]); await assertClean();
  await set('report-employee', '11'); await apply('en');
  await evaluate(() => window.phase2Fixture.setWorkspace('company2')); await rows(1);
  assert.equal(await evaluate(() => document.querySelector('#report-employee').value), 'all', 'Workspace resets employee selection');
  assert.equal(await evaluate(() => document.body.textContent.includes('Anna Visible')), false);
  assert.deepEqual(await evaluate(() => [...document.querySelector('#report-employee').options].map(node => node.value)), ['all', '21', 'unassigned']);
  await set('report-type', 'byService'); await groups(1); assert.deepEqual(await groupIds(), [201]);
  const staffRequests = await evaluate(() => window.phase2Fixture.requests.filter(path => path.includes('/api/provider/employees')).length);
  await evaluate(() => window.phase2Fixture.setWorkspace('personal')); await rows(4);
  assert.equal(await evaluate(() => !!document.querySelector('#report-employee')), false);
  assert.equal(await evaluate(() => document.body.textContent.includes('Second worker')), false);
  assert.equal(await evaluate(() => window.phase2Fixture.requests.filter(path => path.includes('/api/provider/employees')).length), staffRequests);
  await set('report-type', 'byService'); await groups(4); assert.deepEqual(await groupIds(), [101, 102, 103, 104]); await assertClean();

  await fixture.visit('/my-services/reports?company=1&employees=pending');
  await until(() => !!window.phase2Fixture.resolveEmployee, 'Employee lookup pending');
  assert.equal(await evaluate(() => !!document.querySelector('[data-testid="total-earned-EUR"]')), false, 'No partial reports while employee data loads');
  await evaluate(() => window.phase2Fixture.setWorkspace('personal')); await rows(4);
  await evaluate(() => { window.phase2Fixture.employeeResult = 'success'; window.phase2Fixture.resolveEmployee?.(); });
  await fixture.settle();
  assert.equal(await evaluate(() => !!document.querySelector('#report-employee')), false, 'Pending old scope never leaks into personal workspace');
  assert.equal(await evaluate(() => document.body.textContent.includes('Anna Visible') || document.body.textContent.includes('Boris Visible')), false, 'Late previous-workspace response cannot restore employee names');
  for (const failure of ['employees', 'catalog']) {
    await fixture.visit(`/my-services/reports?company=1&${failure}=error`);
    if (failure === 'catalog') { await rows(6); await set('report-type', 'byService'); }
    await until(() => !!document.querySelector('[data-testid="reports-page"] [role="alert"]'), `${failure} error`);
    assert.equal(await evaluate(() => !!document.querySelector('[data-report-group], [data-testid="export-csv"]')), false, 'Lookup failure never fabricates zero demand');
    await evaluate(failure => { window.phase2Fixture[failure === 'employees' ? 'employeeResult' : 'catalogResult'] = 'success'; }, failure);
    await fixture.button(resources.en.translation.reports.retry);
    if (failure === 'catalog') await groups(7); else await rows(6);
    await assertClean();
  }
  assert.deepEqual(fixture.errors, []); assert.deepEqual(fixture.network, []); assert.deepEqual(fixture.blocked, []);
  console.log('Passed company employee drafts/applied/export scopes, named-service demand/currency/counts, numeric CSV/XLSX, PDF bounds, restricted/cache/workspace isolation and lookup error recovery; en/lv/ru only.');
} finally { await fixture.close(); }
