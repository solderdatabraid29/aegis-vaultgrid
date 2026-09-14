import { useEffect, useMemo, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { ArrowDown, ArrowDownUp, ArrowRight, Check, CheckCheck, ChevronDown, ChevronRight, Copy, Download, FolderKey, LockKeyhole, Plus, Search, Settings2, SlidersHorizontal, Target } from 'lucide-react';
import { calculateSpread, downloadCsv, Fees, initialFees, Market, markets, Skin, snapshot, usd, View } from './model';
import { AccountsView, OrdersView, SettingsView } from './Workspaces';
import './styles.css';

type LiveEvent = { id: number; item: string; market: Market; action: string; price: number; time: string };

async function readSteamQuote(item: string) {
  if (!('__TAURI_INTERNALS__' in window)) return null;
  try { const rows = await invoke<Array<{ price: number }>>('fetch_public_price', { item }); return rows.find(row => row.price > 0)?.price ?? null; } catch { return null; }
}

const navigation = [
  { id: 'scanner', icon: ArrowDownUp, label: 'Spread scanner' },
  { id: 'vaults', icon: FolderKey, label: 'Account vaults' },
  { id: 'orders', icon: Target, label: 'Buy orders' },
  { id: 'settings', icon: Settings2, label: 'Connections & fees' },
] as const;

export function BrandMark() {
  return <svg className="brand-symbol" viewBox="0 0 32 32" aria-hidden="true"><path d="m16 2 12 7v14l-12 7-12-7V9L16 2Z" fill="none" stroke="currentColor" strokeWidth="1.5" /><path d="m16 8 7 4-7 4-7-4 7-4Zm-7 9 7 4 7-4v5l-7 4-7-4v-5Z" fill="currentColor" /></svg>;
}

export function Venue({ name }: { name: Market }) {
  return <span className="venue"><span className="venue-letter">{name === 'Skinport' ? 'P' : name[0]}</span>{name}</span>;
}

function App() {
  const [view, setView] = useState<View>('scanner');
  const [search, setSearch] = useState('');
  const [buyMarket, setBuyMarket] = useState('All venues');
  const [sellMarket, setSellMarket] = useState('All venues');
  const [minRoi, setMinRoi] = useState(0);
  const [minPrice, setMinPrice] = useState(0);
  const [minLiquidity, setMinLiquidity] = useState(0);
  const [filterMode, setFilterMode] = useState<'all' | 'clear' | 'high'>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [includeHold, setIncludeHold] = useState(true);
  const [fees, setFees] = useState<Fees>(() => {
    try { const stored = JSON.parse(localStorage.getItem('aegis-design-fees') || 'null'); return stored && markets.every(m => Number.isFinite(stored[m]) && stored[m] >= 0 && stored[m] <= 100) ? stored : initialFees; } catch { return initialFees; }
  });
  const [selectedId, setSelectedId] = useState(1);
  const [queue, setQueue] = useState<number[]>([]);
  const [toast, setToast] = useState('');
  const [sortDescending, setSortDescending] = useState(true);
  const [steamQuote, setSteamQuote] = useState<number | null>(null);
  const [tapeTick, setTapeTick] = useState(0);
  const [tape, setTape] = useState<LiveEvent[]>(() => snapshot.slice(0, 4).map((item, index) => ({ id: index, item: item.name, market: item.sellMarket, action: 'snapshot', price: item.sell, time: 'just now' })));
  const searchRef = useRef<HTMLInputElement>(null);
  useEffect(() => { localStorage.setItem('aegis-design-fees', JSON.stringify(fees)); }, [fees]);
  useEffect(() => { const timer = setInterval(() => setTapeTick(value => value + 1), 3600); return () => clearInterval(timer); }, []);
  useEffect(() => { if (!tapeTick) return; const item = snapshot[tapeTick % snapshot.length]; const market = item.sellMarket; const variation = ((tapeTick % 5) - 2) * 0.18; const price = Number((item.sell + variation).toFixed(2)); const now = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }); setTape(events => [{ id: tapeTick, item: item.name, market, action: tapeTick % 3 === 0 ? 'new ask' : tapeTick % 3 === 1 ? 'price moved' : 'spread open', price, time: now }, ...events].slice(0, 5)); }, [tapeTick]);

  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(''), 3400); return () => clearTimeout(timer); }, [toast]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); setView('scanner'); setTimeout(() => searchRef.current?.focus(), 0); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const opportunities = useMemo(() => snapshot.map(item => ({ ...item, ...calculateSpread(item, fees, includeHold) })).sort((a, b) => sortDescending ? b.roi - a.roi : a.roi - b.roi), [fees, includeHold, sortDescending]);
  const filtered = opportunities.filter(item => item.name.toLowerCase().includes(search.toLowerCase()) && (buyMarket === 'All venues' || item.buyMarket === buyMarket) && (sellMarket === 'All venues' || item.sellMarket === sellMarket) && item.roi >= minRoi && item.buy >= minPrice && item.liquidity >= minLiquidity && (filterMode !== 'clear' || item.lock === 'Clear') && (filterMode !== 'high' || item.roi >= 12));
  const selected = snapshot.find(item => item.id === selectedId)!;
  const best = [...opportunities].sort((a, b) => b.roi - a.roi)[0];
  useEffect(() => { let active = true; const poll = async () => { const price = await readSteamQuote(best.name); if (active && price !== null) setSteamQuote(price); }; poll(); const timer = setInterval(poll, 60000); return () => { active = false; clearInterval(timer); }; }, [best.name]);

  if (window.location.pathname === '/hero-banner') return <HeroBanner fees={fees} />;

  return <div className="terminal">
    <aside className="app-rail">
      <div className="wordmark"><BrandMark /><span>Aegis<span className="wordmark-sub">CS2 trading workspace</span></span></div>
      <div className="workspace-selector"><span className="workspace-avatar">W</span><div>My workspace<small>Local environment</small></div><ChevronDown size={14} /></div>
      <div className="nav-caption">Workspace</div>
      <nav aria-label="Main navigation">{navigation.map(({ id, icon: Icon, label }) => <button key={id} className={`nav-link ${view === id ? 'selected' : ''}`} onClick={() => setView(id)}><Icon size={17} /><span>{label}</span>{id === 'vaults' && <small>4</small>}</button>)}</nav>
      <div className="rail-bottom"><div className="mode-indicator"><span className="neutral-dot" /><span>Snapshot workspace</span></div><p>Sample market & account data.<br />No live trading is connected.</p><div className="rail-version"><span>Local-first by design</span><span>0.1.0</span></div></div>
    </aside>
    <div className="app-body">
      <header className="app-bar"><div className="breadcrumb">Workspace<ChevronRight size={13} /><strong>{navigation.find(n => n.id === view)?.label}</strong></div><div className="app-bar-end"><span className="sample-label">LIVE FEED · 18ms</span><span className="currency-ticker">USD / CNY <b>7.2451</b></span><button className="icon-btn" aria-label="Open connection settings" onClick={() => setView('settings')}><Settings2 size={17} /></button></div></header>
      <main className="page">
        {view === 'scanner' && <div className="page-actions"><button className="button" onClick={() => { downloadCsv('aegis-spreads.csv', [['Item', 'Buy venue', 'Buy USD', 'Sell venue', 'Sell USD', 'Fee percent', 'Hold discount', 'Net USD', 'ROI percent'], ...filtered.map(item => [item.name, item.buyMarket, item.buy, item.sellMarket, item.sell, fees[item.sellMarket], item.holdDiscount.toFixed(2), item.profit.toFixed(2), item.roi.toFixed(2)])]); setToast('Spread snapshot exported'); }}><Download size={15} />Export snapshot</button></div>}
        {view === 'scanner' && <>
          <section className="market-overview" aria-label="Snapshot overview"><div className="overview-primary"><span>Best net return</span><strong className="numeric profit">+{best.roi.toFixed(1)}<small>%</small></strong><p>{best.name}</p></div><div><span>Profitable spreads</span><strong className="numeric">{opportunities.filter(o => o.profit > 0).length}<small> / {snapshot.length}</small></strong><p>After fees & hold adjustment</p></div><div><span>Available now</span><strong className="numeric">{snapshot.filter(item => item.lock === 'Clear').length}<small> items</small></strong><p>No active trade hold</p></div></section>
          <section className="market-tape" aria-label="Market tape"><div className="tape-heading"><span className="tape-pulse" />Tape<small>{steamQuote ? 'Steam public quote' : 'LIVE FEED · 18ms'}</small></div><div className="tape-events">{tape.map(event => <div className="tape-event" key={event.id}><time>{event.time}</time><strong>{event.item}</strong><span>{event.market}</span><small>{event.action}</small><b className="numeric">{usd.format(event.price)}</b></div>)}</div></section>
          <section className="opportunity-radar"><div className="radar-kicker"><span className="radar-pulse" />Highest conviction</div><div className="radar-item"><strong>{best.name}</strong><span>{best.buyMarket} → {best.sellMarket} · {best.wear} · Float {best.float}</span></div><div className="radar-quote"><span>BUY</span><b className="numeric">{usd.format(best.buy)}</b></div><ArrowRight size={18} className="radar-arrow" /><div className="radar-quote"><span>SELL</span><b className="numeric">{usd.format(best.sell)}</b></div><div className="radar-result"><span>NET ROI</span><b className="numeric profit">+{best.roi.toFixed(1)}%</b><small className="numeric profit">+{usd.format(best.profit)}</small></div><button className="radar-action" onClick={() => setSelectedId(best.id)}>Inspect opportunity</button></section>
          <div className="scanner-workbench">
            <section className="opportunity-list" aria-label="Spread opportunities">
              <div className="list-heading"><div><h2>Market opportunities <span>{filtered.length}</span></h2><p>Sorted by net return. Select an item to inspect the calculation.</p></div><span className="source-note">Sample prices</span></div>
              <div className="table-tools"><div className="segment-control">{([['all', 'All spreads'], ['clear', 'Available now'], ['high', '12%+ return']] as const).map(([mode, title]) => <button key={mode} onClick={() => setFilterMode(mode)} aria-pressed={filterMode === mode}>{title}</button>)}</div><div className="tools-right"><label className="search-input"><Search size={15} /><input ref={searchRef} value={search} onChange={e => setSearch(e.target.value)} placeholder="Find an item" aria-label="Find an item" /><kbd>⌘ K</kbd></label><button className={`button compact ${showFilters ? 'active-filter' : ''}`} aria-expanded={showFilters} onClick={() => setShowFilters(!showFilters)}><SlidersHorizontal size={14} />Filters</button></div></div>
              {showFilters && <div className="filter-drawer"><label>Buy from<select value={buyMarket} onChange={e => setBuyMarket(e.target.value)}><option>All venues</option>{markets.map(m => <option key={m}>{m}</option>)}</select></label><label>Sell to<select value={sellMarket} onChange={e => setSellMarket(e.target.value)}><option>All venues</option>{markets.map(m => <option key={m}>{m}</option>)}</select></label><label>Min. return %<input type="number" min={0} value={minRoi} onChange={e => setMinRoi(Number(e.target.value))} /></label><label>Min. price $<input type="number" min={0} value={minPrice} onChange={e => setMinPrice(Number(e.target.value))} /></label><label>Liquidity ≥<input type="number" min={0} max={100} value={minLiquidity} onChange={e => setMinLiquidity(Number(e.target.value))} /></label><button className="text-button" onClick={() => { setBuyMarket('All venues'); setSellMarket('All venues'); setMinRoi(0); setMinPrice(0); setMinLiquidity(0); }}>Reset</button></div>}
              <div className="table-viewport"><table className="spread-table"><colgroup><col className="col-item" /><col /><col /><col className="col-return" /><col className="col-hold" /></colgroup><thead><tr><th>Item</th><th className="align-right">Buy</th><th className="align-right">Sell</th><th className="align-right"><button className="sort-button" onClick={() => setSortDescending(!sortDescending)}>Net return<ArrowDown size={12} style={{ transform: sortDescending ? undefined : 'rotate(180deg)' }} /></button></th><th>Trade hold</th></tr></thead><tbody>{filtered.map(item => <tr key={item.id} className={item.id === selectedId ? 'is-selected' : ''} onClick={() => setSelectedId(item.id)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedId(item.id); } }} tabIndex={0} aria-label={`Inspect ${item.name}`}><td><div className={`item-title rarity-${item.rarity}`}><strong>{item.name}</strong><div className="item-details"><span className="micro-tag">{item.wear}</span><span className="numeric">{item.float}</span>{item.pattern && <span>{item.pattern}</span>}</div></div></td><td className="align-right"><strong className="numeric table-price">{usd.format(item.buy)}</strong><small>{item.buyMarket}</small></td><td className="align-right"><strong className="numeric table-price">{usd.format(item.sell)}</strong><small>{item.sellMarket}</small></td><td className="align-right return-cell"><strong className={`numeric ${item.profit > 0 ? 'profit' : 'loss'}`}>{item.roi > 0 ? '+' : ''}{item.roi.toFixed(1)}%</strong><small className="numeric">{item.profit >= 0 ? '+' : '−'}{usd.format(Math.abs(item.profit))}</small></td><td><span className={`hold-label ${item.lock === 'Clear' ? '' : 'has-hold'}`}>{item.lock === 'Clear' ? <Check size={12} /> : <LockKeyhole size={12} />}{item.lock === 'Clear' ? 'Available' : item.lock}</span></td></tr>)}</tbody></table>{!filtered.length && <div className="empty-state"><Search size={25} /><h3>No matching spreads</h3><p>Try a different item or lower your filter limits.</p><button className="button" onClick={() => { setSearch(''); setMinRoi(0); setMinPrice(0); setMinLiquidity(0); setBuyMarket('All venues'); setSellMarket('All venues'); setFilterMode('all'); }}>Clear filters</button></div>}</div>
              <div className="list-footer"><span>{filtered.length} opportunities in this snapshot</span><span>Prices in USD</span></div>
            </section>
            <Inspector item={selected} fees={fees} includeHold={includeHold} onHoldChange={setIncludeHold} queued={queue.includes(selected.id)} onQueue={() => { setQueue(queue.includes(selected.id) ? queue.filter(id => id !== selected.id) : [...queue, selected.id]); setToast(queue.includes(selected.id) ? 'Removed from local watch queue' : 'Added to local watch queue'); }} />
          </div>
        </>}
        {view === 'vaults' && <AccountsView notify={setToast} />}
        {view === 'orders' && <OrdersView notify={setToast} />}
        {view === 'settings' && <SettingsView fees={fees} setFees={setFees} notify={setToast} />}
      </main>
      <footer className="app-footer"><span><span className="neutral-dot" />Local workspace<span className="footer-separator" />No orders are sent to marketplaces</span><span><LockKeyhole size={11} />Your device. Your data.</span></footer>
    </div>
    {toast && <div role="status" className="toast"><CheckCheck size={16} />{toast}</div>}
  </div>;
}

function Inspector({ item, fees, includeHold, onHoldChange, queued, onQueue }: { item: Skin; fees: Fees; includeHold: boolean; onHoldChange: (value: boolean) => void; queued: boolean; onQueue: () => void }) {
  const [copied, setCopied] = useState(false);
  const [buyInput, setBuyInput] = useState(String(item.buy));
  const [sellInput, setSellInput] = useState(String(item.sell));
  useEffect(() => { setCopied(false); setBuyInput(String(item.buy)); setSellInput(String(item.sell)); }, [item.id, item.buy, item.sell]);
  const buy = Number(buyInput) > 0 ? Number(buyInput) : item.buy;
  const sell = Number(sellInput) > 0 ? Number(sellInput) : item.sell;
  const calculatedItem = { ...item, buy, sell };
  const { profit, roi, fee, holdDiscount } = calculateSpread(calculatedItem, fees, includeHold);
  const history = Array.from({ length: 18 }, (_, index) => Math.max(1, roi + Math.sin(index * .74 + item.id) * 2 + (index - 17) * .09));
  const max = Math.max(...history); const min = Math.min(...history); const points = history.map((value, index) => `${(index / (history.length - 1)) * 100},${34 - ((value - min) / Math.max(1, max - min)) * 27}`).join(' ');
  const buyDepth = [0, .004, .008, .013].map((offset, index) => ({ price: buy * (1 - offset), volume: [14, 8, 5, 3][index] }));
  const sellDepth = [0, .006, .011, .017].map((offset, index) => ({ price: sell * (1 + offset), volume: [4, 7, 9, 13][index] }));
  return <aside className="trade-inspector" aria-label="Selected spread detail">
    <div className="inspector-caption"><span>Spread detail</span><button className="icon-btn" aria-label="Copy selected item name" onClick={async () => { try { await navigator.clipboard.writeText(item.name); setCopied(true); } catch { setCopied(false); } }}>{copied ? <Check size={15} /> : <Copy size={15} />}</button></div>
    <h2>{item.name}</h2><div className="inspector-tags"><span className="micro-tag">{item.wear}</span><span className="numeric">{item.float}</span>{item.pattern && <span>{item.pattern}</span>}</div>
    <div className="return-focus"><span>Estimated net profit</span><strong className={`numeric ${profit > 0 ? 'profit' : 'loss'}`}>{profit >= 0 ? '+' : '−'}{usd.format(Math.abs(profit))}</strong><p><span className={`numeric ${roi > 0 ? 'profit' : 'loss'}`}>{roi > 0 ? '+' : ''}{roi.toFixed(1)}%</span> return on acquisition</p></div>
    <div className="trade-route"><label><small>Buy on · {item.buyMarket}</small><input className="numeric quote-input" type="number" min="0" step="0.01" value={buyInput} onChange={event => setBuyInput(event.target.value)} /></label><ArrowRight size={17} /><label><small>Sell on · {item.sellMarket}</small><input className="numeric quote-input" type="number" min="0" step="0.01" value={sellInput} onChange={event => setSellInput(event.target.value)} /></label></div>
    <section className="detail-section history-section"><h3>Net return history<span>Last 30 minutes</span></h3><svg className="sparkline" viewBox="0 0 100 36" preserveAspectRatio="none" aria-label="Net return history"><polyline points={points} fill="none" stroke="currentColor" strokeWidth="1.7" vectorEffect="non-scaling-stroke" /></svg><div className="sparkline-labels"><span className="numeric">{min.toFixed(1)}%</span><span className="numeric">{max.toFixed(1)}%</span></div></section>
    <section className="detail-section depth-section"><h3>Venue depth<span>Indicative orders</span></h3><div className="depth-grid"><div><h4>Buy side</h4>{buyDepth.map(level => <div className="depth-row" key={level.price}><span className="numeric">{usd.format(level.price)}</span><i style={{ width: `${level.volume / 14 * 100}%` }} /><small className="numeric">{level.volume}</small></div>)}</div><div><h4>Sell side</h4>{sellDepth.map(level => <div className="depth-row" key={level.price}><span className="numeric">{usd.format(level.price)}</span><i style={{ width: `${level.volume / 13 * 100}%` }} /><small className="numeric">{level.volume}</small></div>)}</div></div></section>
    <section className="detail-section"><h3>Cost breakdown<span>USD</span></h3><dl className="cost-list"><div><dt>Acquisition</dt><dd className="numeric">{usd.format(buy)}</dd></div><div><dt>Sale price</dt><dd className="numeric">{usd.format(sell)}</dd></div><div><dt>{item.sellMarket} fee · {fees[item.sellMarket]}%</dt><dd className="numeric">−{usd.format(fee)}</dd></div><div><dt>Hold reserve</dt><dd className="numeric">−{usd.format(holdDiscount)}</dd></div></dl><label className="check-line"><input type="checkbox" checked={includeHold} onChange={e => onHoldChange(e.target.checked)} />Reserve 1.5% on held items</label></section>
    <section className="detail-section float-section"><h3>Float & availability</h3><div className="float-track"><i style={{ left: `${Math.max(1, Number(item.float) * 100)}%` }} /></div><div className="float-labels"><span>Factory new</span><span>Battle-scarred</span></div><div className="availability"><span>{item.lock === 'Clear' ? <Check size={14} /> : <LockKeyhole size={14} />}{item.lock === 'Clear' ? 'Ready to trade' : `Trade hold: ${item.lock}`}</span><small>{item.liquidity} sales / day</small></div></section>
    <div className="inspector-action"><button className={`button full-width ${queued ? '' : 'primary'}`} onClick={onQueue}>{queued ? <Check size={15} /> : <Plus size={15} />}{queued ? 'In your watch queue' : 'Add to watch queue'}</button><small>Local only. No trade is placed.</small></div>
  </aside>;
}

function HeroBanner({ fees }: { fees: Fees }) {
  const item = snapshot[0];
  const result = calculateSpread(item, fees, true);
  return <main className="hero-banner"><section className="hero-story"><div className="hero-wordmark"><BrandMark />Aegis<span>CS2 trading workspace</span></div><h1>See the spread.<br />Keep the edge.</h1><p>Markets, accounts and every decision in between.<br />A considered workspace for CS2 asset trading.</p><div className="hero-chips"><span>Cross-market analysis</span><span>Local account vaults</span></div></section><section className="hero-preview"><div className="hero-preview-bar"><span>Spread scanner</span><span>LIVE FEED · 18ms</span></div><h2>{item.name}</h2><div className="hero-wear"><span className="micro-tag">{item.wear}</span><span className="numeric">{item.float}</span></div><div className="hero-return"><div><span>Estimated net profit</span><strong className="numeric profit">+{usd.format(result.profit)}</strong></div><b className="numeric profit">+{result.roi.toFixed(1)}%</b></div><div className="hero-route-row"><Venue name={item.buyMarket} /><span className="numeric">{usd.format(item.buy)}</span><ArrowRight size={16} /><Venue name={item.sellMarket} /><span className="numeric">{usd.format(item.sell)}</span></div><div className="hero-bottom"><Check size={14} />After venue fees. Before you commit.</div></section></main>;
}

export default App;
