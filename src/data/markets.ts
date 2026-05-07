export type AssetCategory = 'forex' | 'indices' | 'commodities'

export interface Asset {
  symbol: string
  name: string
  price: number
  pip: number
  category: AssetCategory
  color: string
  bg: string
  icon: string
  premiumOnly: boolean
}

export const ASSETS: Asset[] = [
  { symbol: 'EUR/USD', name: 'Euro / US Dollar',       price: 1.08542, pip: 0.00001, category: 'forex',       color: '#3B82F6', bg: '#3B82F620', icon: '€/$',  premiumOnly: false },
  { symbol: 'GBP/USD', name: 'British Pound / Dollar', price: 1.27381, pip: 0.00001, category: 'forex',       color: '#8B5CF6', bg: '#8B5CF620', icon: '£/$',  premiumOnly: true  },
  { symbol: 'USD/JPY', name: 'Dollar / Japanese Yen',  price: 149.832, pip: 0.001,   category: 'forex',       color: '#EC4899', bg: '#EC489920', icon: '$/¥',  premiumOnly: true  },
  { symbol: 'AUD/USD', name: 'Australian / Dollar',    price: 0.65210, pip: 0.00001, category: 'forex',       color: '#10B981', bg: '#10B98120', icon: 'A/$',  premiumOnly: true  },
  { symbol: 'USD/CAD', name: 'Dollar / Canadian',      price: 1.36450, pip: 0.00001, category: 'forex',       color: '#F59E0B', bg: '#F59E0B20', icon: '$/C$', premiumOnly: true  },
  { symbol: 'EUR/GBP', name: 'Euro / British Pound',   price: 0.85123, pip: 0.00001, category: 'forex',       color: '#06B6D4', bg: '#06B6D420', icon: '€/£',  premiumOnly: true  },
  { symbol: 'US30',    name: 'Dow Jones Industrial',   price: 38542.0, pip: 0.1,     category: 'indices',     color: '#F59E0B', bg: '#F59E0B20', icon: 'DJ',   premiumOnly: true  },
  { symbol: 'US500',   name: 'S&P 500',                price: 5021.30, pip: 0.01,    category: 'indices',     color: '#10B981', bg: '#10B98120', icon: 'SP',   premiumOnly: true  },
  { symbol: 'NAS100',  name: 'Nasdaq 100',             price: 17832.5, pip: 0.1,     category: 'indices',     color: '#3B82F6', bg: '#3B82F620', icon: 'NQ',   premiumOnly: true  },
  { symbol: 'UK100',   name: 'FTSE 100',               price: 7654.20, pip: 0.1,     category: 'indices',     color: '#EF4444', bg: '#EF444420', icon: 'FT',   premiumOnly: true  },
  { symbol: 'GER40',   name: 'DAX 40',                 price: 17234.0, pip: 0.1,     category: 'indices',     color: '#8B5CF6', bg: '#8B5CF620', icon: 'DX',   premiumOnly: true  },
  { symbol: 'XAU/USD', name: 'Gold / US Dollar',       price: 2342.50, pip: 0.01,    category: 'commodities', color: '#F59E0B', bg: '#F59E0B20', icon: 'Au',   premiumOnly: false },
  { symbol: 'XAG/USD', name: 'Silver / US Dollar',     price: 27.845,  pip: 0.001,   category: 'commodities', color: '#9CA3AF', bg: '#9CA3AF20', icon: 'Ag',   premiumOnly: true  },
  { symbol: 'WTI',     name: 'WTI Crude Oil',          price: 78.320,  pip: 0.001,   category: 'commodities', color: '#78716C', bg: '#78716C20', icon: 'OL',   premiumOnly: true  },
]

export const FREE_LESSONS = [
  { id: 1,  title: 'What is Forex Trading?',          duration: '8 min',  progress: 100, free: true  },
  { id: 2,  title: 'How Currency Pairs Work',          duration: '10 min', progress: 60,  free: true  },
  { id: 3,  title: 'Reading a Price Chart',            duration: '12 min', progress: 0,   free: true  },
  { id: 4,  title: 'Understanding Pips and Lots',      duration: '10 min', progress: 0,   free: true  },
  { id: 5,  title: 'Basic Order Types (Buy/Sell)',     duration: '8 min',  progress: 0,   free: true  },
]

export const PREMIUM_LESSONS = [
  { id: 6,  title: 'Technical Analysis Fundamentals', duration: '20 min', progress: 0,   free: false },
  { id: 7,  title: 'Candlestick Patterns',            duration: '18 min', progress: 0,   free: false },
  { id: 8,  title: 'Moving Averages & Indicators',    duration: '22 min', progress: 0,   free: false },
  { id: 9,  title: 'Risk Management & Position Sizing',duration: '15 min',progress: 0,   free: false },
  { id: 10, title: 'Trading Psychology',              duration: '12 min', progress: 0,   free: false },
  { id: 11, title: 'Fundamental Analysis & News',     duration: '20 min', progress: 0,   free: false },
  { id: 12, title: 'Building a Trading Strategy',     duration: '25 min', progress: 0,   free: false },
]

export const FREE_CHALLENGES = [
  { id: 1, title: 'Place your first trade',       reward: '100 pts', cash: null,   status: 'completed', progress: 1, total: 1 },
  { id: 2, title: 'Make 3 profitable trades',     reward: '300 pts', cash: null,   status: 'active',    progress: 1, total: 3 },
  { id: 3, title: 'Hold a position for 30 mins',  reward: '200 pts', cash: null,   status: 'active',    progress: 0, total: 1 },
]

export const PREMIUM_CHALLENGES = [
  { id: 4, title: 'Weekly Trading Champion',          reward: '1000 pts', cash: '$200', status: 'active',    progress: 3, total: 10 },
  { id: 5, title: 'Achieve 70% win rate in a week',   reward: '800 pts',  cash: '$100', status: 'upcoming',  progress: 0, total: 1  },
  { id: 6, title: 'Best P&L of the month',            reward: '1500 pts', cash: '$150', status: 'upcoming',  progress: 0, total: 1  },
  { id: 7, title: '5 consecutive profitable trades',  reward: '600 pts',  cash: '$50',  status: 'active',    progress: 2, total: 5  },
]

export const formatPrice = (symbol: string, price: number): string => {
  if (['US30', 'NAS100', 'GER40'].includes(symbol)) return price.toFixed(1)
  if (['US500', 'UK100', 'XAU/USD'].includes(symbol)) return price.toFixed(2)
  if (symbol === 'USD/JPY') return price.toFixed(3)
  if (symbol === 'WTI') return price.toFixed(3)
  return price.toFixed(5)
}
