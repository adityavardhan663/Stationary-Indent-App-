import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeUrgencyValue,
  normalizeIndentUrgency,
  getUrgencyPriority,
  getUrgencyBadgeStyle,
  parseDateValueToTimestamp,
  parseIndentNeededByTimestamp,
  formatNeededByDisplay,
  parseCreatedAtTimestamp,
  sortIssueQueueIndents
} from '../src/utils/indentQueue.js';

const ids = list => list.map(i => i._id);

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }
  return value;
}

// ---------------------------------------------------------------------------
// Urgency labels & styles
// ---------------------------------------------------------------------------
test('Phase 5A urgency labels, priority and badge styles', async (t) => {
  await t.test('normalizeUrgencyValue recognises the three labels and common spellings', () => {
    assert.equal(normalizeUrgencyValue('Urgent'), 'Urgent');
    assert.equal(normalizeUrgencyValue('  urgent '), 'Urgent');
    assert.equal(normalizeUrgencyValue('NORMAL'), 'Normal');
    assert.equal(normalizeUrgencyValue('Not urgent'), 'Not urgent');
    assert.equal(normalizeUrgencyValue('not_urgent'), 'Not urgent');
    assert.equal(normalizeUrgencyValue('NOT-URGENT'), 'Not urgent');
    assert.equal(normalizeUrgencyValue('critical'), null);
    assert.equal(normalizeUrgencyValue(''), null);
    assert.equal(normalizeUrgencyValue(null), null);
    assert.equal(normalizeUrgencyValue(2), null);
  });

  await t.test('missing, blank, null, undefined, numeric and unknown urgency all label as Normal', () => {
    const cases = [
      {},
      { urgency: '' },
      { urgency: '   ' },
      { urgency: null },
      { urgency: undefined },
      { urgency: 999 },
      { urgency: 'CRITICAL_UNKNOWN' }
    ];
    for (const item of cases) {
      assert.equal(normalizeIndentUrgency(item), 'Normal');
      assert.equal(getUrgencyPriority(normalizeIndentUrgency(item)), 2);
    }
    assert.equal(normalizeIndentUrgency(null), 'Normal');
    assert.equal(normalizeIndentUrgency(undefined), 'Normal');
  });

  await t.test('priority order is Urgent < Normal < Not urgent; unknown labels rank as Normal', () => {
    assert.ok(getUrgencyPriority('Urgent') < getUrgencyPriority('Normal'));
    assert.ok(getUrgencyPriority('Normal') < getUrgencyPriority('Not urgent'));
    assert.equal(getUrgencyPriority('whatever'), getUrgencyPriority('Normal'));
    assert.equal(getUrgencyPriority(undefined), getUrgencyPriority('Normal'));
  });

  await t.test('legacy remarks urgency is used only when the urgency field is absent or blank', () => {
    const remarks = 'Urgency: Urgent | Needed by: 29 Nov 2026 (3 days) | Purpose: Exam';
    assert.equal(normalizeIndentUrgency({ remarks }), 'Urgent');
    assert.equal(normalizeIndentUrgency({ urgency: '', remarks }), 'Urgent');
    assert.equal(normalizeIndentUrgency({ urgency: null, remarks }), 'Urgent');
    // A direct value always wins, including an unrecognised one (-> Normal).
    assert.equal(normalizeIndentUrgency({ urgency: 'Not urgent', remarks }), 'Not urgent');
    assert.equal(normalizeIndentUrgency({ urgency: 'bogus', remarks }), 'Normal');
    assert.equal(normalizeIndentUrgency({ remarks: 'Urgency: bogus' }), 'Normal');
    assert.equal(normalizeIndentUrgency({ remarks: 'free text without fields' }), 'Normal');
  });

  await t.test('badge styles are distinct per label, unknown falls back to Normal, objects are fresh', () => {
    const urgent = getUrgencyBadgeStyle('Urgent');
    const normal = getUrgencyBadgeStyle('Normal');
    const notUrgent = getUrgencyBadgeStyle('Not urgent');

    for (const style of [urgent, normal, notUrgent]) {
      assert.ok(style.background && style.color && style.border);
    }
    assert.notEqual(urgent.background, normal.background);
    assert.notEqual(normal.background, notUrgent.background);
    assert.notEqual(urgent.background, notUrgent.background);
    assert.deepEqual(getUrgencyBadgeStyle('nonsense'), normal);
    assert.deepEqual(getUrgencyBadgeStyle(undefined), normal);

    urgent.background = 'mutated';
    assert.notEqual(getUrgencyBadgeStyle('Urgent').background, 'mutated');
    assert.notEqual(getUrgencyBadgeStyle('Urgent'), getUrgencyBadgeStyle('Urgent'));
  });
});

// ---------------------------------------------------------------------------
// Date parsing & formatting
// ---------------------------------------------------------------------------
test('Phase 5A date parsing and formatting', async (t) => {
  await t.test('date-only values are the UTC calendar day, independent of host timezone', () => {
    assert.equal(parseDateValueToTimestamp('2026-11-28'), Date.UTC(2026, 10, 28));
    assert.equal(parseDateValueToTimestamp('2026-01-01'), Date.UTC(2026, 0, 1));
    assert.equal(parseDateValueToTimestamp('2026-12-31'), Date.UTC(2026, 11, 31));
    assert.equal(parseDateValueToTimestamp(' 2026-11-28 '), Date.UTC(2026, 10, 28));
    // consecutive days are exactly 24h apart (no DST / offset drift)
    assert.equal(
      parseDateValueToTimestamp('2027-01-01') - parseDateValueToTimestamp('2026-12-31'),
      86400000
    );
  });

  await t.test('supported human-readable dates parse to the same instant as the ISO date', () => {
    const expected = Date.UTC(2026, 10, 28);
    assert.equal(parseDateValueToTimestamp('28 Nov 2026'), expected);
    assert.equal(parseDateValueToTimestamp('28 nov 2026'), expected);
    assert.equal(parseDateValueToTimestamp('28 NOV 2026'), expected);
    assert.equal(parseDateValueToTimestamp('  28   Nov   2026  '), expected);
    assert.equal(parseDateValueToTimestamp('5 Sep 2026'), Date.UTC(2026, 8, 5));
    assert.equal(parseDateValueToTimestamp('5 Sept 2026'), Date.UTC(2026, 8, 5));
    assert.equal(parseDateValueToTimestamp('05 Dec 2026'), Date.UTC(2026, 11, 5));
  });

  await t.test('ISO datetimes with Z or an offset parse to the exact instant', () => {
    assert.equal(parseDateValueToTimestamp('2026-11-28T00:00:00.000Z'), Date.UTC(2026, 10, 28));
    assert.equal(parseDateValueToTimestamp('2026-11-28T00:00:00Z'), Date.UTC(2026, 10, 28));
    assert.equal(parseDateValueToTimestamp('2026-11-28T05:30:00+05:30'), Date.UTC(2026, 10, 28));
    assert.equal(
      parseDateValueToTimestamp('2026-11-28T10:15:30.500Z'),
      Date.UTC(2026, 10, 28, 10, 15, 30, 500)
    );
  });

  await t.test('valid Date objects pass through; invalid ones are null', () => {
    const d = new Date(Date.UTC(2026, 10, 28, 12));
    assert.equal(parseDateValueToTimestamp(d), d.getTime());
    assert.equal(parseDateValueToTimestamp(new Date('garbage')), null);
  });

  await t.test('leap days are validated', () => {
    assert.equal(parseDateValueToTimestamp('2028-02-29'), Date.UTC(2028, 1, 29));
    assert.equal(parseDateValueToTimestamp('2027-02-29'), null);
    assert.equal(parseDateValueToTimestamp('29 Feb 2028'), Date.UTC(2028, 1, 29));
    assert.equal(parseDateValueToTimestamp('29 Feb 2027'), null);
  });

  await t.test('invalid, impossible, unsupported and non-string values are null (never throw)', () => {
    const bad = [
      '2026-02-30', '2026-13-01', '2026-00-10', '2026-11-00', '2026-04-31',
      '31 Apr 2026', '32 Nov 2026', '0 Nov 2026', '28 Foo 2026',
      '1800-01-01', '2200-01-01',
      'not-a-date', '2026/11/28', '28-11-2026', '11/28/2026', 'Nov 28, 2026',
      '2026-11-28T10:00:00',        // datetime without Z/offset is not a supported form
      '2026-11-28T25:00:00Z', '2026-11-28T10:61:00Z', '2026-02-30T10:00:00Z',
      '', '   ',
      null, undefined, 12345, 0, true, {}, [], () => {}
    ];
    for (const value of bad) {
      assert.equal(parseDateValueToTimestamp(value), null, `expected null for ${String(value)}`);
    }
  });

  await t.test('formatNeededByDisplay renders D Mon YYYY and is null when there is no valid date', () => {
    assert.equal(formatNeededByDisplay({ neededBy: '2026-11-28' }), '28 Nov 2026');
    assert.equal(formatNeededByDisplay({ neededBy: '2026-01-05' }), '5 Jan 2026');
    assert.equal(formatNeededByDisplay({ neededBy: '2026-12-31' }), '31 Dec 2026');
    assert.equal(formatNeededByDisplay({ neededBy: '2026-11-28T00:00:00.000Z' }), '28 Nov 2026');
    assert.equal(formatNeededByDisplay({ neededBy: '5 Sept 2026' }), '5 Sep 2026');
    assert.equal(formatNeededByDisplay({ neededBy: '05 Dec 2026' }), '5 Dec 2026');
    assert.equal(formatNeededByDisplay({ neededBy: new Date(Date.UTC(2026, 10, 28)) }), '28 Nov 2026');

    assert.equal(formatNeededByDisplay({}), null);
    assert.equal(formatNeededByDisplay({ neededBy: null }), null);
    assert.equal(formatNeededByDisplay({ neededBy: '' }), null);
    assert.equal(formatNeededByDisplay({ neededBy: 'soon' }), null);
    assert.equal(formatNeededByDisplay({ neededBy: '2026-02-30' }), null);
    assert.equal(formatNeededByDisplay(null), null);
    assert.equal(formatNeededByDisplay(undefined), null);
  });

  await t.test('legacy remarks "Needed by" is used only when the neededBy field is absent or blank', () => {
    const remarks = 'Urgency: Urgent | Needed by: 29 Nov 2026 (3 days) | Purpose: Exam';
    assert.equal(formatNeededByDisplay({ remarks }), '29 Nov 2026');
    assert.equal(formatNeededByDisplay({ neededBy: '', remarks }), '29 Nov 2026');
    assert.equal(formatNeededByDisplay({ remarks: 'NeededBy: 2026-12-02' }), '2 Dec 2026');
    assert.equal(formatNeededByDisplay({ remarks: 'Needed by: 29 Nov 2026' }), '29 Nov 2026');
    // a present-but-invalid neededBy is NOT rescued by remarks
    assert.equal(formatNeededByDisplay({ neededBy: 'not-a-date', remarks }), null);
    assert.equal(parseIndentNeededByTimestamp({ neededBy: '2026-02-30', remarks }), null);
    // a valid neededBy wins over remarks
    assert.equal(formatNeededByDisplay({ neededBy: '2026-12-10', remarks }), '10 Dec 2026');
    // unusable remarks
    assert.equal(formatNeededByDisplay({ remarks: 'Needed by: someday' }), null);
    assert.equal(formatNeededByDisplay({ remarks: 'just a note' }), null);
  });

  await t.test('parseCreatedAtTimestamp accepts ISO strings and Dates, otherwise null', () => {
    assert.equal(parseCreatedAtTimestamp('2026-11-20T10:00:00.000Z'), Date.UTC(2026, 10, 20, 10));
    assert.equal(parseCreatedAtTimestamp(new Date(Date.UTC(2026, 10, 20))), Date.UTC(2026, 10, 20));
    for (const bad of [undefined, null, '', '  ', 'garbage', new Date('x'), 123, {}]) {
      assert.equal(parseCreatedAtTimestamp(bad), null);
    }
  });
});

// ---------------------------------------------------------------------------
// Sorting
// ---------------------------------------------------------------------------
test('Phase 5A Issue Queue sorting', async (t) => {
  await t.test('Urgent -> Normal -> Not urgent', () => {
    const input = [
      { _id: 'not', urgency: 'Not urgent' },
      { _id: 'normal', urgency: 'Normal' },
      { _id: 'urgent', urgency: 'Urgent' }
    ];
    assert.deepEqual(ids(sortIssueQueueIndents(input)), ['urgent', 'normal', 'not']);
  });

  await t.test('missing/unknown urgency sorts as Normal (between Urgent and Not urgent)', () => {
    const input = [
      { _id: 'not', urgency: 'Not urgent' },
      { _id: 'unknown', urgency: 'SUPER_HIGH' },
      { _id: 'missing' },
      { _id: 'urgent', urgency: 'Urgent' },
      { _id: 'null', urgency: null }
    ];
    assert.deepEqual(ids(sortIssueQueueIndents(input)), ['urgent', 'unknown', 'missing', 'null', 'not']);
  });

  await t.test('urgency always outranks neededBy', () => {
    const input = [
      { _id: 'normal-soon', urgency: 'Normal', neededBy: '2026-11-28' },
      { _id: 'urgent-late', urgency: 'Urgent', neededBy: '2027-06-01' },
      { _id: 'urgent-none', urgency: 'Urgent' }
    ];
    assert.deepEqual(ids(sortIssueQueueIndents(input)), ['urgent-late', 'urgent-none', 'normal-soon']);
  });

  await t.test('earliest valid neededBy first, across all supported formats', () => {
    const input = [
      { _id: 'dec-05', urgency: 'Normal', neededBy: '2026-12-05' },
      { _id: 'nov-30', urgency: 'Normal', neededBy: '2026-11-30T00:00:00.000Z' },
      { _id: 'nov-28', urgency: 'Normal', neededBy: '28 Nov 2026' },
      { _id: 'nov-29-remarks', urgency: 'Normal', remarks: 'Needed by: 29 Nov 2026 (2 days)' }
    ];
    assert.deepEqual(ids(sortIssueQueueIndents(input)), ['nov-28', 'nov-29-remarks', 'nov-30', 'dec-05']);
  });

  await t.test('invalid/missing neededBy sorts after valid dates within the same urgency only', () => {
    const input = [
      { _id: 'n-null', urgency: 'Normal', neededBy: null },
      { _id: 'n-bad', urgency: 'Normal', neededBy: 'not-a-date' },
      { _id: 'n-impossible', urgency: 'Normal', neededBy: '2026-02-30' },
      { _id: 'n-empty', urgency: 'Normal', neededBy: '' },
      { _id: 'n-valid', urgency: 'Normal', neededBy: '2026-12-01' },
      { _id: 'u-none', urgency: 'Urgent' }
    ];
    assert.deepEqual(
      ids(sortIssueQueueIndents(input)),
      ['u-none', 'n-valid', 'n-null', 'n-bad', 'n-impossible', 'n-empty']
    );
  });

  await t.test('same neededBy day in different formats ties, then newest createdAt first', () => {
    const input = [
      { _id: 'old', urgency: 'Normal', neededBy: '2026-11-28', createdAt: '2026-11-20T08:00:00.000Z' },
      { _id: 'new', urgency: 'Normal', neededBy: '28 Nov 2026', createdAt: '2026-11-22T08:00:00.000Z' },
      { _id: 'mid', urgency: 'Normal', neededBy: '2026-11-28T00:00:00.000Z', createdAt: '2026-11-21T08:00:00.000Z' }
    ];
    assert.deepEqual(ids(sortIssueQueueIndents(input)), ['new', 'mid', 'old']);
  });

  await t.test('newest createdAt first when urgency and neededBy are equal (or both absent)', () => {
    const input = [
      { _id: 'a', urgency: 'Normal', createdAt: '2026-11-20T08:00:00.000Z' },
      { _id: 'c', urgency: 'Normal', createdAt: '2026-11-22T08:00:00.000Z' },
      { _id: 'b', urgency: 'Normal', createdAt: '2026-11-21T08:00:00.000Z' }
    ];
    assert.deepEqual(ids(sortIssueQueueIndents(input)), ['c', 'b', 'a']);
  });

  await t.test('createdAt compares as instants, not strings', () => {
    const input = [
      { _id: 'earlier-instant', createdAt: '2026-11-20T23:00:00-05:00' }, // 04:00Z on the 21st
      { _id: 'later-instant', createdAt: '2026-11-21T09:00:00+05:30' }    // 03:30Z on the 21st
    ];
    assert.deepEqual(ids(sortIssueQueueIndents(input)), ['earlier-instant', 'later-instant']);
  });

  await t.test('missing/invalid createdAt sorts after valid createdAt, keeping input order among themselves', () => {
    const input = [
      { _id: 'none-1' },
      { _id: 'bad', createdAt: 'garbage' },
      { _id: 'valid-old', createdAt: '2026-11-01T00:00:00.000Z' },
      { _id: 'none-2', createdAt: null },
      { _id: 'valid-new', createdAt: '2026-11-25T00:00:00.000Z' }
    ];
    assert.deepEqual(
      ids(sortIssueQueueIndents(input)),
      ['valid-new', 'valid-old', 'none-1', 'bad', 'none-2']
    );
  });

  await t.test('fully tied entries keep input order, ignoring indentNo and _id (duplicates and missing)', () => {
    const input = [
      { tag: 1, indentNo: 'IND-9', _id: 'z' },
      { tag: 2, indentNo: 'IND-1', _id: 'a' },
      { tag: 3, indentNo: 'IND-9', _id: 'z' },
      { tag: 4 },
      { tag: 5, indentNo: '', _id: '' },
      { tag: 6, indentNo: null, _id: null },
      { tag: 7, indentNo: 'IND-1', _id: 'a' }
    ];
    const tags = list => list.map(i => i.tag);
    assert.deepEqual(tags(sortIssueQueueIndents(input)), [1, 2, 3, 4, 5, 6, 7]);

    const reversed = [...input].reverse();
    assert.deepEqual(tags(sortIssueQueueIndents(reversed)), [7, 6, 5, 4, 3, 2, 1]);
  });

  await t.test('ties on urgency + neededBy + createdAt keep input order even with unordered indentNo', () => {
    const same = { urgency: 'Urgent', neededBy: '2026-11-29', createdAt: '2026-11-20T10:00:00.000Z' };
    const input = [
      { ...same, _id: 'first', indentNo: 'IND-2' },
      { ...same, _id: 'second', indentNo: 'IND-1' }
    ];
    assert.deepEqual(ids(sortIssueQueueIndents(input)), ['first', 'second']);
    assert.deepEqual(ids(sortIssueQueueIndents([...input].reverse())), ['second', 'first']);
  });

  await t.test('large all-tied input is returned in exactly the original order (stable)', () => {
    const input = Array.from({ length: 500 }, (_, i) => ({ tag: i, urgency: 'Normal' }));
    const out = sortIssueQueueIndents(input);
    assert.deepEqual(out.map(i => i.tag), input.map(i => i.tag));
  });

  await t.test('sorting is idempotent', () => {
    const input = [
      { _id: '1', urgency: 'Not urgent', neededBy: '2026-11-28' },
      { _id: '2', urgency: 'Urgent', neededBy: '2026-12-02', createdAt: '2026-11-20T00:00:00Z' },
      { _id: '3', urgency: 'Urgent', neededBy: '2026-12-02', createdAt: '2026-11-21T00:00:00Z' },
      { _id: '4' }
    ];
    const once = sortIssueQueueIndents(input);
    assert.deepEqual(ids(sortIssueQueueIndents(once)), ids(once));
  });

  await t.test('non-array input yields an empty array; empty array stays empty', () => {
    for (const bad of [null, undefined, {}, 'queue', 42]) {
      assert.deepEqual(sortIssueQueueIndents(bad), []);
    }
    assert.deepEqual(sortIssueQueueIndents([]), []);
  });

  await t.test('null entries do not crash sorting and rank as Normal with no dates', () => {
    const urgent = { _id: 'u', urgency: 'Urgent' };
    const out = sortIssueQueueIndents([null, urgent]);
    assert.equal(out[0], urgent);
    assert.equal(out[1], null);
  });

  await t.test('sorting happens before pagination slicing', () => {
    const rawQueue = [
      { _id: '1', urgency: 'Not urgent' },
      { _id: '2', urgency: 'Normal' },
      { _id: '3', urgency: 'Urgent', neededBy: '2026-11-27' }
    ];
    assert.deepEqual(ids(sortIssueQueueIndents(rawQueue).slice(0, 2)), ['3', '2']);
  });
});

// ---------------------------------------------------------------------------
// Immutability
// ---------------------------------------------------------------------------
test('Phase 5A helpers do not mutate their inputs', async (t) => {
  await t.test('sort works on a deeply frozen input and leaves it untouched', () => {
    const original = deepFreeze([
      { _id: '1', indentNo: 'IND-1', urgency: 'Not urgent', neededBy: '2026-11-28', items: [{ qty: 1 }] },
      { _id: '2', indentNo: 'IND-2', urgency: 'Urgent', neededBy: '2026-12-01', requester: { name: 'A' } },
      { _id: '3', indentNo: 'IND-3', remarks: 'Urgency: Urgent | Needed by: 27 Nov 2026 (1 day)' }
    ]);
    const snapshot = JSON.stringify(original);
    const orderBefore = [...original];

    // Frozen objects throw on write in strict (ES module) mode, so completing proves no mutation.
    const sorted = sortIssueQueueIndents(original);

    assert.equal(JSON.stringify(original), snapshot);
    assert.deepEqual(original, orderBefore);
    assert.notEqual(sorted, original);
    assert.deepEqual(ids(sorted), ['3', '2', '1']);
  });

  await t.test('result is a new array containing the same object references (no cloning)', () => {
    const a = { _id: 'a', urgency: 'Not urgent' };
    const b = { _id: 'b', urgency: 'Urgent' };
    const input = [a, b];
    const out = sortIssueQueueIndents(input);

    assert.notEqual(out, input);
    assert.equal(out[0], b);
    assert.equal(out[1], a);
    assert.deepEqual(input, [a, b]);
    assert.equal(input[0], a);
  });

  await t.test('parsing and formatting helpers leave frozen indents untouched', () => {
    const indent = deepFreeze({
      _id: '1',
      urgency: 'urgent',
      neededBy: '2026-11-28',
      createdAt: '2026-11-20T10:00:00.000Z',
      remarks: 'Urgency: Normal | Needed by: 01 Dec 2026 (3 days)'
    });
    const snapshot = JSON.stringify(indent);

    assert.equal(normalizeIndentUrgency(indent), 'Urgent');
    assert.equal(formatNeededByDisplay(indent), '28 Nov 2026');
    assert.equal(parseIndentNeededByTimestamp(indent), Date.UTC(2026, 10, 28));
    assert.equal(parseCreatedAtTimestamp(indent.createdAt), Date.UTC(2026, 10, 20, 10));
    assert.equal(JSON.stringify(indent), snapshot);
  });
});
