import { useState } from "react";
import { ComposableMap, Geographies, Geography, ZoomableGroup } from "react-simple-maps";

// ISO Alpha-2 → Alpha-3 lookup (covers all UN member states + common territories)
const A2_TO_A3: Record<string, string> = {
  AF:"AFG",AX:"ALA",AL:"ALB",DZ:"DZA",AS:"ASM",AD:"AND",AO:"AGO",AI:"AIA",AQ:"ATA",
  AG:"ATG",AR:"ARG",AM:"ARM",AW:"ABW",AU:"AUS",AT:"AUT",AZ:"AZE",BS:"BHS",BH:"BHR",
  BD:"BGD",BB:"BRB",BY:"BLR",BE:"BEL",BZ:"BLZ",BJ:"BEN",BM:"BMU",BT:"BTN",BO:"BOL",
  BQ:"BES",BA:"BIH",BW:"BWA",BV:"BVT",BR:"BRA",IO:"IOT",BN:"BRN",BG:"BGR",BF:"BFA",
  BI:"BDI",CV:"CPV",KH:"KHM",CM:"CMR",CA:"CAN",KY:"CYM",CF:"CAF",TD:"TCD",CL:"CHL",
  CN:"CHN",CX:"CXR",CC:"CCK",CO:"COL",KM:"COM",CG:"COG",CD:"COD",CK:"COK",CR:"CRI",
  CI:"CIV",HR:"HRV",CU:"CUB",CW:"CUW",CY:"CYP",CZ:"CZE",DK:"DNK",DJ:"DJI",DM:"DMA",
  DO:"DOM",EC:"ECU",EG:"EGY",SV:"SLV",GQ:"GNQ",ER:"ERI",EE:"EST",SZ:"SWZ",ET:"ETH",
  FK:"FLK",FO:"FRO",FJ:"FJI",FI:"FIN",FR:"FRA",GF:"GUF",PF:"PYF",TF:"ATF",GA:"GAB",
  GM:"GMB",GE:"GEO",DE:"DEU",GH:"GHA",GI:"GIB",GR:"GRC",GL:"GRL",GD:"GRD",GP:"GLP",
  GU:"GUM",GT:"GTM",GG:"GGY",GN:"GIN",GW:"GNB",GY:"GUY",HT:"HTI",HM:"HMD",VA:"VAT",
  HN:"HND",HK:"HKG",HU:"HUN",IS:"ISL",IN:"IND",ID:"IDN",IR:"IRN",IQ:"IRQ",IE:"IRL",
  IM:"IMN",IL:"ISR",IT:"ITA",JM:"JAM",JP:"JPN",JE:"JEY",JO:"JOR",KZ:"KAZ",KE:"KEN",
  KI:"KIR",KP:"PRK",KR:"KOR",KW:"KWT",KG:"KGZ",LA:"LAO",LV:"LVA",LB:"LBN",LS:"LSO",
  LR:"LBR",LY:"LBY",LI:"LIE",LT:"LTU",LU:"LUX",MO:"MAC",MG:"MDG",MW:"MWI",MY:"MYS",
  MV:"MDV",ML:"MLI",MT:"MLT",MH:"MHL",MQ:"MTQ",MR:"MRT",MU:"MUS",YT:"MYT",MX:"MEX",
  FM:"FSM",MD:"MDA",MC:"MCO",MN:"MNG",ME:"MNE",MS:"MSR",MA:"MAR",MZ:"MOZ",MM:"MMR",
  NA:"NAM",NR:"NRU",NP:"NPL",NL:"NLD",NC:"NCL",NZ:"NZL",NI:"NIC",NE:"NER",NG:"NGA",
  NU:"NIU",NF:"NFK",MK:"MKD",MP:"MNP",NO:"NOR",OM:"OMN",PK:"PAK",PW:"PLW",PS:"PSE",
  PA:"PAN",PG:"PNG",PY:"PRY",PE:"PER",PH:"PHL",PN:"PCN",PL:"POL",PT:"PRT",PR:"PRI",
  QA:"QAT",RE:"REU",RO:"ROU",RU:"RUS",RW:"RWA",BL:"BLM",SH:"SHN",KN:"KNA",LC:"LCA",
  MF:"MAF",PM:"SPM",VC:"VCT",WS:"WSM",SM:"SMR",ST:"STP",SA:"SAU",SN:"SEN",RS:"SRB",
  SC:"SYC",SL:"SLE",SG:"SGP",SX:"SXM",SK:"SVK",SI:"SVN",SB:"SLB",SO:"SOM",ZA:"ZAF",
  GS:"SGS",SS:"SSD",ES:"ESP",LK:"LKA",SD:"SDN",SR:"SUR",SJ:"SJM",SE:"SWE",CH:"CHE",
  SY:"SYR",TW:"TWN",TJ:"TJK",TZ:"TZA",TH:"THA",TL:"TLS",TG:"TGO",TK:"TKL",TO:"TON",
  TT:"TTO",TN:"TUN",TR:"TUR",TM:"TKM",TC:"TCA",TV:"TUV",UG:"UGA",UA:"UKR",AE:"ARE",
  GB:"GBR",US:"USA",UM:"UMI",UY:"URY",UZ:"UZB",VU:"VUT",VE:"VEN",VN:"VNM",VG:"VGB",
  VI:"VIR",WF:"WLF",EH:"ESH",YE:"YEM",ZM:"ZMB",ZW:"ZWE",XK:"XKX",
};

const GEO_URL =
  "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

type GeoRow = { country: string; views: number };

interface TooltipState {
  name: string;
  views: number;
  x: number;
  y: number;
}

function interpolateColor(t: number): string {
  // White → forest green (#2a5434)
  const r = Math.round(255 - t * (255 - 42));
  const g = Math.round(255 - t * (255 - 84));
  const b = Math.round(255 - t * (255 - 52));
  return `rgb(${r},${g},${b})`;
}

export default function WorldMap({ rows }: { rows: GeoRow[] }) {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  // Build lookup: Alpha-3 → views
  const viewsByA3 = new Map<string, number>();
  for (const row of rows) {
    const a3 = A2_TO_A3[row.country.toUpperCase()];
    if (a3) viewsByA3.set(a3, row.views);
  }

  const maxViews = Math.max(...Array.from(viewsByA3.values()), 1);

  function fillForGeo(a3: string): string {
    const v = viewsByA3.get(a3);
    if (!v) return "#e5e7eb"; // no data — light gray
    const t = Math.pow(v / maxViews, 0.4); // power scale so small values still show
    return interpolateColor(t);
  }

  return (
    <div className="relative select-none" style={{ background: "#f0f4f8", borderRadius: 8 }}>
      <ComposableMap
        projectionConfig={{ rotate: [-10, 0, 0], scale: 147 }}
        style={{ width: "100%", height: "auto" }}
        height={380}
      >
        <ZoomableGroup>
          <Geographies geography={GEO_URL}>
            {({ geographies }) =>
              geographies.map((geo) => {
                const a3: string = geo.properties.ISO_A3 ?? geo.id ?? "";
                const views = viewsByA3.get(a3) ?? 0;
                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    fill={fillForGeo(a3)}
                    stroke="#fff"
                    strokeWidth={0.4}
                    style={{
                      default: { outline: "none" },
                      hover: { outline: "none", fill: views ? "#1a3a24" : "#d1d5db", cursor: views ? "pointer" : "default" },
                      pressed: { outline: "none" },
                    }}
                    onMouseEnter={(e) => {
                      if (!views && !geo.properties.name) return;
                      setTooltip({
                        name: geo.properties.name ?? a3,
                        views,
                        x: e.clientX,
                        y: e.clientY,
                      });
                    }}
                    onMouseMove={(e) => {
                      if (tooltip) setTooltip((t) => t ? { ...t, x: e.clientX, y: e.clientY } : t);
                    }}
                    onMouseLeave={() => setTooltip(null)}
                  />
                );
              })
            }
          </Geographies>
        </ZoomableGroup>
      </ComposableMap>

      {/* Legend */}
      <div className="flex items-center gap-2 px-3 pb-2 text-xs text-gray-500">
        <span>0</span>
        <div
          style={{
            width: 120,
            height: 10,
            borderRadius: 4,
            background: "linear-gradient(to right, #e5e7eb, #2a5434)",
          }}
        />
        <span>{maxViews.toLocaleString()} views</span>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="pointer-events-none fixed z-50 rounded-md bg-gray-900 text-white text-xs px-2 py-1 shadow-lg"
          style={{ left: tooltip.x + 12, top: tooltip.y - 28 }}
        >
          <span className="font-medium">{tooltip.name}</span>
          {tooltip.views > 0 && (
            <span className="ml-2 text-gray-300">{tooltip.views.toLocaleString()} views</span>
          )}
        </div>
      )}
    </div>
  );
}
