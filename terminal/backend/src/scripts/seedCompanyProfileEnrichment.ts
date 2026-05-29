import { initDb, getDb } from "../db.js";
import {
  upsertCompanyProfileEnrichment,
  type CompanyProfileEnrichmentInput,
} from "../services/companyProfileEnrichmentRepository.js";

const SOURCE_NOTE = "manual curated v1 for AI/tech pilot; verify against latest filings before full-universe rollout";

const AI_TECH_SEED: CompanyProfileEnrichmentInput[] = [
  {
    ticker: "NVDA",
    shortDescription: "AI accelerator platform company selling GPUs, systems, networking, and software used to build and run large AI clusters.",
    enhancedDescription: "NVIDIA sells the core compute stack behind many AI training and inference clusters: data-center GPUs and accelerators, HGX/DGX reference systems, high-speed networking, and CUDA-based software libraries. A cloud provider or enterprise buyer typically uses NVIDIA parts inside AI servers or full racks to train foundation models, run inference, or accelerate scientific and data workloads.",
    products: ["H100/H200 and Blackwell AI accelerators", "HGX/DGX AI server platforms", "InfiniBand and Ethernet networking", "CUDA, TensorRT, and NVIDIA AI Enterprise software"],
    revenueModel: ["Data-center GPU and system sales", "Networking adapters, switches, and interconnects", "Gaming/pro visualization chips", "Automotive and embedded platform revenue"],
    keyMetrics: ["Data Center revenue", "gross margin", "AI accelerator supply and lead times", "networking attach rate"],
    watchPoints: ["Blackwell ramp and shipment timing", "hyperscaler capex commentary", "inference mix versus training demand", "export-control impact"],
    risks: ["hyperscaler customer concentration", "custom ASIC substitution", "export controls", "supply-chain bottlenecks"],
    peerGroups: [
      { category: "core_ai_accelerator", label: "Core AI accelerator peers", tickers: ["AMD", "AVGO"], note: "AMD competes in merchant accelerators; AVGO competes more through custom AI silicon and networking." },
      { category: "read_through", label: "AI infrastructure read-through", tickers: ["SMCI", "DELL", "VRT", "ANET", "CRDO"] },
    ],
    tags: ["ai_tech_priority", "ai_infrastructure", "semiconductors"],
    sourceNote: SOURCE_NOTE,
  },
  {
    ticker: "AVGO",
    shortDescription: "Broadcom combines custom AI accelerators, switching silicon, optical/connectivity chips, and VMware infrastructure software.",
    enhancedDescription: "Broadcom is important to AI infrastructure through custom silicon and networking. Large cloud customers can use Broadcom-designed ASICs or XPUs for specialized AI workloads, while Broadcom switching, routing, and optical components move data across AI clusters. VMware adds a software infrastructure layer that can influence enterprise private-cloud and virtualization spending.",
    products: ["custom AI accelerators and ASIC programs", "Tomahawk/Jericho switching and routing silicon", "optical and connectivity components", "VMware Cloud Foundation and infrastructure software"],
    revenueModel: ["semiconductor product sales", "custom silicon programs", "infrastructure software subscriptions and support", "enterprise license renewals"],
    keyMetrics: ["AI semiconductor revenue", "networking silicon demand", "VMware booking and renewal trends", "gross margin"],
    watchPoints: ["custom AI chip customer ramps", "Ethernet AI cluster adoption", "VMware integration execution", "enterprise software renewal quality"],
    risks: ["custom-program lumpiness", "customer concentration", "VMware churn risk", "semiconductor cycle volatility"],
    peerGroups: [
      { category: "core_ai_silicon_networking", label: "AI silicon/networking peers", tickers: ["NVDA", "AMD", "MRVL", "ANET", "CRDO"] },
      { category: "software_adjacent", label: "Infrastructure software adjacent", tickers: ["MSFT", "ORCL"] },
    ],
    tags: ["ai_tech_priority", "ai_silicon", "ai_networking"],
    sourceNote: SOURCE_NOTE,
  },
  {
    ticker: "AMD",
    shortDescription: "AMD sells AI GPUs, EPYC server CPUs, PC CPUs/GPUs, and embedded chips, making it the main merchant alternative to NVIDIA in accelerators.",
    enhancedDescription: "AMD competes in AI infrastructure with Instinct accelerators for training and inference, EPYC server CPUs that sit in AI and cloud servers, and adaptive/embedded products used in edge and specialized compute. The stock often reacts to whether AMD is gaining enough AI accelerator share while keeping server CPU momentum.",
    products: ["Instinct MI-series AI accelerators", "EPYC server CPUs", "Ryzen PC processors", "adaptive SoCs and embedded chips"],
    revenueModel: ["data-center GPU and CPU sales", "client PC processors", "gaming GPUs and semi-custom chips", "embedded/adaptive chip sales"],
    keyMetrics: ["Data Center segment revenue", "Instinct accelerator run-rate", "server CPU share", "gross margin"],
    watchPoints: ["MI-series supply and customer wins", "server CPU share versus Intel", "AI software ecosystem progress", "PC demand recovery"],
    risks: ["NVIDIA ecosystem gap", "AI GPU pricing pressure", "PC cyclicality", "foundry capacity constraints"],
    peerGroups: [
      { category: "core_ai_accelerator", label: "Core AI accelerator peers", tickers: ["NVDA", "AVGO"] },
      { category: "server_cpu", label: "Server CPU peer", tickers: ["INTC"] },
    ],
    tags: ["ai_tech_priority", "ai_accelerator", "semiconductors"],
    sourceNote: SOURCE_NOTE,
  },
  {
    ticker: "MU",
    shortDescription: "Micron sells DRAM, NAND, and high-bandwidth memory, with AI demand centered on HBM used beside advanced GPUs.",
    enhancedDescription: "Micron is a memory supplier. In AI clusters, the key product is HBM, which sits close to GPUs and determines how quickly models can feed data into compute. Micron also sells DRAM and NAND into data centers, PCs, phones, autos, and industrial markets, so results are a mix of AI-driven HBM growth and the broader memory pricing cycle.",
    products: ["HBM for AI accelerators", "DRAM modules", "NAND flash storage", "data-center SSDs"],
    revenueModel: ["memory chip and module sales", "data-center and client SSD sales", "longer-term supply agreements with large customers"],
    keyMetrics: ["HBM revenue and capacity", "DRAM/NAND pricing", "bit shipment growth", "gross margin recovery"],
    watchPoints: ["HBM qualification with GPU platforms", "memory supply discipline", "data-center mix", "inventory normalization"],
    risks: ["memory oversupply", "commodity price swings", "capex intensity", "customer qualification delays"],
    peerGroups: [
      { category: "memory", label: "Memory peers", tickers: ["WDC", "STX"], companies: ["SK hynix", "Samsung Memory"] },
      { category: "ai_read_through", label: "AI platform read-through", tickers: ["NVDA", "AMD"] },
    ],
    tags: ["ai_tech_priority", "hbm", "memory"],
    sourceNote: SOURCE_NOTE,
  },
  {
    ticker: "DELL",
    shortDescription: "Dell sells enterprise servers, storage, PCs, and services; AI upside is mainly GPU server demand and related storage/networking attach.",
    enhancedDescription: "Dell is a hardware systems vendor. Its AI exposure comes from PowerEdge and rack-scale servers configured with accelerators, plus storage, networking, support, and deployment services around those systems. The key question is whether AI server revenue converts into durable margin and backlog rather than low-margin pass-through hardware sales.",
    products: ["PowerEdge AI and general-purpose servers", "PowerScale and enterprise storage", "commercial PCs and workstations", "deployment, support, and financing services"],
    revenueModel: ["server and storage hardware sales", "PC sales", "support/service contracts", "financing and lifecycle services"],
    keyMetrics: ["ISG revenue", "AI server orders/backlog", "server gross margin", "storage attach rate"],
    watchPoints: ["AI server backlog conversion", "margin on accelerator-heavy systems", "enterprise storage recovery", "PC refresh demand"],
    risks: ["low-margin AI server mix", "component supply constraints", "PC cyclicality", "competition from ODMs and SMCI"],
    peerGroups: [
      { category: "ai_server_systems", label: "AI server systems peers", tickers: ["SMCI", "HPE", "CLS", "JBL"] },
      { category: "upstream_read_through", label: "Upstream AI suppliers", tickers: ["NVDA", "AMD", "VRT"] },
    ],
    tags: ["ai_tech_priority", "ai_servers", "computer_hardware"],
    sourceNote: SOURCE_NOTE,
  },
  {
    ticker: "SMCI",
    shortDescription: "Super Micro sells high-density AI servers and rack-scale systems, often tied closely to GPU platform ramps and liquid-cooling adoption.",
    enhancedDescription: "Super Micro Computer builds server systems, storage, and rack-scale AI infrastructure for enterprise, cloud, and service-provider customers. Its AI angle is speed: it packages new GPU platforms quickly, including dense and liquid-cooled configurations. Results are sensitive to order timing, component availability, margins, and investor confidence in controls and filings.",
    products: ["GPU servers", "rack-scale AI systems", "liquid-cooled server platforms", "storage and edge servers"],
    revenueModel: ["server system sales", "rack integration", "storage and networking attach", "support and services"],
    keyMetrics: ["quarterly revenue growth", "gross margin", "AI backlog/order commentary", "inventory and cash conversion"],
    watchPoints: ["new GPU platform availability", "liquid-cooling adoption", "large customer concentration", "filing and internal-control updates"],
    risks: ["margin compression", "governance/filing risk", "working-capital swings", "competition from Dell/HPE/ODMs"],
    peerGroups: [
      { category: "ai_server_systems", label: "AI server systems peers", tickers: ["DELL", "HPE", "CLS", "JBL"] },
      { category: "upstream_read_through", label: "Upstream AI suppliers", tickers: ["NVDA", "AMD", "VRT"] },
    ],
    tags: ["ai_tech_priority", "ai_servers", "computer_hardware"],
    sourceNote: SOURCE_NOTE,
  },
  {
    ticker: "HPE",
    shortDescription: "HPE sells enterprise servers, storage, networking, and GreenLake services; AI demand shows up in accelerator systems and networking.",
    enhancedDescription: "Hewlett Packard Enterprise sells infrastructure to enterprises and service providers: servers, storage, networking, and hybrid-cloud services. AI upside comes from GPU servers, private AI infrastructure, and high-performance networking, while the core business still depends on traditional enterprise IT budgets and execution in networking.",
    products: ["ProLiant and Cray server systems", "HPE GreenLake hybrid-cloud platform", "Aruba networking", "storage and edge infrastructure"],
    revenueModel: ["server and networking hardware", "storage systems", "subscription and service contracts", "hybrid-cloud consumption offerings"],
    keyMetrics: ["server revenue", "AI systems order/backlog", "networking revenue", "annualized revenue run-rate"],
    watchPoints: ["AI order conversion", "networking recovery", "GreenLake growth", "margin balance between hardware and services"],
    risks: ["enterprise IT cyclicality", "competition from Dell and ODMs", "networking integration risk", "low-margin AI configurations"],
    peerGroups: [
      { category: "ai_server_systems", label: "AI server systems peers", tickers: ["DELL", "SMCI", "ANET"] },
      { category: "networking_adjacent", label: "Networking adjacent", tickers: ["CSCO", "ANET", "CIEN"] },
    ],
    tags: ["ai_tech_priority", "ai_servers", "communication_equipment"],
    sourceNote: SOURCE_NOTE,
  },
  {
    ticker: "ANET",
    shortDescription: "Arista sells high-speed cloud and AI networking switches, operating systems, and campus networking products.",
    enhancedDescription: "Arista Networks is a networking equipment company focused on cloud-scale data centers. In AI clusters, its Ethernet switching platforms and EOS software help connect many servers and accelerators with low latency and high bandwidth. The thesis depends on Ethernet gaining share in AI networks and on large cloud customers continuing to expand capacity.",
    products: ["high-speed Ethernet switches", "EOS network operating system", "CloudVision management software", "campus and routing products"],
    revenueModel: ["switch hardware sales", "software and support", "cloud and enterprise deployments"],
    keyMetrics: ["cloud titan revenue mix", "AI networking demand", "gross margin", "large customer concentration"],
    watchPoints: ["800G adoption", "Ethernet versus InfiniBand share", "hyperscaler capex", "enterprise/campus expansion"],
    risks: ["customer concentration", "competitive pressure from NVIDIA/Cisco", "cloud capex pause", "product-cycle timing"],
    peerGroups: [
      { category: "ai_networking", label: "AI networking peers", tickers: ["CSCO", "AVGO", "CRDO", "CIEN"] },
      { category: "ai_cluster_read_through", label: "AI cluster read-through", tickers: ["NVDA", "DELL", "SMCI"] },
    ],
    tags: ["ai_tech_priority", "ai_networking", "computer_hardware"],
    sourceNote: SOURCE_NOTE,
  },
  {
    ticker: "CRDO",
    shortDescription: "Credo sells high-speed connectivity chips, DSPs, and active electrical cables used in data-center and AI cluster networks.",
    enhancedDescription: "Credo Technology supplies connectivity products that help move data inside large data centers. In AI infrastructure, the relevant products are high-speed SerDes, DSPs, retimers, optical/electrical connectivity, and active electrical cables used around GPU clusters. The business can grow quickly when a large cloud or networking customer ramps a new platform.",
    products: ["active electrical cables", "SerDes and DSP connectivity chips", "retimers", "optical connectivity components"],
    revenueModel: ["chip and cable product sales", "platform design wins", "data-center customer ramps"],
    keyMetrics: ["data-center revenue", "large customer concentration", "new platform ramps", "gross margin"],
    watchPoints: ["AI cluster connectivity demand", "customer ramp timing", "AEC adoption", "inventory normalization"],
    risks: ["high customer concentration", "design-win timing", "competition from larger silicon vendors", "data-center capex cyclicality"],
    peerGroups: [
      { category: "ai_connectivity", label: "AI connectivity peers", tickers: ["AVGO", "MRVL", "ANET", "LITE"] },
      { category: "ai_infrastructure_read_through", label: "AI infrastructure read-through", tickers: ["NVDA", "SMCI", "DELL"] },
    ],
    tags: ["ai_tech_priority", "ai_connectivity", "communication_equipment"],
    sourceNote: SOURCE_NOTE,
  },
  {
    ticker: "VRT",
    shortDescription: "Vertiv sells data-center power, cooling, and thermal infrastructure, making it a picks-and-shovels AI infrastructure name.",
    enhancedDescription: "Vertiv supplies the physical infrastructure that keeps data centers running: power management, UPS systems, switchgear, cooling, thermal controls, racks, and services. AI clusters raise rack power density and cooling complexity, so Vertiv is a read-through for AI data-center buildouts even though it does not sell chips or servers.",
    products: ["UPS and power distribution", "thermal management and cooling systems", "racks and enclosures", "data-center services"],
    revenueModel: ["equipment sales", "large project deployments", "maintenance and lifecycle services", "replacement and expansion demand"],
    keyMetrics: ["orders", "backlog", "organic growth", "operating margin"],
    watchPoints: ["AI data-center power density", "liquid-cooling adoption", "hyperscaler and colocation capex", "supply-chain execution"],
    risks: ["project timing lumpiness", "data-center capex pause", "margin pressure", "supply constraints"],
    peerGroups: [
      { category: "data_center_power_cooling", label: "Data-center power/cooling peers", tickers: ["ETN", "TT", "NVT", "HUBB"] },
      { category: "ai_infrastructure_read_through", label: "AI infrastructure read-through", tickers: ["NVDA", "DELL", "SMCI", "ANET"] },
    ],
    tags: ["ai_tech_priority", "data_center_infrastructure", "electrical_equipment"],
    sourceNote: SOURCE_NOTE,
  },
  {
    ticker: "PLTR",
    shortDescription: "Palantir sells data integration and AI decision platforms to governments and enterprises through Gotham, Foundry, and AIP.",
    enhancedDescription: "Palantir is a software platform company. Its products help organizations connect messy data, build operational workflows, and deploy AI-assisted decision systems. Government agencies use Gotham for intelligence and defense workflows; commercial customers use Foundry and AIP to apply AI to operations such as supply chain, manufacturing, customer service, and risk analysis.",
    products: ["Gotham government platform", "Foundry enterprise data platform", "AIP for AI workflows", "Ontology and workflow tooling"],
    revenueModel: ["multi-year software contracts", "government programs", "commercial platform subscriptions", "deployment and expansion services"],
    keyMetrics: ["US commercial revenue growth", "government revenue growth", "remaining deal value", "customer count and net retention"],
    watchPoints: ["AIP adoption and conversion", "commercial customer expansion", "defense/government contract timing", "margin durability"],
    risks: ["valuation sensitivity", "large contract timing", "government budget risk", "competition from cloud and analytics platforms"],
    peerGroups: [
      { category: "ai_platform_software", label: "AI/data platform peers", tickers: ["SNOW", "DDOG", "MSFT", "ORCL"] },
      { category: "defense_it_read_through", label: "Defense IT read-through", tickers: ["LDOS", "CACI", "SAIC", "BBAI"] },
    ],
    tags: ["ai_tech_priority", "ai_software", "software_infrastructure"],
    sourceNote: SOURCE_NOTE,
  },
  {
    ticker: "SNOW",
    shortDescription: "Snowflake sells a cloud data platform used for warehousing, data sharing, app development, and AI/ML workloads.",
    enhancedDescription: "Snowflake sells the Snowflake Data Cloud, a managed platform where customers store, query, govern, share, and build applications on structured and semi-structured data. Concrete products include virtual warehouses for compute, Snowpipe for ingestion, Streams/Tasks for pipelines, Snowpark and Streamlit for app development, Cortex AI and Document AI for AI features, Marketplace, and clean rooms for governed data sharing.",
    products: ["Snowflake Data Cloud", "virtual warehouses", "Snowpipe and Streams/Tasks", "Snowpark and Streamlit", "Cortex AI and Document AI", "Marketplace and clean rooms"],
    revenueModel: ["consumption-based compute and storage usage", "platform feature consumption", "enterprise support and contracted capacity"],
    keyMetrics: ["product revenue growth", "net revenue retention", "remaining performance obligations", "large customer count", "non-GAAP operating margin"],
    watchPoints: ["consumption stabilization", "Cortex AI usage", "enterprise data platform consolidation", "competition with Databricks and cloud-native warehouses"],
    risks: ["usage slowdown", "cloud platform competition", "sales execution", "AI features not translating into consumption"],
    peerGroups: [
      { category: "core_data_platform", label: "Core data platform peers", tickers: ["MDB", "TDC", "ORCL"], companies: ["Databricks"] },
      { category: "cloud_platform_adjacent", label: "Cloud platform adjacent", tickers: ["MSFT", "GOOGL", "AMZN"] },
    ],
    tags: ["ai_tech_priority", "data_platform", "software_application"],
    sourceNote: SOURCE_NOTE,
  },
];

function getLimit(): number {
  const arg = process.argv.find((value) => value.startsWith("--limit="));
  if (!arg) {
    return AI_TECH_SEED.length;
  }
  const parsed = Number(arg.slice("--limit=".length));
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : AI_TECH_SEED.length;
}

async function main(): Promise<void> {
  await initDb();
  const force = process.argv.includes("--force");
  const limit = getLimit();
  const targets = AI_TECH_SEED.slice(0, limit);
  const summary = { inserted: 0, updated: 0, skipped_existing: 0 };

  for (const entry of targets) {
    const result = await upsertCompanyProfileEnrichment({
      ...entry,
      skipExistingDescription: !force,
    });
    summary[result.status] += 1;
    console.log(`${entry.ticker}: ${result.status}`);
  }

  console.log(JSON.stringify({ theme: "ai_tech_priority", force, limit: targets.length, ...summary }, null, 2));
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await getDb().close();
    } catch {
      // ignore close errors during script shutdown
    }
  });