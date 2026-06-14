// The price universe (QADEMIC.md §5) — S&P 500 large/mid caps, expanding toward
// full index coverage. Static list, reviewed quarterly (survivorship caveat
// disclosed on /methodology). Ticker format: Yahoo-compatible (BRK-B, not BRK.B).
// Scoring coverage (fundamentals) remains gated on FMP Premium; this list drives
// OHLCV ingestion → signals, rotation, timing, and the screener.
// Sector names match the app-wide convention (FMP-style GICS).

export const INDEX_ETFS = ['SPY', 'QQQ', 'DIA'] as const

export const SECTOR_ETFS = [
  'XLK', 'XLF', 'XLE', 'XLV', 'XLY', 'XLP', 'XLI', 'XLB', 'XLRE', 'XLU', 'XLC',
] as const

export const UNIVERSE_BY_SECTOR: Record<string, string[]> = {
  'Technology': [
    'AAPL', 'MSFT', 'NVDA', 'AVGO', 'ORCL', 'CRM', 'ADBE', 'AMD', 'INTC', 'QCOM',
    'TXN', 'INTU', 'NOW', 'IBM', 'CSCO', 'ACN', 'AMAT', 'LRCX', 'KLAC', 'MU',
    'ADI', 'SNPS', 'CDNS', 'PANW', 'CRWD', 'FTNT', 'ANET', 'MSI', 'ADSK', 'WDAY',
    'ROP', 'NXPI', 'MCHP', 'ON', 'HPQ', 'HPE', 'DELL', 'STX', 'WDC', 'TER',
    'SWKS', 'QRVO', 'ZBRA', 'KEYS', 'IT', 'CTSH', 'GLW', 'APH', 'TEL', 'CDW',
    'EPAM', 'FFIV', 'JNPR', 'AKAM', 'GEN', 'TYL', 'PTC', 'ANSS', 'FSLR', 'ENPH',
    'SMCI', 'PLTR', 'DDOG', 'TDY',
  ],
  'Communication Services': [
    'GOOGL', 'GOOG', 'META', 'NFLX', 'DIS', 'CMCSA', 'VZ', 'T', 'TMUS', 'CHTR',
    'WBD', 'EA', 'TTWO', 'OMC', 'IPG', 'NWSA', 'FOXA', 'PARA', 'MTCH', 'LYV',
  ],
  'Financials': [
    'BRK-B', 'JPM', 'V', 'MA', 'BAC', 'WFC', 'GS', 'MS', 'C', 'BLK',
    'SCHW', 'AXP', 'SPGI', 'MCO', 'PGR', 'CB', 'MMC', 'AON', 'ICE', 'CME',
    'PNC', 'USB', 'TFC', 'COF', 'BK', 'STT', 'AIG', 'MET', 'PRU', 'AFL',
    'ALL', 'TRV', 'HIG', 'WTW', 'AJG', 'BRO', 'PYPL', 'FIS', 'FI', 'GPN',
    'DFS', 'SYF', 'KEY', 'RF', 'CFG', 'HBAN', 'FITB', 'MTB', 'NTRS', 'RJF',
    'AMP', 'TROW', 'BEN', 'IVZ', 'NDAQ', 'CBOE', 'MKTX', 'FDS', 'MSCI',
  ],
  'Healthcare': [
    'UNH', 'JNJ', 'LLY', 'ABBV', 'MRK', 'PFE', 'TMO', 'ABT', 'DHR', 'BMY',
    'AMGN', 'GILD', 'VRTX', 'REGN', 'ISRG', 'MDT', 'SYK', 'BSX', 'EW', 'ZBH',
    'BDX', 'BAX', 'CI', 'CVS', 'ELV', 'HUM', 'CNC', 'MCK', 'CAH', 'COR',
    'HCA', 'UHS', 'DGX', 'LH', 'IQV', 'A', 'MTD', 'WAT', 'IDXX', 'RMD',
    'DXCM', 'ALGN', 'HOLX', 'STE', 'COO', 'PODD', 'MRNA', 'BIIB', 'INCY', 'VTRS',
    'ZTS', 'WST', 'TFX', 'GEHC',
  ],
  'Consumer Cyclical': [
    'AMZN', 'TSLA', 'HD', 'MCD', 'NKE', 'LOW', 'SBUX', 'TJX', 'BKNG', 'CMG',
    'ORLY', 'AZO', 'ROST', 'MAR', 'HLT', 'YUM', 'DRI', 'DPZ', 'ULTA', 'BBY',
    'DG', 'DLTR', 'TGT', 'EBAY', 'ETSY', 'EXPE', 'ABNB', 'RCL', 'CCL', 'NCLH',
    'LVS', 'WYNN', 'MGM', 'F', 'GM', 'APTV', 'BWA', 'LEN', 'DHI', 'PHM',
    'NVR', 'GRMN', 'POOL', 'TSCO', 'KMX', 'GPC', 'LKQ', 'HAS', 'WHR', 'MHK',
    'RL', 'TPR', 'LULU', 'DECK',
  ],
  'Consumer Defensive': [
    'WMT', 'PG', 'KO', 'PEP', 'COST', 'PM', 'MO', 'MDLZ', 'CL', 'KMB',
    'GIS', 'K', 'HSY', 'KHC', 'STZ', 'BF-B', 'TAP', 'CAG', 'CPB', 'SJM',
    'HRL', 'TSN', 'ADM', 'BG', 'KR', 'SYY', 'KDP', 'MNST', 'CHD', 'CLX',
    'EL', 'COTY',
  ],
  'Energy': [
    'XOM', 'CVX', 'COP', 'EOG', 'SLB', 'MPC', 'PSX', 'VLO', 'OXY',
    'HES', 'DVN', 'FANG', 'HAL', 'BKR', 'KMI', 'WMB', 'OKE', 'TRGP', 'EQT',
    'CTRA', 'APA',
  ],
  'Industrials': [
    'CAT', 'DE', 'UNP', 'UPS', 'HON', 'RTX', 'LMT', 'BA', 'GE', 'GD',
    'NOC', 'MMM', 'ETN', 'EMR', 'ITW', 'PH', 'CMI', 'PCAR', 'CSX', 'NSC',
    'FDX', 'DAL', 'UAL', 'LUV', 'AAL', 'WM', 'RSG', 'URI', 'FAST', 'GWW',
    'AME', 'ROK', 'DOV', 'XYL', 'IR', 'OTIS', 'CARR', 'JCI', 'TT', 'LHX',
    'TDG', 'HWM', 'TXT', 'MAS', 'PNR', 'SWK', 'CHRW', 'EXPD', 'JBHT', 'ODFL',
    'EFX', 'VRSK', 'PAYX', 'ADP', 'CTAS', 'LDOS', 'AXON',
  ],
  'Basic Materials': [
    'LIN', 'APD', 'SHW', 'ECL', 'FCX', 'NEM', 'NUE', 'STLD', 'DOW', 'DD',
    'PPG', 'LYB', 'IFF', 'ALB', 'CE', 'CF', 'MOS', 'FMC', 'VMC', 'MLM',
    'PKG', 'IP', 'AMCR', 'BALL', 'AVY',
  ],
  'Real Estate': [
    'PLD', 'AMT', 'EQIX', 'CCI', 'PSA', 'O', 'WELL', 'SPG', 'DLR', 'AVB',
    'EQR', 'VTR', 'ESS', 'MAA', 'UDR', 'ARE', 'BXP', 'KIM', 'REG', 'FRT',
    'HST', 'EXR', 'IRM', 'SBAC', 'WY', 'CSGP', 'CBRE',
  ],
  'Utilities': [
    'NEE', 'DUK', 'SO', 'D', 'AEP', 'SRE', 'EXC', 'XEL', 'PEG', 'ED',
    'WEC', 'ES', 'AWK', 'DTE', 'PPL', 'AEE', 'CMS', 'CNP', 'FE', 'EIX',
    'ETR', 'NRG', 'PCG', 'ATO', 'NI', 'LNT', 'EVRG', 'PNW', 'CEG', 'VST',
  ],
}

export const SP500_TICKERS: string[] = Object.values(UNIVERSE_BY_SECTOR).flat()

// DB ticker (dot format) → sector. Single source of truth for sector filters
// on tickers that don't yet have a scored fundamentals row.
export const SECTOR_BY_TICKER: Record<string, string> = Object.fromEntries(
  Object.entries(UNIVERSE_BY_SECTOR).flatMap(([sector, tickers]) =>
    tickers.map(t => [t.replace('-', '.'), sector])
  )
)

// Everything the OHLCV pipeline ingests nightly
export const INGEST_UNIVERSE: string[] = [
  ...SP500_TICKERS,
  ...INDEX_ETFS,
  ...SECTOR_ETFS,
]
