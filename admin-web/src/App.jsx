import React, { useState, useEffect, useRef } from 'react';
import {
  Package,
  ClipboardList,
  AlertTriangle,
  TrendingUp,
  CheckCircle,
  Clock,
  Smartphone,
  ShieldCheck,
  Users,
  FileText,
  Plus,
  Download,
  RefreshCw,
  LogOut,
  Fingerprint,
  Loader2
} from 'lucide-react';
import LoginPage from './components/LoginPage';
import IssueQueue from './components/IssueQueue';
import {
  isAllowedDashboardRole,
  getAllowedTabIds,
  getDefaultTabId,
  resolveTabForUrl,
  UNAUTHORIZED_MESSAGE
} from './utils/authAccess';
import { getDeviceActionKey, updateDeviceApproval } from './utils/deviceApi';
import {
  normalizeIndentUrgency,
  getUrgencyBadgeStyle,
  formatNeededByDisplay,
  sortIssueQueueIndents
} from './utils/indentQueue';

export default function App() {
  const [authChecked, setAuthChecked] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [authError, setAuthError] = useState('');
  const [activeTab, setActiveTab] = useState('dashboard');

  const [items, setItems] = useState([]);
  const [indents, setIndents] = useState([]);
  const [lowStock, setLowStock] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [usersList, setUsersList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [pendingDeviceKeys, setPendingDeviceKeys] = useState({});
  const inFlightDeviceKeysRef = useRef(new Set());

  // Form states
  const [newItemModal, setNewItemModal] = useState(false);
  const [newItem, setNewItem] = useState({ name: '', code: '', category: 'Writing', unit: 'box', stock: 20, reorderLevel: 5, maxPerIndent: 5 });
  const [newUserModal, setNewUserModal] = useState(false);
  const [newUser, setNewUser] = useState({ staffId: '', name: '', department: 'Computer Science', role: 'faculty', email: '', phone: '' });
  const [stockInForm, setStockInForm] = useState({ itemId: '', quantity: 10, reference: 'INV-2026-901', supplier: 'Central Stationery Depot' });
  const [searchFilter, setSearchFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const API_BASE = '/api';

  const showNotification = (msg, type = 'success') => {
    setFeedback({ msg, type });
    setTimeout(() => setFeedback(null), 4500);
  };

  const getAuthHeaders = () => {
    if (!currentUser?.token) return { 'Content-Type': 'application/json' };
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${currentUser.token}`
    };
  };

  const clearSession = (errorMessage = '') => {
    localStorage.removeItem('stationery_token');
    localStorage.removeItem('stationery_user');
    setCurrentUser(null);
    setAuthError(errorMessage);
    setItems([]);
    setIndents([]);
    setLowStock([]);
    setAuditLogs([]);
    setUsersList([]);
    setPendingDeviceKeys({});
    inFlightDeviceKeysRef.current.clear();
    setActiveTab('dashboard');
    if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
      window.history.replaceState(null, '', '/login');
    }
  };

  // Check stored credentials on mount
  useEffect(() => {
    const verifyStoredSession = async () => {
      const storedToken = localStorage.getItem('stationery_token');
      if (!storedToken) {
        clearSession('');
        setAuthChecked(true);
        return;
      }

      try {
        const res = await fetch(`${API_BASE}/me`, {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${storedToken}`
          }
        });

        if (res.ok) {
          const json = await res.json();
          if (json?.data?.role) {
            if (!isAllowedDashboardRole(json.data.role)) {
              clearSession(UNAUTHORIZED_MESSAGE);
              return;
            }
            const user = { ...json.data, token: storedToken };
            const resolvedTab = resolveTabForUrl(window.location.pathname, user.role);
            setAuthError('');
            setCurrentUser(user);
            setActiveTab(resolvedTab);
            if (resolvedTab && window.location.pathname !== `/${resolvedTab}`) {
              window.history.replaceState(null, '', `/${resolvedTab}`);
            }
          } else {
            clearSession('');
          }
        } else {
          // Token expired or invalid
          clearSession('');
        }
      } catch (err) {
        console.warn('Session verification error:', err.message);
        clearSession('');
      } finally {
        setAuthChecked(true);
      }
    };

    verifyStoredSession();
  }, []);

  // Login handler triggered by LoginPage
  const handleLoginSuccess = ({ token, user }) => {
    if (!isAllowedDashboardRole(user?.role)) {
      clearSession(UNAUTHORIZED_MESSAGE);
      return;
    }

    const userSession = { ...user, token };
    localStorage.setItem('stationery_token', token);
    localStorage.setItem('stationery_user', JSON.stringify(user));
    const resolvedTab = resolveTabForUrl(window.location.pathname, user.role);
    setAuthError('');
    setCurrentUser(userSession);
    setActiveTab(resolvedTab);
    if (resolvedTab && window.location.pathname !== `/${resolvedTab}`) {
      window.history.replaceState(null, '', `/${resolvedTab}`);
    }
    showNotification(`Welcome, ${user.name} (${user.role.toUpperCase()})`);
  };

  // Logout handler
  const handleLogout = () => {
    clearSession('');
  };

  const navigateToTab = (tabId) => {
    const allowed = getAllowedTabIds(currentUser?.role);
    if (!allowed.includes(tabId)) {
      const fallback = getDefaultTabId(currentUser?.role);
      if (fallback) {
        setActiveTab(fallback);
        if (window.location.pathname !== `/${fallback}`) {
          window.history.replaceState(null, '', `/${fallback}`);
        }
      }
      return;
    }
    setActiveTab(tabId);
    if (window.location.pathname !== `/${tabId}`) {
      window.history.pushState(null, '', `/${tabId}`);
    }
  };

  // Safe fetch wrapper that handles 401 unauthenticated responses
  const authFetch = async (url, options = {}) => {
    const headers = { ...getAuthHeaders(), ...(options.headers || {}) };
    const res = await fetch(url, { ...options, headers });
    if (res.status === 401) {
      handleLogout();
      showNotification('Session expired. Please log in again.', 'error');
      throw new Error('Unauthorized');
    }
    return res;
  };

  // Fetch data according to authenticated user role
  const fetchData = async () => {
    if (!currentUser?.token) return;
    setLoading(true);

    try {
      const userRole = (currentUser.role || '').toLowerCase();

      // 1. Fetch stationery items (all authenticated users can view the catalog)
      const itemsRes = await authFetch(`${API_BASE}/items`);
      if (itemsRes.ok) {
        const data = await itemsRes.json();
        setItems(data.data || []);
      }

      // 2. Fetch indents based on role permissions
      if (['storekeeper', 'admin'].includes(userRole)) {
        const indentsRes = await authFetch(`${API_BASE}/indents`);
        if (indentsRes.ok) {
          const data = await indentsRes.json();
          setIndents(data.data || []);
        }
      }

      // 3. Fetch low stock & reports (Storekeeper and Admin only)
      if (['storekeeper', 'admin'].includes(userRole)) {
        const lowStockRes = await authFetch(`${API_BASE}/reports/low-stock`);
        if (lowStockRes.ok) {
          const data = await lowStockRes.json();
          setLowStock(data.data || []);
        }
      }

      // 4. Fetch audit logs and users list (Admin only)
      if (userRole === 'admin') {
        const auditRes = await authFetch(`${API_BASE}/audit`);
        if (auditRes.ok) {
          const data = await auditRes.json();
          setAuditLogs(data.data || []);
        }

        const usersRes = await authFetch(`${API_BASE}/users`);
        if (usersRes.ok) {
          const data = await usersRes.json();
          setUsersList(data.data || []);
        }
      }
    } catch (err) {
      if (err.message !== 'Unauthorized') {
        console.warn('Backend sync warning:', err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  // Sync data whenever currentUser changes
  useEffect(() => {
    if (currentUser?.token) {
      fetchData();
    }
  }, [currentUser]);

  // Ensure activeTab is valid for currentUser role and handle browser back/forward
  useEffect(() => {
    if (!authChecked) return;

    if (!currentUser || !isAllowedDashboardRole(currentUser.role)) {
      if (window.location.pathname !== '/login') {
        window.history.replaceState(null, '', '/login');
      }
      return;
    }

    const allowed = getAllowedTabIds(currentUser.role);
    if (!allowed.includes(activeTab)) {
      const fallback = getDefaultTabId(currentUser.role);
      setActiveTab(fallback);
      if (fallback && window.location.pathname !== `/${fallback}`) {
        window.history.replaceState(null, '', `/${fallback}`);
      }
    }

    const handlePopState = () => {
      if (!currentUser || !isAllowedDashboardRole(currentUser.role)) {
        window.history.replaceState(null, '', '/login');
        return;
      }
      const nextTab = resolveTabForUrl(window.location.pathname, currentUser.role);
      if (nextTab) {
        setActiveTab(nextTab);
        if (window.location.pathname !== `/${nextTab}`) {
          window.history.replaceState(null, '', `/${nextTab}`);
        }
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [authChecked, currentUser, activeTab]);

  // Issue Indent action (Storekeeper / Admin)
  const handleIssueIndent = async (indentId, indentNo) => {
    setLoading(true);
    try {
      const res = await authFetch(`${API_BASE}/indents/${indentId}/issue`, {
        method: 'PATCH',
        body: JSON.stringify({ remarks: 'Issued at Central Stationery Counter' })
      });
      const json = await res.json();
      if (res.ok) {
        showNotification(`Indent ${indentNo} issued successfully. Stock updated!`);
        fetchData();
      } else {
        showNotification(json.message || 'Issue failed', 'error');
      }
    } catch (err) {
      if (err.message !== 'Unauthorized') {
        showNotification('Error issuing indent: ' + err.message, 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  // Stock-In action (Storekeeper / Admin)
  const handleStockInSubmit = async (e) => {
    e.preventDefault();
    if (!stockInForm.itemId) {
      showNotification('Please select an item', 'error');
      return;
    }
    setLoading(true);
    try {
      const res = await authFetch(`${API_BASE}/stock/in`, {
        method: 'POST',
        body: JSON.stringify(stockInForm)
      });
      const json = await res.json();
      if (res.ok) {
        showNotification(`Stock added: +${stockInForm.quantity} units to inventory!`);
        setStockInForm({ itemId: '', quantity: 10, reference: 'INV-2026-902', supplier: 'Central Stationery Depot' });
        fetchData();
        navigateToTab('items');
      } else {
        showNotification(json.message || 'Stock-in failed', 'error');
      }
    } catch (err) {
      if (err.message !== 'Unauthorized') {
        showNotification('Stock-in error: ' + err.message, 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  // Add Item action (Storekeeper / Admin)
  const handleCreateItemSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await authFetch(`${API_BASE}/items`, {
        method: 'POST',
        body: JSON.stringify(newItem)
      });
      const json = await res.json();
      if (res.ok) {
        showNotification(`New item '${newItem.name}' added to catalog!`);
        setNewItemModal(false);
        setNewItem({ name: '', code: '', category: 'Writing', unit: 'box', stock: 20, reorderLevel: 5, maxPerIndent: 5 });
        fetchData();
      } else {
        showNotification(json.message || 'Could not create item', 'error');
      }
    } catch (err) {
      if (err.message !== 'Unauthorized') {
        showNotification('Item creation error: ' + err.message, 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  // Download CSV with JWT Authorization header
  const handleDownloadCsv = async () => {
    setLoading(true);
    try {
      const res = await authFetch(`${API_BASE}/reports/export.csv`);
      if (!res.ok) {
        showNotification('Failed to download CSV report', 'error');
        return;
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `stationery_indents_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      showNotification('Indent register exported to CSV');
    } catch (err) {
      if (err.message !== 'Unauthorized') {
        showNotification('Export error: ' + err.message, 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  // Device approval toggle (Admin only)
  const handleToggleDeviceApproval = async (userId, deviceId, currentStatus) => {
    if (!currentUser || currentUser.role?.toLowerCase() !== 'admin') {
      showNotification('Only administrators can approve or revoke devices.', 'error');
      return;
    }

    const actionKey = getDeviceActionKey(userId, deviceId);
    if (inFlightDeviceKeysRef.current.has(actionKey)) {
      return;
    }

    setPendingDeviceKeys(prev => ({ ...prev, [actionKey]: true }));
    try {
      const result = await updateDeviceApproval({
        apiBase: API_BASE,
        fetchFn: authFetch,
        currentUserRole: currentUser.role,
        userId,
        deviceId,
        approved: !currentStatus,
        inFlightKeys: inFlightDeviceKeysRef.current
      });

      if (result.skipped) return;

      setUsersList(prev =>
        prev.map(u => {
          if (u._id !== userId) return u;
          return {
            ...u,
            devices: (u.devices || []).map(d =>
              d.deviceId === deviceId ? { ...d, ...result.device } : d
            )
          };
        })
      );

      showNotification(result.message);
      fetchData();
    } catch (err) {
      if (err.message !== 'Unauthorized') {
        showNotification('Error updating device: ' + err.message, 'error');
      }
    } finally {
      setPendingDeviceKeys(prev => {
        const next = { ...prev };
        delete next[actionKey];
        return next;
      });
    }
  };

  // Reset password (Admin)
  const handleResetUserPassword = async (userId, userName) => {
    if (!window.confirm(`Reset password for ${userName} to default ('Password@123')?`)) return;
    setLoading(true);
    try {
      const res = await authFetch(`${API_BASE}/users/${userId}/reset-password`, {
        method: 'POST',
        body: JSON.stringify({ tempPassword: 'Password@123' })
      });
      const json = await res.json();
      if (res.ok) {
        showNotification(json.data?.message || `Password reset for ${userName}`);
      } else {
        showNotification(json.message || 'Password reset failed', 'error');
      }
    } catch (err) {
      if (err.message !== 'Unauthorized') {
        showNotification('Error resetting password: ' + err.message, 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  // Create User submit (Admin)
  const handleCreateUserSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await authFetch(`${API_BASE}/users`, {
        method: 'POST',
        body: JSON.stringify(newUser)
      });
      const json = await res.json();
      if (res.ok) {
        showNotification(`User '${newUser.name}' (${newUser.staffId}) created successfully!`);
        setNewUserModal(false);
        setNewUser({ staffId: '', name: '', department: 'Computer Science', role: 'faculty', email: '', phone: '' });
        fetchData();
      } else {
        showNotification(json.message || 'Could not create user', 'error');
      }
    } catch (err) {
      if (err.message !== 'Unauthorized') {
        showNotification('User creation error: ' + err.message, 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  // If session is still being checked from localStorage, show spinner
  if (!authChecked) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#0f172a', color: '#f8fafc' }}>
        <Loader2 size={40} className="animate-spin" color="#38bdf8" />
        <div style={{ marginTop: 16, fontSize: 15, fontWeight: 500, color: '#94a3b8' }}>
          Initializing Stationery Indent System...
        </div>
      </div>
    );
  }

  // If user is not authenticated or not an allowed dashboard role, render dedicated Login Page
  if (!currentUser || !isAllowedDashboardRole(currentUser.role)) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} initialError={authError} />;
  }

  // Computed state
  const role = (currentUser.role || '').toLowerCase();
  const allowedTabs = getAllowedTabIds(role);

  // Storekeeper counter queue: indents requested or approved waiting to be issued (sorted by urgency & neededBy)
  const pendingCounterIndents = sortIssueQueueIndents(
    indents.filter(i => i.status === 'REQUESTED' || i.status === 'APPROVED')
  );

  // Indents to display in Requisition History
  const filteredIndents = indents.filter(i => {
    if (statusFilter !== 'ALL' && i.status !== statusFilter) return false;
    if (searchFilter && !i.indentNo.toLowerCase().includes(searchFilter.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="app-container">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-title">Stationery Indent</div>
          <div className="sidebar-subtitle">Institutional Management System</div>
        </div>

        <ul className="nav-links">
          {/* Issue Queue: Storekeeper, Admin */}
          {allowedTabs.includes('queue') && (
            <li className={`nav-item ${activeTab === 'queue' ? 'active' : ''}`} onClick={() => navigateToTab('queue')}>
              <ClipboardList size={18} />
              <span>Issue Queue</span>
              {pendingCounterIndents.length > 0 && (
                <span style={{ marginLeft: 'auto', background: '#ef4444', color: '#fff', padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 700 }}>
                  {pendingCounterIndents.length}
                </span>
              )}
            </li>
          )}

          {/* Store Summary: Storekeeper, Admin */}
          {allowedTabs.includes('dashboard') && (
            <li className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => navigateToTab('dashboard')}>
              <TrendingUp size={18} />
              <span>Store Summary</span>
            </li>
          )}

          {/* Item Inventory / Catalog: Storekeeper, Admin */}
          {allowedTabs.includes('items') && (
            <li className={`nav-item ${activeTab === 'items' ? 'active' : ''}`} onClick={() => navigateToTab('items')}>
              <Package size={18} />
              <span>Item Inventory</span>
            </li>
          )}

          {/* Stock-In: Storekeeper, Admin */}
          {allowedTabs.includes('stockin') && (
            <li className={`nav-item ${activeTab === 'stockin' ? 'active' : ''}`} onClick={() => navigateToTab('stockin')}>
              <Plus size={18} />
              <span>Stock-In (Receive)</span>
            </li>
          )}

          {/* Requisition History: Storekeeper, Admin */}
          {allowedTabs.includes('history') && (
            <li className={`nav-item ${activeTab === 'history' ? 'active' : ''}`} onClick={() => navigateToTab('history')}>
              <FileText size={18} />
              <span>Requisition History</span>
            </li>
          )}

          {/* Low Stock & Reports: Storekeeper, Admin */}
          {allowedTabs.includes('reports') && (
            <li className={`nav-item ${activeTab === 'reports' ? 'active' : ''}`} onClick={() => navigateToTab('reports')}>
              <AlertTriangle size={18} />
              <span>Low Stock & Reports</span>
              {lowStock.length > 0 && (
                <span style={{ marginLeft: 'auto', background: '#f59e0b', color: '#000', padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 700 }}>
                  {lowStock.length}
                </span>
              )}
            </li>
          )}

          {/* Staff & Devices: Admin only */}
          {allowedTabs.includes('users') && (
            <li className={`nav-item ${activeTab === 'users' ? 'active' : ''}`} onClick={() => navigateToTab('users')}>
              <Users size={18} />
              <span>Staff & Devices</span>
            </li>
          )}

          {/* Audit Trail: Admin only */}
          {allowedTabs.includes('audit') && (
            <li className={`nav-item ${activeTab === 'audit' ? 'active' : ''}`} onClick={() => navigateToTab('audit')}>
              <ShieldCheck size={18} />
              <span>Audit Trail</span>
            </li>
          )}
        </ul>

        {/* User Identity & Logout Section (No demo role switching) */}
        <div className="user-profile-badge">
          <div className="user-info">
            <div className="user-name">{currentUser.name}</div>
            <div className="user-meta">
              <span>{currentUser.department}</span>
              <span>&bull;</span>
              <span>ID: {currentUser.staffId}</span>
            </div>
            <div style={{ marginTop: 6 }}>
              <span className={`user-role-badge role-${role}`}>
                {currentUser.role.toUpperCase()}
              </span>
            </div>
          </div>

          <button
            type="button"
            className="logout-btn"
            onClick={handleLogout}
            title="Sign out of your account"
          >
            <LogOut size={15} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        <header className="top-bar">
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700 }}>
              {activeTab === 'queue' && 'Counter Issue Queue'}
              {activeTab === 'dashboard' && 'Store Management Overview'}
              {activeTab === 'items' && 'Stationery Item Catalog'}
              {activeTab === 'stockin' && 'Goods Receipt (Stock-In)'}
              {activeTab === 'history' && 'Indent Register & History'}
              {activeTab === 'reports' && 'Inventory Analytics & Low Stock Reports'}
              {activeTab === 'users' && 'Staff Accounts & Device Security'}
              {activeTab === 'audit' && 'Security Audit Log'}
            </h1>
          </div>

          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            {feedback && (
              <div style={{
                padding: '6px 14px',
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 600,
                background: feedback.type === 'error' ? '#fee2e2' : '#dcfce7',
                color: feedback.type === 'error' ? '#991b1b' : '#166534',
                border: feedback.type === 'error' ? '1px solid #f87171' : '1px solid #86efac'
              }}>
                {feedback.msg}
              </div>
            )}

            <button onClick={fetchData} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              <span>Refresh</span>
            </button>
          </div>
        </header>

        <div className="page-body">
          {/* TAB: ISSUE QUEUE (Storekeeper & Admin) */}
          {activeTab === 'queue' && (
            <IssueQueue
              pendingCounterIndents={pendingCounterIndents}
              lowStockCount={lowStock.length}
              totalIndentsCount={indents.length}
              onIssueIndent={handleIssueIndent}
            />
          )}

          {/* TAB: STORE SUMMARY (Storekeeper & Admin) */}
          {activeTab === 'dashboard' && (
            <div>
              <div className="stat-grid">
                <div className="stat-box">
                  <div>
                    <div className="stat-label">Active Stationery Items</div>
                    <div className="stat-num">{items.length}</div>
                  </div>
                  <Package size={36} color="#2563eb" />
                </div>
                <div className="stat-box">
                  <div>
                    <div className="stat-label">Requisitions Issued</div>
                    <div className="stat-num">{indents.filter(i => i.status === 'ISSUED').length}</div>
                  </div>
                  <CheckCircle size={36} color="#16a34a" />
                </div>
                <div className="stat-box">
                  <div>
                    <div className="stat-label">Critical / Low Stock Items</div>
                    <div className="stat-num" style={{ color: '#dc2626' }}>{lowStock.length}</div>
                  </div>
                  <AlertTriangle size={36} color="#dc2626" />
                </div>
              </div>

              <div className="card">
                <div className="card-header">
                  <div className="card-title">Recent System Transactions</div>
                </div>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Indent / Reference</th>
                      <th>Department</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {indents.slice(0, 6).map(ind => (
                      <tr key={ind._id}>
                        <td>{new Date(ind.createdAt).toLocaleString()}</td>
                        <td><strong>{ind.indentNo}</strong></td>
                        <td>{ind.department}</td>
                        <td>
                          <span className={`badge badge-${ind.status.toLowerCase()}`}>{ind.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB: ITEMS INVENTORY / CATALOG (All roles) */}
          {activeTab === 'items' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                <div style={{ display: 'flex', gap: 10 }}>
                  <input
                    type="text"
                    placeholder="Search stationery by name or code..."
                    value={searchFilter}
                    onChange={e => setSearchFilter(e.target.value)}
                    style={{ width: 320 }}
                  />
                </div>
                {['storekeeper', 'admin'].includes(role) && (
                  <button
                    onClick={() => setNewItemModal(true)}
                    className="btn-primary"
                    style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Plus size={16} />
                    <span>Add New Item</span>
                  </button>
                )}
              </div>

              <div className="card">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Item Code</th>
                      <th>Item Name</th>
                      <th>Category</th>
                      <th>Current Stock</th>
                      {['storekeeper', 'admin'].includes(role) && <th>Reorder Level</th>}
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.filter(i => !searchFilter || i.name.toLowerCase().includes(searchFilter.toLowerCase()) || i.code.toLowerCase().includes(searchFilter.toLowerCase())).map(item => (
                      <tr key={item._id}>
                        <td><code>{item.code || 'N/A'}</code></td>
                        <td><strong>{item.name}</strong></td>
                        <td>{item.category}</td>
                        <td>
                          <span style={{ fontSize: 16, fontWeight: 700, color: item.stock <= item.reorderLevel ? '#dc2626' : '#0f172a' }}>
                            {item.stock} {item.unit}
                          </span>
                        </td>
                        {['storekeeper', 'admin'].includes(role) && (
                          <td>{item.reorderLevel} {item.unit}</td>
                        )}
                        <td>
                          {item.stock <= item.reorderLevel ? (
                            <span className="badge badge-low-stock">Low Stock Alert</span>
                          ) : (
                            <span className="badge badge-in-stock">Available</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB: STOCK-IN (Storekeeper & Admin) */}
          {activeTab === 'stockin' && (
            <div style={{ maxWidth: 640, margin: '0 auto' }}>
              <div className="card">
                <div className="card-header">
                  <div className="card-title">Receive Goods (Stock-In Entry)</div>
                </div>
                <form onSubmit={handleStockInSubmit} style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Select Item</label>
                    <select
                      value={stockInForm.itemId}
                      onChange={e => setStockInForm({ ...stockInForm, itemId: e.target.value })}
                      style={{ width: '100%' }}
                      required>
                      <option value="">-- Choose Item from Inventory --</option>
                      {items.map(it => (
                        <option key={it._id} value={it._id}>
                          {it.name} (Current Stock: {it.stock} {it.unit})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Quantity Received</label>
                    <input
                      type="number"
                      min="1"
                      value={stockInForm.quantity}
                      onChange={e => setStockInForm({ ...stockInForm, quantity: Number(e.target.value) })}
                      style={{ width: '100%' }}
                      required
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Invoice / Challan Reference #</label>
                    <input
                      type="text"
                      value={stockInForm.reference}
                      onChange={e => setStockInForm({ ...stockInForm, reference: e.target.value })}
                      style={{ width: '100%' }}
                      required
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Supplier Name</label>
                    <input
                      type="text"
                      value={stockInForm.supplier}
                      onChange={e => setStockInForm({ ...stockInForm, supplier: e.target.value })}
                      style={{ width: '100%' }}
                    />
                  </div>

                  <button type="submit" className="btn-primary" style={{ marginTop: 8, padding: 12 }}>
                    Record Stock In & Update Ledger
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* TAB: REQUISITION HISTORY (Storekeeper & Admin) */}
          {activeTab === 'history' && (
            <div>
              <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                <input
                  type="text"
                  placeholder="Filter by Indent #..."
                  value={searchFilter}
                  onChange={e => setSearchFilter(e.target.value)}
                  style={{ width: 260 }}
                />
                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                  <option value="ALL">All Statuses</option>
                  <option value="REQUESTED">REQUESTED</option>
                  <option value="APPROVED">APPROVED</option>
                  <option value="ISSUED">ISSUED</option>
                  <option value="REJECTED">REJECTED</option>
                  <option value="CANCELLED">CANCELLED</option>
                </select>
              </div>

              <div className="card">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Indent #</th>
                      <th>Requester</th>
                      <th>Department</th>
                      <th>Date / Time</th>
                      <th>Status</th>
                      <th>Items Handled</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredIndents.map(ind => (
                      <tr key={ind._id}>
                        <td><strong>{ind.indentNo}</strong></td>
                        <td>{ind.requester?.name || 'Staff Member'}</td>
                        <td>{ind.department}</td>
                        <td>{new Date(ind.createdAt).toLocaleString()}</td>
                        <td>
                          <span className={`badge badge-${ind.status.toLowerCase()}`}>{ind.status}</span>
                        </td>
                        <td>
                          {ind.items.map((it, idx) => (
                            <span key={idx} style={{ display: 'inline-block', marginRight: 8, background: '#f1f5f9', padding: '2px 6px', borderRadius: 4, fontSize: 12 }}>
                              {it.qtyRequested}x {it.nameSnapshot}
                            </span>
                          ))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB: REPORTS & LOW STOCK (Storekeeper & Admin) */}
          {activeTab === 'reports' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
                <div>
                  <h3 style={{ fontSize: 18 }}>Low Stock Threshold Alerts</h3>
                  <p style={{ fontSize: 13, color: '#64748b' }}>Items at or below defined college reorder minimums</p>
                </div>
                <button onClick={handleDownloadCsv} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Download size={14} />
                  <span>Download Indent Register (CSV)</span>
                </button>
              </div>

              <div className="card">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Item Code</th>
                      <th>Item Name</th>
                      <th>Remaining Quantity</th>
                      <th>Reorder Level</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lowStock.map(it => (
                      <tr key={it._id}>
                        <td><code>{it.code}</code></td>
                        <td><strong>{it.name}</strong></td>
                        <td style={{ color: '#dc2626', fontWeight: 700, fontSize: 16 }}>{it.stock} {it.unit}</td>
                        <td>{it.reorderLevel} {it.unit}</td>
                        <td><span className="badge badge-low-stock">Urgent Reorder</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB: USERS & DEVICE SECURITY (Admin only) */}
          {activeTab === 'users' && role === 'admin' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div>
                  <h3 style={{ fontSize: 18 }}>Staff Accounts & Registered Devices</h3>
                  <p style={{ fontSize: 13, color: '#64748b' }}>Manage user roles and approve mobile biometric hardware tokens</p>
                </div>
                <button
                  onClick={() => setNewUserModal(true)}
                  className="btn-primary"
                  style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Plus size={16} />
                  <span>Add Staff Member</span>
                </button>
              </div>

              <div className="card">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Staff ID</th>
                      <th>Name / Dept</th>
                      <th>Role</th>
                      <th>Status</th>
                      <th>Registered Devices & Biometrics</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usersList.map(u => (
                      <tr key={u._id}>
                        <td><code>{u.staffId}</code></td>
                        <td>
                          <strong>{u.name}</strong>
                          <div style={{ fontSize: 12, color: '#64748b' }}>{u.department} {u.email ? `• ${u.email}` : ''}</div>
                        </td>
                        <td>
                          <span style={{ textTransform: 'uppercase', fontSize: 12, fontWeight: 700, color: '#2563eb' }}>
                            {u.role}
                          </span>
                        </td>
                        <td>
                          <span className={`badge ${u.active ? 'badge-issued' : 'badge-cancelled'}`}>
                            {u.active ? 'Active' : 'Deactivated'}
                          </span>
                        </td>
                        <td>
                          {(!u.devices || u.devices.length === 0) ? (
                            <span style={{ fontSize: 12, color: '#94a3b8', fontStyle: 'italic' }}>No devices registered</span>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                              {u.devices.map((d, dIdx) => {
                                const actionKey = getDeviceActionKey(u._id, d.deviceId);
                                const isUpdating = Boolean(pendingDeviceKeys[actionKey]);
                                return (
                                  <div key={d.deviceId || dIdx} style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f8fafc', padding: '4px 8px', borderRadius: 4, border: '1px solid #e2e8f0' }}>
                                    <Smartphone size={14} color="#64748b" />
                                    <span style={{ fontSize: 12, fontWeight: 600 }}>{d.label || d.deviceId}</span>
                                    <span className={`badge ${d.approved ? 'badge-issued' : 'badge-requested'}`} style={{ fontSize: 10 }}>
                                      {d.approved ? 'Approved' : 'Pending Approval'}
                                    </span>
                                    {role === 'admin' && (
                                      <button
                                        type="button"
                                        disabled={isUpdating}
                                        onClick={() => handleToggleDeviceApproval(u._id, d.deviceId, Boolean(d.approved))}
                                        style={{
                                          fontSize: 11,
                                          padding: '2px 8px',
                                          background: d.approved ? '#fee2e2' : '#dcfce7',
                                          color: d.approved ? '#991b1b' : '#166534',
                                          marginLeft: 'auto',
                                          opacity: isUpdating ? 0.6 : 1,
                                          cursor: isUpdating ? 'not-allowed' : 'pointer'
                                        }}>
                                        {isUpdating
                                          ? (d.approved ? 'Revoking...' : 'Approving...')
                                          : (d.approved ? 'Revoke' : 'Approve')}
                                      </button>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </td>
                        <td>
                          <button
                            onClick={() => handleResetUserPassword(u._id, u.name)}
                            className="btn-secondary"
                            style={{ fontSize: 12, padding: '4px 10px' }}>
                            Reset Password
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB: AUDIT LOG (Admin only) */}
          {activeTab === 'audit' && role === 'admin' && (
            <div>
              <div className="card">
                <div className="card-header">
                  <div className="card-title">Immutable Security & Transaction Trail</div>
                </div>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Timestamp</th>
                      <th>Action</th>
                      <th>Actor</th>
                      <th>IP / Device</th>
                      <th>Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditLogs.map(l => (
                      <tr key={l._id}>
                        <td style={{ fontSize: 12, color: '#64748b' }}>{new Date(l.at).toLocaleString()}</td>
                        <td><code>{l.action}</code></td>
                        <td><strong>{l.actor?.name || l.actor || 'System'}</strong></td>
                        <td style={{ fontSize: 12 }}>{l.ip || '127.0.0.1'} ({l.deviceId || 'Counter Client'})</td>
                        <td style={{ fontSize: 12 }}><code>{JSON.stringify(l.details)}</code></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      </main>

      {/* Modal: Add New Item */}
      {newItemModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', width: 440, borderRadius: 8, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between' }}>
              <h3 style={{ fontSize: 16 }}>Add New Stationery Item</h3>
              <button onClick={() => setNewItemModal(false)} style={{ background: 'none', fontSize: 16 }}>&times;</button>
            </div>
            <form onSubmit={handleCreateItemSubmit} style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Item Name</label>
                <input
                  type="text"
                  value={newItem.name}
                  onChange={e => setNewItem({ ...newItem, name: e.target.value })}
                  placeholder="e.g. Spiral Notebook 200 Pages"
                  style={{ width: '100%' }}
                  required
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Item Code</label>
                  <input
                    type="text"
                    value={newItem.code}
                    onChange={e => setNewItem({ ...newItem, code: e.target.value })}
                    placeholder="e.g. NOT-SPR-200"
                    style={{ width: '100%' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Unit</label>
                  <input
                    type="text"
                    value={newItem.unit}
                    onChange={e => setNewItem({ ...newItem, unit: e.target.value })}
                    placeholder="piece / box / ream"
                    style={{ width: '100%' }}
                    required
                  />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Opening Stock</label>
                  <input
                    type="number"
                    min="0"
                    value={newItem.stock}
                    onChange={e => setNewItem({ ...newItem, stock: Number(e.target.value) })}
                    style={{ width: '100%' }}
                    required
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Reorder Alert Level</label>
                  <input
                    type="number"
                    min="1"
                    value={newItem.reorderLevel}
                    onChange={e => setNewItem({ ...newItem, reorderLevel: Number(e.target.value) })}
                    style={{ width: '100%' }}
                    required
                  />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                <button type="button" onClick={() => setNewItemModal(false)} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary">Save Item</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add New Staff Member */}
      {newUserModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', width: 460, borderRadius: 8, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between' }}>
              <h3 style={{ fontSize: 16 }}>Register New Staff Member</h3>
              <button onClick={() => setNewUserModal(false)} style={{ background: 'none', fontSize: 16 }}>&times;</button>
            </div>
            <form onSubmit={handleCreateUserSubmit} style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Staff ID</label>
                  <input
                    type="text"
                    value={newUser.staffId}
                    onChange={e => setNewUser({ ...newUser, staffId: e.target.value.toUpperCase() })}
                    placeholder="e.g. FAC103"
                    style={{ width: '100%' }}
                    required
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Role</label>
                  <select
                    value={newUser.role}
                    onChange={e => setNewUser({ ...newUser, role: e.target.value })}
                    style={{ width: '100%' }}>
                    <option value="faculty">Faculty</option>
                    <option value="staff">Staff</option>
                    <option value="hod">HOD</option>
                    <option value="storekeeper">Storekeeper</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Full Name</label>
                <input
                  type="text"
                  value={newUser.name}
                  onChange={e => setNewUser({ ...newUser, name: e.target.value })}
                  placeholder="e.g. Prof. Priya Sharma"
                  style={{ width: '100%' }}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Department</label>
                <input
                  type="text"
                  value={newUser.department}
                  onChange={e => setNewUser({ ...newUser, department: e.target.value })}
                  placeholder="e.g. Computer Science & Engineering"
                  style={{ width: '100%' }}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Email</label>
                  <input
                    type="email"
                    value={newUser.email}
                    onChange={e => setNewUser({ ...newUser, email: e.target.value })}
                    placeholder="priya.s@college.edu"
                    style={{ width: '100%' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Phone</label>
                  <input
                    type="tel"
                    value={newUser.phone}
                    onChange={e => setNewUser({ ...newUser, phone: e.target.value })}
                    placeholder="+91 9876543230"
                    style={{ width: '100%' }}
                  />
                </div>
              </div>

              <div style={{ fontSize: 12, color: '#64748b', background: '#f8fafc', padding: 10, borderRadius: 6, border: '1px solid #e2e8f0' }}>
                Default initial password will be set to: <code>Password@123</code>.
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                <button type="button" onClick={() => setNewUserModal(false)} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary">Create User</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
