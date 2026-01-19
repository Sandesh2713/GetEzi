import { useEffect, useMemo, useState, useRef } from 'react';
import { io } from 'socket.io-client';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import './App.css';
import { useAuth } from './AuthContext';
import { Header } from './components/landing/Header';
import { Hero } from './components/landing/Hero';
import { QuickAccess } from './components/landing/QuickAccess';
import { Stats } from './components/landing/Stats';
import { Features } from './components/landing/Features';
import { About } from './components/landing/About';
import { Footer } from './components/landing/Footer';
import { StaffLoginView } from './components/auth/StaffLoginView';
import { OwnerLoginView } from './components/auth/OwnerLoginView';
import { CustomerLoginView } from './components/auth/CustomerLoginView';

function CreateOfficeWizard({ onSubmit, onBack }) {
  const [form, setForm] = useState({
    name: '',
    serviceType: '',
    dailyCapacity: 100,
    avgServiceMinutes: 10,
    counterCount: 1,
    // New Fields
    address: '',
    openingTime: '09:00',
    closingTime: '17:00',
    lunchStart: '',
    lunchEnd: '',
    autoNoShow: false
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    await onSubmit({
      ...form,
      operatingHours: `${form.openingTime}-${form.closingTime}` // Legacy format support if needed, but we send specific fields too
    });
    setLoading(false);
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', padding: '20px' }}>
      <div className="card" style={{ width: '100%', maxWidth: '600px' }}>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '8px' }}>Setup your Office</h2>
        <p style={{ marginBottom: '24px', color: 'var(--text-muted)' }}>Tell us about your organization to get started.</p>
        <form onSubmit={handleSubmit}>
          <div className="grid-2">
            <label className="input-group">
              <span className="input-label">Office Name</span>
              <input className="input-field" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required placeholder="e.g. City Central Clinic" />
            </label>
            <label className="input-group">
              <span className="input-label">Services Offered</span>
              <input className="input-field" value={form.serviceType} onChange={e => setForm({ ...form, serviceType: e.target.value })} required placeholder="e.g. Consultation, X-Ray" />
            </label>
          </div>

          <label className="input-group">
            <span className="input-label">Address</span>
            <textarea
              className="input-field"
              value={form.address}
              onChange={e => setForm({ ...form, address: e.target.value })}
              placeholder="Full address of the office..."
              style={{ minHeight: '60px', fontFamily: 'inherit' }}
            />
          </label>

          <div className="grid-2">
            <label className="input-group">
              <span className="input-label">Opening Time</span>
              <input className="input-field" type="time" value={form.openingTime} onChange={e => setForm({ ...form, openingTime: e.target.value })} required />
            </label>
            <label className="input-group">
              <span className="input-label">Closing Time</span>
              <input className="input-field" type="time" value={form.closingTime} onChange={e => setForm({ ...form, closingTime: e.target.value })} required />
            </label>
          </div>

          <div className="grid-2">
            <label className="input-group">
              <span className="input-label">Lunch Start (Optional)</span>
              <input className="input-field" type="time" value={form.lunchStart} onChange={e => setForm({ ...form, lunchStart: e.target.value })} />
            </label>
            <label className="input-group">
              <span className="input-label">Lunch End (Optional)</span>
              <input className="input-field" type="time" value={form.lunchEnd} onChange={e => setForm({ ...form, lunchEnd: e.target.value })} />
            </label>
          </div>

          <div style={{ marginBottom: '20px', padding: '12px', background: 'var(--gray-50)', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Enable Auto No-Show</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Mark as no-show after 5 min grace</div>
            </div>
            <input type="checkbox" style={{ width: '20px', height: '20px' }} checked={form.autoNoShow} onChange={e => setForm({ ...form, autoNoShow: e.target.checked })} />
          </div>

          <div className="grid-2">
            <label className="input-group">
              <span className="input-label">Avg Service Time (mins)</span>
              <input className="input-field" type="number" value={form.avgServiceMinutes} onChange={e => setForm({ ...form, avgServiceMinutes: e.target.value })} required />
            </label>
            <label className="input-group">
              <span className="input-label">Daily Capacity (Est.)</span>
              <input className="input-field" type="number" value={form.dailyCapacity} onChange={e => setForm({ ...form, dailyCapacity: e.target.value })} required />
            </label>
          </div>

          <label className="input-group">
            <span className="input-label">Number of Counters (N)</span>
            <input className="input-field" type="number" value={form.counterCount} onChange={e => setForm({ ...form, counterCount: e.target.value })} required min="1" max="10" />
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>M = N * 3 (Max Allocations)</div>
          </label>

          <div style={{ marginTop: '32px' }}>
            <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: '100%' }}>
              {loading ? 'Creating...' : 'Create Office'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000';

async function fetchJSON(path, options = {}) {
  const token = sessionStorage.getItem('token');
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

function Stat({ label, value }) {
  return (
    <div className="stat">
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
    </div>
  );
}

// --- 1. Customer Token Row (Instructions & Guidance) ---
function CustomerTokenRow({ token, onCancel, onArrive, isOwner, office }) {
  const isArrived = token.presence_status === 'ARRIVED';
  const isTerminal = ['cancelled', 'completed', 'no-show'].includes(token.status);
  const N = office?.counter_count || 1;
  const serviceMinutes = office?.avg_service_minutes || 10;

  let statusMsg = token.status;
  let subMsg = '';

  const fmtTime = (iso) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // STRICT Customer Logic
  if (office?.is_paused && ['WAIT', 'ALLOCATED'].includes(token.status)) {
    statusMsg = 'Paused';
    subMsg = office.pause_message || `Service paused: ${office.pause_reason}`;
  } else if (token.status === 'CALLED') {
    statusMsg = 'At Counter';
    subMsg = 'Proceed to the counter.';
  } else if (token.status === 'ALLOCATED') {
    if (isArrived) {
      statusMsg = 'You are checked in';
      subMsg = 'Please wait, your turn will be called shortly.';
    } else {
      statusMsg = 'Arrival Confirmation Needed';
      subMsg = 'You are allowed to enter the office. Please confirm arrival.';
    }
  } else if (token.status === 'WAIT') {
    if (token.time_state === 'PAST' || !token.service_start_time) {
      statusMsg = 'Be Ready';
      subMsg = (
        <div style={{ color: 'var(--primary)', fontWeight: 600 }}>Please be ready, your turn is approaching.</div>
      );
    } else {
      statusMsg = 'Wait at Location';
      const callTimeMs = new Date(token.service_start_time).getTime();
      const minsToCall = Math.ceil((callTimeMs - Date.now()) / 60000);
      const callRel = minsToCall > 0 ? `In ${minsToCall} mins` : 'Very soon';

      const allocOffset = 3 * serviceMinutes * 60000;
      const travelOffset = (token.travel_time_minutes || 15) * 60000;
      let allocTimeMs = callTimeMs - allocOffset;
      if (allocTimeMs < Date.now()) allocTimeMs = Date.now();
      const travelStartMs = allocTimeMs - travelOffset;
      const travelStr = fmtTime(new Date(travelStartMs));

      subMsg = (
        <div style={{ lineHeight: '1.4' }}>
          <div>Called in: <strong>{callRel}</strong></div>
          <div style={{ color: '#d93025' }}>Start traveling by <strong>{travelStr}</strong></div>
        </div>
      );
    }
  } else if (token.status === 'COMPLETED') {
    statusMsg = 'Completed';
    subMsg = 'Thank you for visiting';
  } else {
    subMsg = '-';
  }

  return (
    <div className={`token-row ${token.status}`} style={{
      background: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(8px)',
      borderRadius: 'var(--radius-lg)', padding: '20px', marginBottom: '16px',
      boxShadow: 'var(--shadow-sm)', border: '1px solid var(--gray-100)',
      display: 'flex', justifyContent: 'space-between', alignItems: 'center'
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--primary-600)' }}>Token #{token.token_number}</div>
        <div>
          <div style={{ fontWeight: 600, fontSize: '1.1rem' }}>{token.user_name}</div>
          <div style={{ marginTop: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="badge badge-neutral">{statusMsg}</span>
            {(token.assigned_counter || token.called_by_counter) && (
              <span className="badge badge-primary">
                Counter {token.called_by_counter || token.assigned_counter}
              </span>
            )}
          </div>
          <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginTop: '6px' }}>{subMsg}</div>
        </div>
      </div>
      <div className="token-actions" style={{ display: 'flex', gap: '12px' }}>
        {token.status === 'ALLOCATED' && !isArrived && isOwner && (
          <button className="btn btn-primary" onClick={() => onArrive(token.id)}>
            I've Arrived
          </button>
        )}
        {!isTerminal && isOwner && (
          <button className="btn btn-danger" style={{ background: 'transparent', color: '#ef4444', border: '1px solid #fee2e2' }} onClick={() => onCancel(token.id)}>
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}

// --- 2. Admin Token Row (Raw System Data) ---
function AdminTokenRow({ token, onComplete, onNoShow, onCancel, onReQueue, onSelect }) {
  const isArrived = token.presence_status === 'ARRIVED';
  const isTerminal = ['cancelled', 'completed', 'no-show'].includes(token.status);
  const isHolding = token.status === 'holding';

  // Status Badge Logic
  const getStatusColor = (s) => {
    switch (s) {
      case 'CALLED': return '#dcfce7'; // green-100
      case 'ALLOCATED': return '#fef9c3'; // yellow-100
      case 'WAIT': return '#e0f2fe'; // sky-100
      default: return '#f3f4f6'; // gray-100
    }
  };

  return (
    <div onClick={() => onSelect(token)} style={{
      background: 'white', borderRadius: 'var(--radius-md)', padding: '16px', marginBottom: '12px',
      boxShadow: 'var(--shadow-sm)', border: '1px solid var(--gray-200)',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      cursor: 'pointer', transition: 'all 0.2s', position: 'relative', overflow: 'hidden'
    }}
      onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
      onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
    >
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--primary-600)' }}>#{token.token_number}</span>
          <span style={{ fontSize: '1rem', fontWeight: 600 }}>{token.user_name}</span>
        </div>
        <div style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
          <span className="badge" style={{ backgroundColor: getStatusColor(token.status), color: '#374151' }}>
            {token.status}
          </span>
          {(token.assigned_counter || token.called_by_counter) && (
            <span className="badge" style={{ backgroundColor: '#e0e7ff', color: '#3730a3' }}>
              Counter {token.called_by_counter || token.assigned_counter}
            </span>
          )}
          <span className="badge" style={{ backgroundColor: isArrived ? '#dcfce7' : '#fee2e2', color: isArrived ? '#166534' : '#991b1b' }}>
            {isArrived ? 'Arrived' : 'Not Arrived'}
          </span>
          {!isArrived && token.arrival_status && (
            <span className="badge" style={{
              backgroundColor: token.arrival_status === 'LIKELY_TO_ARRIVE' ? '#dcfce7' : (token.arrival_status === 'ON_THE_WAY' ? '#fef9c3' : '#fee2e2'),
              color: token.arrival_status === 'LIKELY_TO_ARRIVE' ? '#166534' : (token.arrival_status === 'ON_THE_WAY' ? '#854d0e' : '#991b1b'),
              display: 'flex', alignItems: 'center', gap: '4px'
            }}>
              {token.arrival_status === 'LIKELY_TO_ARRIVE' && '🟢 Likely'}
              {token.arrival_status === 'ON_THE_WAY' && '🟡 On Way'}
              {token.arrival_status === 'PROBABLE_NO_SHOW' && '🔴 Risk'}
              <span style={{ opacity: 0.7, fontSize: '0.7em' }}>({Math.round((token.arrival_score || 0) * 100)}%)</span>
            </span>
          )}
        </div>
      </div>

      <div className="token-actions" onClick={e => e.stopPropagation()} style={{ display: 'flex', gap: '8px' }}>
        {!isTerminal && !isHolding && (
          <>
            <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.85rem' }} onClick={() => onComplete(token.id)}>Done</button>
            <button className="btn btn-ghost" style={{ padding: '6px 12px', fontSize: '0.85rem' }} onClick={() => onNoShow(token.id)}>No-show</button>
            <button className="btn btn-ghost" style={{ color: 'var(--danger)', padding: '6px 12px', fontSize: '0.85rem' }} onClick={() => onCancel(token.id)}>✕</button>
          </>
        )}
        {isHolding && <button className="btn btn-secondary" onClick={() => onReQueue(token.id)}>ReQ</button>}
      </div>
    </div>
  );
}

// --- 3. Token Details Modal (Admin Only) ---
function TokenDetailsModal({ token, onClose, onAction }) {
  if (!token) return null;
  const isArrived = token.presence_status === 'ARRIVED';

  const InfoRow = ({ label, val }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', borderBottom: '1px solid #f3f4f6', paddingBottom: '4px' }}>
      <span style={{ color: '#6b7280', fontSize: '13px' }}>{label}</span>
      <span style={{ fontWeight: 500, fontSize: '13px' }}>{val || '-'}</span>
    </div>
  );

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3>Token #{token.token_number}</h3>
          <button className="ghost" onClick={onClose}>✕</button>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <h4 style={{ fontSize: '12px', textTransform: 'uppercase', color: '#9ca3af', marginBottom: '8px' }}>Customer</h4>
          <InfoRow label="Name" val={token.user_name} />
          <InfoRow label="Email" val={token.user_email} />
          <InfoRow label="Phone" val={token.user_phone} />
          <InfoRow label="Gender" val={token.user_gender} />
          <InfoRow label="DOB" val={token.user_dob ? new Date(token.user_dob).toLocaleDateString() : ''} />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <h4 style={{ fontSize: '12px', textTransform: 'uppercase', color: '#9ca3af', marginBottom: '8px' }}>System Data</h4>
          <InfoRow label="Status" val={token.status} />
          <InfoRow label="Presence" val={token.presence_status} />
          <InfoRow label="Counter" val={token.called_by_counter || token.assigned_counter || 'Unassigned'} />
          <InfoRow label="Created At" val={token.created_at ? new Date(token.created_at).toLocaleString() : ''} />
          <InfoRow label="Allocation Time" val={token.eligibility_time ? new Date(token.eligibility_time).toLocaleString() : ''} />
          <InfoRow label="Service Start" val={token.service_start_time ? new Date(token.service_start_time).toLocaleString() : ''} />
          <InfoRow label="Arrival Confirmed" val={token.arrival_confirmed_at ? new Date(token.arrival_confirmed_at).toLocaleString() : 'Pending'} />
        </div>

        <div style={{ display: 'flex', gap: '8px', marginTop: '24px' }}>
          <button className="primary-btn" onClick={() => { onAction(token.id, 'complete'); onClose(); }}>Complete</button>
          <button className="secondary-btn" onClick={() => { onAction(token.id, 'no-show'); onClose(); }}>No-Show</button>
          <button className="ghost danger" onClick={() => { onAction(token.id, 'cancel'); onClose(); }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}


// --- 3.5 Counter Card (Admin) ---
function AdminCounterCard({ counterId, tokens, onCall, state }) {
  const activeToken = tokens.find(t => t.status === 'CALLED' && t.called_by_counter === counterId);
  // Next allocated tokens assigned to this counter
  const assignedTokens = tokens.filter(t => t.status === 'ALLOCATED' && t.assigned_counter === counterId)
    .sort((a, b) => new Date(a.allocation_time) - new Date(b.allocation_time));

  return (
    <div className="card" style={{ padding: '16px', background: 'var(--gray-50)', border: '1px solid var(--gray-200)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <h4 style={{ margin: 0 }}>Counter {counterId}</h4>
        <span className={`badge ${activeToken ? 'badge-primary' : 'badge-neutral'}`}>
          {activeToken ? 'Busy' : 'Idle'}
        </span>
      </div>

      <div style={{ marginBottom: '16px', minHeight: '60px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'white', borderRadius: '8px', border: '1px dashed var(--gray-300)' }}>
        {activeToken ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--primary-600)' }}>#{activeToken.token_number}</div>
            <div style={{ fontSize: '0.85rem' }}>{activeToken.user_name}</div>
          </div>
        ) : (
          <span className="text-muted">No Active Token</span>
        )}
      </div>

      <button
        className="btn btn-primary"
        style={{ width: '100%', marginBottom: '16px' }}
        onClick={() => onCall(counterId)}
        disabled={!!activeToken || state !== 'LIVE'}
      >
        Call Next
      </button>

      <div>
        <div style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: 600 }}>Up Next ({assignedTokens.length})</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '150px', overflowY: 'auto' }}>
          {assignedTokens.length === 0 && <div style={{ fontSize: '0.85rem', color: '#9ca3af', fontStyle: 'italic' }}>Queue empty</div>}
          {assignedTokens.map(t => (
            <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px', background: 'white', borderRadius: '4px', border: '1px solid #e5e7eb', fontSize: '0.85rem' }}>
              <span style={{ fontWeight: 600 }}>#{t.token_number}</span>
              <span>{t.presence_status === 'ARRIVED' ? '🟢' : '⚪️'}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function LoginView({ onSuccess, onSwitch, onBack, role }) {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // If role is passed, enforce it.
  const roleProp = role; // 'admin', 'office_owner', 'customer', or undefined
  const [isAdmin, setIsAdmin] = useState(role === 'admin'); // Legacy admin requires key
  // office_owner uses standard email/pass but routes differently

  const [adminKey, setAdminKey] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isAdmin && !adminKey) {
      setError('Admin Key is required for legacy admin login.');
      return;
    }
    try {
      await login(email, password, isAdmin ? adminKey : undefined);
      onSuccess();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="auth-container login-redesign">
      {/* Kept back button but it might need to vary based on design preference. Keeping for UX. */}
      {/* <button type="button" className="back-btn" onClick={(e) => { e.preventDefault(); onBack(); }}>← Back</button> */}

      <h2 style={{ fontSize: '28px', marginBottom: '-12px', lineHeight: '1' }}>Welcome Back</h2>
      <div style={{ textAlign: 'center', color: 'var(--gray-500)', marginBottom: '32px' }}>Let's get started</div>

      {error && <div className="message">{error}</div>}
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div className="field">
          {/* Design often hides labels or puts them inside. Keeping labels for accessibility but could hide them if placeholders are preferred. */}
          {/* Adding placeholders to match typical clean login forms */}
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="Email"
            className="rounded-input"
          />
        </div>
        <div className="field">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder="Password"
            className="rounded-input"
          />
        </div>

        {/* Forgot Password Link */}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <span
            style={{ color: '#0ea5e9', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}
            onClick={() => onSwitch('forgot-password')}
          >
            Forgot Password?
          </span>
        </div>

        {/* Admin Toggle - Hidden if role is explicitly set */}
        {!roleProp && (
          <div style={{ margin: '4px 0', fontSize: '13px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: 'var(--gray-500)' }}>
              <input type="checkbox" checked={isAdmin} onChange={e => setIsAdmin(e.target.checked)} />
              Login as Admin
            </label>
          </div>
        )}

        {isAdmin && (
          <div className="field animate-fade-in">
            <input
              type="password"
              value={adminKey}
              onChange={(e) => setAdminKey(e.target.value)}
              placeholder="Legacy Admin Key"
              className="rounded-input"
            />
          </div>
        )}

        <button type="submit" className="login-btn">Login</button>
      </form>

      <div style={{ textAlign: 'center', marginTop: '24px', fontSize: '14px', color: 'var(--gray-500)' }}>
        Don't have an account? <span onClick={onSwitch} style={{ color: '#0ea5e9', fontWeight: '700', cursor: 'pointer' }}>Sign up.</span>
      </div>
    </div>
  );
}

function RegisterView({ onSuccess, onSwitch, defaultRole = 'customer', onBack }) {
  const { register } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState('');
  const [role, setRole] = useState(defaultRole);
  const [adminKey, setAdminKey] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [exampleKey, setExampleKey] = useState('office-2024');

  // Office Fields
  const [officeName, setOfficeName] = useState('');
  const [address, setAddress] = useState('');
  const [serviceType, setServiceType] = useState('');
  const [openingTime, setOpeningTime] = useState('09:00');
  const [closingTime, setClosingTime] = useState('17:00');
  const [dailyCapacity, setDailyCapacity] = useState('100');
  const [avgServiceMinutes, setAvgServiceMinutes] = useState('15');
  const [counterCount, setCounterCount] = useState('1');
  const [autoNoShow, setAutoNoShow] = useState(false);

  useEffect(() => {
    setRole(defaultRole);
  }, [defaultRole]);

  useEffect(() => {
    if (role === 'admin') {
      const examples = ['my-secret-key', 'admin-pass-123', 'office-blr-01', 'key-xyz-99', 'secure-entry'];
      let i = 0;
      // Sync with CSS animation (2.5s total duration)
      const interval = setInterval(() => {
        i = (i + 1) % examples.length;
        setExampleKey(examples[i]);
      }, 2500);
      return () => clearInterval(interval);
    }
  }, [role]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const officeDetails = role === 'office_owner' ? {
        name: officeName, address, serviceType, openingTime, closingTime,
        dailyCapacity: parseInt(dailyCapacity), avgServiceMinutes: parseInt(avgServiceMinutes),
        counterCount: parseInt(counterCount), autoNoShow
      } : null;

      await register(name, email, password, phone, role, role === 'admin' ? adminKey : undefined, dob, gender, officeDetails);
      onSuccess();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container login-redesign">
      {/* <button type="button" className="back-btn" onClick={(e) => { e.preventDefault(); onBack(); }}>← Back</button> */}

      <h2 style={{ fontSize: '28px', marginBottom: '-12px', lineHeight: '1' }}>Create Account</h2>
      <div style={{ textAlign: 'center', color: 'var(--gray-500)', marginBottom: '32px' }}>Join us today</div>

      {error && <div className="message">{error}</div>}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div className="field">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="Full Name"
          />
        </div>
        <div className="field">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="Email Address"
          />
        </div>
        <div className="field">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder="Password"
          />
        </div>
        <div className="field">
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder={role === 'admin' ? "Phone (Required)" : "Phone (Optional)"}
            required={role === 'admin'}
          />
        </div>



        <div className="field-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <label className="field">
            <span>Date of Birth</span>
            <input
              type="date"
              value={dob}
              onChange={(e) => setDob(e.target.value)}
              required
            />
          </label>
          <label className="field">
            <span>Gender</span>
            <select
              value={gender}
              onChange={(e) => setGender(e.target.value)}
              required
              className="rounded-input"
              style={{ height: '48px' }} // Match input height roughly
            >
              <option value="" disabled>Select Gender</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </select>
          </label>
        </div>

        {role === 'office_owner' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '10px', padding: '16px', border: '1px solid var(--gray-200)', borderRadius: '12px', background: 'var(--gray-50)' }}>
            <h3 style={{ fontSize: '1.1rem', margin: 0 }}>Office Details</h3>

            <div className="field">
              <input value={officeName} onChange={e => setOfficeName(e.target.value)} required placeholder="Office/Business Name" />
            </div>
            <div className="field">
              <textarea value={address} onChange={e => setAddress(e.target.value)} required placeholder="Full Address" style={{ minHeight: '60px', fontFamily: 'inherit' }} className="input-field" />
            </div>
            <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <input value={serviceType} onChange={e => setServiceType(e.target.value)} required placeholder="Service Type (e.g. Clinic)" />
              <input type="number" value={counterCount} onChange={e => setCounterCount(e.target.value)} required placeholder="# Counters" />
            </div>
            <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <label className="field">
                <span style={{ fontSize: '0.8rem' }}>Opens At</span>
                <input type="time" value={openingTime} onChange={e => setOpeningTime(e.target.value)} required />
              </label>
              <label className="field">
                <span style={{ fontSize: '0.8rem' }}>Closes At</span>
                <input type="time" value={closingTime} onChange={e => setClosingTime(e.target.value)} required />
              </label>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.9rem' }}>
              <input type="checkbox" checked={autoNoShow} onChange={e => setAutoNoShow(e.target.checked)} style={{ width: 'auto' }} />
              <span>Enable Auto No-Show (5m grace)</span>
            </div>
          </div>
        )}

        {role === 'admin' && (
          <div className="field">
            <input
              type="password"
              value={adminKey}
              onChange={(e) => setAdminKey(e.target.value)}
              required
              placeholder="Create Admin Key"
            />
            <div style={{ fontSize: '11px', color: 'var(--gray-500)', marginTop: '4px', paddingLeft: '4px' }}>
              You will need this key to login and perform admin actions. <br />
              <span style={{ color: 'var(--gray-400)', fontStyle: 'italic' }}>Example: <span className="fade-text">{exampleKey}</span></span>
            </div>
          </div>
        )}

        <button type="submit" className="login-btn" disabled={loading}>
          {loading ? 'Creating Account...' : 'Sign Up'}
        </button>
      </form>

      <div style={{ textAlign: 'center', marginTop: '24px', fontSize: '14px', color: 'var(--gray-500)' }}>
        Have an account? <span onClick={onSwitch} style={{ color: '#0ea5e9', fontWeight: '700', cursor: 'pointer' }}>Login</span>
      </div>
    </div>
  );
}

function VerifyEmailView({ email, onSuccess, onBack }) {
  const { verifyOtp, sendOtp } = useAuth();
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const mounted = useRef(false);

  // Auto-send OTP on mount
  useEffect(() => {
    if (!mounted.current && email) {
      mounted.current = true;
      // Trigger OTP send on fresh load of this view
      sendOtp(email).catch(err => setError('Failed to send OTP: ' + err.message));
    }
  }, [email, sendOtp]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await verifyOtp(email, otp);
      onSuccess();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setMsg('');
    setError('');
    try {
      await sendOtp(email);
      setMsg('OTP resent successfully!');
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="auth-container">
      <button type="button" className="back-btn" onClick={(e) => { e.preventDefault(); onBack(); }}>← Back</button>
      <h2>Verify Email</h2>
      <p style={{ marginBottom: '20px', color: 'var(--gray-500)' }}>
        We sent a code to <strong>{email}</strong>.
      </p>
      {error && <div className="message" style={{ background: '#ffebee', color: '#c62828' }}>{error}</div>}
      {msg && <div className="message" style={{ background: '#e8f5e9', color: '#2e7d32' }}>{msg}</div>}

      <form onSubmit={handleSubmit}>
        <label className="field">
          <span>Enter 6-digit Code</span>
          <input
            type="text"
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            placeholder="123456"
            maxLength={6}
            style={{ letterSpacing: '4px', fontSize: '24px', textAlign: 'center' }}
            required
          />
        </label>
        <button type="submit" disabled={loading}>{loading ? 'Verifying...' : 'Verify'}</button>
      </form>

      <div style={{ marginTop: '20px', textAlign: 'center' }}>
        <button className="ghost small" onClick={handleResend}>Resend Code</button>
      </div>
    </div>
  );
}

// Forgot Password Component
function ForgotPasswordView({ onBack, onVerify }) {
  const { sendOtp } = useAuth();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');
    try {
      await sendOtp(email, 'reset');
      onVerify(email); // Switch to verification view
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container login-redesign">
      <button type="button" className="back-btn" onClick={(e) => { e.preventDefault(); onBack(); }}>← Back</button>
      <h2 style={{ fontSize: '28px', marginBottom: '8px' }}>Reset Password</h2>
      <div style={{ textAlign: 'center', color: 'var(--gray-500)', marginBottom: '32px' }}>Enter email to receive code</div>

      {error && <div className="message" style={{ background: '#ffebee', color: '#c62828' }}>{error}</div>}
      {message && <div className="message" style={{ background: '#e8f5e9', color: '#2e7d32' }}>{message}</div>}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div className="field">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="Email Address"
            className="rounded-input"
          />
        </div>
        <button type="submit" className="login-btn" disabled={loading}>
          {loading ? 'Sending...' : 'Send Code'}
        </button>
      </form>
    </div>
  );
}

// Reset Password Component
function ResetPasswordView({ email, onBack, onSuccess }) {
  const { resetPassword } = useAuth();
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await resetPassword(email, otp, newPassword);
      onSuccess();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container login-redesign">
      <button type="button" className="back-btn" onClick={(e) => { e.preventDefault(); onBack(); }}>← Back</button>
      <h2 style={{ fontSize: '28px', marginBottom: '8px' }}>New Password</h2>
      <div style={{ textAlign: 'center', color: 'var(--gray-500)', marginBottom: '32px' }}>Enter code and new password</div>

      {error && <div className="message" style={{ background: '#ffebee', color: '#c62828' }}>{error}</div>}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div className="field">
          <input
            type="text"
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            placeholder="6-digit Code"
            maxLength={6}
            className="rounded-input"
            required
            style={{ textAlign: 'center', letterSpacing: '2px' }}
          />
        </div>
        <div className="field">
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            placeholder="New Password"
            className="rounded-input"
          />
        </div>
        <button type="submit" className="login-btn" disabled={loading}>
          {loading ? 'Updating...' : 'Set Password'}
        </button>
      </form>
    </div>
  );
}
// Landing View Component
function AboutDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const [openIndex, setOpenIndex] = useState(null);

  const sections = [
    {
      title: "What We Do?",
      desc: "We provide a smart, web-based Queue Management System to reduce crowding and long waiting times in offices and service centers."
    },
    {
      title: "Why We Do?",
      desc: "Our platform helps organizations manage visitors efficiently with real-time seat and slot updates."
    },
    {
      title: "Our Aim.",
      desc: "We aim to make public service visits smoother, faster, and more organized for everyone."
    }
  ];

  return (
    <div
      style={{ position: 'relative', display: 'inline-block' }}
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => { setIsOpen(false); setOpenIndex(null); }}
    >
      <a href="#about" style={{ cursor: 'pointer', display: 'block', padding: '10px 0' }}>About Us</a>

      {isOpen && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: '0',
          width: '350px',
          background: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(10px)',
          borderRadius: '12px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
          padding: '20px',
          zIndex: 1000,
          border: '1px solid rgba(0,0,0,0.05)',
          animation: 'fade-in 0.2s ease-out'
        }}>
          {sections.map((item, idx) => (
            <div key={idx} style={{
              marginBottom: idx === sections.length - 1 ? 0 : '12px',
              paddingBottom: idx === sections.length - 1 ? 0 : '12px',
              borderBottom: idx === sections.length - 1 ? 'none' : '1px solid rgba(0,0,0,0.06)'
            }}>
              <div
                onClick={() => setOpenIndex(openIndex === idx ? null : idx)}
                style={{
                  fontWeight: '700',
                  fontSize: '14px',
                  color: '#1a1a1a',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '4px 0'
                }}
              >
                {item.title}
                <span style={{ transition: 'transform 0.2s', transform: openIndex === idx ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6" /></svg>
                </span>
              </div>

              {openIndex === idx && (
                <div style={{
                  fontSize: '13px',
                  color: 'var(--gray-500)',
                  marginTop: '4px',
                  lineHeight: '1.4',
                  paddingLeft: '4px',
                  borderLeft: '2px solid #e1e4e8',
                  animation: 'fade-in 0.2s ease-out',
                  opacity: 0.8
                }}>
                  {item.desc}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ContactDropdown() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div
      style={{ position: 'relative', display: 'inline-block' }}
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      <a href="#contact" style={{ cursor: 'pointer', display: 'block', padding: '10px 0' }}>Contact</a>

      {isOpen && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: '0',
          transform: 'none',
          width: '350px',
          background: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(10px)',
          borderRadius: '12px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
          padding: '24px', // Slightly more padding for text
          zIndex: 1000,
          border: '1px solid rgba(0,0,0,0.05)',
          animation: 'fade-in 0.2s ease-out',
          textAlign: 'left'
        }}>
          <div style={{
            fontWeight: '700',
            fontSize: '14px',
            color: '#1a1a1a',
            marginBottom: '20px',
            lineHeight: '1.5'
          }}>
            Have questions or need support? We’re here to help you with quick and reliable assistance.
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ fontSize: '14px', color: 'var(--gray-600)', display: 'flex', alignItems: 'center' }}>
              <span style={{ marginRight: '12px', display: 'flex', alignItems: 'center', color: '#1a1a1a' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
              </span>
              getezi.service@gmail.com
            </div>
            <div style={{ fontSize: '14px', color: 'var(--gray-600)', display: 'flex', alignItems: 'center' }}>
              <span style={{ marginRight: '12px', display: 'flex', alignItems: 'center', color: '#1a1a1a' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
              </span>
              +91 6305213334
            </div>
            <div style={{ fontSize: '14px', color: 'var(--gray-600)', display: 'flex', alignItems: 'center' }}>
              <span style={{ marginRight: '12px', display: 'flex', alignItems: 'center', color: '#25D366' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"></path></svg>
              </span>
              +91 6354826498
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FAQsDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const [openIndex, setOpenIndex] = useState(null);

  const sections = [
    {
      title: "How does the system work?",
      desc: "Users can book tokens online or join a virtual queue by checking real-time availability."
    },
    {
      title: "Who can use this platform?",
      desc: "Government offices, hospitals, and service organizations can register and manage queues."
    },
    {
      title: "Do users get notifications?",
      desc: "Yes, automated reminders are sent when their turn is approaching."
    }
  ];

  return (
    <div
      style={{ position: 'relative', display: 'inline-block' }}
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => { setIsOpen(false); setOpenIndex(null); }}
    >
      <a href="#faqs" style={{ cursor: 'pointer', display: 'block', padding: '10px 0' }}>FAQs</a>

      {isOpen && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: '0',
          width: '350px',
          background: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(10px)',
          borderRadius: '12px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
          padding: '20px',
          zIndex: 1000,
          border: '1px solid rgba(0,0,0,0.05)',
          animation: 'fade-in 0.2s ease-out'
        }}>
          {sections.map((item, idx) => (
            <div key={idx} style={{
              marginBottom: idx === sections.length - 1 ? 0 : '12px',
              paddingBottom: idx === sections.length - 1 ? 0 : '12px',
              borderBottom: idx === sections.length - 1 ? 'none' : '1px solid rgba(0,0,0,0.06)'
            }}>
              <div
                onClick={() => setOpenIndex(openIndex === idx ? null : idx)}
                style={{
                  fontWeight: '700',
                  fontSize: '14px',
                  color: '#1a1a1a',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '4px 0'
                }}
              >
                {item.title}
                <span style={{ transition: 'transform 0.2s', transform: openIndex === idx ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6" /></svg>
                </span>
              </div>

              {openIndex === idx && (
                <div style={{
                  fontSize: '13px',
                  color: 'var(--gray-500)',
                  marginTop: '4px',
                  lineHeight: '1.4',
                  paddingLeft: '4px',
                  borderLeft: '2px solid #e1e4e8',
                  animation: 'fade-in 0.2s ease-out',
                  opacity: 0.8
                }}>
                  {item.desc}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Landing View Component
// Landing View Component
function LandingView({ onLogin, onRegisterAdmin, onRegisterCustomer }) {
  // Functions to handle quick access clicks by mapping roles to view states or register actions
  const handleQuickLogin = (role) => {
    onLogin(role);
  };

  const handleQuickRegister = (role) => {
    if (role === 'office_owner') onRegisterAdmin();
    else if (role === 'customer') onRegisterCustomer();
  };

  return (
    <main className="min-h-screen bg-background">
      <Header />
      <Hero />
      <QuickAccess onLogin={handleQuickLogin} onRegister={handleQuickRegister} />
      <Stats />
      <Features />
      <About />
      <Footer />
    </main>
  );
}

function NotificationPanel({ userId, onClose }) {
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    fetchJSON(`/api/notifications?userId=${userId}`).then((data) => {
      setNotifications(data.notifications || []);
    });
  }, [userId]);

  const markRead = async (id) => {
    await fetchJSON(`/api/notifications/${id}/read`, { method: 'POST' });
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: 1 } : n))
    );
  };

  return (
    <div className="notification-panel">
      <div className="panel-header">
        <h4>Notifications</h4>
        <button className="ghost" onClick={onClose}>Close</button>
      </div>
      <div className="notification-list-container">
        {notifications.length === 0 && <div className="notification-empty">No notifications</div>}
        {notifications.map((n) => (
          <div
            key={n.id}
            className={`notification-item ${n.is_read ? '' : 'unread'}`}
            onClick={() => markRead(n.id)}
          >
            <div className="notification-content">
              <div>{n.message}</div>
              {/* Simulated timestamp if missing */}
              <div className="notification-time">Just now</div>
            </div>
            {!n.is_read && <div className="notification-mark">✓</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

// --- Modern MapLibre Location Picker ---
function MapLibreLocationPicker({ onSelect, onDetect, status }) {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const marker = useRef(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [viewState, setViewState] = useState({
    address: '',
    lat: null,
    lng: null,
    eta: null,
    distInfo: null
  });

  // Init Map
  useEffect(() => {
    if (map.current) return;

    // Premium Map Config
    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: 'https://api.maptiler.com/maps/streets-v2/style.json?key=hq8a5DxB5pz29aRkLMs1',
      center: [78.9629, 20.5937],
      zoom: 4,
      pitchWithRotate: true,
      dragRotate: true,
      touchZoomRotate: true,
      backdrop: false,
      inertia: true,
      inertiaDuration: 300,
      fadeDuration: 300,
      zoomAnimation: true,
      scrollZoom: { smooth: true }
    });

    map.current.addControl(new maplibregl.NavigationControl(), 'bottom-right');

    map.current.on('click', (e) => {
      placeMarker(e.lngLat.lat, e.lngLat.lng);
    });
  }, []);

  // Update logic when external status asks to detect
  useEffect(() => {
    if (status === 'detecting') {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          map.current.flyTo({ center: [longitude, latitude], zoom: 14, speed: 1.2, curve: 1.42, essential: true });
          placeMarker(latitude, longitude);
        },
        (err) => console.error(err),
        { timeout: 10000 }
      );
    }
  }, [status]);

  const placeMarker = async (lat, lng) => {
    // 1. Move Marker
    if (!marker.current) {
      marker.current = new maplibregl.Marker({ draggable: true })
        .setLngLat([lng, lat])
        .addTo(map.current);

      marker.current.on('dragend', () => {
        const { lat: dLat, lng: dLng } = marker.current.getLngLat();
        placeMarker(dLat, dLng);
      });
    } else {
      marker.current.setLngLat([lng, lat]);
    }

    // 2. Reverse Geocode (Nominatim)
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
      const data = await res.json();
      const addr = data.display_name.split(',').slice(0, 3).join(', ');

      // 3. Calc ETA (OSRM) - Hypothetical Office Location (e.g. Pune City Center for demo)
      // In real app, pass office lat/lng as props
      const officeLat = 18.5204;
      const officeLng = 73.8567;

      let etaVal = 15; // default fallback
      try {
        const routeRes = await fetch(`http://router.project-osrm.org/route/v1/driving/${lng},${lat};${officeLng},${officeLat}?overview=false`);
        const routeData = await routeRes.json();
        if (routeData.routes && routeData.routes.length > 0) {
          const durationSecs = routeData.routes[0].duration;
          etaVal = Math.ceil(durationSecs / 60);
        }
      } catch (err) {
        // OSRM Public API might limit valid requests or fallback
        console.warn('OSRM Route failed, using fallback');
      }

      setViewState({ lat, lng, address: addr, eta: etaVal });
      onSelect({ lat, lng, address: data.display_name, travelTime: etaVal });

    } catch (e) {
      console.error(e);
      setViewState({ lat, lng, address: `${lat.toFixed(4)}, ${lng.toFixed(4)}`, eta: 20 });
      onSelect({ lat, lng, address: `${lat}, ${lng}`, travelTime: 20 });
    }
  };

  const handleSearch = async (e) => {
    const q = e.target.value;
    setSearchQuery(q);
    if (q.length > 2) {
      // Use Photon API
      try {
        const res = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=5`);
        const data = await res.json();
        setSearchResults(data.features || []);
      } catch (err) { }
    } else {
      setSearchResults([]);
    }
  };

  const selectResult = (feature) => {
    const [lng, lat] = feature.geometry.coordinates;
    const name = feature.properties.name || feature.properties.street || 'Selected Location';
    const city = feature.properties.city || feature.properties.state || '';
    const fullAddr = `${name}, ${city}`;

    setSearchQuery(fullAddr);
    setSearchResults([]);
    map.current.flyTo({ center: [lng, lat], zoom: 15, speed: 1.5, curve: 1.42, essential: true });
    placeMarker(lat, lng);
  };

  return (
    <div style={{ position: 'relative', height: '320px', width: '100%', borderRadius: '16px', overflow: 'hidden', boxShadow: 'var(--shadow-md)', border: '1px solid var(--gray-200)' }}>
      {/* Search Bar */}
      <div style={{ position: 'absolute', top: '16px', left: '16px', right: '16px', zIndex: 10 }}>
        <input
          className="input-field"
          style={{ width: '100%', paddingLeft: '40px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
          placeholder="Search places..."
          value={searchQuery}
          onChange={handleSearch}
        />
        <span style={{ position: 'absolute', left: '12px', top: '12px' }}>🔍</span>

        {searchResults.length > 0 && (
          <div style={{ background: 'white', marginTop: '8px', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }}>
            {searchResults.map((r, i) => (
              <div
                key={i}
                onClick={() => selectResult(r)}
                style={{ padding: '12px', borderBottom: '1px solid #eee', cursor: 'pointer' }}
                className="hover-bg-gray"
              >
                <div style={{ fontWeight: 600 }}>{r.properties.name}</div>
                <div style={{ fontSize: '0.8rem', color: '#666' }}>{r.properties.city}, {r.properties.country}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div ref={mapContainer} style={{ width: '100%', height: '100%' }} />

      {/* Info Panel */}
      <div style={{ position: 'absolute', bottom: '16px', left: '16px', right: '16px', zIndex: 10, display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
        <div style={{ flex: 1 }}>
          {viewState.address && (
            <div className="animate-slide-up" style={{ background: 'white', padding: '16px', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#888', marginBottom: '4px' }}>Verified Location</div>
              <div style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: '8px', lineHeight: '1.4' }}>{viewState.address}</div>
              <div style={{ display: 'flex', gap: '12px', fontSize: '0.9rem' }}>
                <span style={{ color: 'var(--primary-600)', fontWeight: 600 }}>🚗 ~{viewState.eta} mins</span>
              </div>
            </div>
          )}
        </div>
        <button
          onClick={onDetect}
          className="hover-lift"
          style={{
            background: 'white', border: 'none', borderRadius: '12px', width: '48px', height: '48px',
            display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.2)', cursor: 'pointer', fontSize: '1.4rem'
          }}
          title="Detect My Location"
        >
          🎯
        </button>
      </div>
    </div>
  );
}

// 3-Step Booking Wizard
function BookingModal({ isOpen, onClose, onSubmit, office, user }) {
  if (!isOpen) return null;

  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    customerName: user?.name || '',
    customerEmail: '',
    customerContact: '',
    serviceType: '',
    userLat: null,
    userLng: null,
    customerAddress: '',
    travelTime: 0
  });
  const [locationStatus, setLocationStatus] = useState('');

  const nextStep = () => setStep(s => s + 1);
  const prevStep = () => setStep(s => s - 1);

  const handleSubmit = () => {
    onSubmit(form);
    onClose();
    setStep(1); // Reset
  };

  const handleDetect = () => {
    setLocationStatus('detecting');
    // Actual detection logic handled inside LocationPicker now via prop
  };

  const services = office?.service_type
    ? office.service_type.split(',').map(s => s.trim()).filter(Boolean)
    : ['General Inquiry', 'Support', 'Consultation'];

  return (
    <div className="modal-overlay">
      <div className="modal-content animate-slide-up" style={{ padding: '0', overflow: 'hidden', maxWidth: '550px' }}>
        {/* Header with Progress */}
        <div style={{ padding: '24px', background: 'var(--gray-50)', borderBottom: '1px solid var(--gray-200)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '1.2rem' }}>Book Appointment</h3>
            <button className="btn btn-ghost small" onClick={onClose}>Close</button>
          </div>
          <div style={{ display: 'flex', gap: '4px' }}>
            {[1, 2, 3].map(s => (
              <div key={s} style={{
                height: '4px', flex: 1, borderRadius: '2px',
                background: s <= step ? 'var(--primary-500)' : 'var(--gray-300)',
                transition: 'background 0.3s ease'
              }} />
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '8px' }}>
            <span>Details</span>
            <span>Service</span>
            <span>Location</span>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: '32px' }}>
          {step === 1 && (
            <div className="animate-fade-in">
              <h4 style={{ marginBottom: '20px' }}>Your Details</h4>
              <div className="grid-1" style={{ gap: '16px' }}>
                <div className="input-group">
                  <label className="input-label">Full Name</label>
                  <input className="input-field" value={form.customerName} onChange={e => setForm({ ...form, customerName: e.target.value })} autoFocus />
                </div>
                <div className="input-group">
                  <label className="input-label">Email Address</label>
                  <input className="input-field" type="email" value={form.customerEmail} onChange={e => setForm({ ...form, customerEmail: e.target.value })} />
                </div>
                <div className="input-group">
                  <label className="input-label">Phone (Optional)</label>
                  <input className="input-field" type="tel" value={form.customerContact} onChange={e => setForm({ ...form, customerContact: e.target.value })} />
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="animate-fade-in">
              <h4 style={{ marginBottom: '20px' }}>Select Service</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                {services.map(service => (
                  <button
                    key={service}
                    className="hover-lift"
                    onClick={() => setForm({ ...form, serviceType: service })}
                    style={{
                      padding: '16px', borderRadius: '12px', border: form.serviceType === service ? '2px solid var(--primary-500)' : '1px solid var(--gray-200)',
                      background: form.serviceType === service ? 'var(--primary-50)' : 'white',
                      textAlign: 'left', cursor: 'pointer', transition: 'all 0.2s'
                    }}
                  >
                    <div style={{ fontWeight: '600', color: form.serviceType === service ? 'var(--primary-700)' : 'var(--gray-900)' }}>{service}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="animate-fade-in">
              <h4 style={{ marginBottom: '12px' }}>Confirm Location</h4>
              <p className="text-muted" style={{ fontSize: '0.9rem', marginBottom: '20px' }}>Search or pin your location to calculate ETA.</p>
              <MapLibreLocationPicker
                status={locationStatus}
                onDetect={handleDetect}
                onSelect={({ lat, lng, address, travelTime }) => {
                  setForm(f => ({ ...f, userLat: lat, userLng: lng, customerAddress: address, travelTime }));
                  setLocationStatus('detected');
                }}
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '24px', borderTop: '1px solid var(--gray-200)', display: 'flex', justifyContent: 'space-between' }}>
          {step > 1 ? (
            <button className="btn btn-secondary" onClick={prevStep}>Back</button>
          ) : (
            <div /> // Spacer
          )}

          {step < 3 ? (
            <button
              className="btn btn-primary"
              onClick={nextStep}
              disabled={step === 1 ? (!form.customerName || !form.customerEmail) : (!form.serviceType)}
            >
              Next Step
            </button>
          ) : (
            <button
              className="btn btn-primary"
              onClick={handleSubmit}
              disabled={!form.userLat && !form.userLng}
              style={{ paddingLeft: '32px', paddingRight: '32px' }}
            >
              Confirm Booking
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
const ProfileMenu = ({ user, onNavigate, onLogout }) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="profile-menu" ref={menuRef} style={{ position: 'relative' }}>
      <button className="ghost" onClick={() => setIsOpen(!isOpen)} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px', border: 'none', background: 'transparent' }}>
        <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--gray-100)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 5px rgba(0,0,0,0.1)' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
            <circle cx="12" cy="7" r="4"></circle>
          </svg>
        </div>
      </button>
      {isOpen && (
        <div className="dropdown" style={{ position: 'absolute', top: '120%', right: 0, background: '#fff', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', borderRadius: '12px', padding: '8px', zIndex: 100, minWidth: '180px', display: 'flex', flexDirection: 'column', gap: '4px', border: '1px solid var(--gray-200)' }}>
          <button className="ghost" onClick={() => { setIsOpen(false); onNavigate('profile'); }} style={{ justifyContent: 'flex-start', textAlign: 'left' }}>Use Profile</button>
          <button className="ghost" onClick={() => { setIsOpen(false); onNavigate('settings'); }} style={{ justifyContent: 'flex-start', textAlign: 'left' }}>Settings</button>
          <div style={{ height: '1px', background: 'var(--gray-200)', margin: '4px 0' }} />
          <button className="ghost" onClick={onLogout} style={{ justifyContent: 'flex-start', textAlign: 'left', color: 'var(--state-error)' }}>Logout</button>
        </div>
      )}
    </div>
  );
};

const ProfileView = ({ user, onBack, office }) => {
  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
      <div className="page-header">
        <div>
          <h2 className="page-title">My Profile</h2>
          <p className="page-subtitle">Manage your personal information</p>
        </div>
        <button className="btn btn-ghost" onClick={onBack}>Back to Dashboard</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 1fr) 300px', gap: '32px', alignItems: 'start' }}>
        {/* Left Col: Personal Info */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '32px' }}>
            <div style={{
              width: '80px', height: '80px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--primary-500), var(--primary-700))',
              color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', fontWeight: 'bold',
              boxShadow: '0 4px 12px rgba(99, 102, 241, 0.4)'
            }}>
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h3 style={{ fontSize: '1.5rem', marginBottom: '4px' }}>{user.name}</h3>
              <div className={`chip ${user.role === 'admin' ? 'chip-success' : 'chip-warning'}`}>
                <span className="chip-dot"></span>
                {user.role}
              </div>
            </div>
          </div>

          <h4 style={{ marginBottom: '20px', borderBottom: '1px solid var(--gray-200)', paddingBottom: '12px' }}>Personal Details</h4>
          <div className="grid-2">
            <div className="input-group">
              <label className="input-label">Email</label>
              <div className="input-field" style={{ background: 'var(--gray-50)' }}>{user.email}</div>
            </div>
            <div className="input-group">
              <label className="input-label">Phone</label>
              <div className="input-field" style={{ background: 'var(--gray-50)' }}>{user.phone || 'Not provided'}</div>
            </div>
            <div className="input-group">
              <label className="input-label">Date of Birth</label>
              <div className="input-field" style={{ background: 'var(--gray-50)' }}>{user.dob ? new Date(user.dob).toLocaleDateString() : 'Not provided'}</div>
            </div>
            <div className="input-group">
              <label className="input-label">Age/Gender</label>
              <div className="input-field" style={{ background: 'var(--gray-50)' }}>
                {user.age ? `${user.age} yrs` : '-'} · {user.gender || '-'}
              </div>
            </div>
          </div>
        </div>

        {/* Right Col: Office / Stats */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {user.role === 'admin' && office ? (
            <div className="card hover-lift">
              <h4 style={{ marginBottom: '16px' }}>Office Structure</h4>
              <div className="input-group">
                <label className="input-label">Office Name</label>
                <div style={{ fontWeight: '600', fontSize: '1.1rem' }}>{office.name}</div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
                <span className="text-muted">Avg. Service Time</span>
                <span className="chip chip-success">{office.avg_service_minutes} mins</span>
              </div>
            </div>
          ) : (
            <div className="card hover-lift">
              <h4 style={{ marginBottom: '16px' }}>Membership</h4>
              <div style={{ padding: '16px', background: 'var(--primary-50)', borderRadius: '12px', border: '1px solid var(--primary-100)' }}>
                <div style={{ fontSize: '0.9rem', color: 'var(--primary-700)', fontWeight: '600' }}>Standard Member</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--primary-600)', marginTop: '4px' }}>Joined {new Date().getFullYear()}</div>
              </div>
            </div>
          )}

          <div className="card" style={{ background: 'linear-gradient(135deg, var(--primary-600), var(--primary-700))', color: 'white' }}>
            <h4 style={{ color: 'white', marginBottom: '8px' }}>GetEzi Pro</h4>
            <p style={{ fontSize: '0.9rem', opacity: 0.9, marginBottom: '16px' }}>Upgrade to manage multiple offices and get advanced analytics.</p>
            <button className="btn" style={{ background: 'rgba(255,255,255,0.2)', color: 'white', width: '100%', border: 'none' }}>Coming Soon</button>
          </div>
        </div>
      </div>
    </div>
  );
};

const SettingsView = ({ user, onBack, adminKey, selectedOfficeId }) => {
  const [retention, setRetention] = useState(user.history_retention_days || 30);
  const [exportStart, setExportStart] = useState(new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]);
  const [exportEnd, setExportEnd] = useState(new Date().toISOString().split('T')[0]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  // New Availability State
  const [availability, setAvailability] = useState(1);

  // New Settings State
  const [timingsForm, setTimingsForm] = useState({
    address: '',
    opening_time: '09:00',
    closing_time: '17:00',
    lunch_start: '',
    lunch_end: '',
    lunch_flex_minutes: 30,
    auto_noshow_enabled: false,
    auto_noshow_grace_minutes: 5
  });
  const [timingsLoading, setTimingsLoading] = useState(false);

  // Fetch Office Config on Mount
  useEffect(() => {
    if (selectedOfficeId) {
      fetchJSON(`/api/offices/${selectedOfficeId}`)
        .then(data => {
          if (data && data.office) {
            const o = data.office;
            setAvailability(o.counter_count || 1);
            setTimingsForm({
              address: o.address || '',
              opening_time: o.opening_time || '09:00',
              closing_time: o.closing_time || '17:00',
              lunch_start: o.lunch_start || '',
              lunch_end: o.lunch_end || '',
              lunch_flex_minutes: o.lunch_flex_minutes || 30,
              auto_noshow_enabled: !!o.auto_noshow_enabled,
              auto_noshow_grace_minutes: o.auto_noshow_grace_minutes || 5
            });
          }
        })
        .catch(err => console.error("Failed to load office config", err));
    }
  }, [selectedOfficeId]);

  const handleSaveTimings = async () => {
    if (!adminKey && user.role !== 'office_owner') return setMessage('Access Denied');
    setTimingsLoading(true);
    try {
      await fetchJSON(`/api/offices/${selectedOfficeId}/timings`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }, // Ensure auth
        body: JSON.stringify(timingsForm)
      });
      setMessage('Office timings updated.');
    } catch (err) { setMessage(err.message); } finally { setTimingsLoading(false); }
  };

  const handleSaveAvailability = async () => {
    if (!adminKey) return setMessage('Admin Access Required');
    setLoading(true);
    try {
      await fetchJSON(`/api/offices/${selectedOfficeId}/config`, {
        method: 'PATCH',
        headers: { 'x-admin-key': adminKey },
        body: JSON.stringify({ counterCount: Number(availability) }),
      });
      setMessage('Office capacity updated.');
    } catch (err) { setMessage(err.message); } finally { setLoading(false); }
  };

  const handleSaveRetention = async () => {
    if (!adminKey) return setMessage('Admin Access Required');
    setLoading(true);
    try {
      await fetchJSON('/api/admin/settings', {
        method: 'PUT',
        body: JSON.stringify({ userId: user.id, retentionDays: Number(retention) })
      });
      setMessage('Preferences saved successfully.');
    } catch (err) { setMessage(err.message); } finally { setLoading(false); }
  };

  const handleExport = async () => {
    if (!adminKey) return setMessage('Admin Access Required');
    setLoading(true);
    try {
      const query = new URLSearchParams({ start: exportStart, end: exportEnd, format: 'xlsx' }).toString();
      const response = await fetch(`/api/admin/export?${query}`, {
        headers: { 'x-admin-key': adminKey }
      });
      if (!response.ok) throw new Error('Export failed');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `token_history_${exportStart}_to_${exportEnd}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setMessage('Export started.');
    } catch (err) { setMessage(err.message); } finally { setLoading(false); }
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <div className="page-header">
        <div>
          <h2 className="page-title">Settings</h2>
          <p className="page-subtitle">Configure your workspace preferences</p>
        </div>
        <button className="btn btn-ghost" onClick={onBack}>Back to Dashboard</button>
      </div>

      <div style={{ display: 'grid', gap: '24px' }}>
        {/* Office Settings (Availability) */}
        {['admin', 'office_owner'].includes(user.role) && (
          <section className="card hover-lift">
            <div className="panel-header">
              <div>
                <h3 style={{ fontSize: '1.2rem' }}>Office Settings</h3>
                <p className="text-muted" style={{ fontSize: '0.9rem', marginTop: '4px' }}>Configure operational capacity.</p>
              </div>
            </div>
            <div className="grid-2">
              <div className="input-group">
                <label className="input-label">Max Active Counters (Availability)</label>
                <input
                  type="number"
                  className="input-field"
                  value={availability}
                  onChange={e => setAvailability(e.target.value)}
                  min="1"
                />
                <small className="text-muted" style={{ fontSize: '0.8rem', marginTop: '4px' }}>
                  Limits simultaneous operators. Excess staff become Spectators.
                </small>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-start', paddingTop: '28px' }}>
                <button className="btn btn-primary" onClick={handleSaveAvailability} disabled={loading} style={{ width: '100%' }}>
                  Update Capacity
                </button>
              </div>
            </div>
          </section>
        )}

        {/* Location & Timings Card */}
        {['admin', 'office_owner'].includes(user.role) && (
          <section className="card hover-lift">
            <div className="panel-header">
              <div>
                <h3 style={{ fontSize: '1.2rem' }}>Location & Timings</h3>
                <p className="text-muted" style={{ fontSize: '0.9rem', marginTop: '4px' }}>Manage address, operating hours, and automation.</p>
              </div>
            </div>

            <div style={{ padding: '0 0 24px 0' }}>
              {/* Location */}
              <div style={{ marginBottom: '24px' }}>
                <label className="input-label">Office Address</label>
                <textarea
                  value={timingsForm.address}
                  onChange={e => setTimingsForm({ ...timingsForm, address: e.target.value })}
                  className="input-field"
                  placeholder="Building, Street, City..."
                  style={{ minHeight: '80px', fontFamily: 'inherit' }}
                />
              </div>

              {/* Timings */}
              <div style={{ marginBottom: '24px' }}>
                <label className="input-label" style={{ marginBottom: '12px', display: 'block' }}>Operating Hours</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <span style={{ fontSize: '0.8rem', color: 'var(--gray-500)', display: 'block', marginBottom: '4px' }}>Opens</span>
                    <input type="time" className="input-field" value={timingsForm.opening_time} onChange={e => setTimingsForm({ ...timingsForm, opening_time: e.target.value })} />
                  </div>
                  <div>
                    <span style={{ fontSize: '0.8rem', color: 'var(--gray-500)', display: 'block', marginBottom: '4px' }}>Closes</span>
                    <input type="time" className="input-field" value={timingsForm.closing_time} onChange={e => setTimingsForm({ ...timingsForm, closing_time: e.target.value })} />
                  </div>
                </div>
              </div>

              {/* Lunch */}
              <div style={{ marginBottom: '24px' }}>
                <label className="input-label" style={{ marginBottom: '12px', display: 'block' }}>Lunch Break (Optional)</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <span style={{ fontSize: '0.8rem', color: 'var(--gray-500)', display: 'block', marginBottom: '4px' }}>Start</span>
                    <input type="time" className="input-field" value={timingsForm.lunch_start} onChange={e => setTimingsForm({ ...timingsForm, lunch_start: e.target.value })} />
                  </div>
                  <div>
                    <span style={{ fontSize: '0.8rem', color: 'var(--gray-500)', display: 'block', marginBottom: '4px' }}>End</span>
                    <input type="time" className="input-field" value={timingsForm.lunch_end} onChange={e => setTimingsForm({ ...timingsForm, lunch_end: e.target.value })} />
                  </div>
                </div>
              </div>

              {/* Automation */}
              <div style={{ padding: '16px', background: 'var(--gray-50)', borderRadius: '8px', marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <label style={{ fontWeight: 600, color: 'var(--gray-800)' }}>Auto No-Show</label>
                  <label className="switch">
                    <input
                      type="checkbox"
                      checked={timingsForm.auto_noshow_enabled}
                      onChange={e => setTimingsForm({ ...timingsForm, auto_noshow_enabled: e.target.checked })}
                    />
                    <span className="slider round"></span>
                  </label>
                </div>
                <p className="text-muted" style={{ fontSize: '0.85rem', marginBottom: '16px' }}>
                  Automatically mark customers as No-Show if they don't arrive within the grace period.
                </p>
                <div>
                  <label className="input-label">Grace Period (Minutes)</label>
                  <input
                    type="number"
                    className="input-field"
                    value={timingsForm.auto_noshow_grace_minutes}
                    onChange={e => setTimingsForm({ ...timingsForm, auto_noshow_grace_minutes: parseInt(e.target.value) })}
                    min="1" max="30"
                    disabled={!timingsForm.auto_noshow_enabled}
                  />
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <button
                  className="btn btn-primary"
                  onClick={handleSaveTimings}
                  disabled={timingsLoading}
                  style={{ width: '100%' }}
                >
                  {timingsLoading ? 'Saving...' : 'Save Settings'}
                </button>
              </div>
            </div>
          </section>
        )}

        {/* Data Retention Card */}
        {['admin', 'office_owner'].includes(user.role) ? (
          <>
            <section className="card hover-lift">
              <div className="panel-header">
                <div>
                  <h3 style={{ fontSize: '1.2rem' }}>Data Management</h3>
                  <p className="text-muted" style={{ fontSize: '0.9rem', marginTop: '4px' }}>Control how long your data is stored.</p>
                </div>
              </div>
              <div className="grid-2">
                <div className="input-group">
                  <label className="input-label">History Retention (Days)</label>
                  <select
                    className="input-field"
                    value={retention}
                    onChange={e => setRetention(e.target.value)}
                    style={{ cursor: 'pointer' }}
                  >
                    <option value={7}>7 Days</option>
                    <option value={14}>14 Days</option>
                    <option value={30}>30 Days</option>
                    <option value={60}>60 Days</option>
                    <option value={90}>90 Days</option>
                    <option value={365}>1 Year</option>
                  </select>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: '8px' }}>
                  <button className="btn btn-primary" onClick={handleSaveRetention} disabled={loading} style={{ width: '100%' }}>
                    {loading ? 'Saving...' : 'Save Preference'}
                  </button>
                </div>
              </div>
              {message && <div style={{ marginTop: '12px', color: 'var(--primary-600)', fontWeight: '500' }}>{message}</div>}
            </section>

            {/* Export Card */}
            <section className="card hover-lift">
              <div className="panel-header">
                <div>
                  <h3 style={{ fontSize: '1.2rem' }}>Export Data</h3>
                  <p className="text-muted" style={{ fontSize: '0.9rem', marginTop: '4px' }}>Download your token history as CSV.</p>
                </div>
              </div>
              <div className="grid-3">
                <div className="input-group">
                  <label className="input-label">Start Date</label>
                  <input type="date" className="input-field" value={exportStart} onChange={e => setExportStart(e.target.value)} />
                </div>
                <div className="input-group">
                  <label className="input-label">End Date</label>
                  <input type="date" className="input-field" value={exportEnd} onChange={e => setExportEnd(e.target.value)} />
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: '8px' }}>
                  <button className="btn btn-secondary" onClick={handleExport} style={{ width: '100%' }}>
                    Download CSV
                  </button>
                </div>
              </div>
            </section>
          </>
        ) : (
          <div className="card hover-lift text-center" style={{ padding: '48px' }}>
            <h3 style={{ marginBottom: '8px' }}>Coming Soon</h3>
            <p className="text-muted">Customer preferences are under development.</p>
          </div>
        )}

        {/* Future Settings Placeholder */}
        <section className="card" style={{ opacity: 0.7 }}>
          <div className="panel-header">
            <div>
              <h3 style={{ fontSize: '1.2rem' }}>Notifications</h3>
              <p className="text-muted" style={{ fontSize: '0.9rem', marginTop: '4px' }}>Email & SMS alerts (Coming Soon)</p>
            </div>
            <span className="chip chip-warning">Beta</span>
          </div>
          <div className="input-group">
            <label className="input-label">Daily Digest</label>
            <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
              <button className="btn btn-secondary" disabled>Email Me</button>
              <button className="btn btn-secondary" disabled>SMS Me</button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

const HistoryView = ({ user, onBack, adminKey, selectedOfficeId }) => {
  const [history, setHistory] = useState([]);
  const [start, setStart] = useState(new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]);
  const [end, setEnd] = useState(new Date().toISOString().split('T')[0]);
  const [status, setStatus] = useState('all');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadHistory();
  }, [start, end, status]);

  const loadHistory = async () => {
    if (!adminKey) return;
    setLoading(true);
    try {
      const query = `officeId=${selectedOfficeId}&start=${start}&end=${end}&status=${status}`;
      const data = await fetchJSON(`/api/admin/token-history?${query}`);
      setHistory(data.history || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card" style={{ maxWidth: '800px', margin: '40px auto' }}>
      <div className="panel-header">
        <h3>Token Archives</h3>
        <button className="btn btn-ghost" onClick={onBack}>Back</button>
      </div>

      <div className="grid-3" style={{ marginBottom: '20px' }}>
        <label className="input-group">
          <span className="input-label">From</span>
          <input className="input-field" type="date" value={start} onChange={e => setStart(e.target.value)} />
        </label>
        <label className="input-group">
          <span className="input-label">To</span>
          <input className="input-field" type="date" value={end} onChange={e => setEnd(e.target.value)} />
        </label>
        <label className="input-group">
          <span className="input-label">Status</span>
          <select className="input-field" value={status} onChange={e => setStatus(e.target.value)}>
            <option value="all">All</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
            <option value="no-show">No Show</option>
          </select>
        </label>
      </div>

      <div className="token-list" style={{ maxHeight: '400px', overflowY: 'auto' }}>
        {loading && <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading records...</div>}
        {!loading && history.length === 0 && (
          <div className="empty-state" style={{ padding: '40px' }}>No archived records found for this range.</div>
        )}
        {history.map(t => (
          <div key={t.id} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '16px', borderBottom: '1px solid var(--gray-100)'
          }}>
            <div>
              <div style={{ fontWeight: 'bold', fontSize: '1rem', color: 'var(--primary-700)' }}>#{t.token_number} - {t.user_name}</div>
              <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                {new Date(t.created_at).toLocaleDateString()} · {t.service_type} · <span className="badge badge-neutral">{t.status}</span>
              </div>
            </div>
            <div className="badge badge-neutral" style={{ fontSize: '0.8rem' }}>
              Archived: {new Date(t.archived_at).toLocaleDateString()}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// --- 4. Pause Modal ---
function PauseModal({ isOpen, onClose, onPause }) {
  if (!isOpen) return null;
  const reasons = ['Short Break', 'Lunch Break', 'System Maintenance', 'End of Day'];
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'white', padding: '24px', borderRadius: '12px', width: '90%', maxWidth: '400px' }}>
        <h3 style={{ marginBottom: '16px', fontSize: '1.25rem' }}>Pause Operations</h3>
        <p style={{ color: '#6b7280', marginBottom: '20px' }}>Select a reason for pausing the queue. This will stop the ETA countdown for all customers.</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {reasons.map(r => (
            <button key={r} className="btn btn-secondary" style={{ justifyContent: 'flex-start', textAlign: 'left' }} onClick={() => onPause(r)}>
              {r}
            </button>
          ))}
        </div>
        <button className="btn btn-ghost" style={{ width: '100%', marginTop: '16px' }} onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}

// --- 5. Status Banner ---
function StatusBanner({ office }) {
  if (!office) return null;

  // 1. Manual Pause (Highest Priority)
  if (office.state && office.state !== 'LIVE') {
    return (
      <div style={{
        background: '#fffebf', color: '#92400e', padding: '12px',
        textAlign: 'center', fontWeight: 600, borderBottom: '1px solid #fcd34d',
        position: 'sticky', top: 0, zIndex: 90, gridColumn: '1 / -1'
      }}>
        ⏸ Office is currently PAUSED: {office.state}
      </div>
    );
  }

  // 2. Closed
  if (office.current_status === 'CLOSED') {
    return (
      <div style={{
        background: '#fef2f2', color: '#b91c1c', padding: '12px',
        textAlign: 'center', fontWeight: 600, borderBottom: '1px solid #fecaca',
        position: 'sticky', top: 0, zIndex: 90, gridColumn: '1 / -1'
      }}>
        🔴 Office is CLOSED. Opens at {office.opening_time || '09:00'}
      </div>
    );
  }

  // 3. Lunch Break
  if (office.current_status === 'LUNCH_BREAK') {
    return (
      <div style={{
        background: '#fff7ed', color: '#c2410c', padding: '12px',
        textAlign: 'center', fontWeight: 600, borderBottom: '1px solid #fed7aa',
        position: 'sticky', top: 0, zIndex: 90, gridColumn: '1 / -1'
      }}>
        🍊 Office is on LUNCH BREAK. Resumes at {office.lunch_end || '14:00'}
      </div>
    );
  }

  return null;
}

// --- NEW: Super Admin Dashboard ---
function SuperAdminDashboard({ user, office, onLogout, onNavigate }) {
  const [activeTab, setActiveTab] = useState('staff'); // 'staff', 'settings', 'stats'

  // Staff State
  const [staffList, setStaffList] = useState([]);
  const [newStaff, setNewStaff] = useState({ name: '', email: '', password: '', counterNumber: '' });
  const [showAddStaff, setShowAddStaff] = useState(false);

  // Settings State
  const [activeCounters, setActiveCounters] = useState(office?.active_counters || 1);
  const [retention, setRetention] = useState(user.history_retention_days || 30);
  const [exportStart, setExportStart] = useState("");
  const [exportEnd, setExportEnd] = useState("");

  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (office) {
      loadStaff();
      setActiveCounters(office.active_counters || 1);
    }
  }, [office]);

  const loadStaff = async () => {
    try {
      const data = await fetchJSON(`/api/offices/${office.id}/staff-list`);
      setStaffList(data.staff);
    } catch (e) { console.error(e); }
  };

  const handleAddStaff = async (e) => {
    e.preventDefault();
    try {
      await fetchJSON(`/api/offices/${office.id}/staff`, {
        method: 'POST',
        body: JSON.stringify(newStaff)
      });
      setMsg('Staff added!');
      setNewStaff({ name: '', email: '', password: '', counterNumber: '' });
      setShowAddStaff(false);
      loadStaff();
    } catch (e) { setMsg(e.message); }
  };

  const handleRemoveStaff = async (staffId) => {
    if (!confirm('Remove this staff member?')) return;
    try {
      await fetchJSON(`/api/offices/${office.id}/staff/${staffId}`, { method: 'DELETE' });
      loadStaff();
    } catch (e) { setMsg(e.message); }
  };

  const updateActiveCounters = async () => {
    setLoading(true);
    try {
      await fetchJSON(`/api/offices/${office.id}/active-counters`, {
        method: 'POST',
        body: JSON.stringify({ activeCounters })
      });
      setMsg('Capacity updated');
    } catch (e) { setMsg(e.message); } finally { setLoading(false); }
  };

  const handleSaveRetention = async () => {
    setLoading(true);
    try {
      await fetchJSON('/api/admin/settings', {
        method: 'PUT',
        body: JSON.stringify({ userId: user.id, retentionDays: Number(retention) })
      });
      setMsg('Retention policy saved.');
    } catch (err) { setMsg(err.message); } finally { setLoading(false); }
  };

  const handleExport = async () => {
    if (!exportStart || !exportEnd) return setMsg("Select dates first");
    setMsg("Exporting...");
    try {
      const query = new URLSearchParams({ start: exportStart, end: exportEnd, format: 'xlsx' }).toString();
      fetch(`/api/admin/export?${query}`, { headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}` } })
        .then(res => res.blob())
        .then(blob => {
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `token_history.xlsx`;
          document.body.appendChild(a);
          a.click();
          a.remove();
          setMsg("Download started");
        });
    } catch (err) { setMsg(err.message); }
  };

  const handlePauseResume = async () => {
    if (!confirm(office.is_paused ? "Resume operations?" : "Pause operations?")) return;
    try {
      const action = office.is_paused ? 'resume' : 'pause';
      // We need an endpoint for this, assuming reuse of 'pause' logic
      // Actually 'pause' endpoint takes a body. Let's use simple toggle if API supports, or default reason.
      await fetchJSON(`/api/offices/${office.id}/${action}`, {
        method: 'POST',
        body: JSON.stringify({ reason: 'Manual Toggle', message: 'Operations update' })
      });
      // Force reload or wait for socket
      window.location.reload();
    } catch (e) { setMsg(e.message); }
  };

  return (
    <div className="dashboard-layout" style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <div className="eyebrow">Super Admin Portal</div>
          <h2 style={{ fontSize: '2rem', marginBottom: '4px' }}>{office?.name || 'My Office'}</h2>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <span className={`chip ${office?.is_paused ? 'chip-warning' : 'chip-success'}`}>
              <span className="chip-dot" />
              {office?.is_paused ? 'Operations Paused' : 'System Live'}
            </span>
            <span className="text-muted">Owner: {user.name}</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="btn btn-secondary" onClick={onLogout}>Logout</button>
        </div>
      </header>

      {/* Tabs */}
      <div className="tabs" style={{ display: 'flex', gap: '24px', borderBottom: '1px solid #eee', marginBottom: '24px' }}>
        <button className={`tab-btn ${activeTab === 'staff' ? 'active' : ''}`} onClick={() => setActiveTab('staff')}>Staff & Counters</button>
        <button className={`tab-btn ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')}>Office Controls</button>
        <button className={`tab-btn ${activeTab === 'stats' ? 'active' : ''}`} onClick={() => setActiveTab('stats')}>Analytics</button>
      </div>

      {msg && <div className={`message ${msg.includes('Error') ? 'error' : ''}`}>{msg}</div>}

      {activeTab === 'staff' && (
        <section className="card">
          <div className="panel-header" style={{ alignItems: 'flex-end', marginBottom: '20px' }}>
            <div>
              <h3>Staff Management</h3>
              <p style={{ color: '#6b7280', fontSize: '0.9rem', marginTop: '4px' }}>
                Manage who can operate counters. <br />
                <span style={{ fontSize: '0.8rem', color: 'var(--primary-600)' }}>
                  Current Active Capacity: <b>{activeCounters} counters</b>
                </span>
              </p>
            </div>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#4b5563' }}>Active Limit</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="number"
                    min="0"
                    value={activeCounters}
                    onChange={e => setActiveCounters(e.target.value)}
                    style={{ width: '80px', padding: '6px' }}
                    className="rounded-input"
                  />
                  <button className="btn btn-secondary small" onClick={updateActiveCounters} disabled={loading}>
                    {loading ? '...' : 'Set'}
                  </button>
                </div>
              </div>
              <button className="btn btn-primary" onClick={() => setShowAddStaff(!showAddStaff)}>
                {showAddStaff ? 'Cancel' : 'Add New Staff'}
              </button>
            </div>
          </div>

          {showAddStaff && (
            <form onSubmit={handleAddStaff} className="active-staff-form" style={{ background: '#f9fafb', padding: '20px', borderRadius: '8px', marginBottom: '24px' }}>
              <div className="grid-2">
                <input type="text" placeholder="Full Name" value={newStaff.name} onChange={e => setNewStaff({ ...newStaff, name: e.target.value })} required className="rounded-input" />
                <input type="email" placeholder="Email Address" value={newStaff.email} onChange={e => setNewStaff({ ...newStaff, email: e.target.value })} required className="rounded-input" />
              </div>
              <div className="grid-2" style={{ marginTop: '12px' }}>
                <input type="password" placeholder="Password" value={newStaff.password} onChange={e => setNewStaff({ ...newStaff, password: e.target.value })} required className="rounded-input" />
                <input type="number" placeholder="Assigned Counter #" value={newStaff.counterNumber} onChange={e => setNewStaff({ ...newStaff, counterNumber: e.target.value })} required className="rounded-input" />
              </div>
              <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
                <button type="submit" className="btn btn-black">Create Staff Account</button>
              </div>
            </form>
          )}

          <div className="staff-list" style={{ background: 'white', borderRadius: '12px', border: '1px solid #eee', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ background: '#f9fafb' }}>
                <tr style={{ textAlign: 'left' }}>
                  <th style={{ padding: '12px 16px', fontSize: '0.85rem', color: '#6b7280' }}>Staff Member</th>
                  <th style={{ padding: '12px 16px', fontSize: '0.85rem', color: '#6b7280' }}>Assigned Counter</th>
                  <th style={{ padding: '12px 16px', fontSize: '0.85rem', color: '#6b7280' }}>Status</th>
                  <th style={{ padding: '12px 16px', fontSize: '0.85rem', color: '#6b7280' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {staffList.length === 0 && <tr><td colSpan="4" style={{ padding: '20px', textAlign: 'center', color: '#9ca3af' }}>No staff found. Add someone to get started.</td></tr>}
                {staffList.map(s => (
                  <tr key={s.id} style={{ borderTop: '1px solid #eee' }}>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 500 }}>{s.name}</div>
                      <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>{s.email}</div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span className="badge badge-neutral">Counter #{s.assigned_counter}</span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      {parseInt(s.assigned_counter) <= parseInt(activeCounters) ? (
                        <span className="chip chip-success"><span className="chip-dot"></span> Active</span>
                      ) : (
                        <div title={`Increase "Active Limit" to at least ${s.assigned_counter} to enable this staff.`} style={{ cursor: 'help' }}>
                          <span className="chip chip-warning" style={{ opacity: 0.7 }}>
                            <span className="chip-dot" style={{ background: 'gray' }}></span>
                            Disabled (Limit {activeCounters})
                          </span>
                          <div style={{ fontSize: '0.7rem', color: 'red', marginTop: '2px' }}>Increase Limit to Enable</div>
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <button className="btn btn-ghost small" onClick={() => handleRemoveStaff(s.id)} style={{ color: '#ef4444' }}>Remove</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {activeTab === 'settings' && (
        <div className="animate-fade-in grid-2" style={{ alignItems: 'start', gap: '24px' }}>
          <section className="card">
            <div className="panel-header">
              <h3>Operational Capacity</h3>
            </div>
            <p className="text-muted" style={{ marginBottom: '16px' }}>Set the number of active counters. Staff on counters above this number will be disabled.</p>
            <div className="input-group">
              <label className="input-label">Active Counters</label>
              <input type="number" className="input-field" value={activeCounters} onChange={e => setActiveCounters(e.target.value)} min="1" />
            </div>
            <button className="btn btn-primary" style={{ marginTop: '16px', width: '100%' }} onClick={updateActiveCounters} disabled={loading}>
              {loading ? 'Saving...' : 'Update Capacity'}
            </button>

            <div style={{ marginTop: '32px', borderTop: '1px solid var(--gray-200)', paddingTop: '24px' }}>
              <h4 style={{ color: '#b91c1c' }}>Emergency Controls</h4>
              {office?.is_paused ? (
                <button className="btn btn-success" style={{ width: '100%', marginTop: '12px', backgroundColor: '#16a34a', color: 'white' }} onClick={handlePauseResume}>Resume Operations</button>
              ) : (
                <button className="btn btn-danger" style={{ width: '100%', marginTop: '12px', backgroundColor: '#fee2e2', color: '#b91c1c', border: '1px solid #fecaca' }} onClick={handlePauseResume}>Pause Operations</button>
              )}
            </div>
          </section>

          <section className="card">
            <div className="panel-header">
              <h3>Data & Reports</h3>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label className="input-label" style={{ marginBottom: '8px', display: 'block' }}>Data Retention Policy</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <select className="input-field" value={retention} onChange={e => setRetention(e.target.value)} style={{ flex: 1 }}>
                  <option value={7}>7 Days</option>
                  <option value={14}>14 Days</option>
                  <option value={30}>30 Days</option>
                  <option value={90}>90 Days</option>
                </select>
                <button className="btn btn-secondary" onClick={handleSaveRetention}>Save</button>
              </div>
            </div>

            <div style={{ marginTop: '24px', paddingTop: '24px', borderTop: '1px solid var(--gray-200)' }}>
              <h4 style={{ marginBottom: '16px' }}>Download Token History</h4>
              <div className="grid-2" style={{ gap: '8px' }}>
                <div>
                  <label className="text-muted" style={{ fontSize: '0.8rem' }}>Start Date</label>
                  <input type="date" className="input-field" value={exportStart} onChange={e => setExportStart(e.target.value)} />
                </div>
                <div>
                  <label className="text-muted" style={{ fontSize: '0.8rem' }}>End Date</label>
                  <input type="date" className="input-field" value={exportEnd} onChange={e => setExportEnd(e.target.value)} />
                </div>
              </div>
              <button className="btn btn-secondary" style={{ width: '100%', marginTop: '16px' }} onClick={handleExport}>Download CSV Report</button>
            </div>
          </section>
        </div>
      )}

      {activeTab === 'stats' && (
        <div className="card text-center" style={{ padding: '64px 24px' }}>
          <div style={{ fontSize: '3rem', marginBottom: '16px' }}>📊</div>
          <h3>Analytics Dashboard</h3>
          <p className="text-muted" style={{ maxWidth: '400px', margin: '0 auto', marginTop: '8px' }}>
            Advanced insights, average wait times, and staff performance metrics are being processed. Check back soon.
          </p>
        </div>
      )}
    </div>
  );
}

// --- NEW: Staff Dashboard ---
function StaffDashboard({ user, office, tokens, onCall, onUpdateToken, onLogout }) {
  const isActive = user.assigned_counter <= (office?.active_counters || 1);
  const myCounter = user.assigned_counter;

  // Filter tokens for MY counter
  // In the new logic, tokens are assigned to a counter. 
  // We need to show:
  // 1. Current Token (Status = CALLED, Assigned to Me)
  // 2. Waiting Tokens (Status = WAIT, Allocation might be pending or dynamic, but we show the general queue or my allocation)
  //    Legacy system: Admin saw ALL waiting tokens or filtered list. 
  //    Staff system: You likely pull from the general pool or your specific queue. 
  //    For now, we show tokens assigned to this counter OR unassigned tokens if 'Next' pulls from global.
  //    Actually, 'onCall' (server side) assigns a token to me. So I should see tokens in 'WAIT' status that are assigned to me OR generally available?
  //    Let's stick to: My Current (CALLED) + My Queue (ALLOCATED/WAIT with assigned_counter = myCounter).

  const myTokens = tokens.filter(t => t.assigned_counter === myCounter);
  const currentToken = myTokens.find(t => t.status === 'CALLED');
  // For queue list, show ALL waiting tokens for this office if not strictly assigned yet, 
  // or just assigned ones. To mimic "Admin View", we often showed the whole queue.
  // But strict assignment says "Allocated to Counter X".
  // Let's show "My Queue" (Allocated to me) and "General Pool" (Waiting).
  const myQueue = myTokens.filter(t => ['ALLOCATED', 'WAIT'].includes(t.status));
  const generalQueue = tokens.filter(t => t.status === 'WAIT' && !t.assigned_counter);

  return (
    <div className="dashboard-layout" style={{ maxWidth: '1000px', margin: '0 auto', padding: '24px', display: 'grid', gridTemplateColumns: '1fr 350px', gap: '24px', alignItems: 'start' }}>

      {/* LEFT COLUMN: Controls */}
      <main>
        <header style={{ marginBottom: '32px' }}>
          <div className="eyebrow" style={{ color: isActive ? 'var(--primary-600)' : 'var(--error-600)' }}>
            {isActive ? '● Online & Ready' : '● Counter Disabled'}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <div>
              <h2 style={{ fontSize: '2.5rem', fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1 }}>Counter {myCounter}</h2>
              <div className="text-muted" style={{ fontSize: '1.1rem', marginTop: '8px' }}>Staff: {user.name}</div>
            </div>
            <button className="btn btn-secondary" onClick={onLogout}>Logout</button>
          </div>
        </header>

        {!isActive && (
          <div className="card" style={{ background: '#fee2e2', border: '1px solid #fecaca', color: '#b91c1c' }}>
            <h3 style={{ fontSize: '1.25rem', marginBottom: '8px' }}>⛔ Counter Inactive</h3>
            <p>This counter is currently disabled by the office manager.<br />Please ask them to increase the <b>Active Counter Limit</b> to {myCounter}.</p>
          </div>
        )}

        {isActive && (
          <div className="card" style={{ padding: '40px', textAlign: 'center', minHeight: '400px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
            {currentToken ? (
              <div className="animate-fade-in" style={{ width: '100%' }}>
                <span className="badge badge-primary" style={{ marginBottom: '16px' }}>Now Serving</span>

                <div style={{ fontSize: '5rem', fontWeight: 900, lineHeight: 1, marginBottom: '8px' }}>
                  #{currentToken.token_number}
                </div>
                <div style={{ fontSize: '2rem', fontWeight: 600, marginBottom: '8px' }}>
                  {currentToken.user_name}
                </div>

                <div style={{ display: 'flex', gap: '24px', justifyContent: 'center', margin: '24px 0', color: 'var(--text-muted)' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Service</div>
                    <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{currentToken.service_type || 'General'}</div>
                  </div>
                  <div style={{ width: '1px', background: 'var(--gray-200)' }}></div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Waited</div>
                    <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                      {Math.floor((new Date() - new Date(currentToken.created_at)) / 60000)}m
                    </div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', maxWidth: '400px', margin: '0 auto' }}>
                  <button
                    className="btn btn-primary big"
                    style={{ height: '64px', fontSize: '1.2rem' }}
                    onClick={() => onUpdateToken(currentToken.id, 'complete')}
                  >
                    Complete
                  </button>
                  <button
                    className="btn btn-secondary big"
                    style={{ height: '64px', fontSize: '1.2rem' }}
                    onClick={() => onUpdateToken(currentToken.id, 'no-show')}
                  >
                    No Show
                  </button>
                </div>
                <div style={{ marginTop: '16px' }}>
                  <button className="link" style={{ color: 'var(--text-muted)' }} onClick={() => onUpdateToken(currentToken.id, 'recall')}>Recall Customer</button>
                </div>
              </div>
            ) : (
              <div className="animate-fade-in">
                <div style={{ fontSize: '4rem', marginBottom: '16px' }}>☕️</div>
                <h3 style={{ fontSize: '2rem', marginBottom: '16px', color: 'var(--gray-400)' }}>Ready to Serve</h3>
                <p style={{ color: 'var(--gray-500)', marginBottom: '32px' }}>
                  {myQueue.length + generalQueue.length > 0
                    ? `${myQueue.length + generalQueue.length} customers waiting in queue.`
                    : "Queue is currently empty."}
                </p>
                <button
                  className="btn btn-black big"
                  style={{ fontSize: '1.5rem', padding: '20px 48px', boxShadow: 'var(--shadow-lg)' }}
                  onClick={() => onCall(myCounter)}
                  disabled={!office || office.state !== 'LIVE'}
                >
                  Call Next Customer
                </button>
                {office?.state !== 'LIVE' && <div style={{ color: 'var(--error-600)', marginTop: '16px', fontWeight: 600 }}>Queue is Paused</div>}
              </div>
            )}
          </div>
        )}
      </main>

      {/* RIGHT COLUMN: Queue List */}
      <aside style={{ height: '100%' }}>
        <div className="card" style={{ height: 'fit-content', maxHeight: 'calc(100vh - 48px)', overflowY: 'auto' }}>
          <div className="panel-header" style={{ position: 'sticky', top: 0, background: 'white', zIndex: 10, paddingBottom: 12, marginBottom: 0, borderBottom: '1px solid #eee' }}>
            <h3>Up Next</h3>
            <span className="badge badge-neutral">{myQueue.length}</span>
          </div>

          <div className="token-list">
            {myQueue.length === 0 && <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--gray-400)' }}>No allocations.</div>}

            {myQueue.map((t, idx) => (
              <div key={t.id} className="token-row" style={{ padding: '16px', borderLeft: idx === 0 ? '4px solid var(--primary-500)' : '4px solid transparent' }}>
                <div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>#{t.token_number}</div>
                  <div style={{ fontSize: '0.9rem' }}>{t.user_name}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    {Math.floor((new Date() - new Date(t.created_at)) / 60000)}m wait · {t.service_type || 'General'}
                  </div>
                </div>
              </div>
            ))}

            {/* General Pool hint */}
            {generalQueue.length > 0 && (
              <div style={{ padding: '12px', textAlign: 'center', borderTop: '1px solid #eee', background: '#f9fafb', fontSize: '0.85rem', color: 'var(--gray-500)' }}>
                + {generalQueue.length} unassigned in General Pool
              </div>
            )}
          </div>
        </div>

        {/* Booked / Future List */}
        <div className="card" style={{ marginTop: '24px', maxHeight: '40vh', overflowY: 'auto' }}>
          <div className="panel-header" style={{ position: 'sticky', top: 0, background: 'white', zIndex: 10, paddingBottom: 12, marginBottom: 0, borderBottom: '1px solid #eee' }}>
            <h3>Future Bookings</h3>
            <span className="badge badge-neutral">{tokens.filter(t => t.status === 'booked').length}</span>
          </div>

          <div className="token-list">
            {tokens.filter(t => t.status === 'booked').length === 0 && <div className="text-muted" style={{ padding: '24px', textAlign: 'center' }}>No future bookings.</div>}

            {tokens.filter(t => t.status === 'booked').map(t => (
              <div key={t.id} className="token-row" style={{ padding: '12px', opacity: 0.7 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '0.95rem', fontWeight: 600 }}>#{t.token_number} {t.user_name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t.service_type || 'General'}</div>
                  </div>
                  <div style={{ textAlign: 'right', fontSize: '0.75rem', color: 'var(--gray-500)' }}>
                    {t.expected_arrival_time ? new Date(t.expected_arrival_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Anytime'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card" style={{ marginTop: '24px' }}>
          <div className="panel-header"><h3>Stats</h3></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{tokens.filter(t => t.assigned_counter === myCounter && ['COMPLETED'].includes(t.status)).length}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Served</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{tokens.filter(t => t.assigned_counter === myCounter && ['no-show'].includes(t.status)).length}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>No Show</div>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}

function App() {
  const { user, logout, loading: authLoading } = useAuth();

  const getDefaultView = (u) => {
    if (!u) return 'landing';
    if (u.role === 'office_owner' || u.role === 'admin') return 'super_admin'; // Legacy admin -> Super Admin
    if (u.role === 'staff') return 'staff';
    return 'customer';
  };

  // Initialize view from history state or default
  const [view, setViewState] = useState(getDefaultView(user));

  // Wrapper to sync history
  const setView = (newView, addToHistory = true) => {
    setViewState(newView);
    if (addToHistory) {
      window.history.pushState({ view: newView }, '', window.location.pathname);
    }
  };

  // Handle browser back/forward and Initial Redirect
  useEffect(() => {
    const handlePopState = (event) => {
      if (event.state && event.state.view) {
        setViewState(event.state.view);
      } else {
        setViewState(getDefaultView(user));
      }
    };
    window.addEventListener('popstate', handlePopState);

    // Auto-redirect if on generic auth pages but already logged in
    if (user && ['landing', 'login', 'register', 'verify-email'].includes(view)) {
      const target = getDefaultView(user);
      if (view !== target) setView(target, false);
    }

    // Safety Force Redirect: If view is NOT 'super_admin' but role requires it, force redirect.
    // This catches "customer" fallback or any other state.
    if (user && (user.role === 'admin' || user.role === 'office_owner') && view !== 'super_admin') {
      setView('super_admin', false);
    }

    // Set initial state
    window.history.replaceState({ view: view }, '', window.location.pathname);

    return () => window.removeEventListener('popstate', handlePopState);
  }, [user, view]);

  const [registerRole, setRegisterRole] = useState('customer');
  const [loginRole, setLoginRole] = useState(''); // 'admin' | 'customer' | ''
  const [connectionStatus, setConnectionStatus] = useState('CONNECTED'); // CONNECTED, LOST
  const [tempEmail, setTempEmail] = useState(''); // For password reset flow
  const [offices, setOffices] = useState([]);
  const [selectedOfficeId, setSelectedOfficeId] = useState('');
  const [selectedOfficeData, setSelectedOfficeData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [adminKey, setAdminKey] = useState('');
  const [showAdminKey, setShowAdminKey] = useState(false);

  // Auto-dismiss message after 15 seconds
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(''), 15000);
      return () => clearTimeout(timer);
    }
  }, [message]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notificationCount, setNotificationCount] = useState(0);

  // Form states
  const [newOffice, setNewOffice] = useState({ name: '', serviceType: '', dailyCapacity: 100, operatingHours: '09:00-17:00', avgServiceMinutes: 10, latitude: '', longitude: '' });
  const [bookingForm, setBookingForm] = useState({ customerName: user?.name || '', customerContact: user?.email || '', serviceType: 'General Inquiry', note: '' });
  const [availabilityInput, setAvailabilityInput] = useState('');
  const [selectedToken, setSelectedToken] = useState(null);
  const [tokenFilter, setTokenFilter] = useState('pending'); // 'pending' or 'history'
  const [isPauseModalOpen, setIsPauseModalOpen] = useState(false);

  // --- Pause / Resume Logic ---
  const handlePause = async (reason) => {
    if (!selectedOffice) return;
    try {
      const res = await fetchJSON(`/api/offices/${selectedOffice.id}/pause`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason })
      });
      if (res.success) {
        // Optimistic Update
        setSelectedOfficeData(prev => ({ ...prev, office: { ...prev.office, state: res.state } }));
        setIsPauseModalOpen(false);
        // alert('Office Paused');
      }
    } catch (err) {
      alert('Failed to pause: ' + err.message);
    }
  };

  const handleResume = async () => {
    if (!selectedOffice) return;
    try {
      const res = await fetchJSON(`/api/offices/${selectedOffice.id}/resume`, {
        method: 'POST'
      });
      if (res.success) {
        setSelectedOfficeData(prev => ({ ...prev, office: { ...prev.office, state: 'LIVE' } }));
        // alert('Office Resumed');
      }
    } catch (err) {
      alert('Failed to resume: ' + err.message);
    }
  };

  const selectedOffice = useMemo(() => selectedOfficeData?.office || null, [selectedOfficeData]);
  const counters = useMemo(() => selectedOfficeData?.active_staff || [], [selectedOfficeData]);

  // --- Socket Listeners ---
  useEffect(() => {
    if (selectedOffice) {
      const socket = io(API_BASE);
      socket.emit('join_office', selectedOffice.id);

      socket.on('office_state', (data) => {
        console.log('Office State Update:', data);
        setSelectedOfficeData(prev => (prev && prev.office ? { ...prev, office: { ...prev.office, ...data } } : prev));
      });

      socket.on('queue_update', (data) => {
        if (data.officeId === selectedOffice.id) {
          if (data.tokens) setSelectedOfficeData(prev => (prev ? { ...prev, tokens: data.tokens } : prev));
          if (data.active_staff) setSelectedOfficeData(prev => (prev ? { ...prev, active_staff: data.active_staff } : prev));
          if (data.office) setSelectedOfficeData(prev => (prev && prev.office ? { ...prev, office: { ...prev.office, ...data.office } } : prev));
        }
      });

      socket.on('notification', (data) => {
        setMessage(data.message);
      });

      return () => socket.disconnect();
    }
  }, [selectedOffice?.id]);

  // --- Heartbeat & Connection Monitoring ---
  useEffect(() => {
    if (!user || user.role !== 'admin') return;

    const socket = io(API_BASE);

    // Heartbeat Loop
    const hbInterval = setInterval(() => {
      socket.emit('admin_heartbeat', user.id);
    }, 10000);

    // Connection State
    socket.on('connect', () => {
      setConnectionStatus('CONNECTED');
    });
    socket.on('disconnect', () => {
      setConnectionStatus('LOST');
    });
    socket.on('connection_status', (status) => { // If we had custom
      // setConnectionStatus(status);
    });

    // Listen for Role Promotion/Demotion
    socket.on('role_update', (data) => {
      // data: { role: 'OPERATOR', counter_number: 1 }
      console.log('Role Update Received:', data);
      if (data.role) {
        setUser(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            operational_role: data.role,
            assigned_counter: data.counter_number
          };
        });
        // If promoted, notify
        if (data.role === 'OPERATOR') {
          // alert(`You have been promoted to Counter ${data.counter_number}`);
          // Or just let UI update.
          // Maybe flash message.
          // We can use setMessage logic if available in this scope?
        }
      }
    });

    // Tab Close Warning
    // Tab Close Warning
    const handleBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = 'Leaving this page will log you out and free your counter.';
      return e.returnValue;
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      clearInterval(hbInterval);
      socket.disconnect();
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [user]);



  // Poll for notifications if logged in
  useEffect(() => {
    if (!user) return;
    const check = () => {
      fetchJSON(`/api/notifications?userId=${user.id}`).then((data) => {
        const unread = (data.notifications || []).filter(n => !n.is_read).length;
        setNotificationCount(unread);
      }).catch(() => { });
    };
    check();
    const interval = setInterval(check, 10000); // 10s poll
    return () => clearInterval(interval);
  }, [user]);

  // Auto-fill booking form if logged in
  useEffect(() => {
    if (user) {
      setBookingForm((prev) => ({ ...prev, customerName: user.name, customerContact: user.email }));
      // If we were on login/register pages, switch to assigned role view
      if (view === 'login' || view === 'register' || view === 'landing') {
        if (user.is_verified === 0) {
          setView('verify-email', false);
        } else {
          const targetView = user.role === 'office_owner' ? 'super_admin' :
            user.role === 'staff' ? 'staff' :
              'customer';
          setView(targetView, false);
        }
      } else if (view !== 'verify-email' && user.is_verified === 0) {
        setView('verify-email', false);
      }
    } else {
      // If logged out, force landing view (unless already on login/register)
      if (view !== 'login' && view !== 'register') setView('landing');
      // Clear sensitive state
      setOffices([]);
      setSelectedOfficeId(null);
      setSelectedOfficeData(null);
    }
    // Reload offices whenever user state changes to ensure correct role-based fetching (Isolation Fix)
    // Only load if user is logged in OR if we are in public mode (which handles its own loading usually, but okay to confirm)
    if (user || view === 'landing') {
      loadOffices();
    }
  }, [user]);

  // useEffect(() => { loadOffices(); }, []); // Removed: Handled by user effect to ensure auth context

  useEffect(() => {
    if (selectedOfficeId) fetchOfficeDetail(selectedOfficeId);
  }, [selectedOfficeId]);

  // Socket.IO Integration
  useEffect(() => {
    const socket = io(API_BASE);

    if (user) {
      socket.emit('join_user', user.id);
    }

    if (selectedOfficeId) {
      socket.emit('join_office', selectedOfficeId);
    }

    socket.on('queue_update', (data) => {
      if (data.officeId === selectedOfficeId) {
        setSelectedOfficeData(prev => {
          if (!prev || !prev.office) return prev; // If initial fetch hasn't happened, ignore update to avoid corruption

          return {
            ...prev,
            tokens: data.tokens,
            office: { ...prev.office, ...data.stats }
          };
        });
      }
    });

    socket.on('notification', (payload) => {
      setMessage(payload.message); // Show toast
      setNotificationCount(c => c + 1); // Increment badge
    });

    return () => socket.disconnect();
  }, [selectedOfficeId, user]);

  const [historyTokens, setHistoryTokens] = useState([]);
  const [showHistory, setShowHistory] = useState(false);

  const loadHistory = async () => {
    try {
      setLoading(true);
      const data = await fetchJSON('/api/history');
      setHistoryTokens(data.history);
      setShowHistory(true);
    } catch (err) { setMessage(err.message); } finally { setLoading(false); }
  };

  const loadOffices = async () => {
    try {
      setLoading(true);
      // Office Owner sees only their offices
      const endpoint = (user?.role === 'admin' || user?.role === 'office_owner') ? '/api/offices?owner=me' : '/api/offices';
      const data = await fetchJSON(endpoint);
      setOffices(data.offices);

      // Auto-select Logic
      if (user?.office_id) {
        // If user is assigned to an office (Staff/linked), select it
        const assigned = data.offices.find(o => o.id === user.office_id);
        if (assigned) setSelectedOfficeId(assigned.id);
        else if (data.offices.length > 0) setSelectedOfficeId(data.offices[0].id); // Fallback
      } else if (['admin', 'office_owner'].includes(user?.role)) {
        if (data.offices.length > 0) {
          setSelectedOfficeId(data.offices[0].id);
        } else if (user.is_verified) {
          setView('create-office');
        }
      } else if (!selectedOfficeId && data.offices.length > 0) {
        // Default for customer (just pick first one if nothing selected)
        setSelectedOfficeId(data.offices[0].id);
      }
    } catch (err) { setMessage(err.message); } finally { setLoading(false); }
  };

  const fetchOfficeDetail = async (id) => {
    if (!id || id === 'undefined' || id === 'null') return;
    try {
      setLoading(true);
      const data = await fetchJSON(`/api/offices/${id}`);
      setSelectedOfficeData(data);
      setAvailabilityInput(data.office.counter_count || 1);
    } catch (err) { setMessage(err.message); } finally { setLoading(false); }
  };
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);

  const handleBookingSubmit = async (formData) => {
    if (!selectedOfficeId) return setMessage('Choose an office');
    if (!formData.customerName) return setMessage('Name required');

    try {
      setLoading(true);
      await fetchJSON(`/api/offices/${selectedOfficeId}/book`, {
        method: 'POST',
        body: JSON.stringify({
          customerName: formData.customerName,
          customerEmail: formData.customerEmail,
          customerContact: formData.customerContact, // Phone
          serviceType: formData.serviceType,
          userId: user?.id,
          lat: formData.userLat,
          lng: formData.userLng,
          note: formData.note,
          customerAddress: formData.customerAddress,
          travelTime: formData.travelTime
        }),
      });
      setMessage('Booking successful!');
      setIsBookingModalOpen(false); // Close modal on success
      setBookingForm({ customerName: user?.name || '', customerContact: user?.email || '', note: '' }); // Reset form
      await Promise.all([loadOffices(), fetchOfficeDetail(selectedOfficeId)]);
    } catch (err) {
      setMessage(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOffice = async (officeData) => {
    try {
      setLoading(true);
      await fetchJSON('/api/offices', {
        method: 'POST',
        body: JSON.stringify(officeData),
      });
      setMessage('Office created');
      await loadOffices();
      setView('admin'); // Go to dashboard
    } catch (err) { setMessage(err.message); } finally { setLoading(false); }
  };

  const handleAvailabilityUpdate = async () => {
    // Availability update is strictly an Owner/Admin action. 
    // If user is owner, they have a token. If legacy admin, they have a key.
    // Ideally we assume token-based auth for owners now.
    try {
      await fetchJSON(`/api/offices/${selectedOfficeId}/config`, {
        method: 'POST',
        headers: adminKey ? { 'x-admin-key': adminKey } : {}, // Optional legacy support
        body: JSON.stringify({ counterCount: Number(availabilityInput) }),
      });
      setMessage('Availability updated');
      fetchOfficeDetail(selectedOfficeId);
    } catch (err) { setMessage(err.message); }
  };

  const callNext = async () => {
    // Used by Admin/Owner main button
    try {
      const headers = adminKey ? { 'x-admin-key': adminKey } : {};
      const data = await fetchJSON(`/api/offices/${selectedOfficeId}/call-next`, {
        method: 'POST',
        headers
      });
      setMessage(`Called ${data.user_name}`);
      fetchOfficeDetail(selectedOfficeId);
    } catch (err) { setMessage(err.message); }
  };

  const updateToken = async (id, action) => {
    try {
      // Staff and Owners use Token Auth (handled by fetchJSON automatically).
      // Legacy Admin uses Admin Key.
      let headers = {};
      if (adminKey) headers['x-admin-key'] = adminKey;

      await fetchJSON(`/api/tokens/${id}/${action}`, { method: 'POST', headers });

      const verbs = {
        'cancel': 'cancelled',
        'complete': 'completed',
        'no-show': 'marked as no-show',
        're-queue': 're-queued',
        'arrive': 'marked as arrived'
      };

      setMessage(`Token ${verbs[action] || action}`);
      fetchOfficeDetail(selectedOfficeId);
    } catch (err) { setMessage(err.message); }
  };

  const callCounter = async (counterId) => {
    // Staff action - uses Token.
    try {
      let headers = {};
      if (adminKey) headers['x-admin-key'] = adminKey;

      const data = await fetchJSON(`/api/offices/${selectedOfficeId}/counters/${counterId}/call`, {
        method: 'POST',
        headers
      });
      setMessage(`Counter ${counterId} Called ${data.user_name}`);
      fetchOfficeDetail(selectedOfficeId);
    } catch (err) { setMessage(err.message); }
  };

  const handlePauseToggle = async () => {
    // Owner action - uses Token.
    try {
      let headers = {};
      if (adminKey) headers['x-admin-key'] = adminKey;

      if (selectedOffice.is_paused) {
        // Resume Logic
        await fetchJSON(`/api/offices/${selectedOfficeId}/resume`, {
          method: 'POST',
          headers
        });
        setMessage('Queue Resumed');
        fetchOfficeDetail(selectedOfficeId);
      } else {
        // Open Pause Modal
        setPauseReason('Short Break');
        setPauseMessage('Service paused for a short break. We will resume shortly.');
        setShowPauseModal(true);
      }
    } catch (err) { setMessage(err.message); }
  };

  const submitPause = async () => {
    try {
      await fetchJSON(`/api/offices/${selectedOfficeId}/pause`, {
        method: 'POST',
        headers: { 'x-admin-key': adminKey },
        body: JSON.stringify({ reason: pauseReason, message: pauseMessage })
      });
      setMessage('Queue Paused');
      setShowPauseModal(false);
      fetchOfficeDetail(selectedOfficeId);
    } catch (err) { setMessage(err.message); }
  };

  if (authLoading) return <div>Loading app...</div>;

  if (view === 'landing' && !user) {
    return (
      <>
        {message && <div className="message">{message}</div>}
        <LandingView
          onLogin={(role) => {
            setLoginRole(role);
            setView('login');
          }}
          onRegisterAdmin={() => { setRegisterRole('office_owner'); setView('register'); }}
          onRegisterCustomer={() => { setRegisterRole('customer'); setView('register'); }}
        />
      </>
    );
  }



  // Admin / Customer Dashboard
  const showHeader = !['login', 'register', 'verify-email', 'forgot-password', 'reset-password'].includes(view);

  return (
    <div className="app">
      {connectionStatus === 'LOST' && (
        <div style={{ backgroundColor: '#dc3545', color: 'white', padding: '10px', textAlign: 'center', fontWeight: 'bold', position: 'sticky', top: 0, zIndex: 1000 }}>
          Connection Lost — Reconnecting...
        </div>
      )}
      {showHeader && (
        <header className="app-header">
          <div>
            <div className="eyebrow">Queue Management System</div>
            <h1>Serve people faster</h1>
          </div>
          <div className="user-menu">
            {!user ? (
              <button onClick={() => setView('login')}>Login / Register</button>
            ) : (
              <>
                <div className="bell-icon" onClick={() => setShowNotifications(!showNotifications)}>
                  🔔
                  {notificationCount > 0 && <span className="bell-count">{notificationCount}</span>}
                </div>
                <ProfileMenu user={user} onNavigate={setView} onLogout={logout} />
              </>
            )}
          </div>
        </header>
      )}

      {showNotifications && user && (
        <NotificationPanel userId={user.id} onClose={() => setShowNotifications(false)} />
      )}

      {message && <div className="message">{message}</div>}

      {view === 'landing' && !user ? (
        <LandingView
          onLogin={(role) => {
            setLoginRole(role);
            setView('login');
          }}
          onRegisterAdmin={() => { setRegisterRole('office_owner'); setView('register'); }}
          onRegisterCustomer={() => { setRegisterRole('customer'); setView('register'); }}
        />
      ) : view === 'login' && loginRole === 'office_owner' ? (
        <OwnerLoginView
          onSuccess={() => { }}
          onBack={() => setView('landing')}
          onForgotPass={() => setView('forgot-password')}
          onSignup={() => {
            setRegisterRole('office_owner');
            setView('register');
          }}
        />
      ) : view === 'login' && loginRole === 'staff' ? (
        <StaffLoginView
          onSuccess={() => { }}
          onBack={() => setView('landing')}
          onForgotPass={() => setView('forgot-password')}
        />
      ) : view === 'login' && loginRole === 'customer' ? (
        <CustomerLoginView
          onSuccess={() => { }}
          onBack={() => setView('landing')}
          onForgotPass={() => setView('forgot-password')}
          onSignup={() => {
            setRegisterRole('customer');
            setView('register');
          }}
          onQuickJoin={() => {
            // Assuming there's a quick-join view, if not existing, we can placeholder it or set a view
            // For now, let's assume 'landing' or show a message, but based on context user might want a specific view.
            // Looking at App.jsx, there's no obvious quick-join. I will just log or no-op for now unless I see a view.
            // Actually, I can setView('quick-join') if I implement it, or just leave it blank.
            // Let's check if 'quick-join' view exists in App.jsx... it doesn't seem to.
            // I'll map it to setView('landing') for now as a placeholder or maybe alert.
            // Better: define onQuickJoin to log for now.
            console.log("Quick join clicked");
          }}
        />
      ) : view === 'login' || (!user && view !== 'register' && view !== 'forgot-password' && view !== 'reset-password') ? (
        <LoginView
          role={loginRole}
          onSuccess={() => { }}
          onSwitch={(target) => {
            if (target === 'forgot-password') setView('forgot-password');
            else setView('register');
          }}
          onBack={() => setView('landing')}
        />
      ) : view === 'forgot-password' ? (
        <ForgotPasswordView
          onBack={() => setView('login')}
          onVerify={(email) => {
            setTempEmail(email);
            setView('reset-password');
          }}
        />
      ) : view === 'reset-password' ? (
        <ResetPasswordView
          email={tempEmail}
          onBack={() => setView('forgot-password')}
          onSuccess={() => {
            setMessage('Password updated! Please login.');
            setView('login');
          }}
        />
      ) : view === 'create-office' ? (
        <CreateOfficeWizard onSubmit={handleCreateOffice} onBack={() => setView('admin')} />
      ) : view === 'register' ? (
        <RegisterView
          onSuccess={() => {
            setView('verify-email');
          }}
          onSwitch={() => setView('login')}
          defaultRole={registerRole}
          onBack={() => setView('landing')}
        />
      ) : view === 'verify-email' && user ? (
        <VerifyEmailView
          email={user.email}
          onSuccess={() => {
            // Refresh or manually set
            setMessage('Verified! Welcome.');
            setView(user.role === 'admin' ? 'admin' : 'customer');
          }}
          onBack={() => {
            logout();
            setView('landing');
          }}
        />
      ) : view === 'profile' ? (
        <ProfileView
          user={user}
          onBack={() => setView(user.role === 'admin' ? 'admin' : 'customer')}
          office={user.role === 'admin' ? offices[0] : null}
        />
      ) : view === 'history' ? (
        <>
          <header className="app-header">
            <div className="eyebrow">Archives</div>
            <ProfileMenu user={user} onNavigate={setView} onLogout={logout} />
          </header>
          <HistoryView
            user={user}
            onBack={() => setView(user.role === 'office_owner' ? 'super_admin' : 'staff')}
            adminKey={adminKey}
            selectedOfficeId={selectedOfficeId}
          />
        </>
      ) : view === 'settings' ? (
        <SettingsView user={user} onBack={() => setView('super_admin')} adminKey={adminKey} selectedOfficeId={selectedOfficeId} />
      ) : view === 'super_admin' ? (
        <SuperAdminDashboard user={user} office={selectedOffice} onLogout={logout} onNavigate={setView} />
      ) : view === 'super_admin' && user?.role === 'office_owner' ? (
        <OwnerDashboard user={user} offices={offices} onUpdate={loadOffices} onLogout={logout} />
      ) : view === 'staff' && (user?.role === 'staff' || user?.role === 'office_owner') ? (
        <StaffDashboard user={user} office={selectedOffice} tokens={selectedOfficeData?.tokens || []} onCall={callCounter} onUpdateToken={updateToken} onLogout={logout} />
      ) : (view === 'customer' || (!view && user?.role === 'customer')) ? (
        /* --- CUSTOMER DASHBOARD (Fallback) --- */
        <div className="dashboard-layout" style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 300px) 1fr', gap: '24px', alignItems: 'start' }}>
          <StatusBanner office={selectedOffice} />
          <aside className="card" style={{ padding: '24px', height: 'fit-content' }}>
            <div className="view-toggle" style={{ marginBottom: 20 }}>
              <div style={{ textTransform: 'uppercase', fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--primary-600)', letterSpacing: '0.05em' }}>Logged in as Customer</div>
            </div>

            <div className="panel-header">
              <h3>Offices</h3>
              <button className="ghost" onClick={loadOffices} disabled={loading}>Refresh</button>
            </div>
            {loading && <div className="muted">Loading...</div>}

            <div className="office-list">
              {offices.map((office) => (
                <button
                  key={office.id}
                  className={`office-card ${selectedOfficeId === office.id ? 'selected' : ''}`}
                  onClick={() => setSelectedOfficeId(office.id)}
                >
                  <div className="office-name">{office.name}</div>
                  <div className="office-service">{office.service_type}</div>
                  <div className="office-meta">
                    <span>Avail: {office.available_today}</span>
                    <span>Queue: {office.queueCount}</span>
                  </div>
                </button>
              ))}
              {offices.length === 0 && (
                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--gray-500)' }}>
                  No offices found near you.
                </div>
              )}
            </div>
          </aside>

          <main style={{ display: 'flex', flexDirection: 'column' }}>
            {!selectedOffice ? <div className="muted">Select an office to book</div> : (
              <>
                <section className="card" style={{ marginBottom: '24px' }}>
                  <div className="panel-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <h3 style={{ fontSize: '1.5rem', letterSpacing: '-0.02em' }}>{selectedOffice.name}</h3>
                    </div>
                    <div className="stat-group">
                      <Stat label="Wait" value={
                        (selectedOffice.queueCount * (selectedOffice.average_velocity || selectedOffice.avg_service_minutes)) > 0
                          ? `${Math.round(selectedOffice.queueCount * (selectedOffice.average_velocity || selectedOffice.avg_service_minutes))}m`
                          : 'Access Allowed'
                      } />
                      <Stat label="Avail" value={selectedOffice.available_today} />
                    </div>
                  </div>
                </section>

                <section className="card" style={{ marginBottom: '24px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <h4 style={{ fontSize: '1.5rem', marginBottom: '8px' }}>Book a Slot</h4>
                      <p style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>
                        {selectedOffice.current_status === 'CLOSED' ? (
                          <span style={{ color: 'var(--red-500)' }}>We are currently closed. Opens at {selectedOffice.opening_time}.</span>
                        ) : selectedOffice.current_status === 'LUNCH_BREAK' ? (
                          <span style={{ color: 'var(--orange-500)' }}>Lunch Break. Resumes at {selectedOffice.lunch_end}.</span>
                        ) : selectedOffice.available_today > 0 ? (
                          "We're open! Book now to skip the line."
                        ) : (
                          `Current estimated wait is ${Math.round(selectedOffice.queueCount * (selectedOffice.average_velocity || selectedOffice.avg_service_minutes))} mins. We'll notify you.`
                        )}
                      </p>
                    </div>
                    <button
                      className="btn btn-primary"
                      onClick={() => setIsBookingModalOpen(true)}
                      disabled={selectedOffice.current_status === 'CLOSED'}
                      style={{ opacity: selectedOffice.current_status === 'CLOSED' ? 0.5 : 1 }}
                    >
                      {selectedOffice.current_status === 'CLOSED' ? 'Closed' : 'Book Now'}
                    </button>
                  </div>
                </section>

                <BookingModal
                  isOpen={isBookingModalOpen}
                  onClose={() => setIsBookingModalOpen(false)}
                  onSubmit={handleBookingSubmit}
                  office={selectedOffice}
                  user={user}
                />

                <section className="card">
                  <h4 style={{ fontSize: '1.1rem', marginBottom: '16px' }}>Your Visit Status</h4>
                  <div className="tabs" style={{ display: 'flex', gap: '8px', marginBottom: '20px', background: 'var(--gray-50)', padding: '4px', borderRadius: 'var(--radius-md)', width: 'fit-content' }}>
                    <button
                      className="btn"
                      style={{
                        padding: '6px 16px', borderRadius: '8px', fontSize: '0.9rem',
                        background: tokenFilter === 'pending' ? 'white' : 'transparent',
                        color: tokenFilter === 'pending' ? 'var(--primary-600)' : 'var(--text-muted)',
                        boxShadow: tokenFilter === 'pending' ? 'var(--shadow-sm)' : 'none'
                      }}
                      onClick={() => setTokenFilter('pending')}
                    >
                      Pending
                    </button>
                    <button
                      className="btn"
                      style={{
                        padding: '6px 16px', borderRadius: '8px', fontSize: '0.9rem',
                        background: tokenFilter === 'completed' ? 'white' : 'transparent',
                        color: tokenFilter === 'completed' ? 'var(--primary-600)' : 'var(--text-muted)',
                        boxShadow: tokenFilter === 'completed' ? 'var(--shadow-sm)' : 'none'
                      }}
                      onClick={() => setTokenFilter('completed')}
                    >
                      History
                    </button>
                  </div>

                  <div className="token-list">
                    {(selectedOfficeData?.tokens || [])
                      .filter(t => {
                        // Customer sees only theirs
                        const isMine = t.user_id === user?.id;
                        if (!isMine) return false;

                        // Apply status filter
                        if (tokenFilter === 'pending') return ['WAIT', 'ALLOCATED', 'CALLED', 'booked', 'queued', 'called'].includes(t.status);
                        // Show history/cancelled/complete in History tab
                        if (tokenFilter === 'completed') return ['COMPLETED', 'completed', 'cancelled', 'no-show', 'history'].includes(t.status);
                        return false;
                      })
                      .map(t => {
                        return (
                          <CustomerTokenRow key={t.id} token={t} onCancel={id => updateToken(id, 'cancel')} onArrive={id => updateToken(id, 'arrive')} isOwner={true} office={selectedOffice} />
                        );
                      })}
                    {selectedToken && (
                      <TokenDetailsModal token={selectedToken} office={selectedOffice} onClose={() => setSelectedToken(null)} onAction={updateToken} />
                    )}
                    {(selectedOfficeData?.tokens || []).filter(t => {
                      const isMine = t.user_id === user?.id;
                      if (!isMine) return false;
                      if (tokenFilter === 'pending') return ['WAIT', 'ALLOCATED', 'CALLED', 'booked', 'queued', 'called'].includes(t.status);
                      if (tokenFilter === 'completed') return ['COMPLETED', 'completed', 'cancelled', 'no-show', 'history'].includes(t.status);
                      return false;
                    }).length === 0 && (
                        <div className="empty-state">
                          <div style={{ fontSize: '2rem', marginBottom: '8px' }}>🌱</div>
                          No tokens found in "{tokenFilter}" section.
                        </div>
                      )}
                  </div>
                </section>
              </>
            )}
          </main>
        </div>
      ) : (
        <div className="flex-center" style={{ height: '60vh', flexDirection: 'column', gap: '20px' }}>
          <h2>Access Denied</h2>
          <p className="text-muted">You do not have permission to view this page or the link is invalid.</p>
          <button className="btn btn-primary" onClick={() => setView('landing')}>Go to Home</button>
        </div>
      )}

      {/* Pause Modal */}
      <PauseModal
        isOpen={isPauseModalOpen}
        onClose={() => setIsPauseModalOpen(false)}
        onPause={handlePause}
      />

    </div >
  );
}

export default App;