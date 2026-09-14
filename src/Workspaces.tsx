import { useEffect, useRef, useState } from 'react';
import { Check, Copy, Download, FileJson, FolderKey, LockKeyhole, Plus, ShieldCheck, Target, X } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { downloadCsv, Fees, initialFees, markets, usd } from './model';

type Notify = (message: string) => void;
type Account = { alias: string; steam: string; value: number; holds: number; wallet: number; route: string; status: string; secret?: string };
const sampleAccounts: Account[] = [
  { alias: 'Main Liquidity', steam: '7656119804112•••', value: 12480, holds: 18, wallet: 842.2, route: 'Frankfurt', status: 'Available' },
  { alias: 'Knife Rotation', steam: '7656119827634•••', value: 8730, holds: 7, wallet: 216.8, route: 'Amsterdam', status: 'Available' },
  { alias: 'Cold Storage', steam: '7656119791088•••', value: 31840, holds: 34, wallet: 0, route: 'Ashburn', status: 'Cooldown' },
  { alias: 'Float Lab', steam: '7656119845521•••', value: 5940, holds: 3, wallet: 1280.4, route: 'Singapore', status: 'Available' },
];

async function guardCode(secret: string, epoch: number) {
  if ('__TAURI_INTERNALS__' in window) return invoke<string>('generate_totp', { secret, timestamp: epoch });
  const keyBytes = Uint8Array.from(atob(secret), character => character.charCodeAt(0));
  if (!keyBytes.length) throw new Error('The shared secret is empty.');
  const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
  const counter = new ArrayBuffer(8);
  new DataView(counter).setBigUint64(0, BigInt(Math.floor(epoch / 30)));
  const digest = new Uint8Array(await crypto.subtle.sign('HMAC', key, counter));
  const offset = digest[digest.length - 1] & 15;
  let value = new DataView(digest.buffer).getUint32(offset) & 0x7fffffff;
  const alphabet = '23456789BCDFGHJKMNPQRTVWXY';
  let code = '';
  for (let index = 0; index < 5; index++) { code += alphabet[value % alphabet.length]; value = Math.floor(value / alphabet.length); }
  return code;
}

function Dialog({ title, subtitle, close, children }: { title: string; subtitle: string; close: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { ref.current?.showModal(); }, []);
  return <dialog ref={ref} className="dialog" onCancel={close} onClick={event => { if (event.target === ref.current) close(); }}><div className="dialog-heading"><div><h2>{title}</h2><p>{subtitle}</p></div><button className="icon-btn" aria-label="Close dialog" onClick={close}><X size={18} /></button></div>{children}</dialog>;
}

export function AccountsView({ notify }: { notify: Notify }) {
  const [accounts, setAccounts] = useState(sampleAccounts);
  const [selected, setSelected] = useState(0);
  const [importOpen, setImportOpen] = useState(false);
  const [fileContent, setFileContent] = useState('');
  const [alias, setAlias] = useState('');
  const [error, setError] = useState('');
  const [clock, setClock] = useState(Math.floor(Date.now() / 1000));
  const [codes, setCodes] = useState<Record<string, string>>({});
  const seconds = 30 - clock % 30;
  const period = Math.floor(clock / 30);
  useEffect(() => { const timer = setInterval(() => setClock(Math.floor(Date.now() / 1000)), 1000); return () => clearInterval(timer); }, []);
  useEffect(() => { let active = true; Promise.all(accounts.map(async (account, index) => [account.alias, await guardCode(account.secret || ['AAAAAAAAAAAAAAAAAAAAAA==', 'AQEBAQEBAQEBAQEBAQEBAQ==', 'AgICAgICAgICAgICAgICAg==', 'AwMDAwMDAwMDAwMDAwMDAw=='][index % 4], period * 30)] as const)).then(entries => { if (active) setCodes(Object.fromEntries(entries)); }).catch(() => { if (active) setCodes({}); }); return () => { active = false; }; }, [accounts, period]);
  const total = accounts.reduce((sum, account) => sum + account.value, 0);
  const account = accounts[selected];

  async function importVault(event: React.FormEvent) {
    event.preventDefault();
    try {
      const parsed = JSON.parse(fileContent);
      if (typeof parsed.shared_secret !== 'string') throw new Error('This file has no shared_secret field.');
      await guardCode(parsed.shared_secret, clock);
      const name = alias.trim() || String(parsed.account_name || 'Imported account');
      if (accounts.some(item => item.alias === name)) throw new Error('Choose a unique account alias.');
      setAccounts([...accounts, { alias: name, steam: String(parsed.Session?.SteamID || parsed.steamid || 'Not provided'), value: 0, holds: 0, wallet: 0, route: 'Unassigned', status: 'Imported', secret: parsed.shared_secret }]);
      setImportOpen(false); setFileContent(''); setAlias(''); setError(''); notify('Vault imported for this session. Secret is not saved to disk.');
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'The selected file is not a valid vault.'); }
  }

  return <>
    <div className="workspace-toolbar"><div className="section-lead"><FolderKey size={18} /><span>{accounts.length} accounts in your workspace</span></div><div><button className="button" onClick={() => downloadCsv('aegis-inventory.csv', [['Alias', 'Steam ID', 'Inventory USD', 'Holds', 'Wallet USD', 'Route'], ...accounts.map(item => [item.alias, item.steam, item.value, item.holds, item.wallet, item.route])])}><Download size={14} />Export CSV</button><button className="button primary" onClick={() => setImportOpen(true)}><Plus size={15} />Import vault</button></div></div>
    <section className="account-overview"><div><span>Total inventory</span><strong className="numeric">{usd.format(total)}</strong><p>Across {accounts.length} sample & imported accounts</p></div><div className="allocation-chart" aria-label="Inventory allocation">{accounts.map((item, index) => <span key={item.alias} style={{ flex: item.value || 0.01 }} className={`allocation-${index % 4}`} title={`${item.alias}: ${usd.format(item.value)}`} />)}</div><div className="allocation-legend">{accounts.map((item, index) => <span key={item.alias}><i className={`allocation-${index % 4}`} />{item.alias}<b className="numeric">{(item.value / total * 100).toFixed(0)}%</b></span>)}</div></section>
    <div className="account-layout"><section className="account-register"><div className="list-heading"><div><h2>Account register</h2><p>Select an account to review its access & inventory.</p></div><span className="source-note">Local session</span></div><div className="table-viewport"><table className="account-table"><thead><tr><th>Account</th><th>Steam Guard</th><th className="align-right">Inventory</th><th className="align-right">On hold</th><th>Status</th></tr></thead><tbody>{accounts.map((item, index) => <tr key={item.alias} className={selected === index ? 'is-selected' : ''} onClick={() => setSelected(index)} tabIndex={0} onKeyDown={e => { if (e.key === 'Enter') setSelected(index); }}><td><div className="account-identity"><span className={`account-monogram allocation-${index % 4}`}>{item.alias.split(' ').map(word => word[0]).join('').slice(0, 2)}</span><div><strong>{item.alias}</strong><small>{item.route}</small></div></div></td><td><div className="guard-inline"><strong className="numeric">{codes[item.alias] || '—'}</strong><span className="guard-time numeric">{seconds}s</span><button className="icon-btn" aria-label={`Copy code for ${item.alias}`} disabled={!codes[item.alias]} onClick={async e => { e.stopPropagation(); try { await navigator.clipboard.writeText(codes[item.alias]); notify('Steam Guard code copied'); } catch { notify('Clipboard access is unavailable'); } }}><Copy size={13} /></button></div><small>{item.secret ? 'Imported secret' : 'Demo secret'}</small></td><td className="align-right numeric">{usd.format(item.value)}</td><td className="align-right numeric">{item.holds}</td><td><span className={`status ${item.status === 'Cooldown' ? 'status-outline' : ''}`}>{item.status}</span></td></tr>)}</tbody></table></div><p className="table-note"><ShieldCheck size={14} />Demo codes use public test secrets. Never use them for a real account.</p></section>
    <aside className="account-detail"><div className="inspector-caption">Account detail<span className="micro-tag">{account.secret ? 'Imported' : 'Sample'}</span></div><h2>{account.alias}</h2><p className="account-steam numeric">{account.steam}</p><div className="account-access"><div className="access-title"><LockKeyhole size={15} />Steam Guard</div><strong className="numeric">{codes[account.alias] || '—'}</strong><div className="guard-progress"><span style={{ width: `${seconds / 30 * 100}%` }} /></div><span className="access-countdown">Refreshes in <b className="numeric">{seconds}s</b></span></div><div className="health-rail"><div><span>Inventory sync</span><b>Healthy</b></div><i><span style={{ width: `${Math.min(98, 68 + account.value / 2000)}%` }} /></i><div><span>Route latency</span><b className="numeric">118ms</b></div><i><span style={{ width: '82%' }} /></i><div><span>Trade availability</span><b>{account.status}</b></div><i><span style={{ width: `${account.status === 'Cooldown' ? 42 : 91}%` }} /></i></div><dl className="cost-list"><div><dt>Inventory value</dt><dd className="numeric">{usd.format(account.value)}</dd></div><div><dt>Wallet balance</dt><dd className="numeric">{usd.format(account.wallet)}</dd></div><div><dt>Items on hold</dt><dd className="numeric">{account.holds}</dd></div><div><dt>Assigned route</dt><dd>{account.route}</dd></div></dl><div className="quiet-notice"><ShieldCheck size={17} /><p>{account.secret ? 'Session-only secret' : 'Demonstration account'}<span>{account.secret ? 'The imported secret stays in memory. Closing this app clears it.' : 'Values and balances are sample data, not a connected Steam inventory.'}</span></p></div></aside></div>
    {importOpen && <Dialog title="Import a local vault" subtitle="Add a Steam Guard secret for this session." close={() => setImportOpen(false)}><form onSubmit={importVault}><label className="file-picker"><FileJson size={25} /><strong>{fileContent ? 'Configuration loaded' : 'Choose a .maFile or JSON file'}</strong><span>Your file is read locally. No upload takes place.</span><input type="file" accept=".json,.maFile" required onChange={async e => { const file = e.target.files?.[0]; if (file) { setFileContent(await file.text()); setError(''); } }} /></label><label className="form-field">Account alias<input value={alias} onChange={e => setAlias(e.target.value)} placeholder="e.g. Trading account" /></label><div className="quiet-notice"><LockKeyhole size={16} /><p>Session only<span>Secrets are not persisted or sent to a server.</span></p></div>{error && <p role="alert" className="form-error">{error}</p>}<div className="dialog-actions"><button type="button" className="button" onClick={() => setImportOpen(false)}>Cancel</button><button className="button primary" type="submit">Import vault</button></div></form></Dialog>}
  </>;
}

type Order = { id: number; skin: string; target: string; max: number; bid: number; spread: number; status: string; auto: boolean };
const startingOrders: Order[] = [
  { id: 1, skin: 'AK-47 | Vulcan', target: 'Float < 0.18', max: 164, bid: 158.42, spread: 11.4, status: 'Top bid', auto: true },
  { id: 2, skin: 'M4A1-S | Blue Phosphor', target: 'Float < 0.03', max: 612, bid: 594.8, spread: 8.1, status: 'Top bid', auto: true },
  { id: 3, skin: 'Glock-18 | Gamma Doppler', target: 'Emerald / Phase 2', max: 240, bid: 226.18, spread: 17.6, status: 'Outbid', auto: false },
  { id: 4, skin: 'Butterfly Knife | Tiger Tooth', target: 'Float < 0.02', max: 978, bid: 952, spread: 9.3, status: 'Top bid', auto: true },
  { id: 5, skin: 'AWP | Desert Hydra', target: 'Factory new', max: 684, bid: 651.22, spread: 14.9, status: 'Outbid', auto: false },
];

export function OrdersView({ notify }: { notify: Notify }) {
  const [orders, setOrders] = useState(startingOrders);
  const [filter, setFilter] = useState<'all' | 'outbid'>('all');
  const [newOrder, setNewOrder] = useState(false);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [target, setTarget] = useState('');
  const outbid = orders.filter(order => order.status === 'Outbid');
  const displayed = filter === 'all' ? orders : outbid;
  return <>
    <section className="orders-summary"><div><span>Planned acquisition</span><strong className="numeric">{usd.format(orders.reduce((total, item) => total + item.max, 0))}</strong><p>{orders.length} local order plans</p></div><div><span>Needs attention</span><strong className="numeric">{outbid.length}<small> outbid</small></strong><p>Review your limits before adjusting</p></div></section>
    <section className="orders-register"><div className="list-heading"><div><h2>Buy order plans</h2><p>A clear limit for every acquisition.</p></div><button className="button primary" onClick={() => setNewOrder(true)}><Plus size={15} />New order plan</button></div><div className="table-tools"><div className="segment-control"><button aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>All plans <span>{orders.length}</span></button><button aria-pressed={filter === 'outbid'} onClick={() => setFilter('outbid')}>Needs attention <span>{outbid.length}</span></button></div><button className="text-button" onClick={() => { setOrders(orders.map(order => ({ ...order, auto: false }))); notify('Auto-adjust preference disabled for every plan'); }}>Disable auto-adjust</button></div><div className="table-viewport"><table className="orders-table"><thead><tr><th>Item & target</th><th className="align-right">Price limit</th><th className="align-right">Highest bid</th><th className="align-right">Edge</th><th>Position</th><th className="align-right">Auto-adjust</th></tr></thead><tbody>{displayed.map(order => <tr key={order.id}><td><strong>{order.skin}</strong><small>{order.target}</small></td><td className="align-right numeric">{usd.format(order.max)}</td><td className="align-right numeric">{usd.format(order.bid)}</td><td className="align-right numeric profit">+{order.spread.toFixed(1)}%</td><td><span className={`status ${order.status === 'Outbid' ? 'status-outline' : ''}`}>{order.status === 'Top bid' && <Check size={11} />}{order.status}</span></td><td className="align-right"><button className="switch" role="switch" aria-checked={order.auto} aria-label={`Auto-adjust ${order.skin}`} onClick={() => setOrders(orders.map(item => item.id === order.id ? { ...item, auto: !item.auto } : item))}><span /></button></td></tr>)}</tbody></table>{!displayed.length && <div className="empty-state"><Check size={25} /><h3>Nothing needs attention</h3><p>All current plans are at the top bid.</p></div>}</div><div className="list-footer"><span>Sample bids. Preferences apply to local plans only.</span><span>USD</span></div></section>
    <div className="execution-note"><LockKeyhole size={18} /><div><h3>Your limits are a boundary, not a suggestion.</h3><p>Auto-adjust is a planning preference. No repricing engine or marketplace connection is running.</p></div></div>
    {newOrder && <Dialog title="New order plan" subtitle="Define a local acquisition target. No order is submitted." close={() => setNewOrder(false)}><form onSubmit={event => { event.preventDefault(); setOrders([...orders, { id: Date.now(), skin: name.trim(), target: target.trim() || 'Any float', max: Number(price), bid: 0, spread: 0, status: 'Local plan', auto: false }]); setNewOrder(false); setName(''); setPrice(''); setTarget(''); notify('Order plan added locally'); }}><label className="form-field">Item name<input required value={name} onChange={e => setName(e.target.value)} placeholder="AK-47 | Vulcan" /></label><label className="form-field">Maximum buy price, USD<input required type="number" min="0.01" step="0.01" value={price} onChange={e => setPrice(e.target.value)} placeholder="164.00" /></label><label className="form-field">Float or pattern target<input value={target} onChange={e => setTarget(e.target.value)} placeholder="Float < 0.18" /></label><div className="dialog-actions"><button type="button" className="button" onClick={() => setNewOrder(false)}>Cancel</button><button type="submit" className="button primary">Create plan</button></div></form></Dialog>}
  </>;
}

export function SettingsView({ fees, setFees, notify }: { fees: Fees; setFees: (fees: Fees) => void; notify: Notify }) {
  const [draft, setDraft] = useState(fees);
  const [interval, setInterval] = useState(() => localStorage.getItem('aegis-poll-interval') || '1000');
  const [profiles, setProfiles] = useState<Array<{ name: string; endpoint: string }>>(() => { try { return JSON.parse(localStorage.getItem('aegis-connection-profiles') || '[]'); } catch { return []; } });
  const [adding, setAdding] = useState(false);
  const [profileName, setProfileName] = useState('');
  const [endpoint, setEndpoint] = useState('');
  const [profileError, setProfileError] = useState('');
  const dirty = markets.some(market => draft[market] !== fees[market]);
  useEffect(() => { localStorage.setItem('aegis-connection-profiles', JSON.stringify(profiles)); }, [profiles]);
  return <div className="settings-layout"><div className="settings-main"><section className="settings-section"><div className="settings-title"><h2>Marketplace fees</h2><p>Seller fees used in every spread calculation. Adjust these to match your account tier.</p></div><div className="fee-table">{markets.map(market => <div className="fee-row" key={market}><div><span className="fee-monogram">{market === 'Skinport' ? 'P' : market[0]}</span><div><strong>{market === 'Steam' ? 'Steam Community Market' : market}</strong><small>{market === 'Buff163' ? 'CNY settlement · converted to USD' : 'USD-normalized prices'}</small></div></div><label><input aria-label={`${market} seller fee`} type="number" min="0" max="100" step="0.1" value={draft[market]} onChange={event => setDraft({ ...draft, [market]: Math.min(100, Math.max(0, Number(event.target.value))) })} /><span>%</span></label></div>)}</div><div className="settings-actions"><button className="text-button" onClick={() => setDraft(initialFees)}>Restore defaults</button><button className="button primary" disabled={!dirty} onClick={() => { setFees(draft); notify('Fee model saved. Spread calculations updated.'); }}><Check size={14} />Save fee model</button></div></section><section className="settings-section"><div className="settings-title"><h2>Connection profiles</h2><p>Store endpoint preferences locally. Adding a profile does not start a connection.</p></div>{profiles.length ? <div className="profile-list">{profiles.map((profile, index) => <div key={`${profile.name}-${index}`}><div><strong>{profile.name}</strong><small>{profile.endpoint}</small></div><span className="status status-outline">Not connected</span><button className="icon-btn" aria-label={`Remove ${profile.name}`} onClick={() => setProfiles(profiles.filter((_, current) => current !== index))}><X size={15} /></button></div>)}</div> : <div className="connection-empty"><span className="connection-glyph"><FolderKey size={22} /></span><div><h3>No connections configured</h3><p>The terminal is using a sample price snapshot.</p></div></div>}<button className="button" onClick={() => setAdding(true)}><Plus size={14} />Add connection profile</button></section><section className="settings-section polling-setting"><div className="settings-title"><h2>Polling preference</h2><p>Saved for a future connected session. No polling is active.</p></div><label><input aria-label="Polling interval" type="number" min="250" max="60000" step="250" value={interval} onChange={event => setInterval(event.target.value)} /><span>milliseconds</span></label><button className="button" disabled={Number(interval) < 250 || Number(interval) > 60000} onClick={() => { localStorage.setItem('aegis-poll-interval', interval); notify('Polling preference saved locally'); }}>Save preference</button></section></div>{adding && <Dialog title="Add connection profile" subtitle="Store a public endpoint preference. Do not include API keys." close={() => setAdding(false)}><form onSubmit={event => { event.preventDefault(); try { const url = new URL(endpoint); if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.search) throw new Error('Use an HTTP(S) URL without credentials or query parameters.'); setProfiles([...profiles, { name: profileName.trim(), endpoint: url.href }]); setAdding(false); setProfileName(''); setEndpoint(''); setProfileError(''); notify('Profile saved locally. No connection was started.'); } catch (failure) { setProfileError(failure instanceof Error ? failure.message : 'Enter a valid endpoint URL.'); } }}><label className="form-field">Profile name<input required value={profileName} onChange={e => setProfileName(e.target.value)} placeholder="Primary connection" /></label><label className="form-field">Endpoint URL<input required type="url" value={endpoint} onChange={e => setEndpoint(e.target.value)} placeholder="https://api.example.com" /></label>{profileError && <p className="form-error" role="alert">{profileError}</p>}<div className="dialog-actions"><button type="button" className="button" onClick={() => setAdding(false)}>Cancel</button><button type="submit" className="button primary">Save profile</button></div></form></Dialog>}</div>;
}
