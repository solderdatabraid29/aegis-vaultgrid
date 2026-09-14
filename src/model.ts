export type View = 'scanner' | 'vaults' | 'orders' | 'settings';
export type Market = 'Buff163' | 'CSFloat' | 'Steam' | 'Skinport' | 'Waxpeer';
export type Rarity = 'covert' | 'classified' | 'gold';
export type Skin = {
  id: number;
  name: string;
  wear: string;
  float: string;
  rarity: Rarity;
  buyMarket: Market;
  buy: number;
  sellMarket: Market;
  sell: number;
  liquidity: number;
  lock: string;
  pattern?: string;
};
export type Fees = Record<Market, number>;
export const markets: Market[] = ['Buff163', 'CSFloat', 'Skinport', 'Waxpeer', 'Steam'];
export const initialFees: Fees = { Steam: 13, Buff163: 2.5, CSFloat: 2, Skinport: 12, Waxpeer: 6 };
export const fxRate = 7.2451;
export const snapshot: Skin[] = [
  { id: 1, name: 'AK-47 | Asiimov', wear: 'FT', float: '0.2461', rarity: 'covert', buyMarket: 'Buff163', buy: 73.8, sellMarket: 'CSFloat', sell: 98.2, liquidity: 86, lock: 'Clear' },
  { id: 2, name: 'M4A1-S | Printstream', wear: 'MW', float: '0.0874', rarity: 'covert', buyMarket: 'Buff163', buy: 121.4, sellMarket: 'Skinport', sell: 151.9, liquidity: 78, lock: '3d 14h' },
  { id: 3, name: 'Karambit | Doppler', wear: 'FN', float: '0.0084', rarity: 'gold', buyMarket: 'CSFloat', buy: 842, sellMarket: 'Steam', sell: 1049, liquidity: 94, lock: 'Clear', pattern: 'Phase 2' },
  { id: 4, name: 'AWP | Dragon Lore', wear: 'FT', float: '0.1923', rarity: 'gold', buyMarket: 'Buff163', buy: 3680, sellMarket: 'Steam', sell: 4520, liquidity: 61, lock: '6d 02h' },
  { id: 5, name: 'Butterfly Knife | Fade', wear: 'FN', float: '0.0132', rarity: 'gold', buyMarket: 'CSFloat', buy: 1180, sellMarket: 'Skinport', sell: 1422, liquidity: 82, lock: 'Clear', pattern: 'Fade 98%' },
  { id: 6, name: 'Sport Gloves | Pandora’s Box', wear: 'FT', float: '0.3114', rarity: 'gold', buyMarket: 'Buff163', buy: 792, sellMarket: 'Waxpeer', sell: 944, liquidity: 68, lock: '5d 09h' },
  { id: 7, name: 'Glock-18 | Gamma Doppler', wear: 'FN', float: '0.0271', rarity: 'classified', buyMarket: 'Buff163', buy: 164, sellMarket: 'CSFloat', sell: 196, liquidity: 73, lock: 'Clear', pattern: 'Emerald' },
  { id: 8, name: 'AK-47 | X-Ray', wear: 'MW', float: '0.1198', rarity: 'covert', buyMarket: 'Steam', buy: 69.5, sellMarket: 'Skinport', sell: 89.4, liquidity: 65, lock: '2d 21h' },
  { id: 9, name: 'M4A4 | Howl', wear: 'MW', float: '0.1067', rarity: 'gold', buyMarket: 'Buff163', buy: 1760, sellMarket: 'Steam', sell: 2189, liquidity: 49, lock: 'Clear' },
  { id: 10, name: 'Desert Eagle | Blaze', wear: 'FN', float: '0.0089', rarity: 'classified', buyMarket: 'CSFloat', buy: 612, sellMarket: 'Waxpeer', sell: 745, liquidity: 72, lock: 'Clear' },
  { id: 11, name: 'USP-S | Kill Confirmed', wear: 'FT', float: '0.2149', rarity: 'covert', buyMarket: 'Buff163', buy: 49.2, sellMarket: 'CSFloat', sell: 64.7, liquidity: 89, lock: 'Clear' },
  { id: 12, name: 'AK-47 | Fire Serpent', wear: 'FT', float: '0.3190', rarity: 'covert', buyMarket: 'Buff163', buy: 487, sellMarket: 'Skinport', sell: 590, liquidity: 57, lock: '4d 11h' },
  { id: 13, name: 'Butterfly Knife | Slaughter', wear: 'MW', float: '0.1042', rarity: 'gold', buyMarket: 'Buff163', buy: 618, sellMarket: 'Waxpeer', sell: 744, liquidity: 63, lock: 'Clear' },
  { id: 14, name: 'AWP | Lightning Strike', wear: 'FN', float: '0.0101', rarity: 'classified', buyMarket: 'CSFloat', buy: 503, sellMarket: 'Skinport', sell: 596, liquidity: 44, lock: '1d 06h' },
  { id: 15, name: 'M4A1-S | Hot Rod', wear: 'FN', float: '0.0064', rarity: 'classified', buyMarket: 'Buff163', buy: 694, sellMarket: 'CSFloat', sell: 820, liquidity: 71, lock: 'Clear' },
];

export const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });

export function calculateSpread(item: Skin, fees: Fees, includeHold: boolean) {
  const fee = item.sell * fees[item.sellMarket] / 100;
  const holdDiscount = includeHold && item.lock !== 'Clear' ? item.buy * 0.015 : 0;
  const profit = item.sell - fee - item.buy - holdDiscount;
  return { fee, holdDiscount, profit, roi: profit / item.buy * 100 };
}

export function downloadCsv(filename: string, rows: Array<Array<string | number>>) {
  const text = rows.map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8;' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
