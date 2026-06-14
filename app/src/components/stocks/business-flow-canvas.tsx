'use client'

import { useEffect, useRef } from 'react'
import type { FMPFundamentals } from '@/app/api/fmp/fundamentals/route'

// ─── Business Model Data ────────────────────────────────────────────────────

interface BusinessModel {
  customers: string[]          // who buys (shown on left)
  centerLabel: string          // primary product/business description
  revenueStreams: {
    label: string              // revenue stream name
    pct?: number               // % of revenue if known (for particle weight)
    col: string                // color
  }[]
  businessType: string         // B2B | B2C | B2B2C | Marketplace | Platform
}

const AMBER  = '#F59E0B'
const PURPLE = '#A78BFA'
const BLUE   = '#38BDF8'
const GREEN  = '#34D399'
const PINK   = '#FB7185'
const ORANGE = '#F97316'
const TEAL   = '#2DD4BF'

const BUSINESS_MODELS: Record<string, BusinessModel> = {
  AAPL: {
    customers: ['CONSUMERS', 'ENTERPRISES'],
    centerLabel: 'iPhone · Mac · Services',
    businessType: 'B2C + Platform',
    revenueStreams: [
      { label: 'IPHONE SALES', pct: 52, col: BLUE },
      { label: 'SERVICES / APP STORE', pct: 22, col: GREEN },
      { label: 'MAC + IPAD', pct: 14, col: PURPLE },
      { label: 'WEARABLES + HOME', pct: 10, col: PINK },
    ],
  },
  MSFT: {
    customers: ['ENTERPRISES', 'DEVELOPERS', 'CONSUMERS'],
    centerLabel: 'Azure · Office 365 · Windows',
    businessType: 'B2B + Platform',
    revenueStreams: [
      { label: 'AZURE CLOUD', pct: 43, col: BLUE },
      { label: 'OFFICE 365 / SAAS', pct: 32, col: GREEN },
      { label: 'WINDOWS LICENSING', pct: 13, col: PURPLE },
      { label: 'XBOX + GAME PASS', pct: 10, col: ORANGE },
    ],
  },
  NVDA: {
    customers: ['AI LABS', 'DATA CENTERS', 'GAMERS', 'AUTOMAKERS'],
    centerLabel: 'H100/GB200 GPUs · CUDA',
    businessType: 'B2B + Platform',
    revenueStreams: [
      { label: 'DATA CENTER GPUs', pct: 87, col: GREEN },
      { label: 'GAMING GPUs', pct: 9, col: PURPLE },
      { label: 'AUTOMOTIVE', pct: 2, col: BLUE },
      { label: 'PROFESSIONAL VIZ', pct: 2, col: PINK },
    ],
  },
  GOOGL: {
    customers: ['ADVERTISERS', 'DEVELOPERS', 'ENTERPRISES'],
    centerLabel: 'Search · YouTube · Cloud',
    businessType: 'Marketplace + Platform',
    revenueStreams: [
      { label: 'GOOGLE SEARCH ADS', pct: 57, col: AMBER },
      { label: 'YOUTUBE ADS', pct: 11, col: PINK },
      { label: 'GOOGLE CLOUD', pct: 11, col: BLUE },
      { label: 'PLAY STORE + OTHER', pct: 10, col: PURPLE },
    ],
  },
  AMZN: {
    customers: ['CONSUMERS', '3P SELLERS', 'ENTERPRISES'],
    centerLabel: 'E-Commerce · AWS · Prime',
    businessType: 'Marketplace + Cloud',
    revenueStreams: [
      { label: 'AWS CLOUD', pct: 17, col: ORANGE },
      { label: '3P SELLER FEES', pct: 23, col: GREEN },
      { label: 'PRIME SUBSCRIPTIONS', pct: 7, col: BLUE },
      { label: 'ADVERTISING', pct: 8, col: PURPLE },
    ],
  },
  META: {
    customers: ['ADVERTISERS', 'BUSINESSES'],
    centerLabel: 'Facebook · Instagram · WhatsApp',
    businessType: 'Platform / Ad Network',
    revenueStreams: [
      { label: 'FACEBOOK + IG ADS', pct: 97, col: BLUE },
      { label: 'OCULUS HARDWARE', pct: 2, col: PURPLE },
      { label: 'BUSINESS MESSAGING', pct: 1, col: GREEN },
    ],
  },
  TSLA: {
    customers: ['CONSUMERS', 'FLEET OPS', 'UTILITIES'],
    centerLabel: 'EVs · Energy · FSD',
    businessType: 'B2C + Software',
    revenueStreams: [
      { label: 'VEHICLE SALES', pct: 79, col: PINK },
      { label: 'ENERGY STORAGE', pct: 10, col: GREEN },
      { label: 'FSD + SOFTWARE', pct: 6, col: AMBER },
      { label: 'SUPERCHARGING', pct: 3, col: BLUE },
    ],
  },
  JPM: {
    customers: ['CONSUMERS', 'CORPORATIONS', 'INSTITUTIONS'],
    centerLabel: 'Banking · IB · Asset Mgmt',
    businessType: 'B2C + B2B Financial',
    revenueStreams: [
      { label: 'NET INTEREST INCOME', pct: 55, col: GREEN },
      { label: 'INVESTMENT BANKING', pct: 20, col: BLUE },
      { label: 'ASSET MANAGEMENT', pct: 15, col: PURPLE },
      { label: 'CARD INTERCHANGE', pct: 10, col: AMBER },
    ],
  },
  'BRK.B': {
    customers: ['RETAIL INVESTORS', 'ENTERPRISES'],
    centerLabel: 'Insurance · Railroads · Holdings',
    businessType: 'Conglomerate',
    revenueStreams: [
      { label: 'INSURANCE (GEICO)', pct: 30, col: BLUE },
      { label: 'BNSF RAILROAD', pct: 18, col: ORANGE },
      { label: 'BERKSHIRE ENERGY', pct: 12, col: GREEN },
      { label: 'EQUITY HOLDINGS', pct: 28, col: AMBER },
    ],
  },
  V: {
    customers: ['BANKS', 'MERCHANTS', 'CONSUMERS'],
    centerLabel: 'Payment Network',
    businessType: 'B2B2C Network',
    revenueStreams: [
      { label: 'DATA PROCESSING FEES', pct: 38, col: BLUE },
      { label: 'SERVICE FEES', pct: 32, col: GREEN },
      { label: 'INTERNATIONAL TX FEES', pct: 20, col: AMBER },
      { label: 'OTHER REVENUES', pct: 10, col: PURPLE },
    ],
  },
  MA: {
    customers: ['BANKS', 'MERCHANTS', 'GOVERNMENTS'],
    centerLabel: 'Global Payment Network',
    businessType: 'B2B2C Network',
    revenueStreams: [
      { label: 'DOMESTIC ASSESSMENT', pct: 30, col: BLUE },
      { label: 'CROSS-BORDER VOLUME', pct: 28, col: ORANGE },
      { label: 'TRANSACTION PROCESSING', pct: 26, col: GREEN },
      { label: 'OTHER NET REVENUES', pct: 16, col: PURPLE },
    ],
  },
  JNJ: {
    customers: ['HOSPITALS', 'PATIENTS', 'PHARMACIES'],
    centerLabel: 'Pharma · MedTech',
    businessType: 'B2B Healthcare',
    revenueStreams: [
      { label: 'INNOVATIVE MEDICINE', pct: 56, col: PINK },
      { label: 'MEDTECH DEVICES', pct: 44, col: BLUE },
    ],
  },
  WMT: {
    customers: ['HOUSEHOLDS', 'VALUE SHOPPERS'],
    centerLabel: 'Retail · Grocery · Walmart+',
    businessType: 'B2C Retail',
    revenueStreams: [
      { label: 'US WALMART STORES', pct: 67, col: BLUE },
      { label: 'SAM\'S CLUB', pct: 12, col: GREEN },
      { label: 'INTERNATIONAL', pct: 15, col: PURPLE },
      { label: 'WALMART+ + ADS', pct: 6, col: AMBER },
    ],
  },
  XOM: {
    customers: ['REFINERS', 'INDUSTRIALS', 'CONSUMERS'],
    centerLabel: 'Oil & Gas · Chemicals',
    businessType: 'B2B Energy',
    revenueStreams: [
      { label: 'UPSTREAM (E&P)', pct: 50, col: ORANGE },
      { label: 'ENERGY PRODUCTS', pct: 30, col: AMBER },
      { label: 'CHEMICAL PRODUCTS', pct: 12, col: GREEN },
      { label: 'SPECIALTY PRODUCTS', pct: 8, col: BLUE },
    ],
  },
  UNH: {
    customers: ['EMPLOYERS', 'GOVERNMENTS', 'INDIVIDUALS'],
    centerLabel: 'Health Insurance · Optum',
    businessType: 'B2B2C Healthcare',
    revenueStreams: [
      { label: 'UNITEDHEALTHCARE', pct: 52, col: BLUE },
      { label: 'OPTUM HEALTH', pct: 22, col: GREEN },
      { label: 'OPTUM RX (PBM)', pct: 18, col: TEAL },
      { label: 'OPTUM INSIGHT', pct: 8, col: PURPLE },
    ],
  },
  PG: {
    customers: ['HOUSEHOLDS', 'RETAILERS'],
    centerLabel: 'Consumer Brands Portfolio',
    businessType: 'B2C FMCG',
    revenueStreams: [
      { label: 'FABRIC & HOME CARE', pct: 35, col: BLUE },
      { label: 'BABY, FEMI & FAMILY', pct: 25, col: PINK },
      { label: 'BEAUTY + GROOMING', pct: 22, col: PURPLE },
      { label: 'HEALTH CARE', pct: 18, col: GREEN },
    ],
  },
  HD: {
    customers: ['DIY CONSUMERS', 'CONTRACTORS', 'PRO BUILDERS'],
    centerLabel: 'Home Improvement Retail',
    businessType: 'B2C + B2B Retail',
    revenueStreams: [
      { label: 'PRODUCT SALES (PRO)', pct: 50, col: ORANGE },
      { label: 'PRODUCT SALES (DIY)', pct: 40, col: AMBER },
      { label: 'SERVICES + INSTALL', pct: 8, col: GREEN },
      { label: 'OTHER', pct: 2, col: BLUE },
    ],
  },
  CVX: {
    customers: ['REFINERS', 'UTILITIES', 'INDUSTRIALS'],
    centerLabel: 'Oil · Gas · Midstream',
    businessType: 'B2B Energy',
    revenueStreams: [
      { label: 'UPSTREAM (E&P)', pct: 55, col: ORANGE },
      { label: 'DOWNSTREAM REFINING', pct: 35, col: AMBER },
      { label: 'MIDSTREAM + CHEM', pct: 10, col: GREEN },
    ],
  },
  MRK: {
    customers: ['HOSPITALS', 'PHARMACIES', 'GOVERNMENTS'],
    centerLabel: 'Pharma · Vaccines · Oncology',
    businessType: 'B2B Pharma',
    revenueStreams: [
      { label: 'KEYTRUDA (CANCER)', pct: 42, col: PINK },
      { label: 'VACCINES (GARDASIL)', pct: 15, col: GREEN },
      { label: 'HOSPITAL ACUTE CARE', pct: 20, col: BLUE },
      { label: 'OTHER PHARMA', pct: 23, col: PURPLE },
    ],
  },
  ABBV: {
    customers: ['HOSPITALS', 'PHARMACIES', 'PATIENTS'],
    centerLabel: 'Immunology · Oncology · Neuro',
    businessType: 'B2B Pharma',
    revenueStreams: [
      { label: 'SKYRIZI + RINVOQ', pct: 38, col: GREEN },
      { label: 'HUMIRA (BIOSIMILAR)', pct: 20, col: BLUE },
      { label: 'BOTOX + AESTHETICS', pct: 18, col: PINK },
      { label: 'ONCOLOGY + NEURO', pct: 24, col: PURPLE },
    ],
  },
  KO: {
    customers: ['CONSUMERS', 'RESTAURANTS', 'RETAILERS'],
    centerLabel: 'Beverages & Brand Licensing',
    businessType: 'B2B2C FMCG',
    revenueStreams: [
      { label: 'CONCENTRATE SALES', pct: 45, col: PINK },
      { label: 'FINISHED PRODUCTS', pct: 38, col: BLUE },
      { label: 'BRAND LICENSING', pct: 17, col: AMBER },
    ],
  },
  PEP: {
    customers: ['CONSUMERS', 'RETAILERS', 'RESTAURANTS'],
    centerLabel: 'Beverages · Snacks · Frito-Lay',
    businessType: 'B2C FMCG',
    revenueStreams: [
      { label: 'FRITO-LAY SNACKS', pct: 28, col: ORANGE },
      { label: 'PEPSI BEVERAGES', pct: 22, col: BLUE },
      { label: 'QUAKER FOODS', pct: 10, col: AMBER },
      { label: 'INTERNATIONAL', pct: 40, col: GREEN },
    ],
  },
  COST: {
    customers: ['MEMBERS', 'SMALL BUSINESSES'],
    centerLabel: 'Membership Warehouse Retail',
    businessType: 'B2C Membership',
    revenueStreams: [
      { label: 'MEMBERSHIP FEES', pct: 2, col: AMBER },
      { label: 'MERCHANDISE SALES', pct: 97, col: BLUE },
      { label: 'OTHER (PHARMACY)', pct: 1, col: GREEN },
    ],
  },
  LLY: {
    customers: ['PATIENTS', 'PHARMACIES', 'HOSPITALS'],
    centerLabel: 'Diabetes · Obesity · Oncology',
    businessType: 'B2B Pharma',
    revenueStreams: [
      { label: 'MOUNJARO / ZEPBOUND', pct: 48, col: GREEN },
      { label: 'TRULICITY (GLP-1)', pct: 12, col: BLUE },
      { label: 'ONCOLOGY', pct: 14, col: PINK },
      { label: 'OTHER PRODUCTS', pct: 26, col: PURPLE },
    ],
  },
  AVGO: {
    customers: ['DATA CENTERS', 'TELECOM', 'ENTERPRISES'],
    centerLabel: 'Custom AI Chips · Networking',
    businessType: 'B2B Semiconductor',
    revenueStreams: [
      { label: 'CUSTOM AI ACCELERATORS', pct: 35, col: GREEN },
      { label: 'NETWORKING (ETHERNET)', pct: 25, col: BLUE },
      { label: 'VMWARE / SOFTWARE', pct: 25, col: PURPLE },
      { label: 'BROADBAND + WIRELESS', pct: 15, col: AMBER },
    ],
  },
  MCD: {
    customers: ['CONSUMERS', 'FRANCHISEES'],
    centerLabel: 'Franchise QSR Network',
    businessType: 'B2C + Franchise',
    revenueStreams: [
      { label: 'FRANCHISE ROYALTIES', pct: 62, col: AMBER },
      { label: 'COMPANY-OWNED STORES', pct: 31, col: ORANGE },
      { label: 'FRANCHISE RENT', pct: 7, col: GREEN },
    ],
  },
  CSCO: {
    customers: ['ENTERPRISES', 'GOVERNMENTS', 'TELCOS'],
    centerLabel: 'Networking · Security · Observ.',
    businessType: 'B2B Technology',
    revenueStreams: [
      { label: 'NETWORKING HARDWARE', pct: 45, col: BLUE },
      { label: 'SECURITY SOFTWARE', pct: 25, col: PINK },
      { label: 'OBSERVABILITY (SPLUNK)', pct: 15, col: PURPLE },
      { label: 'SERVICES + SUPPORT', pct: 15, col: GREEN },
    ],
  },
  ACN: {
    customers: ['FORTUNE 500', 'GOVERNMENTS'],
    centerLabel: 'IT Consulting · Outsourcing',
    businessType: 'B2B Services',
    revenueStreams: [
      { label: 'TECHNOLOGY SERVICES', pct: 40, col: BLUE },
      { label: 'CONSULTING', pct: 35, col: PURPLE },
      { label: 'OPERATIONS (BPO)', pct: 25, col: GREEN },
    ],
  },
  ADBE: {
    customers: ['CREATIVES', 'ENTERPRISES', 'MARKETERS'],
    centerLabel: 'Creative Cloud · Document Cloud',
    businessType: 'SaaS Platform',
    revenueStreams: [
      { label: 'CREATIVE CLOUD', pct: 62, col: PINK },
      { label: 'DOCUMENT CLOUD', pct: 17, col: BLUE },
      { label: 'EXPERIENCE CLOUD', pct: 20, col: PURPLE },
    ],
  },
  CRM: {
    customers: ['SALES TEAMS', 'ENTERPRISES', 'SUPPORT TEAMS'],
    centerLabel: 'CRM · AI Agentforce · AppExchange',
    businessType: 'B2B SaaS',
    revenueStreams: [
      { label: 'SALES CLOUD', pct: 22, col: BLUE },
      { label: 'SERVICE CLOUD', pct: 24, col: GREEN },
      { label: 'PLATFORM + AGENTFORCE', pct: 28, col: AMBER },
      { label: 'MARKETING CLOUD', pct: 14, col: PURPLE },
    ],
  },
  NFLX: {
    customers: ['CONSUMERS', 'ADVERTISERS'],
    centerLabel: 'Streaming · Ad-Supported Tier',
    businessType: 'B2C Subscription',
    revenueStreams: [
      { label: 'SUBSCRIPTION (SVOD)', pct: 93, col: PINK },
      { label: 'AD-SUPPORTED TIER', pct: 5, col: ORANGE },
      { label: 'LICENSING + OTHER', pct: 2, col: BLUE },
    ],
  },
  AMD: {
    customers: ['DATA CENTERS', 'GAMERS', 'ENTERPRISES'],
    centerLabel: 'CPUs · GPUs · FPGA',
    businessType: 'B2B Semiconductor',
    revenueStreams: [
      { label: 'DATA CENTER (MI300)', pct: 55, col: GREEN },
      { label: 'CLIENT CPUs (RYZEN)', pct: 20, col: BLUE },
      { label: 'GAMING + CONSOLES', pct: 14, col: PURPLE },
      { label: 'EMBEDDED + FPGA', pct: 11, col: AMBER },
    ],
  },
  INTC: {
    customers: ['PC MAKERS', 'DATA CENTERS', 'TELCOS'],
    centerLabel: 'x86 CPUs · Foundry · Networking',
    businessType: 'B2B Semiconductor',
    revenueStreams: [
      { label: 'CLIENT COMPUTING', pct: 52, col: BLUE },
      { label: 'DATA CENTER & AI', pct: 28, col: GREEN },
      { label: 'INTEL FOUNDRY SVC', pct: 10, col: PURPLE },
      { label: 'NETWORK + EDGE', pct: 10, col: AMBER },
    ],
  },
  QCOM: {
    customers: ['PHONE MAKERS', 'AUTOMAKERS', 'IOT OEMs'],
    centerLabel: 'Snapdragon SoCs · 5G Modems',
    businessType: 'B2B Semiconductor + IP',
    revenueStreams: [
      { label: 'HANDSET CHIPS (QCT)', pct: 62, col: BLUE },
      { label: 'LICENSING (QTL)', pct: 20, col: AMBER },
      { label: 'AUTOMOTIVE', pct: 10, col: GREEN },
      { label: 'IOT + EDGE', pct: 8, col: PURPLE },
    ],
  },
  TXN: {
    customers: ['INDUSTRIALS', 'AUTOMAKERS', 'ELECTRONICS OEMs'],
    centerLabel: 'Analog + Embedded Chips',
    businessType: 'B2B Semiconductor',
    revenueStreams: [
      { label: 'ANALOG CHIPS', pct: 77, col: GREEN },
      { label: 'EMBEDDED PROCESSORS', pct: 23, col: BLUE },
    ],
  },
  INTU: {
    customers: ['SMALL BUSINESSES', 'CONSUMERS', 'ACCOUNTANTS'],
    centerLabel: 'TurboTax · QuickBooks · Credit Karma',
    businessType: 'B2B + B2C SaaS',
    revenueStreams: [
      { label: 'SMALL BUSINESS (QB)', pct: 52, col: GREEN },
      { label: 'CONSUMER (TURBOTAX)', pct: 27, col: BLUE },
      { label: 'CREDIT KARMA', pct: 12, col: PURPLE },
      { label: 'PROCONNECT (PROS)', pct: 9, col: AMBER },
    ],
  },
  NOW: {
    customers: ['ENTERPRISES', 'IT TEAMS', 'HR TEAMS'],
    centerLabel: 'IT Workflows · ITSM Platform',
    businessType: 'B2B SaaS',
    revenueStreams: [
      { label: 'IT SERVICE MGMT', pct: 45, col: BLUE },
      { label: 'CUSTOMER WORKFLOWS', pct: 20, col: GREEN },
      { label: 'EMPLOYEE WORKFLOWS', pct: 15, col: PURPLE },
      { label: 'CREATOR + NOW AI', pct: 20, col: AMBER },
    ],
  },
  ORCL: {
    customers: ['ENTERPRISES', 'GOVERNMENTS', 'DATABASES ADMINS'],
    centerLabel: 'OCI Cloud · Database · ERP',
    businessType: 'B2B Software + Cloud',
    revenueStreams: [
      { label: 'CLOUD SERVICES (OCI)', pct: 42, col: ORANGE },
      { label: 'LICENSE SUPPORT', pct: 38, col: BLUE },
      { label: 'CLOUD APPLICATIONS', pct: 14, col: GREEN },
      { label: 'HARDWARE', pct: 6, col: PURPLE },
    ],
  },
  IBM: {
    customers: ['ENTERPRISES', 'GOVERNMENTS', 'FINANCIAL FIRMS'],
    centerLabel: 'Hybrid Cloud · Consulting · AI',
    businessType: 'B2B Technology',
    revenueStreams: [
      { label: 'SOFTWARE (RED HAT)', pct: 42, col: PINK },
      { label: 'CONSULTING', pct: 31, col: BLUE },
      { label: 'INFRASTRUCTURE', pct: 22, col: PURPLE },
      { label: 'FINANCING', pct: 5, col: GREEN },
    ],
  },
  GS: {
    customers: ['CORPORATIONS', 'INSTITUTIONS', 'GOVTS'],
    centerLabel: 'Investment Banking · Trading',
    businessType: 'B2B Financial',
    revenueStreams: [
      { label: 'GLOBAL BANKING & MKTS', pct: 62, col: BLUE },
      { label: 'ASSET MANAGEMENT', pct: 25, col: GREEN },
      { label: 'CONSUMER + WEALTH', pct: 13, col: AMBER },
    ],
  },
  BAC: {
    customers: ['CONSUMERS', 'CORPORATIONS', 'INSTITUTIONS'],
    centerLabel: 'Retail Banking · Global Markets',
    businessType: 'B2C + B2B Banking',
    revenueStreams: [
      { label: 'CONSUMER BANKING', pct: 37, col: BLUE },
      { label: 'GLOBAL MARKETS', pct: 27, col: GREEN },
      { label: 'GLOBAL BANKING (IB)', pct: 18, col: PURPLE },
      { label: 'WEALTH MANAGEMENT', pct: 18, col: AMBER },
    ],
  },
  WFC: {
    customers: ['CONSUMERS', 'SMBs', 'CORPORATIONS'],
    centerLabel: 'Retail Banking · Mortgages · Cards',
    businessType: 'B2C + B2B Banking',
    revenueStreams: [
      { label: 'CONSUMER BANKING', pct: 46, col: BLUE },
      { label: 'COMMERCIAL BANKING', pct: 22, col: GREEN },
      { label: 'CORPORATE & IB', pct: 18, col: PURPLE },
      { label: 'WEALTH + INVESTMENT', pct: 14, col: AMBER },
    ],
  },
  C: {
    customers: ['MULTINATIONALS', 'INSTITUTIONS', 'CONSUMERS'],
    centerLabel: 'Global Transaction · Markets',
    businessType: 'B2B + B2C Banking',
    revenueStreams: [
      { label: 'SERVICES (TTS + SEC)', pct: 40, col: BLUE },
      { label: 'MARKETS & TRADING', pct: 30, col: GREEN },
      { label: 'BANKING (IB + CB)', pct: 15, col: PURPLE },
      { label: 'US PERSONAL BANKING', pct: 15, col: AMBER },
    ],
  },
  MS: {
    customers: ['INSTITUTIONS', 'WEALTHY INDIVIDUALS', 'CORPS'],
    centerLabel: 'Wealth Mgmt · IB · Trading',
    businessType: 'B2B + B2C Financial',
    revenueStreams: [
      { label: 'WEALTH MANAGEMENT', pct: 46, col: GREEN },
      { label: 'INSTITUTIONAL SECURITIES', pct: 43, col: BLUE },
      { label: 'INVESTMENT MANAGEMENT', pct: 11, col: PURPLE },
    ],
  },
  BLK: {
    customers: ['PENSION FUNDS', 'INSTITUTIONS', 'RETAIL INVESTORS'],
    centerLabel: 'iShares ETFs · Aladdin · Alts',
    businessType: 'B2B2C Asset Manager',
    revenueStreams: [
      { label: 'BASE FEES (ETF/INDEX)', pct: 52, col: GREEN },
      { label: 'PERFORMANCE FEES', pct: 12, col: AMBER },
      { label: 'ALADDIN TECHNOLOGY', pct: 14, col: BLUE },
      { label: 'ALTERNATIVES', pct: 22, col: PURPLE },
    ],
  },
}

// Fallback by sector when ticker not found
function getFallbackModel(f: FMPFundamentals): BusinessModel {
  const sectorModels: Record<string, BusinessModel> = {
    Technology: {
      customers: ['ENTERPRISES', 'DEVELOPERS'],
      centerLabel: f.industry,
      businessType: 'B2B Technology',
      revenueStreams: [
        { label: 'SOFTWARE LICENSES', pct: 50, col: BLUE },
        { label: 'CLOUD SERVICES', pct: 30, col: GREEN },
        { label: 'PROFESSIONAL SVCS', pct: 20, col: PURPLE },
      ],
    },
    Healthcare: {
      customers: ['HOSPITALS', 'PATIENTS', 'PAYERS'],
      centerLabel: f.industry,
      businessType: 'B2B Healthcare',
      revenueStreams: [
        { label: 'PRODUCT SALES', pct: 60, col: PINK },
        { label: 'SERVICES', pct: 25, col: BLUE },
        { label: 'LICENSING', pct: 15, col: PURPLE },
      ],
    },
    Financials: {
      customers: ['CONSUMERS', 'CORPORATIONS'],
      centerLabel: f.industry,
      businessType: 'B2C + B2B Financial',
      revenueStreams: [
        { label: 'NET INTEREST INCOME', pct: 60, col: GREEN },
        { label: 'FEES + COMMISSIONS', pct: 25, col: BLUE },
        { label: 'TRADING + OTHER', pct: 15, col: PURPLE },
      ],
    },
    Energy: {
      customers: ['UTILITIES', 'INDUSTRIALS'],
      centerLabel: f.industry,
      businessType: 'B2B Energy',
      revenueStreams: [
        { label: 'UPSTREAM (E&P)', pct: 55, col: ORANGE },
        { label: 'DOWNSTREAM', pct: 30, col: AMBER },
        { label: 'MIDSTREAM', pct: 15, col: GREEN },
      ],
    },
  }
  return sectorModels[f.sector] ?? {
    customers: ['MARKET DEMAND'],
    centerLabel: f.industry,
    businessType: 'Mixed',
    revenueStreams: [
      { label: 'PRIMARY REVENUE', pct: 70, col: GREEN },
      { label: 'SECONDARY', pct: 30, col: BLUE },
    ],
  }
}

// ─── Canvas types ──────────────────────────────────────────────────────────

interface CanvasNode {
  fx: number; fy: number
  lines: string[]
  col: string
  r: number
  isCenter?: boolean
  isLeft?: boolean
  streamPct?: number
}

interface Particle {
  fromIdx: number; toIdx: number
  t: number; spd: number
  col: string; sz: number
}

interface Props {
  fundamentals: FMPFundamentals
}

// ─── Component ────────────────────────────────────────────────────────────

export default function BusinessFlowCanvas({ fundamentals: f }: Props) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!

    const model = BUSINESS_MODELS[f.ticker] ?? getFallbackModel(f)

    const dpr = window.devicePixelRatio || 1
    const W = canvas.offsetWidth || 780
    const H = 300
    canvas.width = W * dpr
    canvas.height = H * dpr
    canvas.style.width = `${W}px`
    canvas.style.height = `${H}px`
    ctx.scale(dpr, dpr)

    const streams = model.revenueStreams
    const streamCount = streams.length

    // ── Layout ──────────────────────────────────────────────────────────────
    // Left: customers node at x=0.1
    // Center: company node at x=0.40
    // Right: revenue stream nodes at x=0.78, spread vertically

    const rightX = 0.80
    const rightYs = streamCount === 1
      ? [0.50]
      : streamCount === 2
      ? [0.32, 0.68]
      : streamCount === 3
      ? [0.22, 0.50, 0.78]
      : [0.16, 0.38, 0.62, 0.84]

    const NODES: CanvasNode[] = [
      // 0: customers (left)
      {
        fx: 0.10,
        fy: 0.50,
        lines: model.customers,
        col: BLUE,
        r: 0.078,
        isLeft: true,
      },
      // 1: company (center)
      {
        fx: 0.40,
        fy: 0.50,
        lines: [f.ticker, model.centerLabel],
        col: AMBER,
        r: 0.095,
        isCenter: true,
      },
      // 2+: revenue streams (right)
      ...streams.map((s, i): CanvasNode => ({
        fx: rightX,
        fy: rightYs[i] ?? 0.50,
        lines: [s.label, s.pct !== undefined ? `${s.pct}% OF REV` : ''],
        col: s.col,
        r: 0.052,
        streamPct: s.pct,
      })),
    ]

    // Weighted spawn probabilities for right nodes
    const totalPct = streams.reduce((s, r) => s + (r.pct ?? 25), 0)
    const streamWeights = streams.map(s => (s.pct ?? 25) / totalPct)

    // ── Particles ───────────────────────────────────────────────────────────
    const parts: Particle[] = []

    function spawnParticle(fromIdx: number, toIdx: number, phase: number) {
      const node = NODES[toIdx]
      if (!node) return
      const sIdx = toIdx - 2
      const sz = sIdx >= 0 && streamWeights[sIdx] !== undefined
        ? 1.5 + (streamWeights[sIdx]! * 3.5)
        : 2.0
      parts.push({
        fromIdx, toIdx,
        t: phase,
        spd: 0.0025 + Math.random() * 0.0035,
        col: node.col,
        sz,
      })
    }

    // Seed initial particles
    for (let i = 0; i < 28; i++) spawnParticle(0, 1, i / 28)
    for (let i = 0; i < streamCount; i++) {
      const count = Math.max(4, Math.round((streamWeights[i] ?? 0.25) * 20))
      for (let j = 0; j < count; j++) spawnParticle(1, 2 + i, j / count)
    }

    let tick = 0
    let raf: number

    // ── Draw helpers ─────────────────────────────────────────────────────────

    function drawGlowCircle(x: number, y: number, r: number, col: string, alpha: number) {
      const g = ctx.createRadialGradient(x, y, 0, x, y, r * 2.8)
      g.addColorStop(0, col + Math.round(alpha * 255).toString(16).padStart(2, '0'))
      g.addColorStop(1, 'transparent')
      ctx.beginPath()
      ctx.arc(x, y, r * 2.8, 0, Math.PI * 2)
      ctx.fillStyle = g
      ctx.fill()
    }

    function drawNode(n: CanvasNode) {
      const x = n.fx * W
      const y = n.fy * H
      const r = n.r * Math.min(W, H)

      // Ambient glow
      drawGlowCircle(x, y, r, n.col, 0.08)

      // Pulse ring for center
      if (n.isCenter) {
        const pulse = 0.5 + 0.5 * Math.sin(tick * 0.045)
        ctx.beginPath()
        ctx.arc(x, y, r + 4 + pulse * 9, 0, Math.PI * 2)
        ctx.strokeStyle = `rgba(245,158,11,${0.12 + pulse * 0.20})`
        ctx.lineWidth = 1.5
        ctx.stroke()
        // Second pulse ring offset
        ctx.beginPath()
        ctx.arc(x, y, r + 12 + pulse * 14, 0, Math.PI * 2)
        ctx.strokeStyle = `rgba(245,158,11,${0.04 + pulse * 0.08})`
        ctx.lineWidth = 1.0
        ctx.stroke()
      }

      // Left node: dashed outer ring
      if (n.isLeft) {
        ctx.save()
        ctx.setLineDash([3, 5])
        ctx.beginPath()
        ctx.arc(x, y, r + 6, 0, Math.PI * 2)
        ctx.strokeStyle = n.col + '44'
        ctx.lineWidth = 1.2
        ctx.stroke()
        ctx.restore()
      }

      // Main circle
      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fillStyle = n.col + '14'
      ctx.shadowColor = n.col
      ctx.shadowBlur = n.isCenter ? 26 : 14
      ctx.fill()
      ctx.strokeStyle = n.col
      ctx.lineWidth = n.isCenter ? 2.2 : 1.6
      ctx.stroke()
      ctx.shadowBlur = 0

      // Text labels
      const lines = n.lines.filter(l => l.length > 0)
      const fontSize = Math.max(8, r * (n.isCenter ? 0.30 : 0.28))
      const subSize = Math.max(7, r * 0.22)
      const lineH = fontSize * 1.35

      if (n.isCenter) {
        // Ticker large, then product small
        ctx.fillStyle = '#F9FAFB'
        ctx.font = `800 ${Math.max(11, r * 0.42)}px 'JetBrains Mono',monospace`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(lines[0] ?? '', x, y - lineH * 0.4)

        ctx.fillStyle = AMBER + 'BB'
        ctx.font = `500 ${subSize}px 'DM Sans',sans-serif`
        // Truncate to fit
        const maxW = r * 1.6
        let sub = lines[1] ?? ''
        while (sub.length > 3 && ctx.measureText(sub).width > maxW) {
          sub = sub.slice(0, -4) + '…'
        }
        ctx.fillText(sub, x, y + lineH * 0.55)
      } else if (n.isLeft) {
        // Customer segments stacked
        const total = lines.length
        lines.forEach((line, i) => {
          const yOff = (i - (total - 1) / 2) * (fontSize * 1.2)
          ctx.fillStyle = i === 0 ? '#F9FAFB' : BLUE + 'CC'
          ctx.font = `700 ${i === 0 ? fontSize : subSize}px 'JetBrains Mono',monospace`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          // Truncate
          const maxW = r * 1.65
          let txt = line
          while (txt.length > 3 && ctx.measureText(txt).width > maxW) {
            txt = txt.slice(0, -4) + '…'
          }
          ctx.fillText(txt, x, y + yOff)
        })
      } else {
        // Revenue stream: label + pct
        ctx.fillStyle = '#F9FAFB'
        ctx.font = `700 ${fontSize}px 'JetBrains Mono',monospace`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        const maxW = r * 1.7
        let label = lines[0] ?? ''
        while (label.length > 3 && ctx.measureText(label).width > maxW) {
          label = label.slice(0, -4) + '…'
        }
        ctx.fillText(label, x, y - (lines[1] ? lineH * 0.35 : 0))

        if (lines[1]) {
          ctx.fillStyle = n.col + 'BB'
          ctx.font = `600 ${subSize}px 'JetBrains Mono',monospace`
          ctx.fillText(lines[1], x, y + lineH * 0.45)
        }
      }
    }

    function bezierPoint(t: number, ax: number, ay: number, cpx: number, cpy: number, bx: number, by: number) {
      const mt = 1 - t
      return {
        x: mt * mt * ax + 2 * mt * t * cpx + t * t * bx,
        y: mt * mt * ay + 2 * mt * t * cpy + t * t * by,
      }
    }

    function getControlPoint(a: CanvasNode, b: CanvasNode): { cpx: number; cpy: number } {
      const ax = a.fx * W, ay = a.fy * H
      const bx = b.fx * W, by = b.fy * H
      // Curve up or down slightly for right-side nodes to avoid overlap
      const dy = by - ay
      const cpx = (ax + bx) / 2
      const cpy = ay + dy * 0.1  // gentle curve
      return { cpx, cpy }
    }

    // ── Draw connections (bezier) ─────────────────────────────────────────
    function drawConnections() {
      // Left → Center
      const left = NODES[0]!, center = NODES[1]!
      const { cpx: lcp, cpy: lcpy } = getControlPoint(left, center)
      ctx.beginPath()
      ctx.moveTo(left.fx * W, left.fy * H)
      ctx.quadraticCurveTo(lcp, lcpy, center.fx * W, center.fy * H)
      ctx.strokeStyle = 'rgba(56,189,248,0.15)'
      ctx.lineWidth = 1.2
      ctx.stroke()

      // Center → each stream
      for (let i = 0; i < streamCount; i++) {
        const stream = NODES[2 + i]
        if (!stream) continue
        const { cpx, cpy } = getControlPoint(center, stream)
        // Width proportional to revenue %
        const w = streamWeights[i] !== undefined ? 0.8 + (streamWeights[i]! * 2.5) : 1.0
        ctx.beginPath()
        ctx.moveTo(center.fx * W, center.fy * H)
        ctx.quadraticCurveTo(cpx, cpy, stream.fx * W, stream.fy * H)
        ctx.strokeStyle = stream.col + '22'
        ctx.lineWidth = w
        ctx.stroke()
      }
    }

    // ── Main draw loop ─────────────────────────────────────────────────────
    function draw() {
      ctx.clearRect(0, 0, W, H)

      // Subtle scanlines / grid
      ctx.save()
      for (let gy = 0; gy < H; gy += 28) {
        ctx.beginPath()
        ctx.moveTo(0, gy)
        ctx.lineTo(W, gy)
        ctx.strokeStyle = 'rgba(255,255,255,0.012)'
        ctx.lineWidth = 0.5
        ctx.stroke()
      }
      ctx.restore()

      // Central amber glow
      const cn = NODES[1]!
      const cgx = cn.fx * W, cgy = cn.fy * H
      const cg = ctx.createRadialGradient(cgx, cgy, 0, cgx, cgy, W * 0.35)
      cg.addColorStop(0, `rgba(245,158,11,${0.04 + 0.015 * Math.sin(tick * 0.035)})`)
      cg.addColorStop(1, 'transparent')
      ctx.beginPath()
      ctx.arc(cgx, cgy, W * 0.35, 0, Math.PI * 2)
      ctx.fillStyle = cg
      ctx.fill()

      drawConnections()

      // ── Particles ────────────────────────────────────────────────────────
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i]!
        p.t += p.spd
        if (p.t >= 1) {
          parts.splice(i, 1)
          // Respawn: 55% chance left→center, else weighted stream
          if (Math.random() < 0.55) {
            spawnParticle(0, 1, 0)
          } else {
            let r2 = Math.random()
            let chosen = 0
            for (let j = 0; j < streamCount; j++) {
              r2 -= (streamWeights[j] ?? 0.25)
              if (r2 <= 0) { chosen = j; break }
            }
            spawnParticle(1, 2 + chosen, 0)
          }
          continue
        }

        const a = NODES[p.fromIdx]!, b = NODES[p.toIdx]!
        if (!a || !b) continue
        const { cpx, cpy } = getControlPoint(a, b)
        const ax = a.fx * W, ay = a.fy * H, bx = b.fx * W, by = b.fy * H
        const pos = bezierPoint(p.t, ax, ay, cpx, cpy, bx, by)
        const fade = p.t < 0.12 ? p.t / 0.12 : p.t > 0.88 ? (1 - p.t) / 0.12 : 1

        ctx.save()
        ctx.globalAlpha = 0.8 * fade
        ctx.shadowColor = p.col
        ctx.shadowBlur = 10
        ctx.beginPath()
        ctx.arc(pos.x, pos.y, p.sz, 0, Math.PI * 2)
        ctx.fillStyle = p.col
        ctx.fill()
        ctx.restore()
      }

      // ── Nodes on top ─────────────────────────────────────────────────────
      NODES.forEach(n => drawNode(n))

      // ── Flow direction arrows ─────────────────────────────────────────────
      // Small "→" label between nodes
      ctx.save()
      ctx.fillStyle = 'rgba(156,163,175,0.35)'
      ctx.font = `500 9px 'JetBrains Mono',monospace`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      const leftNode = NODES[0]!, centerNode = NODES[1]!
      const midX1 = (leftNode.fx + centerNode.fx) / 2 * W
      const midY1 = leftNode.fy * H - 10
      ctx.fillText('DEMAND →', midX1, midY1)
      ctx.restore()

      tick++
      raf = requestAnimationFrame(draw)
    }

    draw()
    return () => cancelAnimationFrame(raf)
  }, [f])

  const model = BUSINESS_MODELS[f.ticker] ?? getFallbackModel(f)

  return (
    <div style={{
      border: '1px solid #1F2937',
      borderRadius: 16,
      overflow: 'hidden',
      background: 'rgba(5,8,16,0.6)',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 18px',
        borderBottom: '1px solid #1F2937',
        background: 'rgba(255,255,255,0.012)',
      }}>
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 9,
          fontWeight: 800,
          color: '#38BDF8',
          background: 'rgba(56,189,248,0.08)',
          border: '1px solid rgba(56,189,248,0.25)',
          padding: '3px 8px',
          borderRadius: 4,
          letterSpacing: '0.08em',
        }}>BUSINESS MODEL</span>
        <span style={{
          fontFamily: 'var(--font-bricolage)',
          fontSize: 14,
          fontWeight: 700,
          color: '#F9FAFB',
        }}>
          How <span style={{ color: '#F59E0B' }}>{f.ticker}</span> Actually Makes Money
        </span>
        <span style={{
          marginLeft: 'auto',
          fontFamily: 'var(--font-mono)',
          fontSize: 8,
          color: '#374151',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          background: 'rgba(55,65,81,0.3)',
          padding: '2px 7px',
          borderRadius: 3,
        }}>{model.businessType}</span>
      </div>

      {/* Canvas */}
      <div style={{ padding: '0 0 0' }}>
        <canvas
          ref={ref}
          style={{
            display: 'block',
            width: '100%',
            height: 300,
          }}
        />
      </div>

      {/* Legend row */}
      <div style={{
        display: 'flex',
        gap: 6,
        padding: '8px 18px 12px',
        borderTop: '1px solid rgba(31,41,55,0.6)',
        flexWrap: 'wrap',
        alignItems: 'center',
      }}>
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 8,
          color: '#4B5563',
          letterSpacing: '0.1em',
          marginRight: 4,
          textTransform: 'uppercase',
        }}>Revenue Streams →</span>
        {model.revenueStreams.map((s) => (
          <span key={s.label} style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 9,
            fontWeight: 600,
            color: s.col,
            background: s.col + '12',
            border: `1px solid ${s.col}33`,
            padding: '2px 8px',
            borderRadius: 4,
            letterSpacing: '0.05em',
          }}>
            {s.label}{s.pct !== undefined ? ` · ${s.pct}%` : ''}
          </span>
        ))}
      </div>
    </div>
  )
}
