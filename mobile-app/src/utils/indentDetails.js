/**
 * Helper to parse requisition details from either direct fields
 * (urgency, neededBy, purpose, notes) or from the formatted remarks string:
 * "Urgency: Urgent | Needed by: 25 Nov 2026 | Purpose: ... | Notes: ..."
 */
export function parseIndentDetails(indent) {
  if (!indent) {
    return {
      urgency: 'Normal',
      neededBy: null,
      purpose: null,
      notes: null,
      displayRemarks: ''
    };
  }

  let urgency = indent.urgency || null;
  let neededBy = indent.neededBy || null;
  let purpose = indent.purpose || null;
  let notes = indent.notes || null;
  let customRemarks = [];
  let parsedAnyKey = false;

  if (indent.remarks && typeof indent.remarks === 'string') {
    const parts = indent.remarks.split(' | ');
    for (const part of parts) {
      const colonIdx = part.indexOf(':');
      if (colonIdx !== -1) {
        const key = part.substring(0, colonIdx).trim().toLowerCase();
        const val = part.substring(colonIdx + 1).trim();
        if (key === 'urgency') {
          if (!urgency) urgency = val;
          parsedAnyKey = true;
        } else if (key === 'needed by') {
          if (!neededBy) neededBy = val;
          parsedAnyKey = true;
        } else if (key === 'purpose') {
          if (!purpose) purpose = val;
          parsedAnyKey = true;
        } else if (key === 'notes') {
          if (!notes) notes = val;
          parsedAnyKey = true;
        } else {
          customRemarks.push(part.trim());
        }
      } else {
        customRemarks.push(part.trim());
      }
    }
  }

  return {
    urgency: urgency || 'Normal',
    neededBy: neededBy || null,
    purpose: purpose || null,
    notes: notes || null,
    displayRemarks: customRemarks.join(' | ') || (!parsedAnyKey ? (indent.remarks || '') : '')
  };
}
