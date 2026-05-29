# Default Ticker Industry Priority Inventory

## 기준
- 대상: DB `ticker_universes.name = default`에 포함된 전체 ticker.
- 전체 ticker 수: 2,278개.
- market cap coverage: 2,276/2,278개. market cap이 없는 ticker는 각 industry 맨 아래에 둔다.
- market cap: `company_profiles`의 ticker별 최신 non-null `market_cap`을 사용한다.
- 정렬: AI/tech 관련 industry를 먼저 배치하고, 각 industry 내부는 market cap 내림차순으로 정렬한다.
- 용도: description enrichment를 어떤 industry/ticker부터 추가 작성할지 정하는 작업 큐다.
- 중복 처리: 같은 ticker가 여러 industry/subset에 중복 등장하면 description은 한 번만 작성한다. 이미 enrichment가 있으면 재작성하지 않고, 필요한 경우 theme/category tag만 추가한다.

## AI/Tech 우선 Industry 순서
| 우선순위 | Industry | Ticker 수 | Top tickers by market cap |
|----------|----------|-----------|---------------------------|
| 1 | Semiconductors | 80 | NVDA, AVGO, MU, AMD, INTC, LRCX, AMAT, TXN, KLAC, QCOM, ADI, MRVL |
| 2 | Hardware, Equipment & Parts | 55 | SNDK, GLW, APH, TEL, KEYS, COHR, FLEX, GRMN, CLS, JBL, TDY, FN |
| 3 | Computer Hardware | 29 | STX, ANET, WDC, DELL, P, NTAP, PSTG, IONQ, SMCI, HPQ, LOGI, QBTS |
| 4 | Communication Equipment | 43 | CSCO, CIEN, LITE, MSI, UI, HPE, SATS, CRDO, ASTS, VIAV, ZBRA, VSAT |
| 5 | Software - Infrastructure | 91 | MSFT, ORCL, PLTR, PANW, CRWD, SNPS, ADBE, FTNT, NET, CRWV, VRSN, MDB |
| 6 | Software - Application | 146 | APP, CRM, UBER, INTU, CDNS, NOW, DDOG, MSTR, SNOW, ADSK, WDAY, ZM |
| 7 | Internet Content & Information | 36 | GOOGL, GOOG, META, SPOT, DASH, NBIS, RDDT, TWLO, PINS, ZG, Z, SNAP |
| 8 | Information Technology Services | 48 | IBM, ACN, CTSH, FIS, BR, LDOS, AUR, GIB, CDW, APLD, CACI, JKHY |
| 9 | Consumer Electronics | 6 | AAPL, NXT, SONO, VUZI, TBCH, GPRO |
| 10 | Electronic Components | 2 | KULR, ELTK |
| 11 | Electronic Gaming & Multimedia | 11 | EA, TTWO, RBLX, MGRT, PLTK, GDEV, CTW, MRDN, SKLZ, GMHS, DKI |
| 12 | Scientific & Technical Instruments | 4 | ARBE, GNSS, ODYS, SOTK |
| 13 | Financial - Data & Stock Exchanges | 4 | CME, ICE, COIN, NDAQ |
| 14 | Telecommunications Services | 37 | TMUS, VZ, T, CMCSA, BCE, TU, RCI, CHTR, TIGO, GSAT, LUMN, LBTYB |
| 15 | Telecom Services | 2 | RDCM, FNGR |
| 16 | Electrical Equipment & Parts | 30 | VRT, BE, NVT, HUBB, AEIS, POWL, FPS, AYI, ENS, PLUG, AMPX, ATKR |

## Space/Defense 우선 Industry 순서
- AI/Tech 16개 industry를 1차로 처리한 뒤, 2차 큐로 우주/방산 관련 industry와 subset을 처리한다.
- 공식 industry 전체 처리 대상은 `Aerospace & Defense` 70개다.
- 위성통신, 우주 하드웨어, 방산 IT/시스템 통합, 드론/센서 기업은 다른 industry 안에 섞여 있으므로 별도 subset tag로 본다.
- 아래 표의 subset은 industry 전체를 모두 2차로 넣는다는 뜻이 아니라, 해당 industry 안에서 우주/방산 관련 ticker를 먼저 선별한다는 뜻이다.

| 2차 우선순위 | 구분 | Industry / subset | 범위 | 먼저 볼 top tickers by market cap | 비고 |
|--------------|------|-------------------|------|-----------------------------------|------|
| 17 | Core aerospace/defense | Aerospace & Defense | 70 tickers | GE, RTX, BA, LMT, GD, NOC, RKLB, TDG, LHX, HEI, ESLT, AXON, CW, WWD, BWXT | AI/tech 다음 2차 핵심 industry |
| 18 | Satellite/space communications | Communication Equipment subset | industry 43개 중 선별 | SATS, ASTS, VSAT, YSS, GILT, TSAT, ONDS, VIAV | 전체 industry는 AI/tech #4와 중복. 우주/위성/방산 통신 후보만 tag |
| 19 | Space hardware/electronics | Hardware, Equipment & Parts subset | industry 55개 중 선별 | MDA, BKSY, SATL, OSIS, TDY, KEYS, MKSI | 우주 장비, 광학/계측, 위성 부품 후보 |
| 20 | Defense IT / systems integrators | Information Technology Services subset | industry 48개 중 선별 | LDOS, CACI, SAIC, BBAI, TLS, TSSI | 방산 IT, government contractor, mission system 후보 |
| 21 | Drone/robotics/quantum dual-use | Computer Hardware subset | industry 29개 중 선별 | IONQ, QBTS, RGTI, RCAT, UAVS, INFQ, QUBT | quantum/drone/edge hardware 후보. 직접 방산 여부는 개별 검증 필요 |
| 22 | Sensors/radar/instruments | Scientific & Technical Instruments subset | 4 tickers | ARBE, GNSS, ODYS, SOTK | 센서/계측/상황인식 관련 후보 |
| 23 | Aerospace components outside core industry | Industrial - Machinery subset | industry 68개 중 선별 | HWM | 공식 industry가 Aerospace & Defense가 아니지만 항공/우주 부품 exposure가 큰 후보 |

### LWLG 분류 확인
- `LWLG`는 default universe에 포함되어 있지만, 현재 공식 분류는 `Basic Materials` sector의 `Chemicals - Specialty` industry다.
- 현재 상세 목록에서는 `Chemicals - Specialty` 섹션의 rank 27에 있으며, market cap은 약 `$2.4B`로 잡혀 있다.
- Lightwave Logic은 photonic polymer/optical modulator 테마 때문에 AI interconnect 또는 photonics 관점에서 별도 cross-theme tag를 줄 수는 있지만, 현재 industry 기준으로는 AI/tech 1차 큐나 우주/방산 2차 core industry에는 자동 포함되지 않는다.

## 전체 Industry 요약
| 정렬 | Industry | Sector 예시 | Ticker 수 | Market cap 보유 | Industry top ticker |
|------|----------|-------------|-----------|-----------------|---------------------|
| 1 | Semiconductors | Technology | 80 | 80 | NVDA ($5.37T) |
| 2 | Hardware, Equipment & Parts | Technology | 55 | 55 | SNDK ($215.0B) |
| 3 | Computer Hardware | Technology | 29 | 29 | STX ($181.4B) |
| 4 | Communication Equipment | Technology | 43 | 43 | CSCO ($392.2B) |
| 5 | Software - Infrastructure | Technology | 91 | 91 | MSFT ($3.03T) |
| 6 | Software - Application | Technology | 146 | 146 | APP ($164.8B) |
| 7 | Internet Content & Information | Communication Services | 36 | 36 | GOOGL ($4.68T) |
| 8 | Information Technology Services | Technology | 48 | 48 | IBM ($206.0B) |
| 9 | Consumer Electronics | Technology | 6 | 6 | AAPL ($4.33T) |
| 10 | Electronic Components | Technology | 2 | 2 | KULR ($147.5M) |
| 11 | Electronic Gaming & Multimedia | Communication Services | 11 | 11 | EA ($50.1B) |
| 12 | Scientific & Technical Instruments | Technology | 4 | 4 | ARBE ($107.2M) |
| 13 | Financial - Data & Stock Exchanges | Financial Services | 4 | 4 | CME ($103.5B) |
| 14 | Telecommunications Services | Communication Services | 37 | 37 | TMUS ($209.2B) |
| 15 | Telecom Services | Communication Services | 2 | 2 | RDCM ($264.6M) |
| 16 | Electrical Equipment & Parts | Industrials | 30 | 30 | VRT ($141.0B) |
| 17 | Agricultural Inputs | Basic Materials | 1 | 1 | IPI ($627.1M) |
| 18 | Aluminum | Basic Materials | 4 | 4 | AA ($17.8B) |
| 19 | Building Materials | Basic Materials | 1 | 1 | RMIX ($386.5M) |
| 20 | Chemicals | Basic Materials | 11 | 11 | DOW ($28.4B) |
| 21 | Chemicals - Specialty | Basic Materials | 40 | 40 | LIN ($233.1B) |
| 22 | Construction Materials | Basic Materials | 12 | 12 | CRH ($74.4B) |
| 23 | Copper | Basic Materials | 5 | 5 | SCCO ($158.4B) |
| 24 | Gold | Basic Materials | 41 | 41 | NEM ($127.8B) |
| 25 | Industrial Materials | Basic Materials | 28 | 28 | TECK ($31.8B) |
| 26 | Other Industrial Metals & Mining | Basic Materials | 3 | 3 | NAK ($1.2B) |
| 27 | Other Precious Metals | Basic Materials | 23 | 23 | TFPM ($7.3B) |
| 28 | Paper, Lumber & Forest Products | Basic Materials | 1 | 1 | MATV ($474.6M) |
| 29 | Silver | Basic Materials | 6 | 6 | PAAS ($26.9B) |
| 30 | Specialty Chemicals | Basic Materials | 2 | 2 | FSI ($80.8M) |
| 31 | Steel | Basic Materials | 13 | 13 | NUE ($52.3B) |
| 32 | Broadcasting | Communication Services | 1 | 1 | FUBO ($1.1B) |
| 33 | Entertainment | Communication Services | 15 | 15 | NFLX ($369.1B) |
| 34 | Publishing | Communication Services | 3 | 3 | NYT ($12.6B) |
| 35 | Apparel - Retail | Consumer Cyclical | 2 | 2 | DLTH ($113.2M) |
| 36 | Auto & Truck Dealerships | Consumer Cyclical | 1 | 1 | CRMT ($103.2M) |
| 37 | Auto - Dealerships | Consumer Cyclical | 17 | 17 | CVNA ($79.9B) |
| 38 | Auto - Manufacturers | Consumer Cyclical | 10 | 10 | TSLA ($1.63T) |
| 39 | Auto - Parts | Consumer Cyclical | 37 | 37 | ORLY ($76.1B) |
| 40 | Auto - Recreational Vehicles | Consumer Cyclical | 4 | 4 | LCII ($2.7B) |
| 41 | Auto Manufacturers | Consumer Cyclical | 1 | 1 | GGR ($56.4M) |
| 42 | Auto Parts | Consumer Cyclical | 3 | 3 | ECX ($355.2M) |
| 43 | Department Stores | Consumer Cyclical | 4 | 4 | DDS ($8.4B) |
| 44 | Furnishings, Fixtures & Appliances | Consumer Cyclical | 9 | 9 | SN ($15.3B) |
| 45 | Gambling | Consumer Cyclical | 1 | 1 | BRAG ($52.9M) |
| 46 | Gambling, Resorts & Casinos | Consumer Cyclical | 3 | 3 | HGV ($3.6B) |
| 47 | Home Improvement | Consumer Cyclical | 5 | 5 | HD ($309.2B) |
| 48 | Leisure | Consumer Cyclical | 2 | 2 | YETI ($3.0B) |
| 49 | Luxury Goods | Consumer Cyclical | 4 | 4 | SIG ($3.3B) |
| 50 | Packaging & Containers | Consumer Cyclical | 2 | 2 | MYE ($839.4M) |
| 51 | Residential Construction | Consumer Cyclical | 2 | 2 | IBP ($5.5B) |
| 52 | Specialty Retail | Consumer Cyclical | 44 | 44 | AMZN ($2.86T) |
| 53 | Travel Services | Consumer Cyclical | 2 | 2 | MMYT ($4.3B) |
| 54 | Beverages - Wineries & Distilleries | Consumer Defensive | 1 | 1 | RYZ ($1.0B) |
| 55 | Discount Stores | Consumer Defensive | 6 | 6 | WMT ($1.04T) |
| 56 | Education & Training Services | Consumer Defensive | 4 | 4 | PXED ($1.1B) |
| 57 | Food Distribution | Consumer Defensive | 1 | 1 | PFGC ($14.9B) |
| 58 | Household & Personal Products | Consumer Defensive | 2 | 2 | SPB ($1.9B) |
| 59 | Packaged Foods | Consumer Defensive | 9 | 9 | CENT ($2.4B) |
| 60 | Coal | Energy | 1 | 1 | SXC ($638.9M) |
| 61 | Oil & Gas Equipment & Services | Energy | 9 | 9 | SEI ($5.5B) |
| 62 | Oil & Gas Midstream | Energy | 1 | 1 | GEL ($1.9B) |
| 63 | Oil & Gas Refining & Marketing | Energy | 1 | 1 | AMTX ($158.3M) |
| 64 | Solar | Energy | 15 | 15 | FSLR ($24.5B) |
| 65 | Uranium | Energy | 13 | 13 | CCJ ($50.9B) |
| 66 | Asset Management | Financial Services | 13 | 13 | SPY ($762.7B) |
| 67 | Asset Management - Cryptocurrency | Financial Services | 2 | 2 | CNCK ($280.0M) |
| 68 | Banks - Regional | Financial Services | 1 | 1 | DB ($60.8B) |
| 69 | Capital Markets | Financial Services | 6 | 6 | CSHR ($402.0M) |
| 70 | Credit Services | Financial Services | 1 | 1 | VRM ($61.2M) |
| 71 | Financial - Capital Markets | Financial Services | 41 | 41 | GS ($279.0B) |
| 72 | Financial - Conglomerates | Financial Services | 3 | 3 | VOYA ($7.3B) |
| 73 | Financial - Credit Services | Financial Services | 4 | 4 | SEZL ($3.4B) |
| 74 | Insurance - Brokers | Financial Services | 11 | 11 | MRSH ($78.7B) |
| 75 | Insurance - Diversified | Financial Services | 3 | 3 | EQH ($11.4B) |
| 76 | Insurance - Life | Financial Services | 7 | 7 | MFC ($67.1B) |
| 77 | Insurance - Property & Casualty | Financial Services | 3 | 3 | SLDE ($2.1B) |
| 78 | Insurance - Reinsurance | Financial Services | 1 | 1 | RGA ($13.8B) |
| 79 | Insurance - Specialty | Financial Services | 1 | 1 | RYAN ($4.1B) |
| 80 | Investment - Banking & Investment Services | Financial Services | 2 | 2 | IBKR ($145.5B) |
| 81 | Shell Companies | Financial Services | 3 | 3 | UMAC ($549.1M) |
| 82 | Biotechnology | Healthcare | 393 | 393 | VRTX ($113.8B) |
| 83 | Drug Manufacturers - General | Healthcare | 12 | 12 | LLY ($932.2B) |
| 84 | Drug Manufacturers - Specialty & Generic | Healthcare | 37 | 37 | ZTS ($32.3B) |
| 85 | Health Information Services | Healthcare | 2 | 2 | FORA ($67.5M) |
| 86 | Medical - Care Facilities | Healthcare | 34 | 34 | HCA ($95.3B) |
| 87 | Medical - Devices | Healthcare | 84 | 84 | ABT ($147.0B) |
| 88 | Medical - Diagnostics & Research | Healthcare | 36 | 36 | TMO ($170.7B) |
| 89 | Medical - Distribution | Healthcare | 6 | 6 | MCK ($88.3B) |
| 90 | Medical - Equipment & Services | Healthcare | 5 | 5 | HIMS ($5.5B) |
| 91 | Medical - Healthcare Information Services | Healthcare | 31 | 31 | GEHC ($28.3B) |
| 92 | Medical - Healthcare Plans | Healthcare | 9 | 9 | UNH ($360.0B) |
| 93 | Medical - Instruments & Supplies | Healthcare | 41 | 41 | ISRG ($153.0B) |
| 94 | Medical - Pharmaceuticals | Healthcare | 6 | 6 | DMRA ($1.4B) |
| 95 | Medical - Specialties | Healthcare | 3 | 3 | MOBI ($400.3M) |
| 96 | Medical Devices | Healthcare | 2 | 2 | CV ($356.3M) |
| 97 | Advertising Agencies | Industrials | 10 | 10 | VSNT ($5.8B) |
| 98 | Aerospace & Defense | Industrials | 70 | 70 | GE ($310.8B) |
| 99 | Agricultural - Machinery | Industrials | 3 | 3 | OSK ($8.2B) |
| 100 | Airlines, Airports & Air Services | Industrials | 3 | 3 | JOBY ($10.3B) |
| 101 | Building Products & Equipment | Industrials | 1 | 1 | AIRJ ($256.8M) |
| 102 | Business Equipment & Supplies | Industrials | 1 | 1 | EBF ($510.9M) |
| 103 | Conglomerates | Industrials | 7 | 7 | HON ($138.5B) |
| 104 | Construction | Industrials | 22 | 22 | TT ($103.4B) |
| 105 | Consulting Services | Industrials | 2 | 2 | VRSK ($21.8B) |
| 106 | Engineering & Construction | Industrials | 36 | 36 | PWR ($114.9B) |
| 107 | General Transportation | Industrials | 1 | 1 | AEBI ($890.5M) |
| 108 | Industrial - Distribution | Industrials | 4 | 4 | WSO ($17.0B) |
| 109 | Industrial - Infrastructure Operations | Industrials | 2 | 2 | ACA ($6.3B) |
| 110 | Industrial - Machinery | Industrials | 68 | 68 | ETN ($155.9B) |
| 111 | Industrial - Pollution & Treatment Controls | Industrials | 7 | 7 | VLTO ($21.3B) |
| 112 | Integrated Freight & Logistics | Industrials | 13 | 13 | FDX ($89.8B) |
| 113 | Manufacturing - Metal Fabrication | Industrials | 14 | 14 | ATI ($22.0B) |
| 114 | Manufacturing - Tools & Accessories | Industrials | 7 | 7 | RBC ($19.4B) |
| 115 | Marine Shipping | Industrials | 2 | 2 | PANL ($565.2M) |
| 116 | Metal fabrication | Industrials | 1 | 1 | ZJK ($176.1M) |
| 117 | Rental & Leasing Services | Industrials | 3 | 3 | FTAI ($27.3B) |
| 118 | Security & Protection Services | Industrials | 9 | 9 | ALLE ($11.3B) |
| 119 | Specialty Business Services | Industrials | 10 | 10 | TRI ($38.1B) |
| 120 | Specialty Industrial Machinery | Industrials | 1 | 1 | CVV ($48.6M) |
| 121 | Staffing & Employment Services | Industrials | 4 | 4 | ADP ($85.5B) |
| 122 | Trucking | Industrials | 1 | 1 | RXO ($3.3B) |
| 123 | Waste Management | Industrials | 1 | 1 | LNZA ($45.6M) |
| 124 | Precious metals | Non-energy minerals | 1 | 0 | OGC (-) |
| 125 | REIT - Industrial | Real Estate | 1 | 1 | LPA ($113.2M) |
| 126 | REIT - Residential | Real Estate | 1 | 1 | MRP ($4.1B) |
| 127 | Real Estate - Development | Real Estate | 8 | 8 | FOR ($1.4B) |
| 128 | Real Estate - Diversified | Real Estate | 3 | 3 | HHH ($3.8B) |
| 129 | Real Estate - General | Real Estate | 1 | 1 | BEEP ($79.9M) |
| 130 | Real Estate - Services | Real Estate | 20 | 20 | CBRE ($42.2B) |
| 131 | Real Estate Services | Real Estate | 1 | 1 | SRG ($147.0M) |
| 132 | Software - Services | Technology | 1 | 1 | NTSK ($4.3B) |
| 133 | Technology Distributors | Technology | 7 | 7 | SNX ($18.6B) |
| 134 | Unknown | Unknown | 1 | 0 | SPX (-) |
| 135 | Diversified Utilities | Utilities | 9 | 9 | BIP ($17.6B) |
| 136 | Independent Power Producers | Utilities | 6 | 6 | VST ($49.5B) |
| 137 | Regulated Electric | Utilities | 33 | 33 | NEE ($197.3B) |
| 138 | Regulated Gas | Utilities | 1 | 1 | OPAL ($60.3M) |
| 139 | Regulated Water | Utilities | 12 | 12 | AWK ($24.9B) |
| 140 | Renewable Utilities | Utilities | 15 | 15 | GEV ($288.1B) |
| 141 | Utilities - Independent Power Producers | Utilities | 1 | 1 | DGXX ($611.0M) |

## Industry별 전체 Ticker 목록

### 001. Semiconductors - 80 tickers (AI/Tech priority 1)
| Rank | Ticker | Company | Sector | Market Cap |
|------|--------|---------|--------|------------|
| 1 | NVDA | NVIDIA Corporation | Technology | $5.37T |
| 2 | AVGO | Broadcom Inc. | Technology | $1.99T |
| 3 | MU | Micron Technology, Inc. | Technology | $864.5B |
| 4 | AMD | Advanced Micro Devices, Inc. | Technology | $731.0B |
| 5 | INTC | Intel Corporation | Technology | $606.2B |
| 6 | LRCX | Lam Research Corporation | Technology | $361.7B |
| 7 | AMAT | Applied Materials, Inc. | Technology | $342.2B |
| 8 | TXN | Texas Instruments Incorporated | Technology | $268.6B |
| 9 | KLAC | KLA Corporation | Technology | $236.6B |
| 10 | QCOM | QUALCOMM Incorporated | Technology | $221.7B |
| 11 | ADI | Analog Devices, Inc. | Technology | $204.9B |
| 12 | MRVL | Marvell Technology, Inc. | Technology | $143.8B |
| 13 | MPWR | Monolithic Power Systems, Inc. | Technology | $78.6B |
| 14 | NXPI | NXP Semiconductors N.V. | Technology | $74.3B |
| 15 | TER | Teradyne, Inc. | Technology | $56.1B |
| 16 | MCHP | Microchip Technology Incorporated | Technology | $52.9B |
| 17 | ON | ON Semiconductor Corporation | Technology | $40.8B |
| 18 | GFS | GLOBALFOUNDRIES Inc. | Technology | $40.1B |
| 19 | Q | Qnity Electronics, Inc. | Technology | $35.3B |
| 20 | ALAB | Astera Labs, Inc. Common Stock | Technology | $35.0B |
| 21 | MTSI | MACOM Technology Solutions Holdings, Inc. | Technology | $27.7B |
| 22 | TSEM | Tower Semiconductor Ltd. | Technology | $24.7B |
| 23 | SITM | SiTime Corporation | Technology | $22.4B |
| 24 | ENTG | Entegris, Inc. | Technology | $22.1B |
| 25 | AMKR | Amkor Technology, Inc. | Technology | $18.2B |
| 26 | LSCC | Lattice Semiconductor Corporation | Technology | $17.2B |
| 27 | NVMI | Nova Ltd. | Technology | $15.7B |
| 28 | AAOI | Applied Optoelectronics, Inc. | Technology | $15.1B |
| 29 | RMBS | Rambus Inc. | Technology | $14.1B |
| 30 | ONTO | Onto Innovation Inc. | Technology | $13.8B |
| 31 | SMTC | Semtech Corporation | Technology | $12.3B |
| 32 | FORM | FormFactor, Inc. | Technology | $10.3B |
| 33 | SWKS | Skyworks Solutions, Inc. | Technology | $10.0B |
| 34 | ALGM | Allegro MicroSystems, Inc. | Technology | $8.5B |
| 35 | CRUS | Cirrus Logic, Inc. | Technology | $8.5B |
| 36 | MXL | MaxLinear, Inc. | Technology | $8.2B |
| 37 | CAMT | Camtek Ltd. | Technology | $8.0B |
| 38 | QRVO | Qorvo, Inc. | Technology | $7.9B |
| 39 | SLAB | Silicon Laboratories Inc. | Technology | $7.1B |
| 40 | AXTI | AXT, Inc. | Technology | $5.7B |
| 41 | KLIC | Kulicke and Soffa Industries, Inc. | Technology | $5.1B |
| 42 | ACLS | Axcelis Technologies, Inc. | Technology | $5.0B |
| 43 | DIOD | Diodes Incorporated | Technology | $4.8B |
| 44 | LASR | nLIGHT, Inc. | Technology | $4.7B |
| 45 | SYNA | Synaptics Incorporated | Technology | $4.6B |
| 46 | VSH | Vishay Intertechnology, Inc. | Technology | $4.6B |
| 47 | NVTS | Navitas Semiconductor Corporation | Technology | $4.5B |
| 48 | IPGP | IPG Photonics Corporation | Technology | $4.4B |
| 49 | OLED | Universal Display Corporation | Technology | $4.3B |
| 50 | ACMR | ACM Research, Inc. | Technology | $4.2B |
| 51 | POWI | Power Integrations, Inc. | Technology | $4.0B |
| 52 | VECO | Veeco Instruments Inc. | Technology | $3.8B |
| 53 | UCTT | Ultra Clean Holdings, Inc. | Technology | $3.7B |
| 54 | AMBA | Ambarella, Inc. | Technology | $3.4B |
| 55 | PLAB | Photronics, Inc. | Technology | $3.1B |
| 56 | AEHR | Aehr Test Systems | Technology | $3.0B |
| 57 | WOLF | Wolfspeed, Inc. | Technology | $2.6B |
| 58 | ICHR | Ichor Holdings, Ltd. | Technology | $2.5B |
| 59 | COHU | Cohu, Inc. | Technology | $2.3B |
| 60 | SKYT | SkyWater Technology, Inc. | Technology | $1.8B |
| 61 | POET | POET Technologies Inc. | Technology | $1.7B |
| 62 | AIP | Arteris, Inc. | Technology | $1.5B |
| 63 | AMBQ | Ambiq Micro, Inc. | Technology | $1.4B |
| 64 | AOSL | Alpha and Omega Semiconductor Limited | Technology | $1.1B |
| 65 | CEVA | CEVA, Inc. | Technology | $1.0B |
| 66 | MRAM | Everspin Technologies, Inc. | Technology | $1.0B |
| 67 | INDI | indie Semiconductor, Inc. | Technology | $971.3M |
| 68 | QNC | Quantum eMotion Corp. | Technology | $603.3M |
| 69 | NVEC | NVE Corporation | Technology | $444.5M |
| 70 | LAES | SEALSQ Corp | Technology | $419.2M |
| 71 | XPER | Xperi Inc. | Technology | $386.7M |
| 72 | QUIK | QuickLogic Corporation | Technology | $337.6M |
| 73 | GSIT | GSI Technology, Inc. | Technology | $336.7M |
| 74 | ASYS | Amtech Systems, Inc. | Technology | $303.9M |
| 75 | VLN | Valens Semiconductor Ltd. | Technology | $284.3M |
| 76 | INTT | inTEST Corporation | Technology | $209.5M |
| 77 | MX | Magnachip Semiconductor Corporation | Technology | $143.6M |
| 78 | TRT | Trio-Tech International | Technology | $110.3M |
| 79 | GCTS | GCT Semiconductor Holding, Inc. | Technology | $86.5M |
| 80 | IPWR | Ideal Power Inc. | Technology | $51.4M |

### 002. Hardware, Equipment & Parts - 55 tickers (AI/Tech priority 2)
| Rank | Ticker | Company | Sector | Market Cap |
|------|--------|---------|--------|------------|
| 1 | SNDK | Sandisk Corporation | Technology | $215.0B |
| 2 | GLW | Corning Incorporated | Technology | $170.7B |
| 3 | APH | Amphenol Corporation | Technology | $157.3B |
| 4 | TEL | TE Connectivity Ltd. | Technology | $62.4B |
| 5 | KEYS | Keysight Technologies, Inc. | Technology | $62.0B |
| 6 | COHR | Coherent, Inc. | Technology | $59.3B |
| 7 | FLEX | Flex Ltd. | Technology | $51.4B |
| 8 | GRMN | Garmin Ltd. | Technology | $45.7B |
| 9 | CLS | Celestica Inc. | Technology | $43.0B |
| 10 | JBL | Jabil Inc. | Technology | $37.0B |
| 11 | TDY | Teledyne Technologies Incorporated | Technology | $29.3B |
| 12 | FN | Fabrinet | Technology | $22.7B |
| 13 | MKSI | MKS Inc. | Technology | $21.1B |
| 14 | FTV | Fortive Corporation | Technology | $18.4B |
| 15 | TTMI | TTM Technologies, Inc. | Technology | $17.0B |
| 16 | VICR | Vicor Corporation | Technology | $13.2B |
| 17 | TRMB | Trimble Inc. | Technology | $13.2B |
| 18 | SANM | Sanmina Corporation | Technology | $12.6B |
| 19 | LFUS | Littelfuse, Inc. | Technology | $11.5B |
| 20 | CGNX | Cognex Corporation | Technology | $10.9B |
| 21 | ESE | ESCO Technologies Inc. | Technology | $7.8B |
| 22 | PLXS | Plexus Corp. | Technology | $7.1B |
| 23 | ST | Sensata Technologies Holding plc | Technology | $6.5B |
| 24 | NOVT | Novanta Inc. | Technology | $5.7B |
| 25 | MDA | MDA Space Ltd | Technology | $5.2B |
| 26 | VNT | Vontier Corporation | Technology | $4.1B |
| 27 | BELFB | Bel Fuse Inc. | Technology | $3.8B |
| 28 | OSIS | OSI Systems, Inc. | Technology | $3.7B |
| 29 | ITRI | Itron, Inc. | Technology | $3.6B |
| 30 | BELFA | Bel Fuse Inc. | Technology | $3.4B |
| 31 | BMI | Badger Meter, Inc. | Technology | $3.4B |
| 32 | BHE | Benchmark Electronics, Inc. | Technology | $3.0B |
| 33 | ROG | Rogers Corporation | Technology | $2.5B |
| 34 | PENG | Penguin Solutions, Inc. | Technology | $2.3B |
| 35 | OUST | Ouster, Inc. | Technology | $1.7B |
| 36 | CTS | CTS Corporation | Technology | $1.7B |
| 37 | BKSY | BlackSky Technology Inc. | Technology | $1.5B |
| 38 | VPG | Vishay Precision Group, Inc. | Technology | $1.1B |
| 39 | ALNT | Allient Inc. | Technology | $1.1B |
| 40 | DAKT | Daktronics, Inc. | Technology | $998.8M |
| 41 | KOPN | Kopin Corporation | Technology | $952.4M |
| 42 | SATL | Satellogic Inc. | Technology | $907.2M |
| 43 | LYTS | LSI Industries Inc. | Technology | $754.3M |
| 44 | LPTH | LightPath Technologies, Inc. | Technology | $584.6M |
| 45 | MLAB | Mesa Laboratories, Inc. | Technology | $572.9M |
| 46 | MEI | Methode Electronics, Inc. | Technology | $331.6M |
| 47 | OPTX | Syntec Optics Holdings, Inc. | Technology | $283.7M |
| 48 | MPTI | M-tron Industries, Inc. | Technology | $227.8M |
| 49 | RELL | Richardson Electronics, Ltd. | Technology | $218.8M |
| 50 | WRAP | Wrap Technologies, Inc. | Technology | $79.4M |
| 51 | CPSH | CPS Technologies Corporation | Technology | $65.3M |
| 52 | DSWL | Deswell Industries, Inc. | Technology | $53.7M |
| 53 | LINK | Interlink Electronics, Inc. | Technology | $53.0M |
| 54 | UEIC | Universal Electronics Inc. | Technology | $52.0M |
| 55 | WATT | Energous Corporation | Technology | $38.4M |

### 003. Computer Hardware - 29 tickers (AI/Tech priority 3)
| Rank | Ticker | Company | Sector | Market Cap |
|------|--------|---------|--------|------------|
| 1 | STX | Seagate Technology Holdings plc | Technology | $181.4B |
| 2 | ANET | Arista Networks, Inc. | Technology | $179.5B |
| 3 | WDC | Western Digital Corporation | Technology | $168.5B |
| 4 | DELL | Dell Technologies Inc. | Technology | $161.3B |
| 5 | P | Everpure, Inc. | Technology | $27.5B |
| 6 | NTAP | NetApp, Inc. | Technology | $23.0B |
| 7 | PSTG | Everpure, Inc | Technology | $22.1B |
| 8 | IONQ | IonQ, Inc. | Technology | $20.9B |
| 9 | SMCI | Super Micro Computer, Inc. | Technology | $19.7B |
| 10 | HPQ | HP Inc. | Technology | $19.4B |
| 11 | LOGI | Logitech International S.A. | Technology | $14.9B |
| 12 | QBTS | D-Wave Quantum Inc. | Technology | $8.2B |
| 13 | RGTI | Rigetti Computing, Inc. | Technology | $6.3B |
| 14 | INFQ | Infleqtion, Inc. | Technology | $2.3B |
| 15 | QUBT | Quantum Computing, Inc. | Technology | $1.6B |
| 16 | RCAT | Red Cat Holdings, Inc. | Technology | $1.1B |
| 17 | CRSR | Corsair Gaming, Inc. | Technology | $801.6M |
| 18 | SSYS | Stratasys Ltd. | Technology | $740.2M |
| 19 | DDD | 3D Systems Corporation | Technology | $454.2M |
| 20 | BGIN | BGIN BLOCKCHAIN Ltd | Technology | $435.1M |
| 21 | OSS | One Stop Systems, Inc. | Technology | $385.2M |
| 22 | VELO | Velo3D, Inc. | Technology | $294.2M |
| 23 | AMCI | AMC Robotics Corporation | Technology | $117.0M |
| 24 | INVE | Identiv, Inc. | Technology | $115.7M |
| 25 | ALOT | AstroNova, Inc. | Technology | $112.8M |
| 26 | VTIX | Virtuix Holdings Inc. Class A Common Stock | Technology | $102.8M |
| 27 | YIBO | Planet Image International Limited Class A Ordinary Shares | Technology | $59.9M |
| 28 | QMCO | Quantum Corporation | Technology | $55.9M |
| 29 | UAVS | AgEagle Aerial Systems, Inc. | Technology | $47.5M |

### 004. Communication Equipment - 43 tickers (AI/Tech priority 4)
| Rank | Ticker | Company | Sector | Market Cap |
|------|--------|---------|--------|------------|
| 1 | CSCO | Cisco Systems, Inc. | Technology | $392.2B |
| 2 | CIEN | Ciena Corporation | Technology | $81.6B |
| 3 | LITE | Lumentum Holdings Inc. | Technology | $77.2B |
| 4 | MSI | Motorola Solutions, Inc. | Technology | $65.0B |
| 5 | UI | Ubiquiti Inc. | Technology | $42.6B |
| 6 | HPE | Hewlett Packard Enterprise Company | Technology | $40.1B |
| 7 | SATS | EchoStar Corporation | Technology | $37.3B |
| 8 | CRDO | Credo Technology Group Holding Ltd | Technology | $36.6B |
| 9 | ASTS | AST SpaceMobile, Inc. | Technology | $29.7B |
| 10 | VIAV | Viavi Solutions Inc. | Technology | $12.5B |
| 11 | ZBRA | Zebra Technologies Corporation | Technology | $11.9B |
| 12 | VSAT | Viasat, Inc. | Technology | $9.6B |
| 13 | PI | Impinj, Inc. | Technology | $4.5B |
| 14 | ONDS | Ondas Holdings Inc. | Technology | $4.4B |
| 15 | BDC | Belden Inc. | Technology | $4.3B |
| 16 | YSS | York Space Systems, Inc. | Technology | $4.1B |
| 17 | KN | Knowles Corporation | Technology | $3.0B |
| 18 | EXTR | Extreme Networks, Inc. | Technology | $3.0B |
| 19 | VISN | Vistance Networks, Inc. | Technology | $2.7B |
| 20 | DGII | Digi International Inc. | Technology | $2.3B |
| 21 | HLIT | Harmonic Inc. | Technology | $1.4B |
| 22 | ADTN | ADTRAN Holdings, Inc. | Technology | $1.2B |
| 23 | GILT | Gilat Satellite Networks Ltd. | Technology | $1.2B |
| 24 | ITRN | Ituran Location and Control Ltd. | Technology | $1.2B |
| 25 | TSAT | Telesat Corporation | Technology | $787.0M |
| 26 | NTGR | NETGEAR, Inc. | Technology | $689.0M |
| 27 | CLFD | Clearfield, Inc. | Technology | $613.6M |
| 28 | FEIM | Frequency Electronics, Inc. | Technology | $593.5M |
| 29 | AIOT | PowerFleet, Inc. | Technology | $434.6M |
| 30 | BKTI | BK Technologies Corporation | Technology | $341.1M |
| 31 | LTRX | Lantronix, Inc. | Technology | $243.3M |
| 32 | SILC | Silicom Ltd. | Technology | $241.6M |
| 33 | INSG | Inseego Corp. | Technology | $239.4M |
| 34 | CRNT | Ceragon Networks Ltd. | Technology | $227.4M |
| 35 | AUDC | AudioCodes Ltd. | Technology | $215.8M |
| 36 | KVHI | KVH Industries, Inc. | Technology | $214.5M |
| 37 | AVNW | Aviat Networks, Inc. | Technology | $198.1M |
| 38 | CMTL | Comtech Telecommunications Corp. | Technology | $108.8M |
| 39 | OCC | Optical Cable Corporation | Technology | $99.4M |
| 40 | AIRG | Airgain, Inc. | Technology | $87.8M |
| 41 | MOB | Mobilicom Ltd | Technology | $70.5M |
| 42 | AMPG | AmpliTech Group, Inc. | Technology | $56.5M |
| 43 | FIEE | FiEE, Inc. | Technology | $25.3M |

### 005. Software - Infrastructure - 91 tickers (AI/Tech priority 5)
| Rank | Ticker | Company | Sector | Market Cap |
|------|--------|---------|--------|------------|
| 1 | MSFT | Microsoft Corporation | Technology | $3.03T |
| 2 | ORCL | Oracle Corporation | Technology | $537.2B |
| 3 | PLTR | Palantir Technologies Inc. | Technology | $312.3B |
| 4 | PANW | Palo Alto Networks, Inc. | Technology | $146.9B |
| 5 | CRWD | CrowdStrike Holdings, Inc. | Technology | $138.5B |
| 6 | SNPS | Synopsys, Inc. | Technology | $98.3B |
| 7 | ADBE | Adobe Inc. | Technology | $97.3B |
| 8 | FTNT | Fortinet, Inc. | Technology | $84.3B |
| 9 | NET | Cloudflare, Inc. | Technology | $66.1B |
| 10 | CRWV | CoreWeave, Inc. Class A Common Stock | Technology | $58.8B |
| 11 | VRSN | VeriSign, Inc. | Technology | $26.0B |
| 12 | MDB | MongoDB, Inc. | Technology | $24.8B |
| 13 | ZS | Zscaler, Inc. | Technology | $23.5B |
| 14 | AKAM | Akamai Technologies, Inc. | Technology | $21.7B |
| 15 | FFIV | F5, Inc. | Technology | $20.0B |
| 16 | DOCN | DigitalOcean Holdings, Inc. | Technology | $16.2B |
| 17 | IOT | Samsara Inc. | Technology | $16.1B |
| 18 | TOST | Toast, Inc. | Technology | $13.5B |
| 19 | OKTA | Okta, Inc. | Technology | $13.4B |
| 20 | GEN | Gen Digital Inc. | Technology | $13.3B |
| 21 | RBRK | Rubrik, Inc. | Technology | $12.2B |
| 22 | CHKP | Check Point Software Technologies Ltd. | Technology | $12.1B |
| 23 | NTNX | Nutanix, Inc. | Technology | $11.8B |
| 24 | GDDY | GoDaddy Inc. | Technology | $11.5B |
| 25 | CFLT | Confluent, Inc. | Technology | $11.1B |
| 26 | CORZ | Core Scientific, Inc. | Technology | $7.2B |
| 27 | DOX | Amdocs Limited | Technology | $6.7B |
| 28 | DBX | Dropbox, Inc. | Technology | $6.6B |
| 29 | SAIL | SailPoint, Inc. | Technology | $6.5B |
| 30 | BLSH | Bullish | Technology | $6.4B |
| 31 | PATH | UiPath Inc. | Technology | $5.4B |
| 32 | S | SentinelOne, Inc. | Technology | $5.3B |
| 33 | KVYO | Klaviyo, Inc. | Technology | $4.3B |
| 34 | ACIW | ACI Worldwide, Inc. | Technology | $4.3B |
| 35 | WIX | Wix.com Ltd. | Technology | $4.2B |
| 36 | DLO | DLocal Limited | Technology | $3.7B |
| 37 | BB | BlackBerry Limited | Technology | $3.7B |
| 38 | BOX | Box, Inc. | Technology | $3.3B |
| 39 | VRNS | Varonis Systems, Inc. | Technology | $3.3B |
| 40 | CLBT | Cellebrite DI Ltd. | Technology | $3.2B |
| 41 | QLYS | Qualys, Inc. | Technology | $3.2B |
| 42 | TDC | Teradata Corporation | Technology | $3.0B |
| 43 | NTCT | NetScout Systems, Inc. | Technology | $2.8B |
| 44 | CCC | CCC Intelligent Solutions Holdings Inc. | Technology | $2.7B |
| 45 | TENB | Tenable Holdings, Inc. | Technology | $2.3B |
| 46 | CSGS | CSG Systems International, Inc. | Technology | $2.3B |
| 47 | AVPT | AvePoint, Inc. | Technology | $2.1B |
| 48 | ATEN | A10 Networks, Inc. | Technology | $2.0B |
| 49 | SPSC | SPS Commerce, Inc. | Technology | $1.9B |
| 50 | RAMP | LiveRamp Holdings, Inc. | Technology | $1.8B |
| 51 | EVCM | EverCommerce Inc. | Technology | $1.8B |
| 52 | FIVN | Five9, Inc. | Technology | $1.6B |
| 53 | BAND | Bandwidth Inc. | Technology | $1.6B |
| 54 | RXT | Rackspace Technology, Inc. | Technology | $1.6B |
| 55 | APPN | Appian Corporation | Technology | $1.5B |
| 56 | RDWR | Radware Ltd. | Technology | $1.2B |
| 57 | PGY | Pagaya Technologies Ltd. | Technology | $1.1B |
| 58 | BRAI | Braiin Ltd | Technology | $805.4M |
| 59 | CGNT | Cognyte Software Ltd. | Technology | $781.9M |
| 60 | RZLV | Rezolve AI PLC | Technology | $751.5M |
| 61 | ODD | Oddity Tech Ltd. | Technology | $720.3M |
| 62 | HQ | Horizon Quantum Holdings Ltd. Class A Ordinary Shares | Technology | $606.6M |
| 63 | CCSI | Consensus Cloud Solutions, Inc. | Technology | $539.6M |
| 64 | PRTH | Priority Technology Holdings, Inc. | Technology | $508.1M |
| 65 | CINT | CI&T Inc | Technology | $493.1M |
| 66 | OWLS | OBOOK Holdings Inc. | Technology | $490.3M |
| 67 | YEXT | Yext, Inc. | Technology | $451.4M |
| 68 | OSPN | OneSpan Inc. | Technology | $443.0M |
| 69 | RPD | Rapid7, Inc. | Technology | $439.1M |
| 70 | BLZE | Backblaze, Inc. | Technology | $421.9M |
| 71 | IIIV | i3 Verticals, Inc. | Technology | $417.8M |
| 72 | LSAK | Lesaka Technologies, Inc. | Technology | $407.8M |
| 73 | ALLT | Allot Ltd. | Technology | $350.1M |
| 74 | GRRR | Gorilla Technology Group Inc. | Technology | $341.4M |
| 75 | XNDU | Xanadu Quantum Technologies Limited Class B Subordinate Voting Shares | Technology | $320.4M |
| 76 | ATGL | Alpha Technology Group Limited | Technology | $265.6M |
| 77 | PDYN | Palladyne AI Corp. | Technology | $260.7M |
| 78 | ARQQ | Arqit Quantum Inc. | Technology | $225.4M |
| 79 | KLTR | Kaltura, Inc. | Technology | $218.0M |
| 80 | EXOD | Exodus Movement, Inc. | Technology | $207.8M |
| 81 | TCX | Tucows Inc. | Technology | $164.8M |
| 82 | SANG | Sangoma Technologies Corporation | Technology | $132.9M |
| 83 | GOAI | Eva Live, Inc. | Technology | $115.6M |
| 84 | BNAI | Brand Engagement Network, Inc. | Technology | $103.9M |
| 85 | MCRP | Micropolis AI Robotics | Technology | $90.7M |
| 86 | AISP | Airship AI Holdings, Inc. | Technology | $80.9M |
| 87 | STEM | Stem, Inc. | Technology | $79.6M |
| 88 | ZSQR | Z Squared Inc. | Technology | $76.7M |
| 89 | VHC | VirnetX Holding Corp | Technology | $57.7M |
| 90 | ZENA | ZenaTech, Inc. | Technology | $51.3M |
| 91 | MLGO | MicroAlgo Inc. | Technology | $45.5M |

### 006. Software - Application - 146 tickers (AI/Tech priority 6)
| Rank | Ticker | Company | Sector | Market Cap |
|------|--------|---------|--------|------------|
| 1 | APP | AppLovin Corporation | Technology | $164.8B |
| 2 | CRM | Salesforce, Inc. | Technology | $162.7B |
| 3 | UBER | Uber Technologies, Inc. | Technology | $155.4B |
| 4 | INTU | Intuit Inc. | Technology | $107.9B |
| 5 | CDNS | Cadence Design Systems, Inc. | Technology | $98.8B |
| 6 | NOW | ServiceNow, Inc. | Technology | $91.8B |
| 7 | DDOG | Datadog, Inc. | Technology | $71.2B |
| 8 | MSTR | Strategy Inc | Technology | $54.8B |
| 9 | SNOW | Snowflake Inc. | Technology | $52.5B |
| 10 | ADSK | Autodesk, Inc. | Technology | $49.6B |
| 11 | WDAY | Workday, Inc. | Technology | $31.4B |
| 12 | ZM | Zoom Communications, Inc. | Technology | $30.3B |
| 13 | TEAM | Atlassian Corporation | Technology | $22.3B |
| 14 | PTC | PTC Inc. | Technology | $16.7B |
| 15 | SSNC | SS&C Technologies Holdings, Inc. | Technology | $16.1B |
| 16 | GRAB | Grab Holdings Limited | Technology | $14.5B |
| 17 | TYL | Tyler Technologies, Inc. | Technology | $13.1B |
| 18 | DT | Dynatrace, Inc. | Technology | $11.8B |
| 19 | U | Unity Software Inc. | Technology | $11.7B |
| 20 | GWRE | Guidewire Software, Inc. | Technology | $11.2B |
| 21 | TTD | The Trade Desk, Inc. | Technology | $9.9B |
| 22 | BSY | Bentley Systems, Incorporated | Technology | $9.5B |
| 23 | FIG | Figma, Inc. | Technology | $9.4B |
| 24 | HUBS | HubSpot, Inc. | Technology | $9.2B |
| 25 | DOCU | DocuSign, Inc. | Technology | $8.8B |
| 26 | FROG | JFrog Ltd. | Technology | $8.2B |
| 27 | MANH | Manhattan Associates, Inc. | Technology | $8.0B |
| 28 | PAYC | Paycom Software, Inc. | Technology | $7.5B |
| 29 | PCOR | Procore Technologies, Inc. | Technology | $7.3B |
| 30 | CWAN | Clearwater Analytics Holdings, Inc. | Technology | $7.2B |
| 31 | IDCC | InterDigital, Inc. | Technology | $7.0B |
| 32 | OTEX | Open Text Corporation | Technology | $6.0B |
| 33 | YOU | Clear Secure, Inc. | Technology | $5.8B |
| 34 | DSGX | The Descartes Systems Group Inc. | Technology | $5.8B |
| 35 | PCTY | Paylocity Holding Corporation | Technology | $5.7B |
| 36 | PEGA | Pegasystems Inc. | Technology | $5.7B |
| 37 | APPF | AppFolio, Inc. | Technology | $5.6B |
| 38 | TTAN | ServiceTitan, Inc. | Technology | $5.5B |
| 39 | LYFT | Lyft, Inc. | Technology | $5.3B |
| 40 | ESTC | Elastic N.V. | Technology | $5.2B |
| 41 | COMP | Compass, Inc. | Technology | $5.1B |
| 42 | DUOL | Duolingo, Inc. | Technology | $4.9B |
| 43 | CVLT | Commvault Systems, Inc. | Technology | $4.5B |
| 44 | NAVN | Navan, Inc. | Technology | $4.4B |
| 45 | BILL | Bill.com Holdings, Inc. | Technology | $4.1B |
| 46 | ZETA | Zeta Global Holdings Corp. | Technology | $4.1B |
| 47 | GTLB | GitLab Inc. | Technology | $3.9B |
| 48 | SRAD | Sportradar Group AG | Technology | $3.7B |
| 49 | BULL | Webull Corporation Class A Ordinary Shares | Technology | $3.7B |
| 50 | MNDY | monday.com Ltd. | Technology | $3.7B |
| 51 | RNG | RingCentral, Inc. | Technology | $3.7B |
| 52 | CLSK | CleanSpark, Inc. | Technology | $3.5B |
| 53 | RUM | Rumble Inc. | Technology | $3.4B |
| 54 | ADEA | Adeia Inc. | Technology | $3.4B |
| 55 | SOUN | SoundHound AI, Inc. | Technology | $3.4B |
| 56 | NATL | NCR Atleos Corporation | Technology | $3.3B |
| 57 | LIF | Life360, Inc. | Technology | $3.1B |
| 58 | FSLY | Fastly, Inc. | Technology | $3.0B |
| 59 | QTWO | Q2 Holdings, Inc. | Technology | $2.9B |
| 60 | NP | Neptune Insurance Holdings Inc. | Technology | $2.7B |
| 61 | CALX | Calix, Inc. | Technology | $2.7B |
| 62 | WK | Workiva Inc. | Technology | $2.6B |
| 63 | BTDR | Bitdeer Technologies Group | Technology | $2.6B |
| 64 | DBD | Diebold Nixdorf, Incorporated | Technology | $2.6B |
| 65 | GRND | Grindr Inc. | Technology | $2.5B |
| 66 | STUB | StubHub Holdings, Inc. | Technology | $2.4B |
| 67 | OS | OneStream, Inc. Class A Common Stock | Technology | $2.4B |
| 68 | FRSH | Freshworks Inc. | Technology | $2.3B |
| 69 | IE | Ivanhoe Electric Inc. | Technology | $2.3B |
| 70 | PLUS | ePlus inc. | Technology | $2.2B |
| 71 | VERX | Vertex, Inc. | Technology | $2.2B |
| 72 | BRZE | Braze, Inc. | Technology | $2.2B |
| 73 | ALRM | Alarm.com Holdings, Inc. | Technology | $2.1B |
| 74 | PDFS | PDF Solutions, Inc. | Technology | $2.0B |
| 75 | AGYS | Agilysys, Inc. | Technology | $1.9B |
| 76 | NCNO | nCino, Inc. | Technology | $1.9B |
| 77 | SEMR | Semrush Holdings, Inc. | Technology | $1.8B |
| 78 | ALKT | Alkami Technology, Inc. | Technology | $1.8B |
| 79 | INTA | Intapp, Inc. | Technology | $1.8B |
| 80 | WLTH | Wealthfront Corporation | Technology | $1.7B |
| 81 | WBTN | WEBTOON Entertainment Inc. Common stock | Technology | $1.6B |
| 82 | BL | BlackLine, Inc. | Technology | $1.5B |
| 83 | DV | DoubleVerify Holdings, Inc. | Technology | $1.5B |
| 84 | KARO | Karooooo Ltd. | Technology | $1.5B |
| 85 | BLKB | Blackbaud, Inc. | Technology | $1.5B |
| 86 | KDK | Kodiak AI, Inc. Common Stock | Technology | $1.5B |
| 87 | ASAN | Asana, Inc. | Technology | $1.4B |
| 88 | CXM | Sprinklr, Inc. | Technology | $1.3B |
| 89 | LSPD | Lightspeed Commerce Inc. | Technology | $1.2B |
| 90 | GTM | ZoomInfo Technologies Inc. | Technology | $1.2B |
| 91 | PRGS | Progress Software Corporation | Technology | $1.1B |
| 92 | VIA | Via Transportation, Inc. | Technology | $1.1B |
| 93 | IBTA | Ibotta, Inc. | Technology | $873.9M |
| 94 | AMPL | Amplitude, Inc. | Technology | $821.1M |
| 95 | RSKD | Riskified Ltd. | Technology | $721.1M |
| 96 | DSP | Viant Technology Inc. | Technology | $689.8M |
| 97 | DJCO | Daily Journal Corporation | Technology | $672.0M |
| 98 | RDVT | Red Violet, Inc. | Technology | $667.2M |
| 99 | MITK | Mitek Systems, Inc. | Technology | $662.5M |
| 100 | PAR | PAR Technology Corporation | Technology | $640.6M |
| 101 | VTEX | Vtex | Technology | $631.8M |
| 102 | PD | PagerDuty, Inc. | Technology | $573.6M |
| 103 | DCBO | Docebo Inc. | Technology | $499.4M |
| 104 | APPS | Digital Turbine, Inc. | Technology | $464.0M |
| 105 | PUBM | PubMatic, Inc. | Technology | $456.8M |
| 106 | CRNC | Cerence Inc. | Technology | $449.0M |
| 107 | SWMR | Swarmer, Inc Common Stock | Technology | $445.0M |
| 108 | EB | Eventbrite, Inc. | Technology | $440.5M |
| 109 | WEAV | Weave Communications, Inc. | Technology | $433.6M |
| 110 | SPT | Sprout Social, Inc. | Technology | $393.7M |
| 111 | BMBL | Bumble Inc. | Technology | $390.8M |
| 112 | ALIT | Alight, Inc. | Technology | $380.6M |
| 113 | BLND | Blend Labs, Inc. | Technology | $357.9M |
| 114 | SVCO | Silvaco Group, Inc. Common Stock | Technology | $348.4M |
| 115 | ONTF | ON24, Inc. | Technology | $348.2M |
| 116 | EGHT | 8x8, Inc. | Technology | $345.5M |
| 117 | RMNI | Rimini Street, Inc. | Technology | $332.3M |
| 118 | ASUR | Asure Software, Inc. | Technology | $246.1M |
| 119 | LAW | CS Disco, Inc. | Technology | $243.1M |
| 120 | CMRC | Commerce.com, Inc. | Technology | $236.0M |
| 121 | SMRT | SmartRent, Inc. | Technology | $219.8M |
| 122 | IMMR | Immersion Corporation | Technology | $210.2M |
| 123 | BZAI | Blaize Holdings, Inc. | Technology | $200.2M |
| 124 | EGAN | eGain Corporation | Technology | $188.7M |
| 125 | DUOT | Duos Technologies Group, Inc. | Technology | $173.4M |
| 126 | PERF | Perfect Corp. | Technology | $172.1M |
| 127 | TRAK | ReposiTrak, Inc. | Technology | $170.0M |
| 128 | DOMO | Domo, Inc. | Technology | $155.8M |
| 129 | MTC | MMTec, Inc. | Technology | $155.2M |
| 130 | IDN | Intellicheck, Inc. | Technology | $146.1M |
| 131 | RDZN | Roadzen, Inc. | Technology | $139.5M |
| 132 | GLOO | Gloo Holdings, Inc. | Technology | $133.0M |
| 133 | ROC | Rank One Computing Corporation | Technology | $113.1M |
| 134 | NRDY | Nerdy, Inc. | Technology | $104.9M |
| 135 | AEYE | AudioEye, Inc. | Technology | $94.3M |
| 136 | TEAD | Teads Holding Co. | Technology | $93.5M |
| 137 | FRMM | Forum Markets, Incorporated | Technology | $90.8M |
| 138 | SSTI | SoundThinking, Inc. | Technology | $86.7M |
| 139 | HIT | Health In Tech, Inc. | Technology | $81.8M |
| 140 | EXFY | Expensify, Inc. | Technology | $81.4M |
| 141 | NTWK | NetSol Technologies, Inc. | Technology | $50.8M |
| 142 | MKTW | MarketWise, Inc. | Technology | $47.6M |
| 143 | DTCX | Datacentrex, Inc. | Technology | $42.3M |
| 144 | RYDE | Ryde Group Ltd. | Technology | $24.8M |
| 145 | MFI | mF International Limited | Technology | $16.8M |
| 146 | NXTT | Next Technology Holding Inc. | Technology | $4.3M |

### 007. Internet Content & Information - 36 tickers (AI/Tech priority 7)
| Rank | Ticker | Company | Sector | Market Cap |
|------|--------|---------|--------|------------|
| 1 | GOOGL | Alphabet Inc. | Communication Services | $4.68T |
| 2 | GOOG | Alphabet Inc. | Communication Services | $4.64T |
| 3 | META | Meta Platforms, Inc. | Communication Services | $1.53T |
| 4 | SPOT | Spotify Technology S.A. | Communication Services | $89.1B |
| 5 | DASH | DoorDash, Inc. | Communication Services | $67.6B |
| 6 | NBIS | Nebius Group N.V. | Communication Services | $43.0B |
| 7 | RDDT | Reddit, Inc. | Communication Services | $29.3B |
| 8 | TWLO | Twilio Inc. | Communication Services | $29.3B |
| 9 | PINS | Pinterest, Inc. | Communication Services | $13.7B |
| 10 | ZG | Zillow Group, Inc. Class A | Communication Services | $9.6B |
| 11 | Z | Zillow Group, Inc. Class C | Communication Services | $9.5B |
| 12 | SNAP | Snap Inc. | Communication Services | $9.4B |
| 13 | MTCH | Match Group, Inc. | Communication Services | $8.2B |
| 14 | IAC | IAC InterActive Corp. | Technology | $3.0B |
| 15 | NN | NextNav Inc. | Communication Services | $2.7B |
| 16 | TBLA | Taboola.com Ltd. | Communication Services | $1.4B |
| 17 | YELP | Yelp Inc. | Communication Services | $1.3B |
| 18 | GENI | Genius Sports Limited | Communication Services | $1.1B |
| 19 | NXDR | Nextdoor Holdings, Inc. | Communication Services | $750.9M |
| 20 | EVER | EverQuote, Inc. | Communication Services | $676.3M |
| 21 | GRPN | Groupon, Inc. | Communication Services | $661.7M |
| 22 | SSTK | Shutterstock, Inc. | Communication Services | $590.0M |
| 23 | MAX | MediaAlpha, Inc. | Communication Services | $473.6M |
| 24 | PERI | Perion Network Ltd. | Communication Services | $425.8M |
| 25 | FVRR | Fiverr International Ltd. | Communication Services | $392.2M |
| 26 | TTGT | TechTarget, Inc. | Communication Services | $362.9M |
| 27 | GETY | Getty Images Holdings, Inc. | Communication Services | $317.6M |
| 28 | SMWB | Similarweb Ltd. | Communication Services | $272.2M |
| 29 | ANGI | Angi Inc. | Communication Services | $209.5M |
| 30 | WSHP | WeShop Holdings Limited Class A Ordinary Shares | Communication Services | $177.0M |
| 31 | THRY | Thryv Holdings, Inc. | Communication Services | $153.9M |
| 32 | PODC | PodcastOne, Inc. | Communication Services | $100.3M |
| 33 | UPXI | Upexi, Inc. | Communication Services | $93.6M |
| 34 | AREN | The Arena Group Holdings, Inc. | Communication Services | $88.5M |
| 35 | MNY | MoneyHero Limited Class A Ordinary Shares | Communication Services | $57.4M |
| 36 | SCOR | comScore, Inc. | Communication Services | $38.0M |

### 008. Information Technology Services - 48 tickers (AI/Tech priority 8)
| Rank | Ticker | Company | Sector | Market Cap |
|------|--------|---------|--------|------------|
| 1 | IBM | International Business Machines Corporation | Technology | $206.0B |
| 2 | ACN | Accenture plc | Technology | $104.5B |
| 3 | CTSH | Cognizant Technology Solutions Corporation | Technology | $22.6B |
| 4 | FIS | Fidelity National Information Services, Inc. | Technology | $22.2B |
| 5 | BR | Broadridge Financial Solutions, Inc. | Technology | $17.3B |
| 6 | LDOS | Leidos Holdings, Inc. | Technology | $16.1B |
| 7 | AUR | Aurora Innovation, Inc. | Technology | $14.2B |
| 8 | GIB | CGI Inc. | Technology | $13.7B |
| 9 | CDW | CDW Corporation | Technology | $12.7B |
| 10 | APLD | Applied Digital Corporation | Technology | $12.6B |
| 11 | CACI | CACI International Inc | Technology | $11.0B |
| 12 | JKHY | Jack Henry & Associates, Inc. | Technology | $10.3B |
| 13 | IT | Gartner, Inc. | Technology | $10.2B |
| 14 | INGM | Ingram Micro Holding Corporation | Technology | $6.1B |
| 15 | DLB | Dolby Laboratories, Inc. | Technology | $5.3B |
| 16 | EPAM | EPAM Systems, Inc. | Technology | $5.0B |
| 17 | EXLS | ExlService Holdings, Inc. | Technology | $4.5B |
| 18 | SAIC | Science Applications International Corporation | Technology | $4.1B |
| 19 | WAY | Waystar Holding Corp. | Technology | $3.7B |
| 20 | NIQ | NIQ Global Intelligence Plc | Technology | $3.0B |
| 21 | INOD | Innodata Inc. | Technology | $3.0B |
| 22 | NYAX | Nayax Ltd. | Technology | $2.6B |
| 23 | KD | Kyndryl Holdings, Inc. | Technology | $2.6B |
| 24 | KEEL | Keel Infrastructure Corp. | Technology | $2.5B |
| 25 | VRRM | Verra Mobility Corporation | Technology | $2.1B |
| 26 | GLOB | Globant S.A. | Technology | $1.5B |
| 27 | BBAI | BigBear.ai Holdings, Inc. | Technology | $1.5B |
| 28 | DXC | DXC Technology Company | Technology | $1.5B |
| 29 | CNXC | Concentrix Corporation | Technology | $1.4B |
| 30 | AI | C3.ai, Inc. | Technology | $1.2B |
| 31 | VYX | NCR Voyix Corporation | Technology | $1.0B |
| 32 | WYFI | WhiteFiber, Inc. Ordinary Shares | Technology | $1.0B |
| 33 | ASGN | ASGN Incorporated | Technology | $895.0M |
| 34 | NABL | N-able, Inc. | Technology | $736.6M |
| 35 | EFOR | Everforth, Inc. | Technology | $733.1M |
| 36 | HIVE | HIVE Digital Technologies Ltd. | Financial Services | $714.2M |
| 37 | GDYN | Grid Dynamics Holdings, Inc. | Technology | $556.9M |
| 38 | SHAZ | SharonAI Holdings, Inc. Class A Common Stock | Technology | $510.1M |
| 39 | CD | Chaince Digital Holdings Inc. | Technology | $474.1M |
| 40 | XRX | Xerox Holdings Corporation | Technology | $357.0M |
| 41 | TLS | Telos Corporation | Technology | $327.0M |
| 42 | TSSI | TSS, Inc. | Technology | $326.5M |
| 43 | UIS | Unisys Corporation | Technology | $236.2M |
| 44 | DMRC | Digimarc Corporation | Technology | $196.9M |
| 45 | TTEC | TTEC Holdings, Inc. | Technology | $118.7M |
| 46 | CSPI | CSP Inc. | Technology | $92.3M |
| 47 | WYY | WidePoint Corporation | Technology | $81.7M |
| 48 | GMM | Global Mofy Metaverse Limited | Technology | $35.5M |

### 009. Consumer Electronics - 6 tickers (AI/Tech priority 9)
| Rank | Ticker | Company | Sector | Market Cap |
|------|--------|---------|--------|------------|
| 1 | AAPL | Apple Inc. | Technology | $4.33T |
| 2 | NXT | Nextpower Inc. | Technology | $18.6B |
| 3 | SONO | Sonos, Inc. | Technology | $1.8B |
| 4 | VUZI | Vuzix Corporation | Technology | $241.2M |
| 5 | TBCH | Turtle Beach Corporation | Technology | $226.7M |
| 6 | GPRO | GoPro, Inc. | Technology | $184.9M |

### 010. Electronic Components - 2 tickers (AI/Tech priority 10)
| Rank | Ticker | Company | Sector | Market Cap |
|------|--------|---------|--------|------------|
| 1 | KULR | KULR Technology Group, Inc. | Technology | $147.5M |
| 2 | ELTK | Eltek Ltd. | Technology | $54.8M |

### 011. Electronic Gaming & Multimedia - 11 tickers (AI/Tech priority 11)
| Rank | Ticker | Company | Sector | Market Cap |
|------|--------|---------|--------|------------|
| 1 | EA | Electronic Arts Inc. | Communication Services | $50.1B |
| 2 | TTWO | Take-Two Interactive Software, Inc. | Communication Services | $41.8B |
| 3 | RBLX | Roblox Corporation | Technology | $29.7B |
| 4 | MGRT | Mega Fortune Company Limited | Technology | $1.8B |
| 5 | PLTK | Playtika Holding Corp. | Technology | $1.4B |
| 6 | GDEV | GDEV Inc. | Communication Services | $304.9M |
| 7 | CTW | CTW Cayman Class A Ordinary Shares | Communication Services | $181.6M |
| 8 | MRDN | Meridian Holdings Inc. | Technology | $138.7M |
| 9 | SKLZ | Skillz Inc. | Communication Services | $98.9M |
| 10 | GMHS | Gamehaus Holdings Inc. | Technology | $59.6M |
| 11 | DKI | DarkIris Inc. Class A Ordinary Shares | Communication Services | $6.9M |

### 012. Scientific & Technical Instruments - 4 tickers (AI/Tech priority 12)
| Rank | Ticker | Company | Sector | Market Cap |
|------|--------|---------|--------|------------|
| 1 | ARBE | Arbe Robotics Ltd. | Technology | $107.2M |
| 2 | GNSS | Genasys Inc. | Technology | $87.7M |
| 3 | ODYS | Odysight.ai Inc. | Technology | $81.5M |
| 4 | SOTK | Sono-Tek Corporation | Technology | $74.9M |

### 013. Financial - Data & Stock Exchanges - 4 tickers (AI/Tech priority 13)
| Rank | Ticker | Company | Sector | Market Cap |
|------|--------|---------|--------|------------|
| 1 | CME | CME Group Inc. | Financial Services | $103.5B |
| 2 | ICE | Intercontinental Exchange, Inc. | Financial Services | $88.1B |
| 3 | COIN | Coinbase Global, Inc. | Financial Services | $54.7B |
| 4 | NDAQ | Nasdaq, Inc. | Financial Services | $50.6B |

### 014. Telecommunications Services - 37 tickers (AI/Tech priority 14)
| Rank | Ticker | Company | Sector | Market Cap |
|------|--------|---------|--------|------------|
| 1 | TMUS | T-Mobile US, Inc. | Communication Services | $209.2B |
| 2 | VZ | Verizon Communications Inc. | Communication Services | $200.2B |
| 3 | T | AT&T Inc. | Communication Services | $175.3B |
| 4 | CMCSA | Comcast Corporation | Communication Services | $88.9B |
| 5 | BCE | BCE Inc. | Communication Services | $22.8B |
| 6 | TU | TELUS Corporation | Communication Services | $19.6B |
| 7 | RCI | Rogers Communications Inc. | Communication Services | $19.6B |
| 8 | CHTR | Charter Communications, Inc. | Communication Services | $18.2B |
| 9 | TIGO | Millicom International Cellular S.A. | Communication Services | $13.4B |
| 10 | GSAT | Globalstar, Inc. | Communication Services | $10.6B |
| 11 | LUMN | Lumen Technologies, Inc. | Communication Services | $8.9B |
| 12 | LBTYB | Liberty Global plc | Communication Services | $5.0B |
| 13 | LBRDK | Liberty Broadband Corporation | Communication Services | $5.0B |
| 14 | LBRDA | Liberty Broadband Corporation | Communication Services | $5.0B |
| 15 | TDS | Telephone and Data Systems, Inc. | Communication Services | $4.5B |
| 16 | AD | Array Digital Infrastructure, Inc. | Communication Services | $4.4B |
| 17 | IRDM | Iridium Communications Inc. | Communication Services | $4.4B |
| 18 | LBTYA | Liberty Global plc | Communication Services | $3.9B |
| 19 | LBTYK | Liberty Global plc | Communication Services | $3.8B |
| 20 | IHS | IHS Holding Limited | Communication Services | $2.8B |
| 21 | LILAK | Liberty Latin America Ltd. | Communication Services | $1.5B |
| 22 | LILA | Liberty Latin America Ltd. | Communication Services | $1.5B |
| 23 | IDT | IDT Corporation | Communication Services | $1.3B |
| 24 | ATEX | Anterix Inc. | Communication Services | $1.0B |
| 25 | GLIBA | GCI Liberty, Inc. | Communication Services | $943.6M |
| 26 | GLIBK | GCI Liberty, Inc. | Communication Services | $933.7M |
| 27 | SHEN | Shenandoah Telecommunications Company | Communication Services | $862.5M |
| 28 | CCOI | Cogent Communications Holdings, Inc. | Communication Services | $806.8M |
| 29 | GOGO | Gogo Inc. | Communication Services | $566.6M |
| 30 | OOMA | Ooma, Inc. | Communication Services | $505.1M |
| 31 | RBBN | Ribbon Communications Inc. | Communication Services | $449.2M |
| 32 | OPTU | Optimum Communications, Inc. | Communication Services | $446.9M |
| 33 | ATNI | ATN International, Inc. | Communication Services | $406.2M |
| 34 | CXDO | Crexendo, Inc. | Communication Services | $296.9M |
| 35 | CABO | Cable One, Inc. | Communication Services | $286.1M |
| 36 | KORE | KORE Group Holdings, Inc. | Communication Services | $160.9M |
| 37 | ELWT | Elauwit Connection, Inc. Common Stock | Communication Services | $45.7M |

### 015. Telecom Services - 2 tickers (AI/Tech priority 15)
| Rank | Ticker | Company | Sector | Market Cap |
|------|--------|---------|--------|------------|
| 1 | RDCM | RADCOM Ltd. | Communication Services | $264.6M |
| 2 | FNGR | FingerMotion, Inc. | Communication Services | $49.6M |

### 016. Electrical Equipment & Parts - 30 tickers (AI/Tech priority 16)
| Rank | Ticker | Company | Sector | Market Cap |
|------|--------|---------|--------|------------|
| 1 | VRT | Vertiv Holdings Co | Industrials | $141.0B |
| 2 | BE | Bloom Energy Corporation | Industrials | $67.5B |
| 3 | NVT | nVent Electric plc | Industrials | $27.6B |
| 4 | HUBB | Hubbell Incorporated | Industrials | $25.7B |
| 5 | AEIS | Advanced Energy Industries, Inc. | Industrials | $12.9B |
| 6 | POWL | Powell Industries, Inc. | Industrials | $11.2B |
| 7 | FPS | Forgent Power Solutions, Inc. | Industrials | $10.5B |
| 8 | AYI | Acuity Brands, Inc. | Industrials | $8.7B |
| 9 | ENS | EnerSys | Industrials | $8.6B |
| 10 | PLUG | Plug Power Inc. | Industrials | $4.1B |
| 11 | AMPX | Amprius Technologies, Inc. | Industrials | $2.7B |
| 12 | ATKR | Atkore Inc. | Industrials | $2.5B |
| 13 | EOSE | Eos Energy Enterprises, Inc. | Industrials | $2.1B |
| 14 | PLPC | Preformed Line Products Company | Industrials | $1.7B |
| 15 | ENVX | Enovix Corporation | Industrials | $1.5B |
| 16 | TE | T1 Energy Inc | Industrials | $1.0B |
| 17 | FCEL | FuelCell Energy, Inc. | Industrials | $905.4M |
| 18 | ADSE | ADS-TEC Energy PLC | Industrials | $667.4M |
| 19 | KE | Kimball Electronics, Inc. | Industrials | $608.4M |
| 20 | SLDP | Solid Power, Inc. | Industrials | $554.0M |
| 21 | MVST | Microvast Holdings, Inc. | Industrials | $469.8M |
| 22 | ELVA | Electrovaya Inc. | Industrials | $405.7M |
| 23 | LTBR | Lightbridge Corporation | Industrials | $347.8M |
| 24 | EAF | GrafTech International Ltd. | Industrials | $239.1M |
| 25 | ESP | Espey Mfg. & Electronics Corp. | Industrials | $213.7M |
| 26 | RFIL | RF Industries, Ltd. | Industrials | $179.5M |
| 27 | TGEN | Tecogen Inc. | Industrials | $126.5M |
| 28 | SKYX | SKYX Platforms Corp. | Industrials | $123.4M |
| 29 | ULBI | Ultralife Corporation | Industrials | $98.4M |
| 30 | NEOV | NeoVolta Inc. | Industrials | $94.6M |

### 017. Agricultural Inputs - 1 tickers (Non-priority / later batch)
| Rank | Ticker | Company | Sector | Market Cap |
|------|--------|---------|--------|------------|
| 1 | IPI | Intrepid Potash, Inc. | Basic Materials | $627.1M |

### 018. Aluminum - 4 tickers (Non-priority / later batch)
| Rank | Ticker | Company | Sector | Market Cap |
|------|--------|---------|--------|------------|
| 1 | AA | Alcoa Corporation | Basic Materials | $17.8B |
| 2 | CENX | Century Aluminum Company | Basic Materials | $6.3B |
| 3 | CSTM | Constellium SE | Basic Materials | $4.5B |
| 4 | KALU | Kaiser Aluminum Corporation | Basic Materials | $2.9B |

### 019. Building Materials - 1 tickers (Non-priority / later batch)
| Rank | Ticker | Company | Sector | Market Cap |
|------|--------|---------|--------|------------|
| 1 | RMIX | Suncrete, Inc. Class A Common Stock | Basic Materials | $386.5M |

### 020. Chemicals - 11 tickers (Non-priority / later batch)
| Rank | Ticker | Company | Sector | Market Cap |
|------|--------|---------|--------|------------|
| 1 | DOW | Dow Inc. | Basic Materials | $28.4B |
| 2 | CE | Celanese Corporation | Basic Materials | $6.5B |
| 3 | MEOH | Methanex Corporation | Basic Materials | $5.0B |
| 4 | HUN | Huntsman Corporation | Basic Materials | $2.5B |
| 5 | TROX | Tronox Holdings plc | Basic Materials | $1.4B |
| 6 | WLKP | Westlake Chemical Partners LP | Basic Materials | $829.7M |
| 7 | RYAM | Rayonier Advanced Materials Inc. | Basic Materials | $632.6M |
| 8 | ASIX | AdvanSix Inc. | Basic Materials | $604.4M |
| 9 | ASPI | ASP Isotopes Inc. Common Stock | Basic Materials | $496.1M |
| 10 | VHI | Valhi, Inc. | Basic Materials | $400.8M |
| 11 | FF | FutureFuel Corp. | Basic Materials | $178.5M |

### 021. Chemicals - Specialty - 40 tickers (Non-priority / later batch)
| Rank | Ticker | Company | Sector | Market Cap |
|------|--------|---------|--------|------------|
| 1 | LIN | Linde plc | Basic Materials | $233.1B |
| 2 | SHW | The Sherwin-Williams Company | Basic Materials | $76.8B |
| 3 | ECL | Ecolab Inc. | Basic Materials | $70.8B |
| 4 | APD | Air Products and Chemicals, Inc. | Basic Materials | $67.6B |
| 5 | ALB | Albemarle Corporation | Basic Materials | $24.2B |
| 6 | LYB | LyondellBasell Industries N.V. | Basic Materials | $24.0B |
| 7 | PPG | PPG Industries, Inc. | Basic Materials | $23.7B |
| 8 | DD | DuPont de Nemours, Inc. | Basic Materials | $20.7B |
| 9 | SOLS | Solstice Advanced Materials Inc. | Basic Materials | $13.9B |
| 10 | RPM | RPM International Inc. | Basic Materials | $12.7B |
| 11 | WLK | Westlake Corporation | Basic Materials | $12.4B |
| 12 | ESI | Element Solutions Inc | Basic Materials | $10.7B |
| 13 | EMN | Eastman Chemical Company | Basic Materials | $8.5B |
| 14 | NEU | NewMarket Corporation | Basic Materials | $6.3B |
| 15 | AXTA | Axalta Coating Systems Ltd. | Basic Materials | $5.9B |
| 16 | PRM | Perimeter Solutions, S.A. | Basic Materials | $5.2B |
| 17 | CBT | Cabot Corporation | Basic Materials | $4.4B |
| 18 | CC | The Chemours Company | Basic Materials | $3.7B |
| 19 | HWKN | Hawkins, Inc. | Basic Materials | $3.5B |
| 20 | FUL | H.B. Fuller Company | Basic Materials | $3.3B |
| 21 | AVNT | Avient Corporation | Basic Materials | $3.2B |
| 22 | OLN | Olin Corporation | Basic Materials | $3.1B |
| 23 | WDFC | WD-40 Company | Basic Materials | $2.8B |
| 24 | MTX | Minerals Technologies Inc. | Basic Materials | $2.5B |
| 25 | NGVT | Ingevity Corporation | Basic Materials | $2.5B |
| 26 | KWR | Quaker Chemical Corporation | Basic Materials | $2.4B |
| 27 | LWLG | Lightwave Logic, Inc. | Basic Materials | $2.4B |
| 28 | IOSP | Innospec Inc. | Basic Materials | $2.0B |
| 29 | REX | REX American Resources Corporation | Basic Materials | $1.6B |
| 30 | ECVT | Ecovyst Inc. | Basic Materials | $1.6B |
| 31 | GPRE | Green Plains Inc. | Basic Materials | $1.2B |
| 32 | SCL | Stepan Company | Basic Materials | $1.2B |
| 33 | KOP | Koppers Holdings Inc. | Basic Materials | $842.1M |
| 34 | KRO | Kronos Worldwide, Inc. | Basic Materials | $804.2M |
| 35 | ADUR | Aduro Clean Technologies Inc. | Basic Materials | $446.9M |
| 36 | OEC | Orion Engineered Carbons S.A. | Basic Materials | $424.0M |
| 37 | GEVO | Gevo, Inc. | Basic Materials | $416.2M |
| 38 | ALTO | Alto Ingredients, Inc. | Basic Materials | $357.1M |
| 39 | CMT | Core Molding Technologies, Inc. | Basic Materials | $224.6M |
| 40 | NTIC | Northern Technologies International Corporation | Basic Materials | $75.8M |

### 022. Construction Materials - 12 tickers (Non-priority / later batch)
| Rank | Ticker | Company | Sector | Market Cap |
|------|--------|---------|--------|------------|
| 1 | CRH | CRH plc | Basic Materials | $74.4B |
| 2 | VMC | Vulcan Materials Company | Basic Materials | $36.2B |
| 3 | MLM | Martin Marietta Materials, Inc. | Basic Materials | $34.9B |
| 4 | AMRZ | Amrize Ltd | Basic Materials | $28.9B |
| 5 | JHX | James Hardie Industries plc | Basic Materials | $11.7B |
| 6 | EXP | Eagle Materials Inc. | Basic Materials | $6.4B |
| 7 | KNF | Knife River Corporation | Basic Materials | $4.7B |
| 8 | USLM | United States Lime & Minerals, Inc. | Basic Materials | $3.1B |
| 9 | TTAM | Titan America S.A. | Basic Materials | $3.0B |
| 10 | TGLS | Tecnoglass Inc. | Basic Materials | $1.7B |
| 11 | SMID | Smith-Midland Corporation | Basic Materials | $163.2M |
| 12 | FEAM | 5E Advanced Materials Inc. | Basic Materials | $35.5M |

### 023. Copper - 5 tickers (Non-priority / later batch)
| Rank | Ticker | Company | Sector | Market Cap |
|------|--------|---------|--------|------------|
| 1 | SCCO | Southern Copper Corporation | Basic Materials | $158.4B |
| 2 | FCX | Freeport-McMoRan Inc. | Basic Materials | $94.9B |
| 3 | HBM | Hudbay Minerals Inc. | Basic Materials | $10.8B |
| 4 | ERO | Ero Copper Corp. | Basic Materials | $3.3B |
| 5 | TGB | Taseko Mines Limited | Basic Materials | $2.5B |

### 024. Gold - 41 tickers (Non-priority / later batch)
| Rank | Ticker | Company | Sector | Market Cap |
|------|--------|---------|--------|------------|
| 1 | NEM | Newmont Corporation | Basic Materials | $127.8B |
| 2 | AEM | Agnico Eagle Mines Limited | Basic Materials | $98.7B |
| 3 | B | Barrick Mining Corporation | Basic Materials | $76.8B |
| 4 | WPM | Wheaton Precious Metals Corp. | Basic Materials | $64.8B |
| 5 | AU | AngloGold Ashanti Plc | Basic Materials | $52.7B |
| 6 | FNV | Franco-Nevada Corporation | Basic Materials | $45.7B |
| 7 | KGC | Kinross Gold Corporation | Basic Materials | $38.0B |
| 8 | AGI | Alamos Gold Inc. | Basic Materials | $18.7B |
| 9 | RGLD | Royal Gold, Inc. | Basic Materials | $17.0B |
| 10 | HL | Hecla Mining Company | Basic Materials | $13.8B |
| 11 | CDE | Coeur Mining, Inc. | Basic Materials | $13.1B |
| 12 | EQX | Equinox Gold Corp. | Basic Materials | $11.7B |
| 13 | IAG | IAMGOLD Corporation | Basic Materials | $11.2B |
| 14 | OR | OR Royalties Inc. | Basic Materials | $7.4B |
| 15 | SSRM | SSR Mining Inc. | Basic Materials | $7.4B |
| 16 | BTG | B2Gold Corp. | Basic Materials | $7.2B |
| 17 | NGD | New Gold Inc. | Basic Materials | $7.2B |
| 18 | EGO | Eldorado Gold Corporation | Basic Materials | $7.2B |
| 19 | ORLA | Orla Mining Ltd. | Basic Materials | $5.0B |
| 20 | HYMC | Hycroft Mining Holding Corporation | Basic Materials | $4.1B |
| 21 | NG | NovaGold Resources Inc. | Basic Materials | $4.0B |
| 22 | CGAU | Centerra Gold Inc. | Basic Materials | $3.8B |
| 23 | AAUC | Allied Gold Corporation | Basic Materials | $3.7B |
| 24 | SA | Seabridge Gold Inc. | Basic Materials | $3.5B |
| 25 | IAUX | i-80 Gold Corp. | Basic Materials | $1.3B |
| 26 | DC | Dakota Gold Corp. | Basic Materials | $843.8M |
| 27 | IDR | Idaho Strategic Resources, Inc. | Basic Materials | $814.0M |
| 28 | GAU | Galiano Gold Inc. | Basic Materials | $681.3M |
| 29 | THM | International Tower Hill Mines Ltd. | Basic Materials | $588.1M |
| 30 | NFGC | New Found Gold Corp. | Basic Materials | $501.7M |
| 31 | ODV | Osisko Development Corp. | Basic Materials | $499.0M |
| 32 | CMCL | Caledonia Mining Corporation Plc | Basic Materials | $482.2M |
| 33 | TRX | TRX Gold Corporation | Basic Materials | $423.4M |
| 34 | VGZ | Vista Gold Corp. | Basic Materials | $348.9M |
| 35 | CTGO | Contango Ore, Inc. | Basic Materials | $327.7M |
| 36 | USAU | U.S. Gold Corp. | Basic Materials | $291.9M |
| 37 | GLDG | GoldMining Inc. | Basic Materials | $267.5M |
| 38 | MINE | Mayfair Gold Corp. | Basic Materials | $210.0M |
| 39 | GORO | Gold Resource Corporation | Basic Materials | $182.8M |
| 40 | PZG | Paramount Gold Nevada Corp. | Basic Materials | $128.2M |
| 41 | NAMM | Namib Minerals Ordinary Shares | Basic Materials | $89.4M |

### 025. Industrial Materials - 28 tickers (Non-priority / later batch)
| Rank | Ticker | Company | Sector | Market Cap |
|------|--------|---------|--------|------------|
| 1 | TECK | Teck Resources Limited | Basic Materials | $31.8B |
| 2 | MP | MP Materials Corp. | Basic Materials | $11.7B |
| 3 | MTRN | Materion Corporation | Basic Materials | $4.2B |
| 4 | SKE | Skeena Resources Limited | Basic Materials | $4.1B |
| 5 | USAR | USA Rare Earth Inc | Basic Materials | $2.5B |
| 6 | TMC | TMC the metals company Inc. | Basic Materials | $2.4B |
| 7 | SGML | Sigma Lithium Corporation | Basic Materials | $2.3B |
| 8 | USAS | Americas Gold and Silver Corporation | Basic Materials | $2.0B |
| 9 | LAR | Lithium Argentina AG | Basic Materials | $1.9B |
| 10 | NEXA | Nexa Resources S.A. | Basic Materials | $1.8B |
| 11 | UAMY | United States Antimony Corporation | Basic Materials | $1.5B |
| 12 | VZLA | Vizsla Silver Corp. | Basic Materials | $1.3B |
| 13 | LAC | Lithium Americas Corp. | Basic Materials | $1.2B |
| 14 | CMP | Compass Minerals International, Inc. | Basic Materials | $1.2B |
| 15 | CRML | Critical Metals Corp. | Basic Materials | $1.1B |
| 16 | SLI | Standard Lithium Ltd. | Basic Materials | $886.3M |
| 17 | NB | NioCorp Developments Ltd. | Basic Materials | $874.9M |
| 18 | TMQ | Trilogy Metals Inc. | Basic Materials | $816.1M |
| 19 | GSM | Ferroglobe PLC | Basic Materials | $749.3M |
| 20 | WRN | Western Copper and Gold Corporation | Basic Materials | $719.8M |
| 21 | LZM | Lifezone Metals Limited | Basic Materials | $530.4M |
| 22 | ABAT | American Battery Technology Company Common Stock | Basic Materials | $341.4M |
| 23 | NMG | Nouveau Monde Graphite Inc. | Basic Materials | $315.2M |
| 24 | TII | Titan Mining Corporation | Basic Materials | $262.4M |
| 25 | USGO | U.S. GoldMining Inc. | Basic Materials | $176.5M |
| 26 | GRO | Brazil Potash Corp. | Basic Materials | $109.8M |
| 27 | XPL | Solitario Zinc Corp. | Basic Materials | $81.2M |
| 28 | LGO | Largo Inc. | Basic Materials | $76.6M |

### 026. Other Industrial Metals & Mining - 3 tickers (Non-priority / later batch)
| Rank | Ticker | Company | Sector | Market Cap |
|------|--------|---------|--------|------------|
| 1 | NAK | Northern Dynasty Minerals Ltd. | Basic Materials | $1.2B |
| 2 | BMM | Blue Moon Metals Inc | Basic Materials | $496.3M |
| 3 | SBMT | Silver Bow Mining Corp. | Basic Materials | $298.4M |

### 027. Other Precious Metals - 23 tickers (Non-priority / later batch)
| Rank | Ticker | Company | Sector | Market Cap |
|------|--------|---------|--------|------------|
| 1 | TFPM | Triple Flag Precious Metals Corp. | Basic Materials | $7.3B |
| 2 | AUGO | Aura Minerals | Basic Materials | $7.0B |
| 3 | ALM | Almonty Industries Inc. Common Shares | Basic Materials | $6.2B |
| 4 | ARIS | Aris Mining Corporation | Basic Materials | $4.2B |
| 5 | PPTA | Perpetua Resources Corp. | Basic Materials | $3.9B |
| 6 | EXK | Endeavour Silver Corp. | Basic Materials | $3.4B |
| 7 | FSM | Fortuna Mining Corp. | Basic Materials | $3.3B |
| 8 | SLSR | Solaris Resources Inc. | Basic Materials | $1.8B |
| 9 | CNL | Collective Mining Ltd. | Basic Materials | $1.7B |
| 10 | MUX | McEwen Mining Inc. | Basic Materials | $1.6B |
| 11 | ASM | Avino Silver & Gold Mines Ltd. | Basic Materials | $1.3B |
| 12 | ELE | Elemental Royalty Corporation Common Stock | Basic Materials | $1.3B |
| 13 | NEWP | New Pacific Metals Corp. | Basic Materials | $1.1B |
| 14 | SCZM | Santacruz Silver Mining Ltd. Common Shares | Basic Materials | $937.9M |
| 15 | MAKO | Mako Mining Corp Common Stock | Basic Materials | $719.8M |
| 16 | GROY | Gold Royalty Corp. | Basic Materials | $652.5M |
| 17 | ALOY | REalloys Inc. | Basic Materials | $544.5M |
| 18 | REA | Rare Earths Americas, Inc. | Basic Materials | $535.2M |
| 19 | ITRG | Integra Resources Corp. | Basic Materials | $487.5M |
| 20 | VOXR | Vox Royalty Corp. | Basic Materials | $342.4M |
| 21 | PLG | Platinum Group Metals Ltd. | Basic Materials | $233.4M |
| 22 | ATLX | Atlas Lithium Corporation | Basic Materials | $121.1M |
| 23 | NEXM | NexMetals Mining Corp. | Basic Materials | $61.8M |

### 028. Paper, Lumber & Forest Products - 1 tickers (Non-priority / later batch)
| Rank | Ticker | Company | Sector | Market Cap |
|------|--------|---------|--------|------------|
| 1 | MATV | Mativ Holdings, Inc. | Basic Materials | $474.6M |

### 029. Silver - 6 tickers (Non-priority / later batch)
| Rank | Ticker | Company | Sector | Market Cap |
|------|--------|---------|--------|------------|
| 1 | PAAS | Pan American Silver Corp. | Basic Materials | $26.9B |
| 2 | AG | First Majestic Silver Corp. | Basic Materials | $12.0B |
| 3 | SVM | Silvercorp Metals Inc. | Basic Materials | $3.4B |
| 4 | AYA | Aya Gold & Silver Inc. Common Shares | Basic Materials | $3.0B |
| 5 | HSLV | Highlander Silver Corp. | Basic Materials | $830.4M |
| 6 | DVS | Dolly Varden Silver Corporation | Basic Materials | $252.1M |

### 030. Specialty Chemicals - 2 tickers (Non-priority / later batch)
| Rank | Ticker | Company | Sector | Market Cap |
|------|--------|---------|--------|------------|
| 1 | FSI | Flexible Solutions International, Inc. | Basic Materials | $80.8M |
| 2 | LOOP | Loop Industries, Inc. | Basic Materials | $69.1M |

### 031. Steel - 13 tickers (Non-priority / later batch)
| Rank | Ticker | Company | Sector | Market Cap |
|------|--------|---------|--------|------------|
| 1 | NUE | Nucor Corporation | Basic Materials | $52.3B |
| 2 | STLD | Steel Dynamics, Inc. | Basic Materials | $33.6B |
| 3 | RS | Reliance Steel & Aluminum Co. | Basic Materials | $18.4B |
| 4 | CMC | Commercial Metals Company | Basic Materials | $7.7B |
| 5 | CLF | Cleveland-Cliffs Inc. | Basic Materials | $6.2B |
| 6 | WS | Worthington Steel, Inc. | Basic Materials | $2.0B |
| 7 | MTUS | Metallus Inc. | Basic Materials | $733.5M |
| 8 | ASTL | Algoma Steel Group Inc. | Basic Materials | $523.6M |
| 9 | MSB | Mesabi Trust | Basic Materials | $382.7M |
| 10 | FRD | Friedman Industries, Incorporated | Basic Materials | $153.0M |
| 11 | LUD | Luda Technology Group Limited | Basic Materials | $131.5M |
| 12 | ACNT | Ascent Industries Co. | Basic Materials | $124.4M |
| 13 | HLP | Hongli Group Inc. | Basic Materials | $69.0M |

### 032. Broadcasting - 1 tickers (Non-priority / later batch)
| Rank | Ticker | Company | Sector | Market Cap |
|------|--------|---------|--------|------------|
| 1 | FUBO | fuboTV Inc. | Communication Services | $1.1B |

### 033. Entertainment - 15 tickers (Non-priority / later batch)
| Rank | Ticker | Company | Sector | Market Cap |
|------|--------|---------|--------|------------|
| 1 | NFLX | Netflix, Inc. | Communication Services | $369.1B |
| 2 | WBD | Warner Bros. Discovery, Inc. | Communication Services | $68.2B |
| 3 | FWONK | Formula One Group | Communication Services | $22.7B |
| 4 | FWONA | Formula One Group | Communication Services | $20.8B |
| 5 | ROKU | Roku, Inc. | Communication Services | $18.9B |
| 6 | WMG | Warner Music Group Corp. | Communication Services | $17.5B |
| 7 | NWS | News Corporation | Communication Services | $16.6B |
| 8 | NWSA | News Corporation | Communication Services | $14.9B |
| 9 | PSKY | Paramount Skydance Corporation Class B Common Stock | Communication Services | $11.6B |
| 10 | LLYVK | Liberty Live Group | Communication Services | $8.9B |
| 11 | LLYVA | Liberty Live Group | Communication Services | $8.7B |
| 12 | IMAX | IMAX Corporation | Communication Services | $1.9B |
| 13 | AMCX | AMC Networks Inc. | Communication Services | $354.9M |
| 14 | AENT | Alliance Entertainment Holding Corporation | Communication Services | $354.7M |
| 15 | LVO | LiveOne, Inc. | Communication Services | $53.0M |

### 034. Publishing - 3 tickers (Non-priority / later batch)
| Rank | Ticker | Company | Sector | Market Cap |
|------|--------|---------|--------|------------|
| 1 | NYT | The New York Times Company | Communication Services | $12.6B |
| 2 | TDAY | USA TODAY Co., Inc. | Communication Services | $1.1B |
| 3 | LEE | Lee Enterprises, Incorporated | Communication Services | $48.8M |

### 035. Apparel - Retail - 2 tickers (Non-priority / later batch)
| Rank | Ticker | Company | Sector | Market Cap |
|------|--------|---------|--------|------------|
| 1 | DLTH | Duluth Holdings Inc. | Consumer Cyclical | $113.2M |
| 2 | RENT | Rent the Runway, Inc. | Consumer Cyclical | $19.2M |

### 036. Auto & Truck Dealerships - 1 tickers (Non-priority / later batch)
| Rank | Ticker | Company | Sector | Market Cap |
|------|--------|---------|--------|------------|
| 1 | CRMT | America's Car-Mart, Inc. | Consumer Cyclical | $103.2M |

### 037. Auto - Dealerships - 17 tickers (Non-priority / later batch)
| Rank | Ticker | Company | Sector | Market Cap |
|------|--------|---------|--------|------------|
| 1 | CVNA | Carvana Co. | Consumer Cyclical | $79.9B |
| 2 | PAG | Penske Automotive Group, Inc. | Consumer Cyclical | $11.1B |
| 3 | AN | AutoNation, Inc. | Consumer Cyclical | $6.5B |
| 4 | LAD | Lithia Motors, Inc. | Consumer Cyclical | $6.3B |
| 5 | RUSHA | Rush Enterprises, Inc. | Consumer Cyclical | $5.6B |
| 6 | KMX | CarMax, Inc. | Consumer Cyclical | $5.4B |
| 7 | RUSHB | Rush Enterprises, Inc. | Consumer Cyclical | $5.1B |
| 8 | GPI | Group 1 Automotive, Inc. | Consumer Cyclical | $4.0B |
| 9 | OPLN | OPENLANE, Inc. | Consumer Cyclical | $3.8B |
| 10 | ABG | Asbury Automotive Group, Inc. | Consumer Cyclical | $3.6B |
| 11 | CARG | CarGurus, Inc. | Consumer Cyclical | $3.0B |
| 12 | SAH | Sonic Automotive, Inc. | Consumer Cyclical | $2.7B |
| 13 | ACVA | ACV Auctions Inc. | Consumer Cyclical | $1.0B |
| 14 | CARS | Cars.com Inc. | Consumer Cyclical | $589.8M |
| 15 | CWH | Camping World Holdings, Inc. | Consumer Cyclical | $425.6M |
| 16 | RDNW | RideNow Group, Inc. | Consumer Cyclical | $142.8M |
| 17 | OTH | Off The Hook YS Inc. | Consumer Cyclical | $58.6M |

### 038. Auto - Manufacturers - 10 tickers (Non-priority / later batch)
| Rank | Ticker | Company | Sector | Market Cap |
|------|--------|---------|--------|------------|
| 1 | TSLA | Tesla, Inc. | Consumer Cyclical | $1.63T |
| 2 | GM | General Motors Company | Consumer Cyclical | $68.9B |
| 3 | RACE | Ferrari N.V. | Consumer Cyclical | $58.1B |
| 4 | F | Ford Motor Company | Consumer Cyclical | $46.9B |
| 5 | STLA | Stellantis N.V. | Consumer Cyclical | $21.4B |
| 6 | RIVN | Rivian Automotive, Inc. | Consumer Cyclical | $17.5B |
| 7 | VFS | VinFast Auto Ltd. | Consumer Cyclical | $9.5B |
| 8 | BLBD | Blue Bird Corporation | Consumer Cyclical | $2.2B |
| 9 | LCID | Lucid Group, Inc. | Consumer Cyclical | $1.9B |
| 10 | SEV | Aptera Motors Corp. | Consumer Cyclical | $63.4M |

### 039. Auto - Parts - 37 tickers (Non-priority / later batch)
| Rank | Ticker | Company | Sector | Market Cap |
|------|--------|---------|--------|------------|
| 1 | ORLY | O'Reilly Automotive, Inc. | Consumer Cyclical | $76.1B |
| 2 | AZO | AutoZone, Inc. | Consumer Cyclical | $56.2B |
| 3 | MGA | Magna International Inc. | Consumer Cyclical | $17.4B |
| 4 | MOD | Modine Manufacturing Company | Consumer Cyclical | $14.6B |
| 5 | APTV | Aptiv PLC | Consumer Cyclical | $11.6B |
| 6 | ALSN | Allison Transmission Holdings, Inc. | Consumer Cyclical | $9.9B |
| 7 | ALV | Autoliv, Inc. | Consumer Cyclical | $8.9B |
| 8 | MBLY | Mobileye Global Inc. | Consumer Cyclical | $7.5B |
| 9 | LKQ | LKQ Corporation | Consumer Cyclical | $6.8B |
| 10 | LEA | Lear Corporation | Consumer Cyclical | $6.8B |
| 11 | GTX | Garrett Motion Inc. | Consumer Cyclical | $5.5B |
| 12 | QS | QuantumScape Corporation | Consumer Cyclical | $5.2B |
| 13 | GNTX | Gentex Corporation | Consumer Cyclical | $4.9B |
| 14 | DAN | Dana Incorporated | Consumer Cyclical | $4.5B |
| 15 | DORM | Dorman Products, Inc. | Consumer Cyclical | $3.6B |
| 16 | VGNT | Versigent PLC | Consumer Cyclical | $3.1B |
| 17 | VC | Visteon Corporation | Consumer Cyclical | $3.1B |
| 18 | PHIN | PHINIA Inc. | Consumer Cyclical | $2.9B |
| 19 | ADNT | Adient plc | Consumer Cyclical | $1.7B |
| 20 | GT | The Goodyear Tire & Rubber Company | Consumer Cyclical | $1.7B |
| 21 | AEVA | Aeva Technologies, Inc. | Consumer Cyclical | $1.2B |
| 22 | XPEL | XPEL, Inc. | Consumer Cyclical | $1.1B |
| 23 | THRM | Gentherm Incorporated | Consumer Cyclical | $929.2M |
| 24 | SMP | Standard Motor Products, Inc. | Consumer Cyclical | $853.8M |
| 25 | DCH | Dauch Corporation | Industrials | $767.2M |
| 26 | FOXF | Fox Factory Holding Corp. | Consumer Cyclical | $705.8M |
| 27 | MLR | Miller Industries, Inc. | Consumer Cyclical | $532.5M |
| 28 | CPS | Cooper-Standard Holdings Inc. | Consumer Cyclical | $510.8M |
| 29 | MNRO | Monro, Inc. | Consumer Cyclical | $485.1M |
| 30 | HYLN | Hyliion Holdings Corp. | Consumer Cyclical | $477.9M |
| 31 | SES | SES AI Corporation | Consumer Cyclical | $364.4M |
| 32 | HLLY | Holley Inc. | Consumer Cyclical | $327.2M |
| 33 | STRT | Strattec Security Corporation | Consumer Cyclical | $262.3M |
| 34 | MPAA | Motorcar Parts of America, Inc. | Consumer Cyclical | $215.7M |
| 35 | SRI | Stoneridge, Inc. | Consumer Cyclical | $196.5M |
| 36 | INVZ | Innoviz Technologies Ltd. | Consumer Cyclical | $168.7M |
| 37 | LIDR | AEye, Inc. | Consumer Cyclical | $97.5M |

### 040. Auto - Recreational Vehicles - 4 tickers (Non-priority / later batch)
| Rank | Ticker | Company | Sector | Market Cap |
|------|--------|---------|--------|------------|
| 1 | LCII | LCI Industries | Consumer Cyclical | $2.7B |
| 2 | HOG | Harley-Davidson, Inc. | Consumer Cyclical | $2.7B |
| 3 | ONEW | OneWater Marine Inc. | Consumer Cyclical | $185.5M |
| 4 | EMPD | Empery Digital Inc. | Consumer Cyclical | $146.1M |

### 041. Auto Manufacturers - 1 tickers (Non-priority / later batch)
| Rank | Ticker | Company | Sector | Market Cap |
|------|--------|---------|--------|------------|
| 1 | GGR | Gogoro Inc. | Consumer Cyclical | $56.4M |

### 042. Auto Parts - 3 tickers (Non-priority / later batch)
| Rank | Ticker | Company | Sector | Market Cap |
|------|--------|---------|--------|------------|
| 1 | ECX | ECARX Holdings, Inc. | Consumer Cyclical | $355.2M |
| 2 | CAAS | China Automotive Systems, Inc. | Consumer Cyclical | $142.4M |
| 3 | SYPR | Sypris Solutions, Inc. | Consumer Cyclical | $72.5M |

### 043. Department Stores - 4 tickers (Non-priority / later batch)
| Rank | Ticker | Company | Sector | Market Cap |
|------|--------|---------|--------|------------|
| 1 | DDS | Dillard's, Inc. | Consumer Cyclical | $8.4B |
| 2 | M | Macy's, Inc. | Consumer Cyclical | $4.9B |
| 3 | PLBL | Polibeli Group Ltd | Consumer Cyclical | $2.6B |
| 4 | KSS | Kohl's Corporation | Consumer Cyclical | $1.4B |

### 044. Furnishings, Fixtures & Appliances - 9 tickers (Non-priority / later batch)
| Rank | Ticker | Company | Sector | Market Cap |
|------|--------|---------|--------|------------|
| 1 | SN | SharkNinja, Inc. | Consumer Cyclical | $15.3B |
| 2 | MHK | Mohawk Industries, Inc. | Consumer Cyclical | $6.1B |
| 3 | ALH | Alliance Laundry Holdings Inc. | Consumer Cyclical | $4.3B |
| 4 | WHR | Whirlpool Corporation | Consumer Cyclical | $2.7B |
| 5 | TILE | Interface, Inc. | Consumer Cyclical | $1.6B |
| 6 | AMWD | American Woodmark Corporation | Consumer Cyclical | $529.6M |
| 7 | HBB | Hamilton Beach Brands Holding Company | Consumer Cyclical | $252.1M |
| 8 | COOK | Traeger, Inc. | Consumer Cyclical | $111.0M |
| 9 | KEQU | Kewaunee Scientific Corporation | Consumer Cyclical | $105.3M |

### 045. Gambling - 1 tickers (Non-priority / later batch)
| Rank | Ticker | Company | Sector | Market Cap |
|------|--------|---------|--------|------------|
| 1 | BRAG | Bragg Gaming Group Inc. | Consumer Cyclical | $52.9M |

### 046. Gambling, Resorts & Casinos - 3 tickers (Non-priority / later batch)
| Rank | Ticker | Company | Sector | Market Cap |
|------|--------|---------|--------|------------|
| 1 | HGV | Hilton Grand Vacations Inc. | Consumer Cyclical | $3.6B |
| 2 | INSE | Inspired Entertainment, Inc. | Consumer Cyclical | $196.1M |
| 3 | ROLR | High Roller Technologies, Inc. | Consumer Cyclical | $59.3M |

### 047. Home Improvement - 5 tickers (Non-priority / later batch)
| Rank | Ticker | Company | Sector | Market Cap |
|------|--------|---------|--------|------------|
| 1 | HD | The Home Depot, Inc. | Consumer Cyclical | $309.2B |
| 2 | LOW | Lowe's Companies, Inc. | Consumer Cyclical | $125.7B |
| 3 | FND | Floor & Decor Holdings, Inc. | Consumer Cyclical | $5.2B |
| 4 | HVT.A | Haverty Furniture Companies, Inc. | Consumer Cyclical | $382.1M |
| 5 | HVT | Haverty Furniture Companies, Inc. | Consumer Cyclical | $333.2M |

### 048. Leisure - 2 tickers (Non-priority / later batch)
| Rank | Ticker | Company | Sector | Market Cap |
|------|--------|---------|--------|------------|
| 1 | YETI | YETI Holdings, Inc. | Consumer Cyclical | $3.0B |
| 2 | PLBY | Playboy, Inc. | Consumer Cyclical | $140.1M |

### 049. Luxury Goods - 4 tickers (Non-priority / later batch)
| Rank | Ticker | Company | Sector | Market Cap |
|------|--------|---------|--------|------------|
| 1 | SIG | Signet Jewelers Limited | Consumer Cyclical | $3.3B |
| 2 | REAL | The RealReal, Inc. | Consumer Cyclical | $2.7B |
| 3 | ELA | Envela Corporation | Consumer Cyclical | $627.5M |
| 4 | BRLT | Brilliant Earth Group, Inc. | Consumer Cyclical | $86.9M |

### 050. Packaging & Containers - 2 tickers (Non-priority / later batch)
| Rank | Ticker | Company | Sector | Market Cap |
|------|--------|---------|--------|------------|
| 1 | MYE | Myers Industries, Inc. | Consumer Cyclical | $839.4M |
| 2 | ORBS | Eightco Holdings Inc. | Consumer Cyclical | $177.7M |

### 051. Residential Construction - 2 tickers (Non-priority / later batch)
| Rank | Ticker | Company | Sector | Market Cap |
|------|--------|---------|--------|------------|
| 1 | IBP | Installed Building Products, Inc. | Consumer Cyclical | $5.5B |
| 2 | MTH | Meritage Homes Corporation | Consumer Cyclical | $4.2B |

### 052. Specialty Retail - 44 tickers (Non-priority / later batch)
| Rank | Ticker | Company | Sector | Market Cap |
|------|--------|---------|--------|------------|
| 1 | AMZN | Amazon.com, Inc. | Consumer Cyclical | $2.86T |
| 2 | MELI | MercadoLibre, Inc. | Consumer Cyclical | $80.0B |
| 3 | EBAY | eBay Inc. | Consumer Cyclical | $49.0B |
| 4 | CASY | Casey's General Stores, Inc. | Consumer Cyclical | $32.1B |
| 5 | CPNG | Coupang, Inc. | Consumer Cyclical | $28.5B |
| 6 | ULTA | Ulta Beauty, Inc. | Consumer Cyclical | $22.1B |
| 7 | WSM | Williams-Sonoma, Inc. | Consumer Cyclical | $20.9B |
| 8 | DKS | DICK'S Sporting Goods, Inc. | Consumer Cyclical | $18.2B |
| 9 | TSCO | Tractor Supply Company | Consumer Cyclical | $16.0B |
| 10 | BBY | Best Buy Co., Inc. | Consumer Cyclical | $12.0B |
| 11 | MUSA | Murphy USA Inc. | Consumer Cyclical | $10.7B |
| 12 | GME | GameStop Corp. | Consumer Cyclical | $10.0B |
| 13 | CHWY | Chewy, Inc. | Consumer Cyclical | $9.5B |
| 14 | CART | Instacart (Maplebear Inc.) | Consumer Cyclical | $9.2B |
| 15 | W | Wayfair Inc. | Consumer Cyclical | $8.0B |
| 16 | ETSY | Etsy, Inc. | Consumer Cyclical | $5.5B |
| 17 | GLBE | Global-e Online Ltd. | Consumer Cyclical | $5.1B |
| 18 | BBWI | Bath & Body Works, Inc. | Consumer Cyclical | $3.8B |
| 19 | ASO | Academy Sports and Outdoors, Inc. | Consumer Cyclical | $3.3B |
| 20 | AAP | Advance Auto Parts, Inc. | Consumer Cyclical | $3.2B |
| 21 | RH | Rh | Consumer Cyclical | $2.5B |
| 22 | EYE | National Vision Holdings, Inc. | Consumer Cyclical | $1.7B |
| 23 | BOBS | Bob's Discount Furniture, Inc. | Consumer Cyclical | $1.6B |
| 24 | OLPX | Olaplex Holdings, Inc. | Consumer Cyclical | $1.4B |
| 25 | RVLV | Revolve Group, Inc. | Consumer Cyclical | $1.3B |
| 26 | SBH | Sally Beauty Holdings, Inc. | Consumer Cyclical | $1.2B |
| 27 | SVV | Savers Value Village, Inc. | Consumer Cyclical | $1.1B |
| 28 | LQDT | Liquidity Services, Inc. | Consumer Cyclical | $1.0B |
| 29 | HZO | MarineMax, Inc. | Consumer Cyclical | $720.5M |
| 30 | WOOF | Petco Health and Wellness Company, Inc. | Consumer Cyclical | $719.3M |
| 31 | BWMX | Betterware de México, S.A.P.I. de C.V. | Consumer Cyclical | $610.1M |
| 32 | EVGO | EVgo, Inc. | Consumer Cyclical | $602.1M |
| 33 | TDUP | ThredUp Inc. | Consumer Cyclical | $553.6M |
| 34 | NEGG | Newegg Commerce, Inc. | Consumer Cyclical | $510.9M |
| 35 | BBW | Build-A-Bear Workshop, Inc. | Consumer Cyclical | $454.4M |
| 36 | HNST | The Honest Company, Inc. | Consumer Cyclical | $371.0M |
| 37 | BNED | Barnes & Noble Education, Inc. | Consumer Cyclical | $355.0M |
| 38 | BBBY | Bed Bath & Beyond Inc. | Consumer Cyclical | $346.8M |
| 39 | FLWS | 1-800-FLOWERS.COM, Inc. | Consumer Cyclical | $280.0M |
| 40 | DIBS | 1stdibs.Com, Inc. | Consumer Cyclical | $162.3M |
| 41 | CHPT | ChargePoint Holdings, Inc. | Consumer Cyclical | $152.1M |
| 42 | AKA | a.k.a. Brands Holding Corp. | Consumer Cyclical | $126.9M |
| 43 | HOUR | Hour Loop, Inc. | Consumer Cyclical | $81.6M |
| 44 | SPWH | Sportsman's Warehouse Holdings, Inc. | Consumer Cyclical | $53.2M |

### 053. Travel Services - 2 tickers (Non-priority / later batch)
| Rank | Ticker | Company | Sector | Market Cap |
|------|--------|---------|--------|------------|
| 1 | MMYT | MakeMyTrip Limited | Consumer Cyclical | $4.3B |
| 2 | SABR | Sabre Corporation | Consumer Cyclical | $723.4M |

### 054. Beverages - Wineries & Distilleries - 1 tickers (Non-priority / later batch)
| Rank | Ticker | Company | Sector | Market Cap |
|------|--------|---------|--------|------------|
| 1 | RYZ | Ryerson Holding Corporation | Consumer Defensive | $1.0B |

### 055. Discount Stores - 6 tickers (Non-priority / later batch)
| Rank | Ticker | Company | Sector | Market Cap |
|------|--------|---------|--------|------------|
| 1 | WMT | Walmart Inc. | Consumer Defensive | $1.04T |
| 2 | COST | Costco Wholesale Corporation | Consumer Defensive | $453.4B |
| 3 | TGT | Target Corporation | Consumer Defensive | $55.1B |
| 4 | BJ | BJ's Wholesale Club Holdings, Inc. | Consumer Defensive | $11.9B |
| 5 | PSMT | PriceSmart, Inc. | Consumer Defensive | $4.8B |
| 6 | OLLI | Ollie's Bargain Outlet Holdings, Inc. | Consumer Defensive | $4.6B |

### 056. Education & Training Services - 4 tickers (Non-priority / later batch)
| Rank | Ticker | Company | Sector | Market Cap |
|------|--------|---------|--------|------------|
| 1 | PXED | Phoenix Education Partners, Inc | Consumer Defensive | $1.1B |
| 2 | COUR | Coursera, Inc. | Consumer Defensive | $971.9M |
| 3 | UDMY | Udemy, Inc. | Consumer Defensive | $677.3M |
| 4 | SKIL | Skillsoft Corp. | Consumer Defensive | $67.8M |

### 057. Food Distribution - 1 tickers (Non-priority / later batch)
| Rank | Ticker | Company | Sector | Market Cap |
|------|--------|---------|--------|------------|
| 1 | PFGC | Performance Food Group Company | Consumer Defensive | $14.9B |

### 058. Household & Personal Products - 2 tickers (Non-priority / later batch)
| Rank | Ticker | Company | Sector | Market Cap |
|------|--------|---------|--------|------------|
| 1 | SPB | Spectrum Brands Holdings, Inc. | Consumer Defensive | $1.9B |
| 2 | NWL | Newell Brands Inc. | Consumer Defensive | $1.7B |

### 059. Packaged Foods - 9 tickers (Non-priority / later batch)
| Rank | Ticker | Company | Sector | Market Cap |
|------|--------|---------|--------|------------|
| 1 | CENT | Central Garden & Pet Company | Consumer Defensive | $2.4B |
| 2 | CENTA | Central Garden & Pet Company | Consumer Defensive | $2.2B |
| 3 | BRBR | BellRing Brands, Inc. | Consumer Defensive | $1.1B |
| 4 | NATR | Nature's Sunshine Products, Inc. | Consumer Defensive | $394.4M |
| 5 | USNA | USANA Health Sciences, Inc. | Consumer Defensive | $320.4M |
| 6 | FTLF | FitLife Brands, Inc. | Consumer Defensive | $89.2M |
| 7 | CLNN | Clene Inc. | Consumer Defensive | $65.0M |
| 8 | LFVN | LifeVantage Corporation | Consumer Defensive | $65.0M |
| 9 | DDC | DDC Enterprise Limited | Consumer Defensive | $33.9M |

### 060. Coal - 1 tickers (Non-priority / later batch)
| Rank | Ticker | Company | Sector | Market Cap |
|------|--------|---------|--------|------------|
| 1 | SXC | SunCoke Energy, Inc. | Energy | $638.9M |

### 061. Oil & Gas Equipment & Services - 9 tickers (Non-priority / later batch)
| Rank | Ticker | Company | Sector | Market Cap |
|------|--------|---------|--------|------------|
| 1 | SEI | Solaris Energy Infrastructure, Inc. | Energy | $5.5B |
| 2 | OII | Oceaneering International, Inc. | Energy | $3.8B |
| 3 | EFXT | Enerflex Ltd. | Energy | $3.3B |
| 4 | TTI | TETRA Technologies, Inc. | Energy | $1.4B |
| 5 | NPKI | NPK International Inc. | Energy | $1.3B |
| 6 | NGS | Natural Gas Services Group, Inc. | Energy | $535.1M |
| 7 | NOA | North American Construction Group Ltd. | Energy | $414.6M |
| 8 | SND | Smart Sand, Inc. | Energy | $222.7M |
| 9 | DWSN | Dawson Geophysical Company | Energy | $108.4M |

### 062. Oil & Gas Midstream - 1 tickers (Non-priority / later batch)
| Rank | Ticker | Company | Sector | Market Cap |
|------|--------|---------|--------|------------|
| 1 | GEL | Genesis Energy, L.P. | Energy | $1.9B |

### 063. Oil & Gas Refining & Marketing - 1 tickers (Non-priority / later batch)
| Rank | Ticker | Company | Sector | Market Cap |
|------|--------|---------|--------|------------|
| 1 | AMTX | Aemetis, Inc. | Energy | $158.3M |

### 064. Solar - 15 tickers (Non-priority / later batch)
| Rank | Ticker | Company | Sector | Market Cap |
|------|--------|---------|--------|------------|
| 1 | FSLR | First Solar, Inc. | Energy | $24.5B |
| 2 | ENPH | Enphase Energy, Inc. | Energy | $4.9B |
| 3 | RUN | Sunrun Inc. | Energy | $3.4B |
| 4 | SEDG | SolarEdge Technologies, Inc. | Energy | $2.5B |
| 5 | SHLS | Shoals Technologies Group, Inc. | Energy | $1.4B |
| 6 | CSIQ | Canadian Solar Inc. | Energy | $1.3B |
| 7 | ARRY | Array Technologies, Inc. | Energy | $1.3B |
| 8 | TOYO | TOYO Co., Ltd. | Technology | $438.3M |
| 9 | TYGO | Tigo Energy, Inc. | Energy | $312.8M |
| 10 | SPWR | SunPower Inc. | Energy | $84.5M |
| 11 | FTCI | FTC Solar, Inc. | Energy | $67.2M |
| 12 | SPRU | Spruce Power Holding Corporation | Energy | $56.5M |
| 13 | VIVO | VivoPower PLC | Energy | $52.6M |
| 14 | ZEO | Zeo Energy Corp. | Technology | $47.3M |
| 15 | PN | Skycorp Solar Group Limited | Technology | $5.7M |

### 065. Uranium - 13 tickers (Non-priority / later batch)
| Rank | Ticker | Company | Sector | Market Cap |
|------|--------|---------|--------|------------|
| 1 | CCJ | Cameco Corporation | Energy | $50.9B |
| 2 | NXE | NexGen Energy Ltd. | Energy | $8.1B |
| 3 | UEC | Uranium Energy Corp. | Energy | $7.6B |
| 4 | UUUU | Energy Fuels Inc. | Energy | $5.2B |
| 5 | LEU | Centrus Energy Corp. | Energy | $3.8B |
| 6 | DNN | Denison Mines Corp. | Energy | $3.3B |
| 7 | URG | Ur-Energy Inc. | Energy | $770.8M |
| 8 | ISOU | IsoEnergy Ltd. | Energy | $759.4M |
| 9 | UROY | Uranium Royalty Corp. | Energy | $615.2M |
| 10 | EU | enCore Energy Corp. | Energy | $320.5M |
| 11 | NUCL | Eagle Nuclear Energy Corp. | Energy | $305.9M |
| 12 | AEC | Anfield Energy Inc. Common Shares | Energy | $91.3M |
| 13 | JAGU | Jaguar Uranium Corp. Class A | Energy | $21.2M |

### 066. Asset Management - 13 tickers (Non-priority / later batch)
| Rank | Ticker | Company | Sector | Market Cap |
|------|--------|---------|--------|------------|
| 1 | SPY | State Street SPDR S&P 500 ETF Trust | Financial Services | $762.7B |
| 2 | QQQ | Invesco QQQ Trust, Series 1 | Financial Services | $437.8B |
| 3 | BK | The Bank of New York Mellon Corporation | Financial Services | $91.6B |
| 4 | AMP | Ameriprise Financial, Inc. | Financial Services | $42.3B |
| 5 | STT | State Street Corporation | Financial Services | $41.6B |
| 6 | CRBG | Corebridge Financial, Inc. | Financial Services | $11.9B |
| 7 | BBUC | Brookfield Business Corporation | Financial Services | $2.3B |
| 8 | GENB | Generate Biomedicines, Inc. | Financial Services | $2.0B |
| 9 | INV | Innventure, Inc. | Financial Services | $368.5M |
| 10 | WTF | Waton Financial Limited Ordinary Shares | Financial Services | $207.4M |
| 11 | TONX | TON Strategy Co. | Financial Services | $196.2M |
| 12 | BMHL | Bluemount Holdings Limited | Financial Services | $100.5M |
| 13 | HSDT | Solana Company | Financial Services | $84.6M |

### 067. Asset Management - Cryptocurrency - 2 tickers (Non-priority / later batch)
| Rank | Ticker | Company | Sector | Market Cap |
|------|--------|---------|--------|------------|
| 1 | CNCK | Coincheck Group N.V. | Financial Services | $280.0M |
| 2 | FLD | Fold Holdings Inc | Financial Services | $75.2M |

### 068. Banks - Regional - 1 tickers (Non-priority / later batch)
| Rank | Ticker | Company | Sector | Market Cap |
|------|--------|---------|--------|------------|
| 1 | DB | Deutsche Bank AG | Financial Services | $60.8B |

### 069. Capital Markets - 6 tickers (Non-priority / later batch)
| Rank | Ticker | Company | Sector | Market Cap |
|------|--------|---------|--------|------------|
| 1 | CSHR | CoinShares PLC Ordinary Shares | Financial Services | $402.0M |
| 2 | BRR | ProCap Financial, Inc. | Financial Services | $153.5M |
| 3 | SIEB | Siebert Financial Corp. | Financial Services | $72.1M |
| 4 | SLNH | Soluna Holdings, Inc. | Financial Services | $51.7M |
| 5 | STEX | Streamex Corp. | Financial Services | $35.5M |
| 6 | BTM | Bitcoin Depot Inc. | Financial Services | $17.9M |

### 070. Credit Services - 1 tickers (Non-priority / later batch)
| Rank | Ticker | Company | Sector | Market Cap |
|------|--------|---------|--------|------------|
| 1 | VRM | Vroom, Inc. | Financial Services | $61.2M |

### 071. Financial - Capital Markets - 41 tickers (Non-priority / later batch)
| Rank | Ticker | Company | Sector | Market Cap |
|------|--------|---------|--------|------------|
| 1 | GS | The Goldman Sachs Group, Inc. | Financial Services | $279.0B |
| 2 | SCHW | The Charles Schwab Corporation | Financial Services | $156.8B |
| 3 | HOOD | Robinhood Markets, Inc. | Financial Services | $70.5B |
| 4 | CRCL | Circle Internet Group | Financial Services | $33.1B |
| 5 | LPLA | LPL Financial Holdings Inc. | Financial Services | $23.6B |
| 6 | TW | Tradeweb Markets Inc. | Financial Services | $23.3B |
| 7 | IREN | IREN Limited | Financial Services | $20.2B |
| 8 | EVR | Evercore Inc. | Financial Services | $13.5B |
| 9 | HUT | Hut 8 Corp. | Financial Services | $12.1B |
| 10 | VIRT | Virtu Financial, Inc. | Financial Services | $11.0B |
| 11 | JEF | Jefferies Financial Group Inc. | Financial Services | $10.7B |
| 12 | GLXY | Galaxy Digital | Financial Services | $10.4B |
| 13 | HLI | Houlihan Lokey, Inc. | Financial Services | $10.4B |
| 14 | XP | XP Inc. | Financial Services | $9.8B |
| 15 | WULF | TeraWulf Inc. | Financial Services | $9.3B |
| 16 | RIOT | Riot Platforms, Inc. | Financial Services | $9.3B |
| 17 | SNEX | StoneX Group Inc. | Financial Services | $9.3B |
| 18 | FRHC | Freedom Holding Corp. | Financial Services | $8.6B |
| 19 | CIFR | Cipher Mining Inc. | Financial Services | $8.2B |
| 20 | FIGR | Figure Technology Solutions, Inc. Class A Common Stock | Financial Services | $7.2B |
| 21 | PIPR | Piper Sandler Companies | Financial Services | $5.7B |
| 22 | BGC | BGC Group, Inc | Financial Services | $5.2B |
| 23 | MKTX | MarketAxess Holdings Inc. | Financial Services | $5.0B |
| 24 | MARA | Marathon Digital Holdings, Inc. | Financial Services | $4.8B |
| 25 | MIAX | Miami International Holdings, Inc. | Financial Services | $4.8B |
| 26 | MC | Moelis & Company | Financial Services | $4.8B |
| 27 | LAZ | Lazard Ltd | Financial Services | $4.5B |
| 28 | MRX | Marex Group plc Ordinary Shares | Financial Services | $4.0B |
| 29 | PJT | PJT Partners Inc. | Financial Services | $4.0B |
| 30 | ETOR | eToro Group Ltd. | Financial Services | $3.2B |
| 31 | BITF | Bitfarms Ltd. | Financial Services | $1.3B |
| 32 | ABTC | American Bitcoin Corp | Financial Services | $1.1B |
| 33 | GOLD | Gold.com, Inc. | Financial Services | $1.1B |
| 34 | DFIN | Donnelley Financial Solutions, Inc. | Financial Services | $1.0B |
| 35 | OPY | Oppenheimer Holdings Inc. | Financial Services | $1.0B |
| 36 | GEMI | Gemini Space Station, Inc. Class A Common Stock | Financial Services | $615.9M |
| 37 | BTGO | BitGo Holdings, Inc. | Financial Services | $459.5M |
| 38 | FUFU | BitFuFu Inc. | Financial Services | $363.2M |
| 39 | AXG | Solowin Holdings Ordinary Share | Financial Services | $157.0M |
| 40 | SRL | Scully Royalty Ltd. | Financial Services | $93.3M |
| 41 | DOMH | Dominari Holdings Inc. | Financial Services | $55.9M |

### 072. Financial - Conglomerates - 3 tickers (Non-priority / later batch)
| Rank | Ticker | Company | Sector | Market Cap |
|------|--------|---------|--------|------------|
| 1 | VOYA | Voya Financial, Inc. | Financial Services | $7.3B |
| 2 | PACS | PACS Group, Inc. | Financial Services | $6.5B |
| 3 | RILY | BRC Group Holdings, Inc. | Financial Services | $323.4M |

### 073. Financial - Credit Services - 4 tickers (Non-priority / later batch)
| Rank | Ticker | Company | Sector | Market Cap |
|------|--------|---------|--------|------------|
| 1 | SEZL | Sezzle Inc. | Financial Services | $3.4B |
| 2 | NRDS | NerdWallet, Inc. | Financial Services | $602.8M |
| 3 | LPRO | Open Lending Corporation | Financial Services | $218.7M |
| 4 | AIOS | AIOS Tech Inc. | Financial Services | $4.0M |

### 074. Insurance - Brokers - 11 tickers (Non-priority / later batch)
| Rank | Ticker | Company | Sector | Market Cap |
|------|--------|---------|--------|------------|
| 1 | MRSH | Marsh & McLennan Companies, Inc. | Financial Services | $78.7B |
| 2 | AON | Aon plc | Financial Services | $67.6B |
| 3 | AJG | Arthur J. Gallagher & Co. | Financial Services | $50.7B |
| 4 | WTW | Willis Towers Watson Public Limited Company | Financial Services | $23.7B |
| 5 | BRO | Brown & Brown, Inc. | Financial Services | $18.9B |
| 6 | CRVL | CorVel Corporation | Financial Services | $3.0B |
| 7 | BWIN | The Baldwin Insurance Group, Inc. | Financial Services | $1.5B |
| 8 | CRD.A | Crawford & Company | Financial Services | $487.3M |
| 9 | CRD.B | Crawford & Company | Financial Services | $467.6M |
| 10 | TWFG | TWFG, Inc. Common Stock | Financial Services | $273.5M |
| 11 | EHTH | eHealth, Inc. | Financial Services | $58.7M |

### 075. Insurance - Diversified - 3 tickers (Non-priority / later batch)
| Rank | Ticker | Company | Sector | Market Cap |
|------|--------|---------|--------|------------|
| 1 | EQH | Equitable Holdings, Inc. | Financial Services | $11.4B |
| 2 | GSHD | Goosehead Insurance, Inc | Financial Services | $1.5B |
| 3 | XZO | Exzeo Group, Inc. | Financial Services | $1.3B |

### 076. Insurance - Life - 7 tickers (Non-priority / later batch)
| Rank | Ticker | Company | Sector | Market Cap |
|------|--------|---------|--------|------------|
| 1 | MFC | Manulife Financial Corporation | Financial Services | $67.1B |
| 2 | PRU | Prudential Financial, Inc. | Financial Services | $35.6B |
| 3 | PRI | Primerica, Inc. | Financial Services | $8.5B |
| 4 | JXN | Jackson Financial Inc. | Financial Services | $7.6B |
| 5 | BHF | Brighthouse Financial, Inc. | Financial Services | $3.5B |
| 6 | LIFE | Ethos Technologies Inc. | Financial Services | $1.6B |
| 7 | CIA | Citizens, Inc. | Financial Services | $259.3M |

### 077. Insurance - Property & Casualty - 3 tickers (Non-priority / later batch)
| Rank | Ticker | Company | Sector | Market Cap |
|------|--------|---------|--------|------------|
| 1 | SLDE | Slide Insurance Holdings, Inc. Common Stock | Financial Services | $2.1B |
| 2 | ROOT | Root, Inc. | Financial Services | $830.3M |
| 3 | KINS | Kingstone Companies, Inc. | Financial Services | $212.6M |

### 078. Insurance - Reinsurance - 1 tickers (Non-priority / later batch)
| Rank | Ticker | Company | Sector | Market Cap |
|------|--------|---------|--------|------------|
| 1 | RGA | Reinsurance Group of America, Incorporated | Financial Services | $13.8B |

### 079. Insurance - Specialty - 1 tickers (Non-priority / later batch)
| Rank | Ticker | Company | Sector | Market Cap |
|------|--------|---------|--------|------------|
| 1 | RYAN | Ryan Specialty Holdings, Inc. | Financial Services | $4.1B |

### 080. Investment - Banking & Investment Services - 2 tickers (Non-priority / later batch)
| Rank | Ticker | Company | Sector | Market Cap |
|------|--------|---------|--------|------------|
| 1 | IBKR | Interactive Brokers Group, Inc. | Financial Services | $145.5B |
| 2 | AURE | Aurelion Inc. | Financial Services | $686,631 |

### 081. Shell Companies - 3 tickers (Non-priority / later batch)
| Rank | Ticker | Company | Sector | Market Cap |
|------|--------|---------|--------|------------|
| 1 | UMAC | Unusual Machines, Inc. | Financial Services | $549.1M |
| 2 | CUB | Lionheart Holdings | Financial Services | $331.2M |
| 3 | CPBI | Central Plains Bancshares, Inc. Common Stock | Financial Services | $73.9M |

### 082. Biotechnology - 393 tickers (Non-priority / later batch)
| Rank | Ticker | Company | Sector | Market Cap |
|------|--------|---------|--------|------------|
| 1 | VRTX | Vertex Pharmaceuticals Incorporated | Healthcare | $113.8B |
| 2 | REGN | Regeneron Pharmaceuticals, Inc. | Healthcare | $74.5B |
| 3 | ALNY | Alnylam Pharmaceuticals, Inc. | Healthcare | $39.0B |
| 4 | RVMD | Revolution Medicines, Inc. | Healthcare | $31.0B |
| 5 | INSM | Insmed Incorporated | Healthcare | $25.1B |
| 6 | UTHR | United Therapeutics Corporation | Healthcare | $24.7B |
| 7 | RPRX | Royalty Pharma plc | Healthcare | $22.2B |
| 8 | MRNA | Moderna, Inc. | Healthcare | $21.1B |
| 9 | ROIV | Roivant Sciences Ltd. | Healthcare | $21.0B |
| 10 | INCY | Incyte Corporation | Healthcare | $19.8B |
| 11 | SMMT | Summit Therapeutics Inc. | Healthcare | $14.7B |
| 12 | ASND | Ascendis Pharma A/S | Healthcare | $14.7B |
| 13 | JAZZ | Jazz Pharmaceuticals plc | Healthcare | $14.3B |
| 14 | BBIO | BridgeBio Pharma, Inc. | Healthcare | $12.9B |
| 15 | IONS | Ionis Pharmaceuticals, Inc. | Healthcare | $12.5B |
| 16 | EXEL | Exelixis, Inc. | Healthcare | $12.4B |
| 17 | MDGL | Madrigal Pharmaceuticals, Inc. | Healthcare | $11.8B |
| 18 | AXSM | Axsome Therapeutics, Inc. | Healthcare | $11.5B |
| 19 | ARWR | Arrowhead Pharmaceuticals, Inc. | Healthcare | $11.1B |
| 20 | BMRN | BioMarin Pharmaceutical Inc. | Healthcare | $10.2B |
| 21 | CYTK | Cytokinetics, Incorporated | Healthcare | $9.3B |
| 22 | KRYS | Krystal Biotech, Inc. | Healthcare | $9.1B |
| 23 | IBRX | ImmunityBio, Inc. | Healthcare | $8.5B |
| 24 | HALO | Halozyme Therapeutics, Inc. | Healthcare | $8.4B |
| 25 | PCVX | Vaxcyte, Inc. | Healthcare | $7.8B |
| 26 | NUVL | Nuvalent, Inc. | Healthcare | $7.5B |
| 27 | TECH | Bio-Techne Corporation | Healthcare | $7.4B |
| 28 | PRAX | Praxis Precision Medicines, Inc. | Healthcare | $7.3B |
| 29 | KYMR | Kymera Therapeutics, Inc. | Healthcare | $6.9B |
| 30 | ACLX | Arcellx, Inc. | Healthcare | $6.7B |
| 31 | TGTX | TG Therapeutics, Inc. | Healthcare | $6.5B |
| 32 | PTGX | Protagonist Therapeutics, Inc. | Healthcare | $6.4B |
| 33 | ALKS | Alkermes plc | Healthcare | $6.4B |
| 34 | RYTM | Rhythm Pharmaceuticals, Inc. | Healthcare | $6.3B |
| 35 | PTCT | PTC Therapeutics, Inc. | Healthcare | $6.2B |
| 36 | CGON | CG Oncology, Inc. Common stock | Healthcare | $6.1B |
| 37 | CELC | Celcuity Inc. | Healthcare | $6.0B |
| 38 | COGT | Cogent Biosciences, Inc. | Healthcare | $5.9B |
| 39 | SRRK | Scholar Rock Holding Corporation | Healthcare | $5.9B |
| 40 | IMVT | Immunovant, Inc. | Healthcare | $5.8B |
| 41 | CORT | Corcept Therapeutics Incorporated | Healthcare | $5.5B |
| 42 | MIRM | Mirum Pharmaceuticals, Inc. | Healthcare | $5.4B |
| 43 | APLS | Apellis Pharmaceuticals, Inc. | Healthcare | $5.3B |
| 44 | APGE | Apogee Therapeutics, Inc. | Healthcare | $5.1B |
| 45 | CRSP | CRISPR Therapeutics AG | Healthcare | $5.1B |
| 46 | LQDA | Liquidia Corporation | Healthcare | $5.0B |
| 47 | TERN | Terns Pharmaceuticals, Inc. | Healthcare | $4.8B |
| 48 | CAI | Caris Life Sciences, Inc. | Healthcare | $4.7B |
| 49 | FOLD | Amicus Therapeutics, Inc. | Healthcare | $4.5B |
| 50 | NAMS | NewAmsterdam Pharma Company N.V. | Healthcare | $4.5B |
| 51 | SYRE | Spyre Therapeutics, Inc. | Healthcare | $4.5B |
| 52 | KNSA | Kiniksa Pharmaceuticals, Ltd. | Healthcare | $4.5B |
| 53 | LGND | Ligand Pharmaceuticals Incorporated | Healthcare | $4.4B |
| 54 | XENE | Xenon Pharmaceuticals Inc. | Healthcare | $4.3B |
| 55 | MANE | Veradermics, Incorporated | Healthcare | $4.3B |
| 56 | TVTX | Travere Therapeutics, Inc. | Healthcare | $4.0B |
| 57 | CRNX | Crinetics Pharmaceuticals, Inc. | Healthcare | $3.9B |
| 58 | CPRX | Catalyst Pharmaceuticals, Inc. | Healthcare | $3.8B |
| 59 | ACAD | ACADIA Pharmaceuticals Inc. | Healthcare | $3.7B |
| 60 | EWTX | Edgewise Therapeutics, Inc. | Healthcare | $3.7B |
| 61 | VKTX | Viking Therapeutics, Inc. | Healthcare | $3.6B |
| 62 | DNTH | Dianthus Therapeutics, Inc. | Healthcare | $3.6B |
| 63 | BEAM | Beam Therapeutics Inc. | Healthcare | $3.2B |
| 64 | ERAS | Erasca, Inc. | Healthcare | $3.2B |
| 65 | VCYT | Veracyte, Inc. | Healthcare | $3.2B |
| 66 | DNLI | Denali Therapeutics Inc. | Healthcare | $3.1B |
| 67 | DYN | Dyne Therapeutics, Inc. | Healthcare | $3.0B |
| 68 | ALMS | Alumis Inc. Common Stock | Healthcare | $2.9B |
| 69 | KLRA | Kailera Therapeutics, Inc. | Healthcare | $2.9B |
| 70 | ANAB | AnaptysBio, Inc. | Healthcare | $2.8B |
| 71 | SLNO | Soleno Therapeutics, Inc. | Healthcare | $2.8B |
| 72 | TNGX | Tango Therapeutics, Inc. | Healthcare | $2.7B |
| 73 | RARE | Ultragenyx Pharmaceutical Inc. | Healthcare | $2.6B |
| 74 | VERA | Vera Therapeutics, Inc. | Healthcare | $2.6B |
| 75 | IRON | Disc Medicine, Inc. | Healthcare | $2.6B |
| 76 | ARQT | Arcutis Biotherapeutics, Inc. | Healthcare | $2.6B |
| 77 | ELVN | Enliven Therapeutics, Inc. | Healthcare | $2.6B |
| 78 | TARS | Tarsus Pharmaceuticals, Inc. | Healthcare | $2.6B |
| 79 | RCUS | Arcus Biosciences, Inc. | Healthcare | $2.5B |
| 80 | RLAY | Relay Therapeutics, Inc. | Healthcare | $2.5B |
| 81 | IDYA | IDEAYA Biosciences, Inc. | Healthcare | $2.5B |
| 82 | ORKA | Oruka Therapeutics, Inc. | Healthcare | $2.4B |
| 83 | DFTX | Definium Therapeutics, Inc. | Healthcare | $2.3B |
| 84 | DAWN | Day One Biopharmaceuticals, Inc. | Healthcare | $2.2B |
| 85 | ADPT | Adaptive Biotechnologies Corporation | Healthcare | $2.2B |
| 86 | CLDX | Celldex Therapeutics, Inc. | Healthcare | $2.1B |
| 87 | TRVI | Trevi Therapeutics, Inc. | Healthcare | $2.1B |
| 88 | KOD | Kodiak Sciences Inc. | Healthcare | $2.1B |
| 89 | AUPH | Aurinia Pharmaceuticals Inc. | Healthcare | $2.1B |
| 90 | PHVS | Pharvaris N.V. | Healthcare | $2.0B |
| 91 | STOK | Stoke Therapeutics, Inc. | Healthcare | $2.0B |
| 92 | SRPT | Sarepta Therapeutics, Inc. | Healthcare | $2.0B |
| 93 | OCUL | Ocular Therapeutix, Inc. | Healthcare | $2.0B |
| 94 | IMNM | Immunome, Inc. | Healthcare | $2.0B |
| 95 | ADMA | ADMA Biologics, Inc. | Healthcare | $1.9B |
| 96 | MLYS | Mineralys Therapeutics, Inc. | Healthcare | $1.9B |
| 97 | TYRA | Tyra Biosciences, Inc. | Healthcare | $1.9B |
| 98 | BCRX | BioCryst Pharmaceuticals, Inc. | Healthcare | $1.8B |
| 99 | SION | Sionna Therapeutics, Inc. | Healthcare | $1.8B |
| 100 | QURE | uniQure N.V. | Healthcare | $1.8B |
| 101 | SNDX | Syndax Pharmaceuticals, Inc. | Healthcare | $1.8B |
| 102 | ZYME | Zymeworks Inc. | Healthcare | $1.8B |
| 103 | HRMY | Harmony Biosciences Holdings, Inc. | Healthcare | $1.7B |
| 104 | TSHA | Taysha Gene Therapies, Inc. | Healthcare | $1.7B |
| 105 | AGIO | Agios Pharmaceuticals, Inc. | Healthcare | $1.7B |
| 106 | VCEL | Vericel Corporation | Healthcare | $1.7B |
| 107 | NUVB | Nuvation Bio Inc. | Healthcare | $1.7B |
| 108 | INVA | Innoviva, Inc. | Healthcare | $1.7B |
| 109 | NTLA | Intellia Therapeutics, Inc. | Healthcare | $1.7B |
| 110 | ARDX | Ardelyx, Inc. | Healthcare | $1.6B |
| 111 | INBX | Inhibrx Biosciences, Inc. | Healthcare | $1.6B |
| 112 | VIR | Vir Biotechnology, Inc. | Healthcare | $1.6B |
| 113 | NVAX | Novavax, Inc. | Healthcare | $1.6B |
| 114 | NKTR | Nektar Therapeutics | Healthcare | $1.5B |
| 115 | IMTX | Immatics N.V. | Healthcare | $1.5B |
| 116 | ABCL | AbCellera Biologics Inc. | Healthcare | $1.5B |
| 117 | PVLA | Palvella Therapeutics, Inc. | Healthcare | $1.5B |
| 118 | GHRS | GH Research PLC | Healthcare | $1.5B |
| 119 | URGN | UroGen Pharma Ltd. | Healthcare | $1.5B |
| 120 | CAPR | Capricor Therapeutics, Inc. | Healthcare | $1.4B |
| 121 | VRDN | Viridian Therapeutics, Inc. | Healthcare | $1.4B |
| 122 | MAZE | Maze Therapeutics, Inc. | Healthcare | $1.4B |
| 123 | RXRX | Recursion Pharmaceuticals, Inc. | Healthcare | $1.4B |
| 124 | NRIX | Nurix Therapeutics, Inc. | Healthcare | $1.4B |
| 125 | KALV | KalVista Pharmaceuticals, Inc. | Healthcare | $1.4B |
| 126 | RAPP | Rapport Therapeutics, Inc. Common Stock | Healthcare | $1.4B |
| 127 | AVBP | ArriVent BioPharma, Inc. Common Stock | Healthcare | $1.3B |
| 128 | CRVS | Corvus Pharmaceuticals, Inc. | Healthcare | $1.3B |
| 129 | MLTX | MoonLake Immunotherapeutics | Healthcare | $1.3B |
| 130 | WVE | Wave Life Sciences Ltd. | Healthcare | $1.3B |
| 131 | MRVI | Maravai LifeSciences Holdings, Inc. | Healthcare | $1.3B |
| 132 | IOVA | Iovance Biotherapeutics, Inc. | Healthcare | $1.3B |
| 133 | GLUE | Monte Rosa Therapeutics, Inc. | Healthcare | $1.2B |
| 134 | MBX | MBX Biosciences, Inc. Common Stock | Healthcare | $1.2B |
| 135 | BCAX | Bicara Therapeutics Inc. Common Stock | Healthcare | $1.2B |
| 136 | PGEN | Precigen, Inc. | Healthcare | $1.2B |
| 137 | OLMA | Olema Pharmaceuticals, Inc. | Healthcare | $1.2B |
| 138 | AMLX | Amylyx Pharmaceuticals, Inc. | Healthcare | $1.2B |
| 139 | EYPT | EyePoint Pharmaceuticals, Inc. | Healthcare | $1.1B |
| 140 | SEPN | Septerna, Inc. | Healthcare | $1.1B |
| 141 | XERS | Xeris Biopharma Holdings, Inc. | Healthcare | $1.1B |
| 142 | LXRX | Lexicon Pharmaceuticals, Inc. | Healthcare | $1.1B |
| 143 | OMER | Omeros Corporation | Healthcare | $1.1B |
| 144 | AKTS | Aktis Oncology, Inc. | Healthcare | $1.1B |
| 145 | SVRA | Savara Inc. | Healthcare | $1.0B |
| 146 | MNKD | MannKind Corporation | Healthcare | $1.0B |
| 147 | VTYX | Ventyx Biosciences, Inc. | Healthcare | $1.0B |
| 148 | PHAT | Phathom Pharmaceuticals, Inc. | Healthcare | $999.3M |
| 149 | DSGN | Design Therapeutics, Inc. | Healthcare | $986.2M |
| 150 | BHVN | Biohaven Ltd. | Healthcare | $974.0M |
| 151 | RAPT | RAPT Therapeutics, Inc. | Healthcare | $959.3M |
| 152 | XNCR | Xencor, Inc. | Healthcare | $922.3M |
| 153 | ORIC | ORIC Pharmaceuticals, Inc. | Healthcare | $914.1M |
| 154 | SANA | Sana Biotechnology, Inc. | Healthcare | $907.2M |
| 155 | MGTX | MeiraGTx Holdings plc | Healthcare | $906.1M |
| 156 | GERN | Geron Corporation | Healthcare | $898.1M |
| 157 | LBRX | LB Pharmaceuticals Inc Common Stock | Healthcare | $892.6M |
| 158 | JANX | Janux Therapeutics, Inc. | Healthcare | $878.8M |
| 159 | DRTS | Alpha Tau Medical Ltd. | Healthcare | $869.5M |
| 160 | KURA | Kura Oncology, Inc. | Healthcare | $859.2M |
| 161 | SPRY | ARS Pharmaceuticals, Inc. | Healthcare | $856.9M |
| 162 | ZBIO | Zenas BioPharma, Inc. | Healthcare | $855.4M |
| 163 | TBPH | Theravance Biopharma, Inc. | Healthcare | $849.6M |
| 164 | ABUS | Arbutus Biopharma Corporation | Healthcare | $848.8M |
| 165 | SPTX | Seaport Therapeutics, Inc. Common Stock | Healthcare | $845.8M |
| 166 | ABSI | Absci Corporation | Healthcare | $834.9M |
| 167 | JBIO | Jade Biosciences, Inc. | Healthcare | $823.1M |
| 168 | ETON | Eton Pharmaceuticals, Inc. | Healthcare | $810.6M |
| 169 | SGP | SpyGlass Pharma, Inc. Common Stock | Healthcare | $806.9M |
| 170 | ANRO | Alto Neuroscience, Inc. | Healthcare | $786.8M |
| 171 | CLYM | Climb Bio, Inc. | Healthcare | $761.6M |
| 172 | SLS | SELLAS Life Sciences Group, Inc. | Healthcare | $743.5M |
| 173 | GYRE | Gyre Therapeutics, Inc. | Healthcare | $708.1M |
| 174 | BIOA | BioAge Labs, Inc. | Healthcare | $684.8M |
| 175 | DRUG | Bright Minds Biosciences Inc. | Healthcare | $657.0M |
| 176 | ZVRA | Zevra Therapeutics, Inc. | Healthcare | $653.2M |
| 177 | BBOT | BridgeBio Oncology Therapeutics Inc. | Healthcare | $651.3M |
| 178 | ANNX | Annexon, Inc. | Healthcare | $650.6M |
| 179 | CTMX | CytomX Therapeutics, Inc. | Healthcare | $624.0M |
| 180 | ARVN | Arvinas, Inc. | Healthcare | $617.4M |
| 181 | SLDB | Solid Biosciences Inc. | Healthcare | $601.5M |
| 182 | PRME | Prime Medicine, Inc. | Healthcare | $596.0M |
| 183 | CRMD | CorMedix Inc. | Healthcare | $589.1M |
| 184 | IMMX | Immix Biopharma, Inc. | Healthcare | $580.0M |
| 185 | ALLO | Allogene Therapeutics, Inc. | Healthcare | $560.9M |
| 186 | RLMD | Relmada Therapeutics, Inc. | Healthcare | $546.3M |
| 187 | DNA | Ginkgo Bioworks Holdings, Inc. | Healthcare | $544.8M |
| 188 | RIGL | Rigel Pharmaceuticals, Inc. | Healthcare | $543.4M |
| 189 | FDMT | 4D Molecular Therapeutics, Inc. | Healthcare | $540.5M |
| 190 | RGNX | REGENXBIO Inc. | Healthcare | $528.6M |
| 191 | MDXG | MiMedx Group, Inc. | Healthcare | $527.3M |
| 192 | PROK | ProKidney Corp. | Healthcare | $515.3M |
| 193 | CTNM | Contineum Therapeutics, Inc. Class A Common Stock | Healthcare | $510.7M |
| 194 | AURA | Aura Biosciences, Inc. | Healthcare | $509.1M |
| 195 | CBIO | Crescent Biopharma, Inc. | Healthcare | $509.0M |
| 196 | XOMA | XOMA Royalty Corp. | Healthcare | $506.4M |
| 197 | OCGN | Ocugen, Inc. | Healthcare | $497.6M |
| 198 | PRTA | Prothena Corporation plc | Healthcare | $493.7M |
| 199 | NGNE | Neurogene Inc. | Healthcare | $492.5M |
| 200 | ASMB | Assembly Biosciences, Inc. | Healthcare | $489.8M |
| 201 | UPB | Upstream Bio, Inc. | Healthcare | $487.1M |
| 202 | CADL | Candel Therapeutics, Inc. | Healthcare | $478.7M |
| 203 | LYEL | Lyell Immunopharma, Inc. | Healthcare | $449.2M |
| 204 | KYTX | Kyverna Therapeutics, Inc. | Healthcare | $448.0M |
| 205 | LXEO | Lexeo Therapeutics, Inc. Common Stock | Healthcare | $447.6M |
| 206 | AVIR | Atea Pharmaceuticals, Inc. | Healthcare | $438.2M |
| 207 | ADCT | ADC Therapeutics S.A. | Healthcare | $436.3M |
| 208 | KROS | Keros Therapeutics, Inc. | Healthcare | $433.6M |
| 209 | MNPR | Monopar Therapeutics Inc. | Healthcare | $410.6M |
| 210 | RCKT | Rocket Pharmaceuticals, Inc. | Healthcare | $397.5M |
| 211 | VNDA | Vanda Pharmaceuticals Inc. | Healthcare | $386.1M |
| 212 | OVID | Ovid Therapeutics Inc. | Healthcare | $378.5M |
| 213 | FULC | Fulcrum Therapeutics, Inc. | Healthcare | $376.6M |
| 214 | NAUT | Nautilus Biotechnology, Inc. | Healthcare | $372.3M |
| 215 | IRD | Opus Genetics, Inc. | Healthcare | $369.9M |
| 216 | YDES | YD Bio Limited Ordinary Shares | Healthcare | $366.0M |
| 217 | PBYI | Puma Biotechnology, Inc. | Healthcare | $360.4M |
| 218 | LRMR | Larimar Therapeutics, Inc. | Healthcare | $353.4M |
| 219 | NMRA | Neumora Therapeutics, Inc. Common Stock | Healthcare | $352.0M |
| 220 | CABA | Cabaletta Bio, Inc. | Healthcare | $349.4M |
| 221 | STRO | Sutro Biopharma, Inc. | Healthcare | $347.6M |
| 222 | GLSI | Greenwich LifeSciences, Inc. | Healthcare | $342.3M |
| 223 | DMAC | DiaMedica Therapeutics Inc. | Healthcare | $340.5M |
| 224 | REPL | Replimune Group, Inc. | Healthcare | $337.7M |
| 225 | ENTA | Enanta Pharmaceuticals, Inc. | Healthcare | $337.3M |
| 226 | FBRX | Forte Biosciences, Inc. | Healthcare | $337.3M |
| 227 | LCTX | Lineage Cell Therapeutics, Inc. | Healthcare | $331.3M |
| 228 | ARMP | Armata Pharmaceuticals, Inc. | Healthcare | $329.7M |
| 229 | ABEO | Abeona Therapeutics Inc. | Healthcare | $324.0M |
| 230 | PALI | Palisade Bio, Inc. | Healthcare | $321.5M |
| 231 | EVMN | Evommune, Inc. | Healthcare | $321.4M |
| 232 | VSTM | Verastem, Inc. | Healthcare | $320.9M |
| 233 | ACHV | Achieve Life Sciences, Inc. | Healthcare | $318.8M |
| 234 | STTK | Shattuck Labs, Inc. | Healthcare | $317.1M |
| 235 | AKBA | Akebia Therapeutics, Inc. | Healthcare | $316.5M |
| 236 | RZLT | Rezolute, Inc. | Healthcare | $315.8M |
| 237 | BNTC | Benitec Biopharma Inc. | Healthcare | $310.8M |
| 238 | ZURA | Zura Bio Limited | Healthcare | $308.9M |
| 239 | NAGE | Niagen Bioscience Inc | Healthcare | $306.6M |
| 240 | ZNTL | Zentalis Pharmaceuticals, Inc. | Healthcare | $303.6M |
| 241 | NGEN | NervGen Pharma Corp. Common stock | Healthcare | $301.9M |
| 242 | NVCT | Nuvectis Pharma, Inc. | Healthcare | $289.1M |
| 243 | EDIT | Editas Medicine, Inc. | Healthcare | $286.9M |
| 244 | AVXL | Anavex Life Sciences Corp. | Healthcare | $283.6M |
| 245 | ACIU | AC Immune S.A. | Healthcare | $281.9M |
| 246 | TRDA | Entrada Therapeutics, Inc. | Healthcare | $276.4M |
| 247 | ALT | Altimmune, Inc. | Healthcare | $271.8M |
| 248 | CGEN | Compugen Ltd. | Healthcare | $267.6M |
| 249 | ARTV | Artiva Biotherapeutics, Inc. | Healthcare | $262.7M |
| 250 | CCCC | C4 Therapeutics, Inc. | Healthcare | $262.6M |
| 251 | FATE | Fate Therapeutics, Inc. | Healthcare | $261.6M |
| 252 | CMPX | Compass Therapeutics, Inc. | Healthcare | $258.6M |
| 253 | PRLD | Prelude Therapeutics Incorporated | Healthcare | $258.6M |
| 254 | RNAC | Cartesian Therapeutics, Inc. | Healthcare | $255.6M |
| 255 | EPRX | Eupraxia Pharmaceuticals Inc. | Healthcare | $254.8M |
| 256 | VYGR | Voyager Therapeutics, Inc. | Healthcare | $250.7M |
| 257 | SGMT | Sagimet Biosciences Inc. | Healthcare | $249.3M |
| 258 | FHTX | Foghorn Therapeutics Inc. | Healthcare | $248.9M |
| 259 | LENZ | LENZ Therapeutics, Inc. | Healthcare | $248.0M |
| 260 | ALEC | Alector, Inc. | Healthcare | $239.8M |
| 261 | OBIO | Orchestra BioMed Holdings, Inc. | Healthcare | $237.6M |
| 262 | ARCT | Arcturus Therapeutics Holdings Inc. | Healthcare | $234.5M |
| 263 | NKTX | Nkarta, Inc. | Healthcare | $233.8M |
| 264 | ELDN | Eledon Pharmaceuticals, Inc. | Healthcare | $233.8M |
| 265 | CDXS | Codexis, Inc. | Healthcare | $230.9M |
| 266 | SRZN | Surrozen, Inc. | Healthcare | $229.3M |
| 267 | CNTX | Context Therapeutics Inc. | Healthcare | $227.9M |
| 268 | AVTX | Avalo Therapeutics, Inc. | Healthcare | $225.2M |
| 269 | MGNX | MacroGenics, Inc. | Healthcare | $223.7M |
| 270 | ALMR | Alamar Biosciences, Inc. | Healthcare | $215.3M |
| 271 | CHRS | Coherus Oncology, Inc. | Healthcare | $209.3M |
| 272 | TENX | Tenax Therapeutics, Inc. | Healthcare | $209.3M |
| 273 | RNA | Atrium Therapeutics, Inc. | Healthcare | $203.9M |
| 274 | ELTX | Elicio Therapeutics, Inc. | Healthcare | $201.4M |
| 275 | CRBU | Caribou Biosciences, Inc. | Healthcare | $201.3M |
| 276 | FENC | Fennec Pharmaceuticals Inc. | Healthcare | $200.9M |
| 277 | TARA | Protara Therapeutics, Inc. | Healthcare | $198.7M |
| 278 | IPSC | Century Therapeutics, Inc. | Healthcare | $198.2M |
| 279 | IVVD | Invivyd, Inc. | Healthcare | $197.8M |
| 280 | WHWK | Whitehawk Therapeutics Inc | Healthcare | $193.9M |
| 281 | SLGL | Sol-Gel Technologies Ltd. | Healthcare | $188.9M |
| 282 | TNXP | Tonix Pharmaceuticals Holding Corp. | Healthcare | $188.6M |
| 283 | IMRX | Immuneering Corporation | Healthcare | $188.0M |
| 284 | QSI | Quantum-Si incorporated | Healthcare | $185.5M |
| 285 | ORMP | Oramed Pharmaceuticals Inc. | Healthcare | $180.0M |
| 286 | IFRX | InflaRx N.V. | Healthcare | $175.7M |
| 287 | UNCY | Unicycive Therapeutics, Inc. | Healthcare | $175.6M |
| 288 | MDWD | MediWound Ltd. | Healthcare | $175.2M |
| 289 | PRQR | ProQR Therapeutics N.V. | Healthcare | $168.6M |
| 290 | TNYA | Tenaya Therapeutics, Inc. | Healthcare | $166.6M |
| 291 | PYXS | Pyxis Oncology, Inc. | Healthcare | $163.4M |
| 292 | MIST | Milestone Pharmaceuticals Inc. | Healthcare | $163.2M |
| 293 | BDTX | Black Diamond Therapeutics, Inc. | Healthcare | $162.2M |
| 294 | MENS | Jyong Biotech Ltd. Ordinary Shares | Healthcare | $158.9M |
| 295 | HURA | TuHURA Biosciences, Inc. | Healthcare | $154.1M |
| 296 | PLX | Protalix BioTherapeutics, Inc. | Healthcare | $153.9M |
| 297 | HRTX | Heron Therapeutics, Inc. | Healthcare | $152.3M |
| 298 | CNTB | Connect Biopharma Holdings Limited | Healthcare | $151.5M |
| 299 | ABOS | Acumen Pharmaceuticals, Inc. | Healthcare | $150.2M |
| 300 | GALT | Galectin Therapeutics Inc. | Healthcare | $148.1M |
| 301 | SPRO | Spero Therapeutics, Inc. | Healthcare | $147.0M |
| 302 | CRBP | Corbus Pharmaceuticals Holdings, Inc. | Healthcare | $143.3M |
| 303 | AGEN | Agenus Inc. | Healthcare | $142.9M |
| 304 | HUMA | Humacyte, Inc. | Healthcare | $142.7M |
| 305 | ALPS | Alps Group Inc | Healthcare | $139.4M |
| 306 | IKT | Inhibikase Therapeutics, Inc. | Healthcare | $136.3M |
| 307 | IMDX | Insight Molecular Diagnostics Inc. | Healthcare | $133.7M |
| 308 | AARD | Aardvark Therapeutics, Inc. Common Stock | Healthcare | $133.3M |
| 309 | TTRX | Turn Therapeutics Inc. | Healthcare | $118.6M |
| 310 | IMUX | Immunic, Inc. | Healthcare | $117.4M |
| 311 | ANTX | AN2 Therapeutics, Inc. | Healthcare | $117.0M |
| 312 | PEPG | PepGen Inc. | Healthcare | $116.1M |
| 313 | CNTN | Canton Strategic Holdings Inc | Healthcare | $114.7M |
| 314 | VOR | Vor Biopharma Inc. | Healthcare | $112.9M |
| 315 | CRDF | Cardiff Oncology, Inc. | Healthcare | $112.1M |
| 316 | GNLX | Genelux Corporation | Healthcare | $111.7M |
| 317 | KRRO | Korro Bio, Inc. | Healthcare | $111.7M |
| 318 | EDSA | Edesa Biotech, Inc. | Healthcare | $110.8M |
| 319 | NTHI | Neonc Technologies Holdings, Inc. | Healthcare | $110.2M |
| 320 | ALXO | ALX Oncology Holdings Inc. | Healthcare | $110.1M |
| 321 | DTIL | Precision BioSciences, Inc. | Healthcare | $105.2M |
| 322 | ALDX | Aldeyra Therapeutics, Inc. | Healthcare | $103.1M |
| 323 | SEER | Seer, Inc. | Healthcare | $102.7M |
| 324 | ANIX | Anixa Biosciences, Inc. | Healthcare | $98.9M |
| 325 | CAMP | CAMP4 Therapeutics Corporation | Healthcare | $95.6M |
| 326 | NRXS | NeurAxis, Inc. | Healthcare | $95.1M |
| 327 | BMEA | Biomea Fusion, Inc. | Healthcare | $94.0M |
| 328 | TLSA | Tiziana Life Sciences Ltd | Healthcare | $92.7M |
| 329 | ONCY | Oncolytics Biotech Inc. | Healthcare | $90.7M |
| 330 | KLRS | Kalaris Therapeutics Inc | Healthcare | $89.6M |
| 331 | CSBR | Champions Oncology, Inc. | Healthcare | $87.1M |
| 332 | CGTX | Cognition Therapeutics, Inc. | Healthcare | $86.8M |
| 333 | VTVT | vTv Therapeutics Inc. | Healthcare | $84.0M |
| 334 | EXOZ | eXoZymes, Inc. | Healthcare | $83.8M |
| 335 | ATRA | Atara Biotherapeutics, Inc. | Healthcare | $83.5M |
| 336 | EQ | Equillium, Inc. | Healthcare | $80.6M |
| 337 | SPRB | Spruce Biosciences, Inc. | Healthcare | $77.7M |
| 338 | MCRB | Seres Therapeutics, Inc. | Healthcare | $77.1M |
| 339 | CUE | Cue Biopharma, Inc. | Healthcare | $76.9M |
| 340 | GANX | Gain Therapeutics, Inc. | Healthcare | $76.8M |
| 341 | ACET | Adicet Bio, Inc. | Healthcare | $76.3M |
| 342 | XBIT | XBiotech Inc. | Healthcare | $76.2M |
| 343 | VRCA | Verrica Pharmaceuticals Inc. | Healthcare | $76.2M |
| 344 | KPTI | Karyopharm Therapeutics Inc. | Healthcare | $76.1M |
| 345 | ICCC | ImmuCell Corporation | Healthcare | $75.8M |
| 346 | PMVP | PMV Pharmaceuticals, Inc. | Healthcare | $75.7M |
| 347 | INO | Inovio Pharmaceuticals, Inc. | Healthcare | $75.6M |
| 348 | QTTB | Q32 Bio Inc. | Healthcare | $74.2M |
| 349 | RLYB | Rallybio Corporation | Healthcare | $74.2M |
| 350 | PLRX | Pliant Therapeutics, Inc. | Healthcare | $73.1M |
| 351 | FBIO | Fortress Biotech, Inc. | Healthcare | $72.8M |
| 352 | OSTX | OS Therapies Incorporated | Healthcare | $71.9M |
| 353 | RANI | Rani Therapeutics Holdings, Inc. | Healthcare | $71.9M |
| 354 | COYA | Coya Therapeutics, Inc. | Healthcare | $71.8M |
| 355 | TCRX | TScan Therapeutics, Inc. | Healthcare | $70.2M |
| 356 | ACTU | Actuate Therapeutics Inc | Healthcare | $68.5M |
| 357 | KALA | KALA BIO, Inc. | Healthcare | $68.4M |
| 358 | MNOV | MediciNova, Inc. | Healthcare | $67.9M |
| 359 | CBUS | Cibus, Inc. | Healthcare | $65.0M |
| 360 | IMA | ImageneBio Inc | Healthcare | $64.5M |
| 361 | OKYO | OKYO Pharma Limited | Healthcare | $62.2M |
| 362 | ENTX | Entera Bio Ltd. | Healthcare | $61.5M |
| 363 | PDSB | PDS Biotechnology Corporation | Healthcare | $61.4M |
| 364 | CYPH | Cypherpunk Technologies Inc. | Healthcare | $60.6M |
| 365 | HYFT | MindWalk Holdings Corp. | Healthcare | $59.8M |
| 366 | ACRV | Acrivon Therapeutics, Inc. Common Stock | Healthcare | $59.6M |
| 367 | FLNA | Filana Therapeutics, Inc. | Healthcare | $58.0M |
| 368 | BYSI | BeyondSpring Inc. | Healthcare | $57.2M |
| 369 | INKT | MiNK Therapeutics, Inc. | Healthcare | $56.7M |
| 370 | TIL | Instil Bio, Inc. | Healthcare | $54.9M |
| 371 | KZR | Kezar Life Sciences, Inc. | Healthcare | $53.9M |
| 372 | COAG | Hemab Therapeutics Holdings, Inc. Common Stock | Healthcare | $52.0M |
| 373 | ATYR | aTyr Pharma, Inc. | Healthcare | $52.0M |
| 374 | ESLA | Estrella Immunopharma, Inc. | Healthcare | $51.6M |
| 375 | MGX | Metagenomi, Inc. Common Stock | Healthcare | $50.8M |
| 376 | MAIA | MAIA Biotechnology, Inc. | Healthcare | $50.6M |
| 377 | NRXP | NRx Pharmaceuticals, Inc. | Healthcare | $49.6M |
| 378 | XFOR | X4 Pharmaceuticals, Inc. | Healthcare | $49.5M |
| 379 | PYPD | PolyPid Ltd. | Healthcare | $46.5M |
| 380 | OKUR | OnKure Therapeutics, Inc. | Healthcare | $46.4M |
| 381 | ANVS | Annovis Bio, Inc. | Healthcare | $44.9M |
| 382 | LONA | LeonaBio, Inc. | Healthcare | $40.1M |
| 383 | NERV | Minerva Neurosciences, Inc. | Healthcare | $39.2M |
| 384 | GLTO | Galecto, Inc. | Healthcare | $38.4M |
| 385 | SABS | SAB Biotherapeutics, Inc. | Healthcare | $34.6M |
| 386 | EIKN | Eikon Therapeutics, Inc. Common Stock | Healthcare | $34.0M |
| 387 | CING | Cingulate Inc. | Healthcare | $26.9M |
| 388 | IBIO | iBio, Inc. | Healthcare | $25.4M |
| 389 | MPLT | MapLight Therapeutics, Inc. | Healthcare | $23.9M |
| 390 | LIXT | Lixte Biotechnology Holdings, Inc. | Healthcare | $23.1M |
| 391 | PTHS | Pelthos Therapeutics Inc. | Healthcare | $17.6M |
| 392 | MSLE | Satellos Bioscience Inc. Common Stock | Healthcare | $9.4M |
| 393 | DWTX | Dogwood Therapeutics, Inc. | Healthcare | $3.2M |

### 083. Drug Manufacturers - General - 12 tickers (Non-priority / later batch)
| Rank | Ticker | Company | Sector | Market Cap |
|------|--------|---------|--------|------------|
| 1 | LLY | Eli Lilly and Company | Healthcare | $932.2B |
| 2 | JNJ | Johnson & Johnson | Healthcare | $539.8B |
| 3 | ABBV | AbbVie Inc. | Healthcare | $367.4B |
| 4 | AZN | AstraZeneca PLC | Healthcare | $286.2B |
| 5 | MRK | Merck & Co., Inc. | Healthcare | $277.5B |
| 6 | AMGN | Amgen Inc. | Healthcare | $181.5B |
| 7 | GILD | Gilead Sciences, Inc. | Healthcare | $167.5B |
| 8 | PFE | Pfizer Inc. | Healthcare | $147.5B |
| 9 | BMY | Bristol-Myers Squibb Company | Healthcare | $115.3B |
| 10 | BIIB | Biogen Inc. | Healthcare | $29.4B |
| 11 | OGN | Organon & Co. | Healthcare | $3.5B |
| 12 | SCLX | Scilex Holding Company | Healthcare | $57.8M |

### 084. Drug Manufacturers - Specialty & Generic - 37 tickers (Non-priority / later batch)
| Rank | Ticker | Company | Sector | Market Cap |
|------|--------|---------|--------|------------|
| 1 | ZTS | Zoetis Inc. | Healthcare | $32.3B |
| 2 | VTRS | Viatris Inc. | Healthcare | $20.0B |
| 3 | NBIX | Neurocrine Biosciences, Inc. | Healthcare | $15.7B |
| 4 | RGC | Regencell Bioscience Holdings Limited | Healthcare | $13.0B |
| 5 | ELAN | Elanco Animal Health Incorporated | Healthcare | $10.7B |
| 6 | LNTH | Lantheus Holdings, Inc. | Healthcare | $6.3B |
| 7 | INDV | Indivior Pharmaceuticals Inc | Healthcare | $4.8B |
| 8 | AMRX | Amneal Pharmaceuticals, Inc. | Healthcare | $4.0B |
| 9 | SUPN | Supernus Pharmaceuticals, Inc. | Healthcare | $2.9B |
| 10 | BHC | Bausch Health Companies Inc. | Healthcare | $2.0B |
| 11 | ANIP | ANI Pharmaceuticals, Inc. | Healthcare | $1.8B |
| 12 | PRGO | Perrigo Company plc | Healthcare | $1.5B |
| 13 | PAHC | Phibro Animal Health Corporation | Healthcare | $1.5B |
| 14 | COLL | Collegium Pharmaceutical, Inc. | Healthcare | $1.2B |
| 15 | ALVO | Alvotech | Healthcare | $1.1B |
| 16 | HROW | Harrow Health, Inc. | Healthcare | $1.1B |
| 17 | CRON | Cronos Group Inc. | Healthcare | $1.0B |
| 18 | PCRX | Pacira BioSciences, Inc. | Healthcare | $898.4M |
| 19 | AMPH | Amphastar Pharmaceuticals, Inc. | Healthcare | $771.6M |
| 20 | IRWD | Ironwood Pharmaceuticals, Inc. | Healthcare | $673.3M |
| 21 | ESPR | Esperion Therapeutics, Inc. | Healthcare | $650.8M |
| 22 | KMDA | Kamada Ltd. | Healthcare | $486.3M |
| 23 | EBS | Emergent BioSolutions Inc. | Healthcare | $438.6M |
| 24 | EOLS | Evolus, Inc. | Healthcare | $428.1M |
| 25 | AQST | Aquestive Therapeutics, Inc. | Healthcare | $413.1M |
| 26 | SIGA | SIGA Technologies, Inc. | Healthcare | $319.2M |
| 27 | ORGO | Organogenesis Holdings Inc. | Healthcare | $310.1M |
| 28 | TKNO | Alpha Teknova, Inc. | Healthcare | $213.9M |
| 29 | EMBC | Embecta Corp. | Healthcare | $202.3M |
| 30 | LFCR | Lifecore Biomedical, Inc. | Healthcare | $171.0M |
| 31 | CRDL | Cardiol Therapeutics Inc. | Healthcare | $150.8M |
| 32 | ASRT | Assertio Holdings, Inc. | Healthcare | $145.3M |
| 33 | DERM | Journey Medical Corporation | Healthcare | $137.0M |
| 34 | CTOR | Citius Oncology, Inc. | Healthcare | $79.7M |
| 35 | CPIX | Cumberland Pharmaceuticals Inc. | Healthcare | $67.9M |
| 36 | IXHL | Incannex Healthcare Limited | Healthcare | $44.8M |
| 37 | SCYX | SCYNEXIS, Inc. | Healthcare | $39.3M |

### 085. Health Information Services - 2 tickers (Non-priority / later batch)
| Rank | Ticker | Company | Sector | Market Cap |
|------|--------|---------|--------|------------|
| 1 | FORA | Forian Inc. | Healthcare | $67.5M |
| 2 | ONMD | OneMedNet Corporation | Healthcare | $31.8M |

### 086. Medical - Care Facilities - 34 tickers (Non-priority / later batch)
| Rank | Ticker | Company | Sector | Market Cap |
|------|--------|---------|--------|------------|
| 1 | HCA | HCA Healthcare, Inc. | Healthcare | $95.3B |
| 2 | THC | Tenet Healthcare Corporation | Healthcare | $16.9B |
| 3 | SOLV | Solventum Corporation | Healthcare | $13.0B |
| 4 | DVA | DaVita Inc. | Healthcare | $12.9B |
| 5 | EHC | Encompass Health Corporation | Healthcare | $10.7B |
| 6 | UHS | Universal Health Services, Inc. | Healthcare | $10.6B |
| 7 | ENSG | The Ensign Group, Inc. | Healthcare | $10.3B |
| 8 | CHE | Chemed Corporation | Healthcare | $5.6B |
| 9 | MMED | MiniMed Group, Inc. Common Stock | Healthcare | $3.3B |
| 10 | BKD | Brookdale Senior Living Inc. | Healthcare | $3.1B |
| 11 | OPCH | Option Care Health, Inc. | Healthcare | $3.1B |
| 12 | LFST | LifeStance Health Group, Inc. | Healthcare | $3.1B |
| 13 | NHC | National HealthCare Corporation | Healthcare | $3.0B |
| 14 | ACHC | Acadia Healthcare Company, Inc. | Healthcare | $2.4B |
| 15 | SEM | Select Medical Holdings Corporation | Healthcare | $2.0B |
| 16 | MD | Pediatrix Medical Group, Inc. | Healthcare | $1.9B |
| 17 | ASTH | Astrana Health, Inc. | Healthcare | $1.9B |
| 18 | ADUS | Addus HomeCare Corporation | Healthcare | $1.8B |
| 19 | SGRY | Surgery Partners, Inc. | Healthcare | $1.8B |
| 20 | AVAH | Aveanna Healthcare Holdings Inc. | Healthcare | $1.5B |
| 21 | ARDT | Ardent Health Partners, LLC | Healthcare | $1.4B |
| 22 | PNTG | The Pennant Group, Inc. | Healthcare | $1.2B |
| 23 | AGL | Agilon Health, Inc. | Healthcare | $1.2B |
| 24 | INNV | InnovAge Holding Corp. | Healthcare | $1.0B |
| 25 | USPH | U.S. Physical Therapy, Inc. | Healthcare | $926.8M |
| 26 | TALK | Talkspace, Inc. | Healthcare | $867.7M |
| 27 | SNDA | Sonida Senior Living, Inc. | Healthcare | $742.4M |
| 28 | EHAB | Enhabit, Inc. | Healthcare | $706.4M |
| 29 | CYH | Community Health Systems, Inc. | Healthcare | $404.4M |
| 30 | TOI | The Oncology Institute, Inc. | Healthcare | $401.9M |
| 31 | AUNA | Auna S.A. | Healthcare | $362.7M |
| 32 | AIRS | AirSculpt Technologies, Inc. | Healthcare | $293.5M |
| 33 | JYNT | The Joint Corp. | Healthcare | $123.7M |
| 34 | BTMD | biote Corp. | Healthcare | $97.0M |

### 087. Medical - Devices - 84 tickers (Non-priority / later batch)
| Rank | Ticker | Company | Sector | Market Cap |
|------|--------|---------|--------|------------|
| 1 | ABT | Abbott Laboratories | Healthcare | $147.0B |
| 2 | SYK | Stryker Corporation | Healthcare | $112.8B |
| 3 | MDT | Medtronic plc | Healthcare | $98.6B |
| 4 | BSX | Boston Scientific Corporation | Healthcare | $80.4B |
| 5 | EW | Edwards Lifesciences Corporation | Healthcare | $45.9B |
| 6 | DXCM | DexCom, Inc. | Healthcare | $23.6B |
| 7 | STE | STERIS plc | Healthcare | $20.7B |
| 8 | ZBH | Zimmer Biomet Holdings, Inc. | Healthcare | $16.1B |
| 9 | PEN | Penumbra, Inc. | Healthcare | $12.7B |
| 10 | ALGN | Align Technology, Inc. | Healthcare | $11.9B |
| 11 | PODD | Insulet Corporation | Healthcare | $11.0B |
| 12 | GMED | Globus Medical, Inc. | Healthcare | $10.3B |
| 13 | GKOS | Glaukos Corporation | Healthcare | $8.0B |
| 14 | BRKR | Bruker Corporation | Healthcare | $6.8B |
| 15 | BIO.B | Bio-Rad Laboratories, Inc. | Healthcare | $6.6B |
| 16 | BIO | Bio-Rad Laboratories, Inc. | Healthcare | $6.5B |
| 17 | LIVN | LivaNova PLC | Healthcare | $3.9B |
| 18 | IRTC | iRhythm Technologies, Inc. | Healthcare | $3.9B |
| 19 | ITGR | Integer Holdings Corporation | Healthcare | $2.9B |
| 20 | TMDX | TransMedics Group, Inc. | Healthcare | $2.2B |
| 21 | AXGN | AxoGen, Inc. | Healthcare | $2.2B |
| 22 | ESTA | Establishment Labs Holdings Inc. | Healthcare | $2.0B |
| 23 | UFPT | UFP Technologies, Inc. | Healthcare | $1.7B |
| 24 | PRCT | PROCEPT BioRobotics Corporation | Healthcare | $1.6B |
| 25 | AHCO | AdaptHealth Corp. | Healthcare | $1.5B |
| 26 | INSP | Inspire Medical Systems, Inc. | Healthcare | $1.3B |
| 27 | ATEC | Alphatec Holdings, Inc. | Healthcare | $1.2B |
| 28 | AVNS | Avanos Medical, Inc. | Healthcare | $1.2B |
| 29 | AORT | Artivion, Inc. | Healthcare | $1.1B |
| 30 | BFLY | Butterfly Network, Inc. | Healthcare | $1.1B |
| 31 | IRMD | IRadimed Corporation | Healthcare | $1.1B |
| 32 | CNMD | CONMED Corporation | Healthcare | $1.1B |
| 33 | IART | Integra LifeSciences Holdings Corporation | Healthcare | $1.1B |
| 34 | LMRI | Lumexa Imaging Holdings, Inc. Common Stock | Healthcare | $1.0B |
| 35 | TNDM | Tandem Diabetes Care, Inc. | Healthcare | $1.0B |
| 36 | INMD | InMode Ltd. | Healthcare | $876.3M |
| 37 | SSII | SS Innovations International, Inc. | Healthcare | $822.5M |
| 38 | BVS | Bioventus Inc. | Healthcare | $685.9M |
| 39 | CBLL | CeriBell, Inc. | Healthcare | $634.4M |
| 40 | SIBN | SI-BONE, Inc. | Healthcare | $615.0M |
| 41 | NPCE | NeuroPace, Inc. | Healthcare | $536.4M |
| 42 | TCMD | Tactile Systems Technology, Inc. | Healthcare | $530.7M |
| 43 | CTKB | Cytek Biosciences, Inc. | Healthcare | $521.7M |
| 44 | CERS | Cerus Corporation | Healthcare | $510.9M |
| 45 | OFIX | Orthofix Medical Inc. | Healthcare | $492.3M |
| 46 | KIDS | OrthoPediatrics Corp. | Healthcare | $455.1M |
| 47 | VREX | Varex Imaging Corporation | Healthcare | $415.5M |
| 48 | PACB | Pacific Biosciences of California, Inc. | Healthcare | $397.6M |
| 49 | LAB | Standard BioTools Inc. | Healthcare | $394.3M |
| 50 | DCTH | Delcath Systems, Inc. | Healthcare | $391.5M |
| 51 | CLPT | ClearPoint Neuro, Inc. | Healthcare | $379.0M |
| 52 | VMD | Viemed Healthcare, Inc. | Healthcare | $358.8M |
| 53 | CATX | Perspective Therapeutics, Inc. | Healthcare | $291.2M |
| 54 | MASS | 908 Devices Inc. | Healthcare | $289.3M |
| 55 | SGHT | Sight Sciences, Inc. | Healthcare | $268.2M |
| 56 | AVR | Anteris Technologies Global Corp. | Healthcare | $246.5M |
| 57 | SENS | Senseonics Holdings, Inc. | Healthcare | $240.7M |
| 58 | RXST | RxSight, Inc. | Healthcare | $228.5M |
| 59 | ELMD | Electromed, Inc. | Healthcare | $225.1M |
| 60 | PROF | Profound Medical Corp. | Healthcare | $216.1M |
| 61 | ANIK | Anika Therapeutics, Inc. | Healthcare | $195.3M |
| 62 | INGN | Inogen, Inc. | Healthcare | $180.9M |
| 63 | TLSI | TriSalus Life Sciences, Inc. | Healthcare | $172.9M |
| 64 | APYX | Apyx Medical Corporation | Healthcare | $171.3M |
| 65 | TMCI | Treace Medical Concepts, Inc. | Healthcare | $148.7M |
| 66 | HYPR | Hyperfine, Inc. | Healthcare | $141.3M |
| 67 | CVRX | CVRx, Inc. | Healthcare | $139.3M |
| 68 | SNWV | SANUWAVE Health, Inc. | Healthcare | $137.9M |
| 69 | QTRX | Quanterix Corporation | Healthcare | $137.1M |
| 70 | NNOX | Nano-X Imaging Ltd. | Healthcare | $119.0M |
| 71 | RPID | Rapid Micro Biosystems, Inc. | Healthcare | $118.1M |
| 72 | OWLT | Owlet, Inc. | Healthcare | $107.1M |
| 73 | LUCD | Lucid Diagnostics Inc. | Healthcare | $106.4M |
| 74 | MXCT | MaxCyte, Inc. | Healthcare | $87.9M |
| 75 | OM | Outset Medical, Inc. | Healthcare | $71.2M |
| 76 | LNSR | LENSAR, Inc. | Healthcare | $71.2M |
| 77 | BDMD | Baird Medical Investment Holdings Limited | Healthcare | $70.1M |
| 78 | MDAI | Spectral AI, Inc. | Healthcare | $68.4M |
| 79 | VANI | Vivani Medical, Inc. | Healthcare | $67.3M |
| 80 | NSPR | InspireMD, Inc. | Healthcare | $56.3M |
| 81 | ECOR | electroCore, Inc. | Healthcare | $55.5M |
| 82 | SRTS | Sensus Healthcare, Inc. | Healthcare | $55.5M |
| 83 | LUNG | Pulmonx Corporation | Healthcare | $54.5M |
| 84 | POAS | Phaos Technology Holdings (Caym | Healthcare | $32.2M |

### 088. Medical - Diagnostics & Research - 36 tickers (Non-priority / later batch)
| Rank | Ticker | Company | Sector | Market Cap |
|------|--------|---------|--------|------------|
| 1 | TMO | Thermo Fisher Scientific Inc. | Healthcare | $170.7B |
| 2 | DHR | Danaher Corporation | Healthcare | $117.7B |
| 3 | IDXX | IDEXX Laboratories, Inc. | Healthcare | $42.1B |
| 4 | A | Agilent Technologies, Inc. | Healthcare | $31.9B |
| 5 | NTRA | Natera, Inc. | Healthcare | $29.2B |
| 6 | IQV | IQVIA Holdings Inc. | Healthcare | $29.2B |
| 7 | WAT | Waters Corporation | Healthcare | $23.0B |
| 8 | ILMN | Illumina, Inc. | Healthcare | $22.0B |
| 9 | MTD | Mettler-Toledo International Inc. | Healthcare | $21.7B |
| 10 | LH | Labcorp Holdings Inc. | Healthcare | $21.1B |
| 11 | DGX | Quest Diagnostics Incorporated | Healthcare | $21.1B |
| 12 | EXAS | Exact Sciences Corporation | Healthcare | $20.0B |
| 13 | GH | Guardant Health, Inc. | Healthcare | $13.3B |
| 14 | RVTY | Revvity, Inc. | Healthcare | $11.1B |
| 15 | QGEN | Qiagen N.V. | Healthcare | $6.9B |
| 16 | SHC | Sotera Health Company | Healthcare | $4.5B |
| 17 | RDNT | RadNet, Inc. | Healthcare | $4.4B |
| 18 | BLLN | BillionToOne, Inc. | Healthcare | $4.3B |
| 19 | TWST | Twist Bioscience Corporation | Healthcare | $3.5B |
| 20 | GRAL | GRAIL, Inc. | Healthcare | $2.7B |
| 21 | NEOG | Neogen Corporation | Healthcare | $1.9B |
| 22 | CDNA | CareDx, Inc | Healthcare | $1.1B |
| 23 | OPK | OPKO Health, Inc. | Healthcare | $830.6M |
| 24 | ACRS | Aclaris Therapeutics, Inc. | Healthcare | $588.5M |
| 25 | CSTL | Castle Biosciences, Inc. | Healthcare | $565.0M |
| 26 | PSNL | Personalis, Inc. | Healthcare | $536.4M |
| 27 | FLGT | Fulgent Genetics, Inc. | Healthcare | $448.7M |
| 28 | MYGN | Myriad Genetics, Inc. | Healthcare | $384.4M |
| 29 | NEO | NeoGenomics, Inc. | Healthcare | $227.9M |
| 30 | BDSX | Biodesix, Inc. | Healthcare | $118.9M |
| 31 | MDXH | MDxHealth S.A. | Healthcare | $96.1M |
| 32 | XGN | Exagen Inc. | Healthcare | $89.6M |
| 33 | STIM | Neuronetics, Inc. | Healthcare | $88.4M |
| 34 | SERA | Sera Prognostics, Inc. | Healthcare | $64.5M |
| 35 | DRIO | DarioHealth Corp. | Healthcare | $63.4M |
| 36 | PRPO | Precipio, Inc. | Healthcare | $51.2M |

### 089. Medical - Distribution - 6 tickers (Non-priority / later batch)
| Rank | Ticker | Company | Sector | Market Cap |
|------|--------|---------|--------|------------|
| 1 | MCK | McKesson Corporation | Healthcare | $88.3B |
| 2 | COR | Cencora, Inc. | Healthcare | $50.8B |
| 3 | CAH | Cardinal Health, Inc. | Healthcare | $42.8B |
| 4 | HSIC | Henry Schein, Inc. | Healthcare | $7.9B |
| 5 | PBH | Prestige Consumer Healthcare Inc. | Healthcare | $2.4B |
| 6 | ACH | Accendra Health, Inc. | Healthcare | $245.1M |

### 090. Medical - Equipment & Services - 5 tickers (Non-priority / later batch)
| Rank | Ticker | Company | Sector | Market Cap |
|------|--------|---------|--------|------------|
| 1 | HIMS | Hims & Hers Health, Inc. | Healthcare | $5.5B |
| 2 | NVST | Envista Holdings Corp | Healthcare | $4.0B |
| 3 | CON | Concentra Group Holdings Parent, Inc. | Healthcare | $3.3B |
| 4 | BBNX | Beta Bionics, Inc. | Healthcare | $437.6M |
| 5 | PARK | Park Dental Partners, Inc. Common Stock | Healthcare | $36.9M |

### 091. Medical - Healthcare Information Services - 31 tickers (Non-priority / later batch)
| Rank | Ticker | Company | Sector | Market Cap |
|------|--------|---------|--------|------------|
| 1 | GEHC | GE HealthCare Technologies Inc. | Healthcare | $28.3B |
| 2 | VEEV | Veeva Systems Inc. | Healthcare | $26.1B |
| 3 | BTSG | BrightSpring Health Services, Inc. Common Stock | Healthcare | $10.8B |
| 4 | TEM | Tempus AI, Inc. | Healthcare | $8.2B |
| 5 | DOCS | Doximity, Inc. | Healthcare | $5.0B |
| 6 | HNGE | Hinge Health, Inc. | Healthcare | $4.3B |
| 7 | PRVA | Privia Health Group, Inc. | Healthcare | $2.9B |
| 8 | TXG | 10x Genomics, Inc. | Healthcare | $2.7B |
| 9 | HTFL | Heartflow, Inc. Common Stock | Healthcare | $2.5B |
| 10 | OMCL | Omnicell, Inc. | Healthcare | $2.0B |
| 11 | TDOC | Teladoc Health, Inc. | Healthcare | $1.2B |
| 12 | WGS | GeneDx Holdings Corp. | Healthcare | $1.2B |
| 13 | SDGR | Schrödinger, Inc. | Healthcare | $948.2M |
| 14 | GDRX | GoodRx Holdings, Inc. | Healthcare | $932.4M |
| 15 | OMDA | Omada Health | Healthcare | $886.4M |
| 16 | NUTX | Nutex Health, Inc. | Healthcare | $806.7M |
| 17 | CERT | Certara, Inc. | Healthcare | $791.8M |
| 18 | HSTM | HealthStream, Inc. | Healthcare | $682.5M |
| 19 | PHR | Phreesia, Inc. | Healthcare | $583.9M |
| 20 | CTEV | Claritev Corporation | Healthcare | $486.4M |
| 21 | NRC | National Research Corporation | Healthcare | $432.5M |
| 22 | TBRG | TruBridge, Inc. | Healthcare | $388.3M |
| 23 | SOPH | SOPHiA GENETICS S.A. | Healthcare | $331.8M |
| 24 | SLP | Simulations Plus, Inc. | Healthcare | $282.1M |
| 25 | CARL | Carlsmed, Inc. | Healthcare | $267.2M |
| 26 | SPOK | Spok Holdings, Inc. | Healthcare | $224.3M |
| 27 | AMWL | American Well Corporation | Healthcare | $131.8M |
| 28 | OPRX | OptimizeRx Corporation | Healthcare | $119.0M |
| 29 | HCAT | Health Catalyst, Inc. | Healthcare | $109.4M |
| 30 | DH | Definitive Healthcare Corp. | Healthcare | $97.8M |
| 31 | CCLD | CareCloud, Inc. | Healthcare | $95.2M |

### 092. Medical - Healthcare Plans - 9 tickers (Non-priority / later batch)
| Rank | Ticker | Company | Sector | Market Cap |
|------|--------|---------|--------|------------|
| 1 | UNH | UnitedHealth Group Incorporated | Healthcare | $360.0B |
| 2 | ELV | Elevance Health Inc. | Healthcare | $85.4B |
| 3 | CI | Cigna Corporation | Healthcare | $79.0B |
| 4 | HUM | Humana Inc. | Healthcare | $35.5B |
| 5 | CNC | Centene Corporation | Healthcare | $29.3B |
| 6 | MOH | Molina Healthcare, Inc. | Healthcare | $10.0B |
| 7 | OSCR | Oscar Health, Inc. | Healthcare | $6.2B |
| 8 | ALHC | Alignment Healthcare, Inc. | Healthcare | $3.8B |
| 9 | CLOV | Clover Health Investments, Corp. | Healthcare | $1.7B |

### 093. Medical - Instruments & Supplies - 41 tickers (Non-priority / later batch)
| Rank | Ticker | Company | Sector | Market Cap |
|------|--------|---------|--------|------------|
| 1 | ISRG | Intuitive Surgical, Inc. | Healthcare | $153.0B |
| 2 | BDX | Becton, Dickinson and Company | Healthcare | $53.4B |
| 3 | MDLN | Medline Inc. | Healthcare | $31.3B |
| 4 | ALC | Alcon Inc. | Healthcare | $31.1B |
| 5 | RMD | ResMed Inc. | Healthcare | $29.6B |
| 6 | WST | West Pharmaceutical Services, Inc. | Healthcare | $22.0B |
| 7 | HOLX | Hologic, Inc. | Healthcare | $17.0B |
| 8 | COO | The Cooper Companies, Inc. | Healthcare | $11.7B |
| 9 | MASI | Masimo Corporation | Healthcare | $9.3B |
| 10 | BAX | Baxter International Inc. | Healthcare | $9.2B |
| 11 | RGEN | Repligen Corporation | Healthcare | $6.4B |
| 12 | BLCO | Bausch + Lomb Corporation | Healthcare | $5.7B |
| 13 | TFX | Teleflex Incorporated | Healthcare | $5.7B |
| 14 | AVTR | Avantor, Inc. | Healthcare | $5.6B |
| 15 | STVN | Stevanato Group S.p.A. | Healthcare | $5.0B |
| 16 | MMSI | Merit Medical Systems, Inc. | Healthcare | $3.6B |
| 17 | WRBY | Warby Parker Inc. | Healthcare | $3.3B |
| 18 | ICUI | ICU Medical, Inc. | Healthcare | $3.1B |
| 19 | HAE | Haemonetics Corporation | Healthcare | $2.5B |
| 20 | LMAT | LeMaitre Vascular, Inc. | Healthcare | $2.2B |
| 21 | XRAY | DENTSPLY SIRONA Inc. | Healthcare | $2.2B |
| 22 | NVCR | NovoCure Limited | Healthcare | $2.1B |
| 23 | PLSE | Pulse Biosciences, Inc. | Healthcare | $1.6B |
| 24 | STAA | STAAR Surgical Company | Healthcare | $1.4B |
| 25 | ATRC | AtriCure, Inc. | Healthcare | $1.4B |
| 26 | KMTS | Kestra Medical Technologies, Ltd. | Healthcare | $1.3B |
| 27 | NNNN | Anbio Biotechnology Class A Ordinary Shares | Healthcare | $1.1B |
| 28 | BLFS | BioLife Solutions, Inc. | Healthcare | $1.0B |
| 29 | AZTA | Azenta, Inc. | Healthcare | $807.5M |
| 30 | QDEL | QuidelOrtho Corporation | Healthcare | $758.3M |
| 31 | ANGO | AngioDynamics, Inc. | Healthcare | $450.4M |
| 32 | OSUR | OraSure Technologies, Inc. | Healthcare | $213.7M |
| 33 | UTMD | Utah Medical Products, Inc. | Healthcare | $203.3M |
| 34 | SMTI | Sanara MedTech Inc. | Healthcare | $187.4M |
| 35 | STXS | Stereotaxis, Inc. | Healthcare | $187.2M |
| 36 | KRMD | KORU Medical Systems, Inc. | Healthcare | $183.7M |
| 37 | PDEX | Pro-Dex, Inc. | Healthcare | $180.4M |
| 38 | NYXH | Nyxoah S.A. | Healthcare | $114.6M |
| 39 | MBOT | Microbot Medical Inc. | Healthcare | $99.8M |
| 40 | ZTEK | Zentek Ltd. | Healthcare | $93.2M |
| 41 | STSS | Sharps Technology, Inc. | Healthcare | $51.0M |

### 094. Medical - Pharmaceuticals - 6 tickers (Non-priority / later batch)
| Rank | Ticker | Company | Sector | Market Cap |
|------|--------|---------|--------|------------|
| 1 | DMRA | Galecto, Inc. | Healthcare | $1.4B |
| 2 | AVLN | Avalyn Pharma Inc. Common Stock | Healthcare | $1.3B |
| 3 | CGEM | Cullinan Therapeutics, Inc. | Healthcare | $992.5M |
| 4 | ATAI | Atai Beckley N.V | Healthcare | $782.8M |
| 5 | HITI | High Tide Inc. | Healthcare | $213.6M |
| 6 | LFMD | LifeMD, Inc. | Healthcare | $207.0M |

### 095. Medical - Specialties - 3 tickers (Non-priority / later batch)
| Rank | Ticker | Company | Sector | Market Cap |
|------|--------|---------|--------|------------|
| 1 | MOBI | Mobia Medical, Inc. Common Stock | Healthcare | $400.3M |
| 2 | SI | Shoulder Innovations, Inc. | Healthcare | $276.1M |
| 3 | CHRN | Ekso Bionics Holdings, Inc. Common Stock | Healthcare | $50.9M |

### 096. Medical Devices - 2 tickers (Non-priority / later batch)
| Rank | Ticker | Company | Sector | Market Cap |
|------|--------|---------|--------|------------|
| 1 | CV | CapsoVision, Inc. | Healthcare | $356.3M |
| 2 | RCEL | AVITA Medical, Inc. | Healthcare | $108.8M |

### 097. Advertising Agencies - 10 tickers (Non-priority / later batch)
| Rank | Ticker | Company | Sector | Market Cap |
|------|--------|---------|--------|------------|
| 1 | VSNT | Versant Media Group, Inc. Class A | Industrials | $5.8B |
| 2 | CMPR | Cimpress plc | Communication Services | $2.2B |
| 3 | MGNI | Magnite, Inc. | Communication Services | $2.0B |
| 4 | ZD | Ziff Davis, Inc. | Communication Services | $1.5B |
| 5 | DLX | Deluxe Corporation | Communication Services | $1.2B |
| 6 | MNTN | MNTN Inc. | Communication Services | $602.5M |
| 7 | NEXN | Nexxen International Ltd. | Communication Services | $414.0M |
| 8 | TZOO | Travelzoo | Communication Services | $98.1M |
| 9 | FLNT | Fluent, Inc. | Communication Services | $52.7M |
| 10 | ABLV | Able View Inc. | Communication Services | $51.0M |

### 098. Aerospace & Defense - 70 tickers (Non-priority / later batch)
| Rank | Ticker | Company | Sector | Market Cap |
|------|--------|---------|--------|------------|
| 1 | GE | GE Aerospace | Industrials | $310.8B |
| 2 | RTX | RTX Corporation | Industrials | $240.9B |
| 3 | BA | The Boeing Company | Industrials | $186.7B |
| 4 | LMT | Lockheed Martin Corporation | Industrials | $120.1B |
| 5 | GD | General Dynamics Corporation | Industrials | $93.7B |
| 6 | NOC | Northrop Grumman Corporation | Industrials | $79.3B |
| 7 | RKLB | Rocket Lab USA, Inc. | Industrials | $68.0B |
| 8 | TDG | TransDigm Group Incorporated | Industrials | $66.6B |
| 9 | LHX | L3Harris Technologies, Inc. | Industrials | $57.7B |
| 10 | HEI | HEICO Corporation | Industrials | $40.0B |
| 11 | ESLT | Elbit Systems Ltd. | Industrials | $37.5B |
| 12 | AXON | Axon Enterprise, Inc. | Industrials | $31.7B |
| 13 | HEI.A | HEICO Corporation | Industrials | $30.3B |
| 14 | CW | Curtiss-Wright Corporation | Industrials | $27.2B |
| 15 | WWD | Woodward, Inc. | Industrials | $21.9B |
| 16 | BWXT | BWX Technologies, Inc. | Industrials | $18.9B |
| 17 | TXT | Textron Inc. | Industrials | $15.8B |
| 18 | HII | Huntington Ingalls Industries, Inc. | Industrials | $13.1B |
| 19 | PL | Planet Labs PBC | Industrials | $13.1B |
| 20 | DRS | Leonardo DRS, Inc. | Industrials | $11.4B |
| 21 | KTOS | Kratos Defense & Security Solutions, Inc. | Industrials | $10.8B |
| 22 | MOG.B | Moog Inc. | Industrials | $9.8B |
| 23 | MOG.A | Moog Inc. | Industrials | $9.8B |
| 24 | SARO | StandardAero, Inc. | Industrials | $8.9B |
| 25 | AVAV | AeroVironment, Inc. | Industrials | $8.4B |
| 26 | KRMN | Karman Holdings Inc. | Industrials | $8.3B |
| 27 | HXL | Hexcel Corporation | Industrials | $7.0B |
| 28 | RAL | Ralliant Corp. | Industrials | $6.6B |
| 29 | FLY | Firefly Aerospace Inc. | Industrials | $6.3B |
| 30 | AMTM | Amentum Holdings, Inc. | Industrials | $5.9B |
| 31 | LOAR | Loar Holdings Inc. | Industrials | $5.7B |
| 32 | MRCY | Mercury Systems, Inc. | Industrials | $5.5B |
| 33 | LUNR | Intuitive Machines, Inc. | Industrials | $5.1B |
| 34 | ACHR | Archer Aviation Inc. | Industrials | $4.9B |
| 35 | AIR | AAR Corp. | Industrials | $4.4B |
| 36 | VSEC | VSE Corporation | Industrials | $4.2B |
| 37 | BETA | BETA Technologies, Inc. | Industrials | $4.0B |
| 38 | HAWK | HawkEye 360, Inc. | Industrials | $3.2B |
| 39 | ATRO | Astronics Corporation | Industrials | $2.8B |
| 40 | DCO | Ducommun Incorporated | Industrials | $2.2B |
| 41 | RDW | Redwire Corporation | Industrials | $1.7B |
| 42 | VOYG | Voyager Technologies, Inc. | Industrials | $1.7B |
| 43 | ARXS | Arxis, Inc. Class A Common Stock | Industrials | $1.5B |
| 44 | AVEX | Aevex Corp. | Industrials | $1.4B |
| 45 | CDRE | Cadre Holdings, Inc. | Industrials | $1.2B |
| 46 | EVEX | Eve Holding, Inc. | Industrials | $980.9M |
| 47 | NPK | National Presto Industries, Inc. | Industrials | $973.1M |
| 48 | SKYH | Sky Harbour Group Corporation | Industrials | $734.3M |
| 49 | PKE | Park Aerospace Corp. | Industrials | $668.5M |
| 50 | SWBI | Smith & Wesson Brands, Inc. | Industrials | $641.6M |
| 51 | ELMT | Elmet Group Co. | Industrials | $468.2M |
| 52 | TATT | TAT Technologies Ltd. | Industrials | $467.7M |
| 53 | ISSC | Innovative Aerosystems, Inc. | Industrials | $377.3M |
| 54 | EVTL | Vertical Aerospace Ltd. | Industrials | $261.0M |
| 55 | AIRO | AIRO Group Holdings, Inc. Common Stock | Industrials | $246.2M |
| 56 | POWW | Outdoor Holding Company | Industrials | $229.9M |
| 57 | MRLN | Merlin, Inc. | Industrials | $199.1M |
| 58 | SPCE | Virgin Galactic Holdings, Inc. | Industrials | $176.3M |
| 59 | CODA | Coda Octopus Group, Inc. | Industrials | $133.4M |
| 60 | SIF | SIFCO Industries, Inc. | Industrials | $125.1M |
| 61 | DPRO | Draganfly Inc. | Industrials | $121.1M |
| 62 | SIDU | Sidus Space, Inc. | Industrials | $117.1M |
| 63 | BYRN | Byrna Technologies Inc. | Industrials | $115.0M |
| 64 | HOVR | New Horizon Aircraft Ltd. | Industrials | $100.9M |
| 65 | PEW | GrabAGun Digital Holdings Inc. | Industrials | $97.1M |
| 66 | VWAV | VisionWave Holdings, Inc. | Industrials | $96.3M |
| 67 | OPXS | Optex Systems Holdings, Inc | Industrials | $81.8M |
| 68 | SPAI | Safe Pro Group Inc. Common Stock | Industrials | $75.0M |
| 69 | CVU | CPI Aerostructures, Inc. | Industrials | $51.6M |
| 70 | XTIA | XTI Aerospace, Inc. | Industrials | $30.9M |

### 099. Agricultural - Machinery - 3 tickers (Non-priority / later batch)
| Rank | Ticker | Company | Sector | Market Cap |
|------|--------|---------|--------|------------|
| 1 | OSK | Oshkosh Corporation | Industrials | $8.2B |
| 2 | HY | Hyster-Yale Materials Handling, Inc. | Industrials | $646.0M |
| 3 | TWI | Titan International, Inc. | Industrials | $487.9M |

### 100. Airlines, Airports & Air Services - 3 tickers (Non-priority / later batch)
| Rank | Ticker | Company | Sector | Market Cap |
|------|--------|---------|--------|------------|
| 1 | JOBY | Joby Aviation, Inc. | Industrials | $10.3B |
| 2 | CAAP | Corporación América Airports S.A. | Industrials | $4.1B |
| 3 | SRTA | Strata Critical Medical, Inc. | Industrials | $473.3M |

### 101. Building Products & Equipment - 1 tickers (Non-priority / later batch)
| Rank | Ticker | Company | Sector | Market Cap |
|------|--------|---------|--------|------------|
| 1 | AIRJ | AirJoule Technologies Corporation | Industrials | $256.8M |

### 102. Business Equipment & Supplies - 1 tickers (Non-priority / later batch)
| Rank | Ticker | Company | Sector | Market Cap |
|------|--------|---------|--------|------------|
| 1 | EBF | Ennis, Inc. | Industrials | $510.9M |

### 103. Conglomerates - 7 tickers (Non-priority / later batch)
| Rank | Ticker | Company | Sector | Market Cap |
|------|--------|---------|--------|------------|
| 1 | HON | Honeywell International Inc. | Industrials | $138.5B |
| 2 | VMI | Valmont Industries, Inc. | Industrials | $10.0B |
| 3 | GFF | Griffon Corporation | Industrials | $3.8B |
| 4 | MATW | Matthews International Corporation | Industrials | $867.2M |
| 5 | TRC | Tejon Ranch Co. | Industrials | $527.4M |
| 6 | FBYD | Falcon's Beyond Global, Inc. Class A Common Stock | Industrials | $425.3M |
| 7 | NNBR | NN, Inc. | Industrials | $125.1M |

### 104. Construction - 22 tickers (Non-priority / later batch)
| Rank | Ticker | Company | Sector | Market Cap |
|------|--------|---------|--------|------------|
| 1 | TT | Trane Technologies plc | Industrials | $103.4B |
| 2 | JCI | Johnson Controls International plc | Industrials | $86.1B |
| 3 | CARR | Carrier Global Corporation | Industrials | $54.5B |
| 4 | LII | Lennox International Inc. | Industrials | $17.7B |
| 5 | CSL | Carlisle Companies Incorporated | Industrials | $14.2B |
| 6 | MAS | Masco Corporation | Industrials | $14.1B |
| 7 | AAON | AAON, Inc. | Industrials | $10.9B |
| 8 | WMS | Advanced Drainage Systems, Inc. | Industrials | $10.9B |
| 9 | BLDR | Builders FirstSource, Inc. | Industrials | $7.8B |
| 10 | SSD | Simpson Manufacturing Co., Inc. | Industrials | $7.6B |
| 11 | AWI | Armstrong World Industries, Inc. | Industrials | $6.8B |
| 12 | MWH | Solv Energy Inc | Industrial services | $5.7B |
| 13 | FBIN | Fortune Brands Innovations, Inc. | Industrials | $4.4B |
| 14 | ROCK | Gibraltar Industries, Inc. | Industrials | $1.1B |
| 15 | NX | Quanex Building Products Corporation | Industrials | $896.7M |
| 16 | APOG | Apogee Enterprises, Inc. | Industrials | $755.9M |
| 17 | JBI | Janus International Group, Inc. | Industrials | $676.5M |
| 18 | SWIM | Latham Group, Inc. | Industrials | $588.2M |
| 19 | ASPN | Aspen Aerogels, Inc. | Industrials | $419.4M |
| 20 | PHOE | Phoenix Asia Holdings Limited Ordinary Shares | Industrials | $388.8M |
| 21 | PPIH | Perma-Pipe International Holdings, Inc. | Industrials | $265.7M |
| 22 | APT | Alpha Pro Tech, Ltd. | Industrials | $64.9M |

### 105. Consulting Services - 2 tickers (Non-priority / later batch)
| Rank | Ticker | Company | Sector | Market Cap |
|------|--------|---------|--------|------------|
| 1 | VRSK | Verisk Analytics, Inc. | Industrials | $21.8B |
| 2 | EXPO | Exponent, Inc. | Industrials | $2.8B |

### 106. Engineering & Construction - 36 tickers (Non-priority / later batch)
| Rank | Ticker | Company | Sector | Market Cap |
|------|--------|---------|--------|------------|
| 1 | PWR | Quanta Services, Inc. | Industrials | $114.9B |
| 2 | FIX | Comfort Systems USA, Inc. | Industrials | $71.0B |
| 3 | FER | Ferrovial SE | Industrials | $49.7B |
| 4 | EME | EMCOR Group, Inc. | Industrials | $41.2B |
| 5 | MTZ | MasTec, Inc. | Industrials | $33.2B |
| 6 | STRL | Sterling Infrastructure, Inc. | Industrials | $26.1B |
| 7 | APG | APi Group Corporation | Industrials | $18.7B |
| 8 | IESC | IES Holdings, Inc. | Industrials | $13.7B |
| 9 | J | Jacobs Solutions Inc. | Industrials | $13.5B |
| 10 | DY | Dycom Industries, Inc. | Industrials | $12.9B |
| 11 | BLD | TopBuild Corp. | Industrials | $11.7B |
| 12 | LGN | Legence Corp. Class A Common stock | Industrials | $10.4B |
| 13 | AGX | Argan, Inc. | Industrials | $9.5B |
| 14 | STN | Stantec Inc. | Industrials | $9.5B |
| 15 | ACM | Aecom | Industrials | $9.0B |
| 16 | ECG | Everus Construction Group, Inc. | Industrials | $8.1B |
| 17 | TTEK | Tetra Tech, Inc. | Industrials | $7.5B |
| 18 | ROAD | Construction Partners, Inc. | Industrials | $7.2B |
| 19 | MYRG | MYR Group Inc. | Industrials | $7.1B |
| 20 | FLR | Fluor Corporation | Industrials | $6.4B |
| 21 | PRIM | Primoris Services Corporation | Industrials | $6.1B |
| 22 | GVA | Granite Construction Incorporated | Industrials | $6.1B |
| 23 | TPC | Tutor Perini Corporation | Industrials | $4.4B |
| 24 | KBR | KBR, Inc. | Industrials | $4.1B |
| 25 | AMRC | Ameresco, Inc. | Industrials | $1.5B |
| 26 | GLDD | Great Lakes Dredge & Dock Corporation | Industrials | $1.1B |
| 27 | LMB | Limbach Holdings, Inc. | Industrials | $862.1M |
| 28 | ORN | Orion Group Holdings, Inc. | Industrials | $599.5M |
| 29 | BWMN | Bowman Consulting Group Ltd. | Industrials | $584.1M |
| 30 | BBCP | Concrete Pumping Holdings, Inc. | Industrials | $368.2M |
| 31 | ESOA | Energy Services of America Corporation | Industrials | $356.0M |
| 32 | MTRX | Matrix Service Company | Industrials | $342.4M |
| 33 | SHIM | Shimmick Corporation Common Stock | Industrials | $172.8M |
| 34 | VATE | INNOVATE Corp. | Industrials | $169.2M |
| 35 | SKBL | Skyline Builders Group Holding Limited | Industrials | $98.8M |
| 36 | SLND | Southland Holdings, Inc. | Industrials | $74.1M |

### 107. General Transportation - 1 tickers (Non-priority / later batch)
| Rank | Ticker | Company | Sector | Market Cap |
|------|--------|---------|--------|------------|
| 1 | AEBI | Aebi Schmidt Holding AG | Industrials | $890.5M |

### 108. Industrial - Distribution - 4 tickers (Non-priority / later batch)
| Rank | Ticker | Company | Sector | Market Cap |
|------|--------|---------|--------|------------|
| 1 | WSO | Watsco, Inc. | Industrials | $17.0B |
| 2 | WSO.B | Watsco, Inc. | Industrials | $16.0B |
| 3 | GIC | Global Industrial Company | Industrials | $1.1B |
| 4 | TRNS | Transcat, Inc. | Industrials | $709.8M |

### 109. Industrial - Infrastructure Operations - 2 tickers (Non-priority / later batch)
| Rank | Ticker | Company | Sector | Market Cap |
|------|--------|---------|--------|------------|
| 1 | ACA | Arcosa, Inc. | Industrials | $6.3B |
| 2 | CDNL | Cardinal Infrastructure Group Inc. Class A Common Stock | Industrials | $873.1M |

### 110. Industrial - Machinery - 68 tickers (Non-priority / later batch)
| Rank | Ticker | Company | Sector | Market Cap |
|------|--------|---------|--------|------------|
| 1 | ETN | Eaton Corporation plc | Industrials | $155.9B |
| 2 | PH | Parker-Hannifin Corporation | Industrials | $111.1B |
| 3 | HWM | Howmet Aerospace Inc. | Industrials | $107.9B |
| 4 | CMI | Cummins Inc. | Industrials | $97.2B |
| 5 | EMR | Emerson Electric Co. | Industrials | $76.9B |
| 6 | ITW | Illinois Tool Works Inc. | Industrials | $72.3B |
| 7 | AME | AMETEK, Inc. | Industrials | $53.0B |
| 8 | ROK | Rockwell Automation, Inc. | Industrials | $50.6B |
| 9 | SYM | Symbotic Inc. | Industrials | $32.9B |
| 10 | ROP | Roper Technologies, Inc. | Industrials | $32.7B |
| 11 | DOV | Dover Corporation | Industrials | $29.2B |
| 12 | IR | Ingersoll Rand Inc. | Industrials | $28.6B |
| 13 | OTIS | Otis Worldwide Corporation | Industrials | $28.4B |
| 14 | XYL | Xylem Inc. | Industrials | $26.5B |
| 15 | ITT | ITT Inc. | Industrials | $18.4B |
| 16 | GNRC | Generac Holdings Inc. | Industrials | $15.9B |
| 17 | IEX | IDEX Corporation | Industrials | $15.8B |
| 18 | NDSN | Nordson Corporation | Industrials | $15.7B |
| 19 | RRX | Regal Rexnord Corporation | Industrials | $14.0B |
| 20 | GGG | Graco Inc. | Industrials | $12.8B |
| 21 | PNR | Pentair plc | Industrials | $12.2B |
| 22 | CR | Crane Company | Industrials | $10.4B |
| 23 | WTS | Watts Water Technologies, Inc. | Industrials | $10.0B |
| 24 | SPXC | SPX Technologies, Inc. | Industrials | $10.0B |
| 25 | GTLS | Chart Industries, Inc. | Industrials | $9.9B |
| 26 | DCI | Donaldson Company, Inc. | Industrials | $9.8B |
| 27 | FLS | Flowserve Corporation | Industrials | $8.9B |
| 28 | AOS | A. O. Smith Corporation | Industrials | $8.1B |
| 29 | MIDD | The Middleby Corporation | Industrials | $7.0B |
| 30 | JBTM | JBT Marel Corporation | Industrials | $6.7B |
| 31 | NPO | EnPro Industries, Inc. | Industrials | $6.6B |
| 32 | GTES | Gates Industrial Corporation plc | Industrials | $6.5B |
| 33 | PSN | Parsons Corporation | Industrials | $5.6B |
| 34 | MIR | Mirion Technologies, Inc. | Industrials | $4.6B |
| 35 | CSW | CSW Industrials, Inc. | Industrials | $4.4B |
| 36 | FELE | Franklin Electric Co., Inc. | Industrials | $4.3B |
| 37 | XMTR | Xometry, Inc. | Industrials | $4.2B |
| 38 | MWA | Mueller Water Products, Inc. | Industrials | $4.0B |
| 39 | KAI | Kadant Inc. | Industrials | $3.9B |
| 40 | ATS | ATS Corporation | Industrials | $3.3B |
| 41 | SXI | Standex International Corporation | Industrials | $3.1B |
| 42 | AMSC | American Superconductor Corporation | Industrials | $2.6B |
| 43 | HLIO | Helios Technologies, Inc. | Industrials | $2.6B |
| 44 | CXT | Crane NXT, Co. | Industrials | $2.5B |
| 45 | BW | Babcock & Wilcox Enterprises, Inc. | Industrials | $2.3B |
| 46 | THR | Thermon Group Holdings, Inc. | Industrials | $2.1B |
| 47 | GRC | The Gorman-Rupp Company | Industrials | $2.0B |
| 48 | CYD | China Yuchai International Limited | Industrials | $1.8B |
| 49 | EPAC | Enerpac Tool Group Corp. | Industrials | $1.8B |
| 50 | ENOV | Enovis Corporation | Industrials | $1.5B |
| 51 | TNC | Tennant Company | Industrials | $1.4B |
| 52 | BLDP | Ballard Power Systems Inc. | Industrials | $1.3B |
| 53 | NNE | Nano Nuclear Energy Inc | Industrials | $1.1B |
| 54 | GHM | Graham Corporation | Industrials | $1.1B |
| 55 | PSIX | Power Solutions International, Inc. | Industrials | $875.9M |
| 56 | KRNT | Kornit Digital Ltd. | Industrials | $745.2M |
| 57 | XE | X-Energy, Inc. Class A Common Stock | Industrials | $635.3M |
| 58 | SERV | Serve Robotics Inc. | Industrials | $540.1M |
| 59 | RR | Richtech Robotics Inc. Class B Common Stock | Industrials | $472.0M |
| 60 | PKOH | Park-Ohio Holdings Corp. | Industrials | $426.8M |
| 61 | LXFR | Luxfer Holdings PLC | Industrials | $406.7M |
| 62 | OFLX | Omega Flex, Inc. | Industrials | $294.6M |
| 63 | SHMD | SCHMID Group N.V. Class A Ordinary Shares | Industrials | $256.7M |
| 64 | HUHU | HUHUTECH International Group Inc. Ordinary Shares | Industrials | $243.5M |
| 65 | NPWR | NET Power Inc. | Industrials | $210.0M |
| 66 | TAYD | Taylor Devices, Inc. | Industrials | $163.4M |
| 67 | HURC | Hurco Companies, Inc. | Industrials | $107.5M |
| 68 | INLF | INLIF Limited | Industrials | $3.8M |

### 111. Industrial - Pollution & Treatment Controls - 7 tickers (Non-priority / later batch)
| Rank | Ticker | Company | Sector | Market Cap |
|------|--------|---------|--------|------------|
| 1 | VLTO | Veralto Corporation | Industrials | $21.3B |
| 2 | ZWS | Zurn Elkay Water Solutions Corporation | Industrials | $8.3B |
| 3 | FSS | Federal Signal Corporation | Industrials | $7.0B |
| 4 | ATMU | Atmus Filtration Technologies Inc. | Industrials | $4.5B |
| 5 | CECO | CECO Environmental Corp. | Industrials | $2.9B |
| 6 | ERII | Energy Recovery, Inc. | Industrials | $450.0M |
| 7 | ARQ | Arq, Inc. | Industrials | $116.3M |

### 112. Integrated Freight & Logistics - 13 tickers (Non-priority / later batch)
| Rank | Ticker | Company | Sector | Market Cap |
|------|--------|---------|--------|------------|
| 1 | FDX | FedEx Corporation | Industrials | $89.8B |
| 2 | UPS | United Parcel Service, Inc. | Industrials | $83.7B |
| 3 | EXPD | Expeditors International of Washington, Inc. | Industrials | $20.2B |
| 4 | CHRW | C.H. Robinson Worldwide, Inc. | Industrials | $19.7B |
| 5 | GXO | GXO Logistics, Inc. | Industrials | $5.8B |
| 6 | HUBG | Hub Group, Inc. | Industrials | $2.2B |
| 7 | PBI | Pitney Bowes Inc. | Industrials | $2.1B |
| 8 | CYRX | Cryoport, Inc. | Industrials | $657.2M |
| 9 | RLGT | Radiant Logistics, Inc. | Industrials | $405.6M |
| 10 | CRGO | Freightos Limited Ordinary shares | Industrials | $104.9M |
| 11 | SFWL | Shengfeng Development Limited | Industrials | $71.0M |
| 12 | AIRT | Air T, Inc. | Industrials | $57.8M |
| 13 | PSIG | PS International Group Ltd. | Industrials | $23.1M |

### 113. Manufacturing - Metal Fabrication - 14 tickers (Non-priority / later batch)
| Rank | Ticker | Company | Sector | Market Cap |
|------|--------|---------|--------|------------|
| 1 | ATI | ATI Inc. | Industrials | $22.0B |
| 2 | CRS | Carpenter Technology Corporation | Industrials | $21.1B |
| 3 | MLI | Mueller Industries, Inc. | Industrials | $15.3B |
| 4 | ESAB | ESAB Corporation | Industrials | $5.7B |
| 5 | AZZ | AZZ Inc. | Industrials | $4.4B |
| 6 | GPGI | GPGI, Inc. | Industrials | $3.7B |
| 7 | WOR | Worthington Industries, Inc. | Industrials | $2.7B |
| 8 | PRLB | Proto Labs, Inc. | Industrials | $1.7B |
| 9 | NWPX | NWPX Infrastructure, Inc. | Industrials | $1.1B |
| 10 | RYI | Ryerson Holding Corporation | Industrials | $746.4M |
| 11 | MEC | Mayville Engineering Company, Inc. | Industrials | $544.1M |
| 12 | IIIN | Insteel Industries, Inc. | Industrials | $510.3M |
| 13 | TG | Tredegar Corporation | Industrials | $293.5M |
| 14 | AP | Ampco-Pittsburgh Corporation | Industrials | $215.9M |

### 114. Manufacturing - Tools & Accessories - 7 tickers (Non-priority / later batch)
| Rank | Ticker | Company | Sector | Market Cap |
|------|--------|---------|--------|------------|
| 1 | RBC | RBC Bearings Incorporated | Industrials | $19.4B |
| 2 | SNA | Snap-on Incorporated | Industrials | $19.1B |
| 3 | LECO | Lincoln Electric Holdings, Inc. | Industrials | $14.6B |
| 4 | SWK | Stanley Black & Decker, Inc. | Industrials | $12.3B |
| 5 | TKR | The Timken Company | Industrials | $8.1B |
| 6 | KMT | Kennametal Inc. | Industrials | $2.7B |
| 7 | EML | The Eastern Company | Industrials | $134.7M |

### 115. Marine Shipping - 2 tickers (Non-priority / later batch)
| Rank | Ticker | Company | Sector | Market Cap |
|------|--------|---------|--------|------------|
| 1 | PANL | Pangaea Logistics Solutions, Ltd. | Industrials | $565.2M |
| 2 | SMHI | SEACOR Marine Holdings Inc. | Industrials | $199.4M |

### 116. Metal fabrication - 1 tickers (Non-priority / later batch)
| Rank | Ticker | Company | Sector | Market Cap |
|------|--------|---------|--------|------------|
| 1 | ZJK | ZJK Industrial Co., Ltd. | Industrials | $176.1M |

### 117. Rental & Leasing Services - 3 tickers (Non-priority / later batch)
| Rank | Ticker | Company | Sector | Market Cap |
|------|--------|---------|--------|------------|
| 1 | FTAI | FTAI Aviation Ltd. | Industrials | $27.3B |
| 2 | R | Ryder System, Inc. | Industrials | $8.8B |
| 3 | EQPT | EquipmentShare.com Inc. | Industrials | $6.5B |

### 118. Security & Protection Services - 9 tickers (Non-priority / later batch)
| Rank | Ticker | Company | Sector | Market Cap |
|------|--------|---------|--------|------------|
| 1 | ALLE | Allegion plc | Industrials | $11.3B |
| 2 | REZI | Resideo Technologies, Inc. | Industrials | $5.6B |
| 3 | BRC | Brady Corporation | Industrials | $3.5B |
| 4 | ARLO | Arlo Technologies, Inc. | Industrials | $1.4B |
| 5 | EVLV | Evolv Technologies Holdings, Inc. | Industrials | $1.2B |
| 6 | MG | Mistras Group, Inc. | Industrials | $536.1M |
| 7 | CIX | CompX International Inc. | Industrials | $301.2M |
| 8 | NL | NL Industries, Inc. | Industrials | $286.3M |
| 9 | SNT | Senstar Technologies Ltd. | Industrials | $62.8M |

### 119. Specialty Business Services - 10 tickers (Non-priority / later batch)
| Rank | Ticker | Company | Sector | Market Cap |
|------|--------|---------|--------|------------|
| 1 | TRI | Thomson Reuters Corporation | Industrials | $38.1B |
| 2 | CPRT | Copart, Inc. | Industrials | $32.2B |
| 3 | RBA | RB Global, Inc. | Industrials | $19.3B |
| 4 | FA | First Advantage Corporation | Industrials | $2.7B |
| 5 | LZ | LegalZoom.com, Inc. | Industrials | $1.1B |
| 6 | KODK | Eastman Kodak Company | Industrials | $1.0B |
| 7 | SPIR | Spire Global, Inc. | Industrials | $591.5M |
| 8 | QUAD | Quad/Graphics, Inc. | Industrials | $382.6M |
| 9 | ANPA | Rich Sparkle Holdings Limited Ordinary Shares | Industrials | $75.8M |
| 10 | SMX | SMX (Security Matters) Public Limited Company | Industrials | $1.1M |

### 120. Specialty Industrial Machinery - 1 tickers (Non-priority / later batch)
| Rank | Ticker | Company | Sector | Market Cap |
|------|--------|---------|--------|------------|
| 1 | CVV | CVD Equipment Corporation | Industrials | $48.6M |

### 121. Staffing & Employment Services - 4 tickers (Non-priority / later batch)
| Rank | Ticker | Company | Sector | Market Cap |
|------|--------|---------|--------|------------|
| 1 | ADP | Automatic Data Processing, Inc. | Industrials | $85.5B |
| 2 | PAYX | Paychex, Inc. | Industrials | $33.6B |
| 3 | ZIP | ZipRecruiter, Inc. | Industrials | $319.2M |
| 4 | ATLN | Atlantic International Corp. | Industrials | $127.0M |

### 122. Trucking - 1 tickers (Non-priority / later batch)
| Rank | Ticker | Company | Sector | Market Cap |
|------|--------|---------|--------|------------|
| 1 | RXO | RXO, Inc. | Industrials | $3.3B |

### 123. Waste Management - 1 tickers (Non-priority / later batch)
| Rank | Ticker | Company | Sector | Market Cap |
|------|--------|---------|--------|------------|
| 1 | LNZA | LanzaTech Global, Inc. | Industrials | $45.6M |

### 124. Precious metals - 1 tickers (Non-priority / later batch)
| Rank | Ticker | Company | Sector | Market Cap |
|------|--------|---------|--------|------------|
| 1 | OGC | OceanaGold Corporation | Non-energy minerals | - |

### 125. REIT - Industrial - 1 tickers (Non-priority / later batch)
| Rank | Ticker | Company | Sector | Market Cap |
|------|--------|---------|--------|------------|
| 1 | LPA | Logistic Properties of the Americas | Real Estate | $113.2M |

### 126. REIT - Residential - 1 tickers (Non-priority / later batch)
| Rank | Ticker | Company | Sector | Market Cap |
|------|--------|---------|--------|------------|
| 1 | MRP | Millrose Properties, Inc. | Real Estate | $4.1B |

### 127. Real Estate - Development - 8 tickers (Non-priority / later batch)
| Rank | Ticker | Company | Sector | Market Cap |
|------|--------|---------|--------|------------|
| 1 | FOR | Forestar Group Inc. | Real Estate | $1.4B |
| 2 | AGNT | eXp World Holdings, Inc. Common Stock | Financial Services | $830.6M |
| 3 | FPH | Five Point Holdings, LLC | Real Estate | $336.2M |
| 4 | ARL | American Realty Investors, Inc. | Real Estate | $211.4M |
| 5 | OZ | Belpointe PREP, LLC | Real Estate | $195.5M |
| 6 | AXR | AMREP Corporation | Real Estate | $131.3M |
| 7 | JFB | JFB Construction Holdings Class A Common Stock | Real Estate | $96.4M |
| 8 | AEI | Alset Inc. | Real Estate | $73.6M |

### 128. Real Estate - Diversified - 3 tickers (Non-priority / later batch)
| Rank | Ticker | Company | Sector | Market Cap |
|------|--------|---------|--------|------------|
| 1 | HHH | Howard Hughes Holdings Inc. | Real Estate | $3.8B |
| 2 | JOE | The St. Joe Company | Real Estate | $3.7B |
| 3 | STRS | Stratus Properties Inc. | Real Estate | $236.6M |

### 129. Real Estate - General - 1 tickers (Non-priority / later batch)
| Rank | Ticker | Company | Sector | Market Cap |
|------|--------|---------|--------|------------|
| 1 | BEEP | Mobile Infrastructure Corporation | Real Estate | $79.9M |

### 130. Real Estate - Services - 20 tickers (Non-priority / later batch)
| Rank | Ticker | Company | Sector | Market Cap |
|------|--------|---------|--------|------------|
| 1 | CBRE | CBRE Group, Inc. | Real Estate | $42.2B |
| 2 | JLL | Jones Lang LaSalle Incorporated | Real Estate | $14.7B |
| 3 | CSGP | CoStar Group, Inc. | Real Estate | $13.5B |
| 4 | FSV | FirstService Corporation | Real Estate | $6.0B |
| 5 | OPEN | Opendoor Technologies Inc. | Real Estate | $3.6B |
| 6 | CWK | Cushman & Wakefield plc | Real Estate | $3.1B |
| 7 | NMRK | Newmark Group, Inc. | Real Estate | $2.5B |
| 8 | KW | Kennedy-Wilson Holdings, Inc. | Real Estate | $1.5B |
| 9 | HBNB | Hotel101 Global Holdings Corp. Class A Ordinary Shares | Real Estate | $1.4B |
| 10 | MMI | Marcus & Millichap, Inc. | Real Estate | $1.1B |
| 11 | EXPI | eXp World Holdings, Inc. | Real Estate | $830.6M |
| 12 | FRPH | FRP Holdings, Inc. | Real Estate | $430.2M |
| 13 | TCI | Transcontinental Realty Investors, Inc. | Real Estate | $303.2M |
| 14 | MLP | Maui Land & Pineapple Company, Inc. | Real Estate | $300.8M |
| 15 | RMAX | RE/MAX Holdings, Inc. | Real Estate | $194.0M |
| 16 | DOUG | Douglas Elliman Inc. | Real Estate | $156.4M |
| 17 | LODE | Comstock Inc. | Real Estate | $107.7M |
| 18 | MAYS | J.W. Mays, Inc. | Real Estate | $86.1M |
| 19 | RFL | Rafael Holdings, Inc. | Real Estate | $48.9M |
| 20 | DUO | Fangdd Network Group Ltd. | Real Estate | $10.5M |

### 131. Real Estate Services - 1 tickers (Non-priority / later batch)
| Rank | Ticker | Company | Sector | Market Cap |
|------|--------|---------|--------|------------|
| 1 | SRG | Seritage Growth Properties | Real Estate | $147.0M |

### 132. Software - Services - 1 tickers (Non-priority / later batch)
| Rank | Ticker | Company | Sector | Market Cap |
|------|--------|---------|--------|------------|
| 1 | NTSK | Netskope, Inc. Class A Common Stock | Technology | $4.3B |

### 133. Technology Distributors - 7 tickers (Non-priority / later batch)
| Rank | Ticker | Company | Sector | Market Cap |
|------|--------|---------|--------|------------|
| 1 | SNX | TD SYNNEX Corporation | Technology | $18.6B |
| 2 | ARW | Arrow Electronics, Inc. | Technology | $10.3B |
| 3 | AVT | Avnet, Inc. | Technology | $6.7B |
| 4 | NSIT | Insight Enterprises, Inc. | Technology | $2.6B |
| 5 | CNXN | PC Connection, Inc. | Technology | $1.6B |
| 6 | SCSC | ScanSource, Inc. | Technology | $884.1M |
| 7 | CLMB | Climb Global Solutions, Inc. | Technology | $358.6M |

### 134. Unknown - 1 tickers (Non-priority / later batch)
| Rank | Ticker | Company | Sector | Market Cap |
|------|--------|---------|--------|------------|
| 1 | SPX |  | Unknown | - |

### 135. Diversified Utilities - 9 tickers (Non-priority / later batch)
| Rank | Ticker | Company | Sector | Market Cap |
|------|--------|---------|--------|------------|
| 1 | BIP | Brookfield Infrastructure Partners L.P. | Utilities | $17.6B |
| 2 | AES | The AES Corporation | Utilities | $10.3B |
| 3 | NWE | Northwestern Energy Group Inc | Utilities | $4.4B |
| 4 | OTTR | Otter Tail Corporation | Utilities | $3.8B |
| 5 | AVA | Avista Corporation | Utilities | $3.4B |
| 6 | MGEE | MGE Energy, Inc. | Utilities | $2.8B |
| 7 | HE | Hawaiian Electric Industries, Inc. | Utilities | $2.3B |
| 8 | UTL | Unitil Corporation | Utilities | $913.6M |
| 9 | MNTK | Montauk Renewables, Inc. | Utilities | $200.7M |

### 136. Independent Power Producers - 6 tickers (Non-priority / later batch)
| Rank | Ticker | Company | Sector | Market Cap |
|------|--------|---------|--------|------------|
| 1 | VST | Vistra Corp. | Utilities | $49.5B |
| 2 | NRG | NRG Energy, Inc. | Utilities | $29.0B |
| 3 | TLN | Talen Energy Corporation | Utilities | $17.1B |
| 4 | KEN | Kenon Holdings Ltd. | Utilities | $4.8B |
| 5 | TAC | TransAlta Corporation | Utilities | $3.7B |
| 6 | XIFR | XPLR Infrastructure, LP | Utilities | $1.1B |

### 137. Regulated Electric - 33 tickers (Non-priority / later batch)
| Rank | Ticker | Company | Sector | Market Cap |
|------|--------|---------|--------|------------|
| 1 | NEE | NextEra Energy, Inc. | Utilities | $197.3B |
| 2 | SO | The Southern Company | Utilities | $105.4B |
| 3 | DUK | Duke Energy Corporation | Utilities | $97.5B |
| 4 | AEP | American Electric Power Company, Inc. | Utilities | $71.8B |
| 5 | D | Dominion Energy, Inc. | Utilities | $55.3B |
| 6 | ETR | Entergy Corporation | Utilities | $51.7B |
| 7 | XEL | Xcel Energy Inc. | Utilities | $49.9B |
| 8 | EXC | Exelon Corporation | Utilities | $46.0B |
| 9 | ED | Consolidated Edison, Inc. | Utilities | $39.4B |
| 10 | PEG | Public Service Enterprise Group Incorporated | Utilities | $39.2B |
| 11 | PCG | PG&E Corporation | Utilities | $37.0B |
| 12 | WEC | WEC Energy Group, Inc. | Utilities | $36.7B |
| 13 | AEE | Ameren Corporation | Utilities | $30.3B |
| 14 | DTE | DTE Energy Company | Utilities | $29.7B |
| 15 | FTS | Fortis Inc. | Utilities | $28.6B |
| 16 | CNP | CenterPoint Energy, Inc. | Utilities | $27.6B |
| 17 | EIX | Edison International | Utilities | $27.4B |
| 18 | PPL | PPL Corporation | Utilities | $27.3B |
| 19 | FE | FirstEnergy Corp. | Utilities | $25.9B |
| 20 | ES | Eversource Energy | Utilities | $25.8B |
| 21 | CMS | CMS Energy Corporation | Utilities | $22.6B |
| 22 | EVRG | Evergy, Inc. | Utilities | $19.2B |
| 23 | LNT | Alliant Energy Corporation | Utilities | $18.7B |
| 24 | EMA | Emera Incorporated | Utilities | $15.8B |
| 25 | OKLO | Oklo Inc. | Utilities | $12.8B |
| 26 | PNW | Pinnacle West Capital Corporation | Utilities | $12.1B |
| 27 | OGE | OGE Energy Corp. | Utilities | $9.8B |
| 28 | IDA | IDACORP, Inc. | Utilities | $8.0B |
| 29 | TXNM | TXNM Energy, Inc. | Utilities | $6.6B |
| 30 | POR | Portland General Electric Company | Utilities | $5.6B |
| 31 | IMSR | Terrestrial Energy Inc. | Energy | $607.3M |
| 32 | NKLR | Terra Innovatum Global N.V. Ordinary shares | Energy | $419.7M |
| 33 | GNE | Genie Energy Ltd. | Utilities | $374.1M |

### 138. Regulated Gas - 1 tickers (Non-priority / later batch)
| Rank | Ticker | Company | Sector | Market Cap |
|------|--------|---------|--------|------------|
| 1 | OPAL | OPAL Fuels Inc. | Utilities | $60.3M |

### 139. Regulated Water - 12 tickers (Non-priority / later batch)
| Rank | Ticker | Company | Sector | Market Cap |
|------|--------|---------|--------|------------|
| 1 | AWK | American Water Works Company, Inc. | Utilities | $24.9B |
| 2 | WTRG | Essential Utilities, Inc. | Utilities | $10.8B |
| 3 | AWR | American States Water Company | Utilities | $3.0B |
| 4 | CWT | California Water Service Group | Utilities | $2.6B |
| 5 | HTO | H2O America | Utilities | $2.0B |
| 6 | MSEX | Middlesex Water Company | Utilities | $967.2M |
| 7 | CWCO | Consolidated Water Co. Ltd. | Utilities | $485.4M |
| 8 | YORW | The York Water Company | Utilities | $479.5M |
| 9 | CDZI | Cadiz Inc. | Utilities | $386.7M |
| 10 | ARTNA | Artesian Resources Corporation | Utilities | $339.1M |
| 11 | PCYO | Pure Cycle Corporation | Utilities | $268.8M |
| 12 | GWRS | Global Water Resources, Inc. | Utilities | $200.5M |

### 140. Renewable Utilities - 15 tickers (Non-priority / later batch)
| Rank | Ticker | Company | Sector | Market Cap |
|------|--------|---------|--------|------------|
| 1 | GEV | GE Vernova Inc. | Utilities | $288.1B |
| 2 | CEG | Constellation Energy Corporation | Utilities | $91.7B |
| 3 | ENLT | Enlight Renewable Energy Ltd | Utilities | $12.7B |
| 4 | BEP | Brookfield Renewable Partners L.P. | Utilities | $10.5B |
| 5 | CWEN.A | Clearway Energy, Inc. | Utilities | $8.3B |
| 6 | CWEN | Clearway Energy, Inc. | Utilities | $7.8B |
| 7 | ORA | Ormat Technologies, Inc. | Utilities | $7.8B |
| 8 | BEPC | Brookfield Renewable Corporation | Utilities | $5.4B |
| 9 | AQN | Algonquin Power & Utilities Corp. | Utilities | $4.6B |
| 10 | FLNC | Fluence Energy, Inc. | Utilities | $3.9B |
| 11 | SMR | NuScale Power Corporation | Utilities | $3.6B |
| 12 | RNW | ReNew Energy Global Plc | Utilities | $2.0B |
| 13 | NRGV | Energy Vault Holdings, Inc. | Utilities | $926.5M |
| 14 | ELLO | Ellomay Capital Ltd. | Utilities | $327.1M |
| 15 | VGAS | Verde Clean Fuels, Inc. | Utilities | $74.8M |

### 141. Utilities - Independent Power Producers - 1 tickers (Non-priority / later batch)
| Rank | Ticker | Company | Sector | Market Cap |
|------|--------|---------|--------|------------|
| 1 | DGXX | Digi Power X Inc. | Utilities | $611.0M |

