import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { parseIndentDetails } from '../utils/indentDetails';

/**
 * Formats a date string or Date object to "24 Nov 2026, 10:10 AM".
 */
export function formatTimelineDate(dateValue) {
  if (!dateValue) return null;
  const d = new Date(dateValue);
  if (isNaN(d.getTime())) return null;

  const dateStr = d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
  const timeStr = d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
  return `${dateStr}, ${timeStr}`;
}

/**
 * Sanitizes a person field. If populated as an object, extracts name or staffId.
 * If raw database ID (Mongo ObjectId or memory id), displays a friendly role title instead.
 */
function formatPersonName(person, fallbackRole = 'Staff') {
  if (!person) return fallbackRole;
  if (typeof person === 'object') {
    if (person.name) return person.name;
    if (person.staffId) return `${fallbackRole} (${person.staffId})`;
    return fallbackRole;
  }
  if (typeof person === 'string') {
    // Check if it's an ObjectId or memory id (e.g., u001, 674582f3...)
    if (/^[0-9a-fA-F]{24}$/.test(person) || /^u\d+$/.test(person) || /^[0-9a-fA-F-]{36}$/.test(person)) {
      return fallbackRole;
    }
    return person;
  }
  return fallbackRole;
}

/**
 * Extracts rejection reason if present from indent record or parsed remarks.
 */
function extractRejectionReason(indent) {
  if (indent.rejectionReason) return indent.rejectionReason;
  const parsed = parseIndentDetails(indent);
  if (parsed.displayRemarks) return parsed.displayRemarks;
  if (indent.remarks && typeof indent.remarks === 'string') {
    if (!indent.remarks.includes('Urgency:')) {
      return indent.remarks;
    }
  }
  return 'Declined by Department Head';
}

/**
 * Generates the step states based on indent status and dates:
 * - REQUESTED: HOD decision is current, Issued is pending.
 * - APPROVED: HOD decision is done, Issued is current.
 * - REJECTED: HOD decision is rejected (red), ends after HOD step.
 * - ISSUED: All steps done.
 * - CANCELLED: Final step shows as Cancelled in red.
 */
function buildTimelineSteps(indent) {
  const steps = [];
  const status = indent.status?.toUpperCase() || 'REQUESTED';
  const requesterName = formatPersonName(indent.requester, 'Requester');
  const confirmMethod = indent.confirmation?.method === 'pin' ? 'PIN / Passcode' : 'Biometric Fingerprint';

  // 1. Requested Step (Always completed)
  steps.push({
    key: 'requested',
    title: 'Requisition Submitted',
    state: 'done',
    timestamp: formatTimelineDate(indent.confirmation?.at || indent.createdAt),
    who: `Submitted by ${requesterName}`,
    subtext: `Digitally signed via ${confirmMethod}`
  });

  // 2. HOD Decision Step
  if (status === 'REJECTED') {
    const approverName = formatPersonName(indent.approvedBy, 'Department Head');
    const reason = extractRejectionReason(indent);
    steps.push({
      key: 'hod',
      title: 'HOD Decision: Rejected',
      state: 'rejected',
      timestamp: formatTimelineDate(indent.updatedAt || indent.approvedAt),
      who: `Decision by ${approverName}`,
      subtext: `Reason: ${reason}`,
      isRejection: true,
      reason
    });
    // Stops after HOD step when rejected
    return steps;
  }

  const isHodApproved = status === 'APPROVED' || status === 'ISSUED';
  const approverName = formatPersonName(indent.approvedBy, 'Department Head');

  steps.push({
    key: 'hod',
    title: isHodApproved ? 'HOD Decision: Approved' : 'HOD Decision: In Review',
    state: isHodApproved ? 'done' : (status === 'CANCELLED' ? 'pending' : 'current'),
    timestamp: isHodApproved ? formatTimelineDate(indent.approvedAt || indent.updatedAt) : null,
    who: isHodApproved ? `Approved by ${approverName}` : 'Department Head review',
    subtext: isHodApproved ? 'Requisition authorized for store fulfillment' : 'Awaiting HOD verification & quota approval'
  });

  // 3. Issued Step (Store Counter Dispatch)
  if (status !== 'CANCELLED' || isHodApproved) {
    const isIssued = status === 'ISSUED';
    const issuerName = formatPersonName(indent.issuedBy, 'Storekeeper');
    const items = indent.items || [];
    const hasPartial = items.some(it => (it.qtyIssued || 0) < it.qtyRequested);

    steps.push({
      key: 'issued',
      title: isIssued
        ? (hasPartial ? 'Store Dispatch: Partial Issue' : 'Store Dispatch: Full Issue')
        : 'Store Counter Issue',
      state: isIssued ? 'done' : (status === 'APPROVED' ? 'current' : 'pending'),
      timestamp: isIssued ? formatTimelineDate(indent.issuedAt || indent.updatedAt) : null,
      who: isIssued ? `Issued by ${issuerName}` : 'Central Stationery Stores',
      subtext: isIssued
        ? (hasPartial ? 'Partially fulfilled due to available store inventory' : 'Items collected at store counter')
        : (status === 'APPROVED' ? 'Ready for collection at store counter' : 'Pending HOD approval before dispatch'),
      items,
      isIssued,
      hasPartial
    });
  }

  // 4. Cancelled Step (if status is CANCELLED)
  if (status === 'CANCELLED') {
    steps.push({
      key: 'cancelled',
      title: 'Requisition Cancelled',
      state: 'cancelled',
      timestamp: formatTimelineDate(indent.updatedAt),
      who: `Cancelled by ${requesterName}`,
      subtext: 'Requisition was withdrawn and closed'
    });
  }

  return steps;
}

export default function StatusTimeline({ indent }) {
  if (!indent) return null;

  const steps = buildTimelineSteps(indent);

  const getDotStyle = (state) => {
    switch (state) {
      case 'done':
        return styles.dotDone;
      case 'current':
        return styles.dotCurrent;
      case 'rejected':
      case 'cancelled':
        return styles.dotRejected;
      case 'pending':
      default:
        return styles.dotPending;
    }
  };

  const getTitleColor = (state) => {
    switch (state) {
      case 'done':
        return '#4ade80';
      case 'current':
        return '#38bdf8';
      case 'rejected':
      case 'cancelled':
        return '#f87171';
      case 'pending':
      default:
        return '#94a3b8';
    }
  };

  const getDotSymbol = (state) => {
    switch (state) {
      case 'done':
        return '✓';
      case 'current':
        return '●';
      case 'rejected':
      case 'cancelled':
        return '✕';
      case 'pending':
      default:
        return '○';
    }
  };

  return (
    <View style={styles.container}>
      {steps.map((step, idx) => {
        const isLast = idx === steps.length - 1;
        const lineIsDone = step.state === 'done';

        return (
          <View key={step.key} style={styles.stepRow}>
            {/* Left Column: Dot & Vertical Connecting Line */}
            <View style={styles.leftCol}>
              <View style={[styles.dotBase, getDotStyle(step.state)]}>
                <Text style={styles.dotIcon}>{getDotSymbol(step.state)}</Text>
              </View>
              {!isLast && (
                <View
                  style={[
                    styles.verticalLine,
                    lineIsDone ? styles.lineDone : styles.linePending
                  ]}
                />
              )}
            </View>

            {/* Right Column: Step Info */}
            <View style={[styles.rightCol, isLast && styles.rightColLast]}>
              <View style={styles.headerRow}>
                <Text style={[styles.stepTitle, { color: getTitleColor(step.state) }]}>
                  {step.title}
                </Text>
                {step.timestamp ? (
                  <Text style={styles.timestamp}>{step.timestamp}</Text>
                ) : null}
              </View>

              <Text style={styles.whoText}>{step.who}</Text>

              {step.subtext ? (
                <Text style={styles.subtext}>{step.subtext}</Text>
              ) : null}

              {/* Items Breakdown on Issued Step */}
              {step.isIssued && step.items?.length > 0 && (
                <View style={styles.issuedItemsCard}>
                  <View style={styles.issuedSummaryRow}>
                    <Text style={[styles.issuedBadge, step.hasPartial ? styles.badgePartial : styles.badgeFull]}>
                      {step.hasPartial ? '⚠️ Partial Issue' : '✓ Full Issue'}
                    </Text>
                  </View>
                  {step.items.map((it, itemIdx) => {
                    const isShort = (it.qtyIssued || 0) < it.qtyRequested;
                    return (
                      <View key={itemIdx} style={styles.issuedItemLine}>
                        <Text style={styles.itemName}>&bull; {it.nameSnapshot}:</Text>
                        <Text style={[styles.itemQty, isShort && styles.itemQtyShort]}>
                          {it.qtyIssued || 0} / {it.qtyRequested} {it.unit}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              )}

              {/* Rejection Reason Box */}
              {step.isRejection && step.reason && (
                <View style={styles.rejectionBox}>
                  <Text style={styles.rejectionTitle}>Rejection Reason:</Text>
                  <Text style={styles.rejectionText}>{step.reason}</Text>
                </View>
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 8,
    paddingHorizontal: 4
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start'
  },
  leftCol: {
    alignItems: 'center',
    width: 24,
    marginRight: 10
  },
  dotBase: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2
  },
  dotDone: {
    backgroundColor: '#15803d',
    borderWidth: 1,
    borderColor: '#4ade80'
  },
  dotCurrent: {
    backgroundColor: '#0284c7',
    borderWidth: 1,
    borderColor: '#38bdf8'
  },
  dotPending: {
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#475569'
  },
  dotRejected: {
    backgroundColor: '#991b1b',
    borderWidth: 1,
    borderColor: '#ef4444'
  },
  dotIcon: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700'
  },
  verticalLine: {
    width: 2,
    flex: 1,
    minHeight: 28,
    marginTop: 2,
    marginBottom: 2
  },
  lineDone: {
    backgroundColor: '#15803d'
  },
  linePending: {
    backgroundColor: '#334155'
  },
  rightCol: {
    flex: 1,
    paddingBottom: 16
  },
  rightColLast: {
    paddingBottom: 4
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4
  },
  stepTitle: {
    fontSize: 13,
    fontWeight: '700'
  },
  timestamp: {
    fontSize: 11,
    color: '#64748b'
  },
  whoText: {
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2
  },
  subtext: {
    color: '#94a3b8',
    fontSize: 11,
    marginTop: 2,
    lineHeight: 15
  },
  issuedItemsCard: {
    backgroundColor: '#0f172a',
    borderRadius: 6,
    padding: 8,
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#1e293b'
  },
  issuedSummaryRow: {
    marginBottom: 4
  },
  issuedBadge: {
    fontSize: 10,
    fontWeight: '700',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start'
  },
  badgeFull: {
    backgroundColor: '#052e16',
    color: '#4ade80'
  },
  badgePartial: {
    backgroundColor: '#451a03',
    color: '#fbbf24'
  },
  issuedItemLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 1
  },
  itemName: {
    color: '#94a3b8',
    fontSize: 11
  },
  itemQty: {
    color: '#cbd5e1',
    fontSize: 11,
    fontWeight: '600'
  },
  itemQtyShort: {
    color: '#fbbf24'
  },
  rejectionBox: {
    backgroundColor: '#450a0a',
    borderRadius: 6,
    padding: 8,
    marginTop: 6,
    borderLeftWidth: 3,
    borderLeftColor: '#ef4444'
  },
  rejectionTitle: {
    color: '#f87171',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase'
  },
  rejectionText: {
    color: '#fca5a5',
    fontSize: 12,
    marginTop: 2
  }
});
