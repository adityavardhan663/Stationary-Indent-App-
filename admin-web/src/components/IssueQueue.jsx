import React from 'react';
import {
  Clock,
  AlertTriangle,
  CheckCircle,
  Fingerprint
} from 'lucide-react';
import {
  normalizeIndentUrgency,
  getUrgencyBadgeStyle,
  formatNeededByDisplay
} from '../utils/indentQueue';

export default function IssueQueue({
  pendingCounterIndents = [],
  lowStockCount = 0,
  totalIndentsCount = 0,
  onIssueIndent
}) {
  return (
    <div>
      <div className="stat-grid">
        <div className="stat-box">
          <div>
            <div className="stat-label">Awaiting Issue at Counter</div>
            <div className="stat-num" style={{ color: '#d97706' }}>{pendingCounterIndents.length}</div>
          </div>
          <Clock size={36} color="#f59e0b" />
        </div>
        <div className="stat-box">
          <div>
            <div className="stat-label">Low Stock Alerts</div>
            <div className="stat-num" style={{ color: '#dc2626' }}>{lowStockCount}</div>
          </div>
          <AlertTriangle size={36} color="#ef4444" />
        </div>
        <div className="stat-box">
          <div>
            <div className="stat-label">Total Indents Handled</div>
            <div className="stat-num">{totalIndentsCount}</div>
          </div>
          <CheckCircle size={36} color="#16a34a" />
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">Pending Requisitions for Handover</div>
          <div style={{ fontSize: 13, color: '#64748b' }}>Sorted by urgency &amp; needed-by date &bull; Instant atomic stock subtraction</div>
        </div>

        {pendingCounterIndents.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: '#64748b' }}>
            <CheckCircle size={48} color="#16a34a" style={{ margin: '0 auto 12px' }} />
            <h3>Queue is clear!</h3>
            <p style={{ marginTop: 4 }}>No pending requisitions at the counter right now.</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Indent #</th>
                <th>Urgency &amp; Needed By</th>
                <th>Requester / Dept</th>
                <th>Verification Status</th>
                <th>Items Requested</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {pendingCounterIndents.map(ind => {
                const urgencyLabel = normalizeIndentUrgency(ind);
                const urgencyStyle = getUrgencyBadgeStyle(urgencyLabel);
                const neededByDisplay = formatNeededByDisplay(ind);

                return (
                  <tr key={ind._id}>
                    <td>
                      <strong style={{ fontSize: 15 }}>{ind.indentNo}</strong>
                      <div style={{ fontSize: 12, color: '#64748b' }}>
                        {ind.createdAt ? new Date(ind.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <span
                          className="badge"
                          style={{
                            ...urgencyStyle,
                            width: 'fit-content'
                          }}
                        >
                          {urgencyLabel}
                        </span>
                        <div style={{ fontSize: 12, color: neededByDisplay ? '#0f172a' : '#94a3b8', fontWeight: neededByDisplay ? 600 : 400 }}>
                          {neededByDisplay ? `Needed by: ${neededByDisplay}` : 'No target date'}
                        </div>
                        {ind.neededWithin && (
                          <div style={{ fontSize: 11, color: '#64748b' }}>
                            Within: {ind.neededWithin}
                          </div>
                        )}
                      </div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{ind.requester?.name || 'Staff Member'}</div>
                      <div style={{ fontSize: 12, color: '#64748b' }}>{ind.department} ({ind.requester?.staffId || 'ID'})</div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Fingerprint size={16} color="#16a34a" />
                          <span className="badge badge-issued" style={{ textTransform: 'capitalize' }}>
                            {ind.confirmation?.method || 'biometric'} confirmed
                          </span>
                        </div>
                        {ind.status === 'APPROVED' && (
                          <span className="badge" style={{ background: '#e0f2fe', color: '#0369a1', width: 'fit-content' }}>
                            HOD Approved
                          </span>
                        )}
                        <div style={{ fontSize: 11, color: '#64748b' }}>
                          Device: {ind.confirmation?.deviceId || 'Registered Phone'}
                        </div>
                      </div>
                    </td>
                    <td>
                      <ul style={{ listStyle: 'none', paddingLeft: 0 }}>
                        {(ind.items || []).map((it, idx) => (
                          <li key={idx} style={{ marginBottom: 4 }}>
                            <strong>{it.qtyRequested}x</strong> {it.nameSnapshot} <span style={{ fontSize: 11, color: '#64748b' }}>({it.unit})</span>
                          </li>
                        ))}
                      </ul>
                    </td>
                    <td>
                      <button
                        onClick={() => onIssueIndent && onIssueIndent(ind._id, ind.indentNo)}
                        className="btn-success"
                        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 18px', fontSize: 14 }}>
                        <CheckCircle size={16} />
                        <span>Issue & Deduct Stock</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
