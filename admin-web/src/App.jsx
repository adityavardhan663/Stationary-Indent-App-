import React, { useState, useEffect } from 'react';
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
  Search, 
  Plus, 
  Download, 
  RefreshCw, 
  LogOut,
  Fingerprint,
  Printer
} from 'lucide-react';

export default function App() {
  const [currentUser, setCurrentUser] = useState({
    staffId: 'SK001',
    name: 'Rajesh Kumar',
    role: 'storekeeper',
    department: 'Central Stores',
    token: 'demo-token'
  });

  const [activeTab, setActiveTab] = useState('queue'); // 'dashboard', 'queue', 'items', 'stockin', 'history', 'reports', 'users', 'audit', 'mobile-sim'
  const [items, setItems] = useState([]);
  const [indents, setIndents] = useState([]);
  const [lowStock, setLowStock] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [usersList, setUsersList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState(null);

  // Form states
  const [newItemModal, setNewItemModal] = useState(false);
  const [newItem, setNewItem] = useState({ name: '', code: '', category: 'Writing', unit: 'box', stock: 20, reorderLevel: 5, maxPerIndent: 5 });
  const [stockInForm, setStockInForm] = useState({ itemId: '', quantity: 10, reference: 'INV-2026-901', supplier: 'Central Stationery Depot' });
  const [searchFilter, setSearchFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Mobile Simulator state (for testing faculty flow right inside the browser!)
  const [mobileCart, setMobileCart] = useState([]);
  const [mobileRemarks, setMobileRemarks] = useState('');
  const [mobileSuccessIndent, setMobileSuccessIndent] = useState(null);
  const [biometricScanning, setBiometricScanning] = useState(false);

  const API_BASE = '/api';

  const showNotification = (msg, type = 'success') => {
    setFeedback({ msg, type });
    setTimeout(() => setFeedback(null), 4000);
  };

  const getAuthHeaders = () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${currentUser.token}`
  });

  // Login handler
  const handleQuickLogin = async (staffId) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staffId, password: 'Password@123' })
      });
      const json = await res.json();
      if (res.ok && json.data) {
        setCurrentUser({ ...json.data.user, token: json.data.token });
        showNotification(`Logged in as ${json.data.user.name} (${json.data.user.role.toUpperCase()})`);
      } else {
        showNotification(json.message || 'Login failed', 'error');
      }
    } catch (err) {
      showNotification('Network error connecting to backend: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Fetch initial data
  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch items
      const itemsRes = await fetch(`${API_BASE}/items`, { headers: getAuthHeaders() });
      if (itemsRes.ok) {
        const data = await itemsRes.json();
        setItems(data.data || []);
      }

      // Fetch indents
      const indentsRes = await fetch(`${API_BASE}/indents`, { headers: getAuthHeaders() });
      if (indentsRes.ok) {
        const data = await indentsRes.json();
        setIndents(data.data || []);
      }

      // Fetch low stock
      const lowStockRes = await fetch(`${API_BASE}/reports/low-stock`, { headers: getAuthHeaders() });
      if (lowStockRes.ok) {
        const data = await lowStockRes.json();
        setLowStock(data.data || []);
      }

      // Fetch audit logs if admin
      if (currentUser.role === 'admin') {
        const auditRes = await fetch(`${API_BASE}/audit`, { headers: getAuthHeaders() });
        if (auditRes.ok) {
          const data = await auditRes.json();
          setAuditLogs(data.data || []);
        }

        const usersRes = await fetch(`${API_BASE}/users`, { headers: getAuthHeaders() });
        if (usersRes.ok) {
          const data = await usersRes.json();
          setUsersList(data.data || []);
        }
      }
    } catch (err) {
      console.warn('Backend sync error:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    handleQuickLogin('SK001');
  }, []);

  useEffect(() => {
    if (currentUser?.token) {
      fetchData();
    }
  }, [currentUser]);

  // Issue Indent action (Atomic stock decrement on backend)
  const handleIssueIndent = async (indentId, indentNo) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/indents/${indentId}/issue`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ remarks: 'Issued at Central Stationery Counter' })
      });
      const json = await res.json();
      if (res.ok) {
        showNotification(`Indent ${indentNo} issued successfully. Stock updated automatically!`);
        fetchData();
      } else {
        showNotification(json.message || 'Issue failed', 'error');
      }
    } catch (err) {
      showNotification('Error issuing indent: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Stock-In action
  const handleStockInSubmit = async (e) => {
    e.preventDefault();
    if (!stockInForm.itemId) {
      showNotification('Please select an item', 'error');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/stock/in`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(stockInForm)
      });
      const json = await res.json();
      if (res.ok) {
        showNotification(`Stock added: +${stockInForm.quantity} units to inventory!`);
        setStockInForm({ itemId: '', quantity: 10, reference: 'INV-2026-902', supplier: 'Central Stationery Depot' });
        fetchData();
        setActiveTab('items');
      } else {
        showNotification(json.message || 'Stock-in failed', 'error');
      }
    } catch (err) {
      showNotification('Stock-in error: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Add Item action
  const handleCreateItemSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/items`, {
        method: 'POST',
        headers: getAuthHeaders(),
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
      showNotification('Item creation error: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Mobile App Simulation submit
  const handleMobileSubmitIndent = async () => {
    if (mobileCart.length === 0) {
      showNotification('Select at least one item first', 'error');
      return;
    }

    setBiometricScanning(true);
    // Simulate fingerprint touch delay
    setTimeout(async () => {
      try {
        const payload = {
          items: mobileCart.map(c => ({ itemId: c.itemId, quantity: c.qty })),
          confirmation: {
            method: 'biometric',
            deviceId: 'dev-phone-aditya'
          },
          remarks: mobileRemarks || 'Department office supply request'
        };

        const res = await fetch(`${API_BASE}/indents`, {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify(payload)
        });
        const json = await res.json();
        if (res.ok && json.data) {
          setMobileSuccessIndent(json.data);
          setMobileCart([]);
          setMobileRemarks('');
          fetchData();
        } else {
          showNotification(json.message || 'Failed to submit indent', 'error');
        }
      } catch (err) {
        showNotification('Submission error: ' + err.message, 'error');
      } finally {
        setBiometricScanning(false);
      }
    }, 1200);
  };

  const pendingIndents = indents.filter(i => i.status === 'REQUESTED');
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
          <div className="sidebar-subtitle">Counter & Admin Suite</div>
        </div>

        <ul className="nav-links">
          <li className={`nav-item ${activeTab === 'queue' ? 'active' : ''}`} onClick={() => setActiveTab('queue')}>
            <ClipboardList size={18} />
            <span>Issue Queue</span>
            {pendingIndents.length > 0 && (
              <span style={{ marginLeft: 'auto', background: '#ef4444', color: '#fff', padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 700 }}>
                {pendingIndents.length}
              </span>
            )}
          </li>

          <li className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}>
            <TrendingUp size={18} />
            <span>Store Summary</span>
          </li>

          <li className={`nav-item ${activeTab === 'items' ? 'active' : ''}`} onClick={() => setActiveTab('items')}>
            <Package size={18} />
            <span>Item Inventory</span>
          </li>

          <li className={`nav-item ${activeTab === 'stockin' ? 'active' : ''}`} onClick={() => setActiveTab('stockin')}>
            <Plus size={18} />
            <span>Stock-In (Receive)</span>
          </li>

          <li className={`nav-item ${activeTab === 'history' ? 'active' : ''}`} onClick={() => setActiveTab('history')}>
            <FileText size={18} />
            <span>Requisition History</span>
          </li>

          <li className={`nav-item ${activeTab === 'reports' ? 'active' : ''}`} onClick={() => setActiveTab('reports')}>
            <AlertTriangle size={18} />
            <span>Low Stock & Reports</span>
            {lowStock.length > 0 && (
              <span style={{ marginLeft: 'auto', background: '#f59e0b', color: '#000', padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 700 }}>
                {lowStock.length}
              </span>
            )}
          </li>

          {currentUser.role === 'admin' && (
            <>
              <li className={`nav-item ${activeTab === 'users' ? 'active' : ''}`} onClick={() => setActiveTab('users')}>
                <Users size={18} />
                <span>Staff & Devices</span>
              </li>
              <li className={`nav-item ${activeTab === 'audit' ? 'active' : ''}`} onClick={() => setActiveTab('audit')}>
                <ShieldCheck size={18} />
                <span>Audit Trail</span>
              </li>
            </>
          )}

          <div style={{ height: 1, background: '#1e293b', margin: '16px 0' }} />

          <li className={`nav-item ${activeTab === 'mobile-sim' ? 'active' : ''}`} onClick={() => setActiveTab('mobile-sim')} style={{ border: '1px dashed #38bdf8' }}>
            <Smartphone size={18} color="#38bdf8" />
            <span style={{ color: '#38bdf8' }}>Phone App Simulator</span>
          </li>
        </ul>

        {/* User Badge in Sidebar */}
        <div style={{ padding: 16, borderTop: '1px solid #1e293b', background: '#020617' }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>{currentUser.name}</div>
          <div style={{ fontSize: 11, color: '#94a3b8' }}>{currentUser.department} &bull; <strong style={{ color: '#38bdf8' }}>{currentUser.role.toUpperCase()}</strong></div>
          <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
            <button 
              onClick={() => handleQuickLogin('SK001')} 
              style={{ fontSize: 11, padding: '4px 8px', background: currentUser.role === 'storekeeper' ? '#1d4ed8' : '#334155', color: '#fff' }}>
              Storekeeper
            </button>
            <button 
              onClick={() => handleQuickLogin('EMP001')} 
              style={{ fontSize: 11, padding: '4px 8px', background: currentUser.role === 'admin' ? '#1d4ed8' : '#334155', color: '#fff' }}>
              Admin
            </button>
            <button 
              onClick={() => handleQuickLogin('FAC101')} 
              style={{ fontSize: 11, padding: '4px 8px', background: currentUser.role === 'faculty' ? '#1d4ed8' : '#334155', color: '#fff' }}>
              Faculty
            </button>
          </div>
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
              {activeTab === 'reports' && 'Inventory Analytics & Reports'}
              {activeTab === 'users' && 'Staff Accounts & Device Security'}
              {activeTab === 'audit' && 'Security Audit Log'}
              {activeTab === 'mobile-sim' && 'Faculty Mobile Application (Biometric Flow)'}
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
          {/* TAB: ISSUE QUEUE (The core storekeeper screen) */}
          {activeTab === 'queue' && (
            <div>
              <div className="stat-grid">
                <div className="stat-box">
                  <div>
                    <div className="stat-label">Awaiting Issue at Counter</div>
                    <div className="stat-num" style={{ color: '#d97706' }}>{pendingIndents.length}</div>
                  </div>
                  <Clock size={36} color="#f59e0b" />
                </div>
                <div className="stat-box">
                  <div>
                    <div className="stat-label">Low Stock Alerts</div>
                    <div className="stat-num" style={{ color: '#dc2626' }}>{lowStock.length}</div>
                  </div>
                  <AlertTriangle size={36} color="#ef4444" />
                </div>
                <div className="stat-box">
                  <div>
                    <div className="stat-label">Total Indents Handled</div>
                    <div className="stat-num">{indents.length}</div>
                  </div>
                  <CheckCircle size={36} color="#16a34a" />
                </div>
              </div>

              <div className="card">
                <div className="card-header">
                  <div className="card-title">Pending Requisitions for Handover</div>
                  <div style={{ fontSize: 13, color: '#64748b' }}>Oldest first &bull; Instant atomic stock subtraction</div>
                </div>

                {pendingIndents.length === 0 ? (
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
                        <th>Requester / Dept</th>
                        <th>Biometric Confirmation</th>
                        <th>Items Requested</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendingIndents.map(ind => (
                        <tr key={ind._id}>
                          <td>
                            <strong style={{ fontSize: 15 }}>{ind.indentNo}</strong>
                            <div style={{ fontSize: 12, color: '#64748b' }}>{new Date(ind.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                          </td>
                          <td>
                            <div style={{ fontWeight: 600 }}>{ind.requester?.name || 'Faculty Member'}</div>
                            <div style={{ fontSize: 12, color: '#64748b' }}>{ind.department} ({ind.requester?.staffId || 'ID'})</div>
                          </td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <Fingerprint size={16} color="#16a34a" />
                              <span className="badge badge-issued" style={{ textTransform: 'capitalize' }}>
                                {ind.confirmation?.method || 'biometric'} confirmed
                              </span>
                            </div>
                            <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                              Device: {ind.confirmation?.deviceId || 'Registered Phone'}
                            </div>
                          </td>
                          <td>
                            <ul style={{ listStyle: 'none', paddingLeft: 0 }}>
                              {ind.items.map((it, idx) => (
                                <li key={idx} style={{ marginBottom: 4 }}>
                                  <strong>{it.qtyRequested}x</strong> {it.nameSnapshot} <span style={{ fontSize: 11, color: '#64748b' }}>({it.unit})</span>
                                </li>
                              ))}
                            </ul>
                          </td>
                          <td>
                            <button 
                              onClick={() => handleIssueIndent(ind._id, ind.indentNo)}
                              className="btn-success" 
                              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 18px', fontSize: 14 }}>
                              <CheckCircle size={16} />
                              <span>Issue & Deduct Stock</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* TAB: STORE SUMMARY */}
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

          {/* TAB: ITEMS INVENTORY */}
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
                <button 
                  onClick={() => setNewItemModal(true)}
                  className="btn-primary" 
                  style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Plus size={16} />
                  <span>Add New Item</span>
                </button>
              </div>

              <div className="card">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Item Code</th>
                      <th>Item Name</th>
                      <th>Category</th>
                      <th>Current Stock</th>
                      <th>Reorder Level</th>
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
                        <td>{item.reorderLevel} {item.unit}</td>
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

          {/* TAB: STOCK-IN (RECEIVE NEW GOODS) */}
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

          {/* TAB: HISTORY */}
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
                  <option value="ISSUED">ISSUED</option>
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

          {/* TAB: REPORTS & LOW STOCK */}
          {activeTab === 'reports' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
                <div>
                  <h3 style={{ fontSize: 18 }}>Low Stock Threshold Alerts</h3>
                  <p style={{ fontSize: 13, color: '#64748b' }}>Items at or below defined college reorder minimums</p>
                </div>
                <a href={`${API_BASE}/reports/export.csv`} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 6, textDecoration: 'none' }}>
                  <Download size={14} />
                  <span>Download Indent Register (CSV)</span>
                </a>
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

          {/* TAB: AUDIT LOG (Admin only) */}
          {activeTab === 'audit' && (
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

          {/* TAB: PHONE APP SIMULATOR (Live mobile flow testing for Person B) */}
          {activeTab === 'mobile-sim' && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '20px 0' }}>
              <div style={{
                width: 380,
                height: 720,
                background: '#090d16',
                borderRadius: 40,
                border: '12px solid #1e293b',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                color: '#fff',
                position: 'relative'
              }}>
                {/* Phone Speaker Notch */}
                <div style={{ width: 120, height: 18, background: '#1e293b', margin: '0 auto', borderBottomLeftRadius: 10, borderBottomRightRadius: 10 }} />

                {/* Mobile Header */}
                <div style={{ padding: '16px 20px', borderBottom: '1px solid #1e293b' }}>
                  <div style={{ fontSize: 12, color: '#38bdf8' }}>Faculty Mobile Portal</div>
                  <div style={{ fontSize: 16, fontWeight: 700 }}>{currentUser.name}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>{currentUser.department} &bull; ID: {currentUser.staffId}</div>
                </div>

                {/* Mobile Screen Content */}
                <div style={{ flex: 1, padding: 16, overflowY: 'auto' }}>
                  {mobileSuccessIndent ? (
                    <div style={{ textAlign: 'center', padding: '40px 10px' }}>
                      <CheckCircle size={60} color="#22c55e" style={{ margin: '0 auto 16px' }} />
                      <h2 style={{ fontSize: 20 }}>Indent Submitted!</h2>
                      <div style={{ background: '#1e293b', padding: '12px', borderRadius: 8, margin: '20px 0' }}>
                        <div style={{ fontSize: 12, color: '#94a3b8' }}>Indent Number</div>
                        <div style={{ fontSize: 18, fontWeight: 700, color: '#38bdf8' }}>{mobileSuccessIndent.indentNo}</div>
                      </div>
                      <p style={{ fontSize: 12, color: '#94a3b8' }}>Confirmed via phone fingerprint. Walk to the counter to collect your items.</p>
                      <button 
                        onClick={() => setMobileSuccessIndent(null)}
                        style={{ marginTop: 24, width: '100%', padding: 12, background: '#2563eb', color: '#fff' }}>
                        Make Another Request
                      </button>
                    </div>
                  ) : (
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: '#cbd5e1' }}>Select Items to Requisition:</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 260, overflowY: 'auto', marginBottom: 16 }}>
                        {items.slice(0, 6).map(it => {
                          const inCart = mobileCart.find(c => c.itemId === it._id);
                          return (
                            <div key={it._id} style={{ background: '#1e293b', padding: '10px 12px', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div>
                                <div style={{ fontSize: 13, fontWeight: 600 }}>{it.name}</div>
                                <div style={{ fontSize: 11, color: '#94a3b8' }}>Stock: {it.stock} {it.unit}</div>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                {inCart ? (
                                  <>
                                    <button 
                                      onClick={() => setMobileCart(mobileCart.map(c => c.itemId === it._id ? { ...c, qty: Math.max(0, c.qty - 1) } : c).filter(c => c.qty > 0))}
                                      style={{ width: 26, height: 26, background: '#334155', color: '#fff', borderRadius: 4 }}>-</button>
                                    <span style={{ fontSize: 13, fontWeight: 700 }}>{inCart.qty}</span>
                                    <button 
                                      onClick={() => setMobileCart(mobileCart.map(c => c.itemId === it._id ? { ...c, qty: c.qty + 1 } : c))}
                                      style={{ width: 26, height: 26, background: '#334155', color: '#fff', borderRadius: 4 }}>+</button>
                                  </>
                                ) : (
                                  <button 
                                    onClick={() => setMobileCart([...mobileCart, { itemId: it._id, name: it.name, qty: 1 }])}
                                    style={{ fontSize: 12, padding: '4px 10px', background: '#2563eb', color: '#fff' }}>Add</button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6, color: '#cbd5e1' }}>Cart Summary:</div>
                      {mobileCart.length === 0 ? (
                        <div style={{ fontSize: 12, color: '#64748b', fontStyle: 'italic', marginBottom: 16 }}>No items selected yet.</div>
                      ) : (
                        <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, padding: 10, marginBottom: 16 }}>
                          {mobileCart.map((c, idx) => (
                            <div key={idx} style={{ fontSize: 12, display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                              <span>{c.name}</span>
                              <strong>x{c.qty}</strong>
                            </div>
                          ))}
                        </div>
                      )}

                      <div style={{ marginBottom: 16 }}>
                        <input 
                          type="text" 
                          placeholder="Requisition purpose / remark..." 
                          value={mobileRemarks}
                          onChange={e => setMobileRemarks(e.target.value)}
                          style={{ width: '100%', background: '#1e293b', border: '1px solid #334155', color: '#fff', fontSize: 12 }}
                        />
                      </div>

                      {/* Fingerprint Submit Area */}
                      <div style={{ background: '#111827', border: '1px solid #374151', borderRadius: 12, padding: 14, textAlign: 'center' }}>
                        <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 10 }}>
                          Touch fingerprint sensor to confirm Requisition
                        </div>

                        <button 
                          onClick={handleMobileSubmitIndent}
                          disabled={biometricScanning || mobileCart.length === 0}
                          style={{
                            width: 64,
                            height: 64,
                            borderRadius: 32,
                            background: biometricScanning ? '#16a34a' : '#2563eb',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            margin: '0 auto',
                            boxShadow: '0 0 20px rgba(37, 99, 235, 0.4)'
                          }}>
                          <Fingerprint size={36} color="#fff" />
                        </button>
                        <div style={{ fontSize: 11, color: biometricScanning ? '#22c55e' : '#60a5fa', marginTop: 8, fontWeight: 600 }}>
                          {biometricScanning ? 'Verifying Biometric Fingerprint...' : 'Hold Finger to Confirm'}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
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
    </div>
  );
}
