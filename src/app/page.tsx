"use client";

import { useState, useEffect } from "react";
import { 
  getAdminData, 
  getClientData, 
  createCliente, 
  createDispositivo 
} from "./actions";
import styles from "./dashboard.module.css";

interface Empresa {
  id: string;
  razaoSocial: string;
  cnpj: string;
  emailContato: string;
  telefone: string | null;
  status: string;
  criadoEm: string | Date;
}

interface Dispositivo {
  id: string;
  empresaClienteId: string;
  localInstalacao: string;
  produtoQuimicoAssociado: string;
  precoPormL: number;
  status: string;
  ultimaConexao: string | Date | null;
}

interface Registro {
  id: string;
  dispositivoId: string;
  mlConsumido: number;
  dataHora: string;
}

export default function Dashboard() {
  // Navigation & Role Simulation States
  const [currentRole, setCurrentRole] = useState<string>("admin"); // "admin" or client company ID
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Data States
  const [adminData, setAdminData] = useState<{
    faturamentoAcumuladoGlobal: number;
    empresas: Empresa[];
    dispositivos: Dispositivo[];
    registros: Registro[];
  } | null>(null);

  const [clientData, setClientData] = useState<{
    client: Empresa;
    devices: Dispositivo[];
    totalMLMensal: number;
    totalValorMensal: number;
    logs: Registro[];
  } | null>(null);

  // Timeframe toggle for Admin Telemetry
  const [timeframe, setTimeframe] = useState<"daily" | "weekly" | "monthly">("daily");

  // Modals
  const [showClientModal, setShowClientModal] = useState(false);
  const [showDeviceModal, setShowDeviceModal] = useState(false);

  // Form States
  const [clientForm, setClientForm] = useState({
    razaoSocial: "",
    cnpj: "",
    emailContato: "",
    telefone: "",
    status: "Ativo"
  });

  const [deviceForm, setDeviceForm] = useState({
    id: "",
    empresaClienteId: "",
    localInstalacao: "",
    produtoQuimicoAssociado: "",
    precoPormL: 0.05,
    status: "Ativo"
  });

  // ESP32 Simulator States
  const [simDevice, setSimDevice] = useState("");
  const [simML, setSimML] = useState(150);
  const [simLogs, setSimLogs] = useState<Array<{ time: string; status: number; payload: string; response: string }>>([]);
  const [isSimulating, setIsSimulating] = useState(false);

  // Chart Tooltip Hover State
  const [hoveredPoint, setHoveredPoint] = useState<{ x: number; y: number; label: string; value: string } | null>(null);

  // Load appropriate data based on role
  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      if (currentRole === "admin") {
        const res = await getAdminData();
        if (res.success && res.data) {
          // Assert type conversion for runtime dates
          const data = res.data as any;
          setAdminData(data);
          // Set first device in simulator default if available
          if (data.dispositivos.length > 0 && !simDevice) {
            setSimDevice(data.dispositivos[0].id);
          }
        } else {
          setError(res.error || "Erro ao carregar dados do administrador");
        }
      } else {
        const res = await getClientData(currentRole);
        if (res.success && res.data) {
          setClientData(res.data as any);
        } else {
          setError(res.error || "Erro ao carregar dados do cliente");
        }
      }
    } catch (err: any) {
      setError(err.message || "Ocorreu um erro inesperado");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentRole]);

  // Form Handlers
  const handleClientSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await createCliente(clientForm);
    if (res.success) {
      setShowClientModal(false);
      setClientForm({ razaoSocial: "", cnpj: "", emailContato: "", telefone: "", status: "Ativo" });
      loadData();
    } else {
      alert("Erro ao cadastrar cliente: " + res.error);
    }
  };

  const handleDeviceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await createDispositivo(deviceForm);
    if (res.success) {
      setShowDeviceModal(false);
      setDeviceForm({ id: "", empresaClienteId: "", localInstalacao: "", produtoQuimicoAssociado: "", precoPormL: 0.05, status: "Ativo" });
      loadData();
    } else {
      alert("Erro ao cadastrar dispositivo: " + res.error);
    }
  };

  // ESP32 Webhook Request Simulator
  const handleTriggerTelemetry = async () => {
    if (!simDevice) {
      alert("Por favor, selecione ou cadastre um dispositivo primeiro.");
      return;
    }
    setIsSimulating(true);
    const payload = { dispositivo_id: simDevice, ml_consumido: Number(simML) };
    
    try {
      const start = Date.now();
      const res = await fetch("/api/v1/consumo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const duration = Date.now() - start;
      const data = await res.json();
      
      const timeStr = new Date().toLocaleTimeString();
      setSimLogs(prev => [
        {
          time: timeStr,
          status: res.status,
          payload: JSON.stringify(payload),
          response: `${duration}ms - ${JSON.stringify(data)}`
        },
        ...prev
      ]);
      
      // Reload current view
      await loadData();
    } catch (err: any) {
      alert("Erro de conexão com o Webhook: " + err.message);
    } finally {
      setIsSimulating(false);
    }
  };

  // SVG Chart Helper: Grouping Admin logs for telemetry visualization
  const getAdminChartData = () => {
    const width = 600;
    const height = 200;
    const paddingLeft = 60;
    const paddingRight = 20;
    const paddingTop = 20;
    const paddingBottom = 40;

    const chartWidth = width - paddingLeft - paddingRight;
    const chartHeight = height - paddingTop - paddingBottom;

    if (!adminData || !adminData.registros || adminData.registros.length === 0) {
      return { 
        points: [], labels: [], values: [], maxVal: 100, 
        width, height, paddingLeft, paddingRight, paddingTop, paddingBottom, chartWidth, chartHeight 
      };
    }

    const deviceMap = new Map<string, Dispositivo>();
    adminData.dispositivos.forEach(d => deviceMap.set(d.id, d));

    const groupedData: { [key: string]: number } = {};
    const now = new Date();

    if (timeframe === "daily") {
      // Past 7 Days
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        const key = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
        groupedData[key] = 0;
      }
      
      adminData.registros.forEach(r => {
        const rDate = new Date(r.dataHora);
        const diffTime = Math.abs(now.getTime() - rDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays <= 7) {
          const key = rDate.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
          if (groupedData[key] !== undefined) {
            groupedData[key] += r.mlConsumido;
          }
        }
      });
    } else if (timeframe === "weekly") {
      // Past 4 Weeks
      for (let i = 3; i >= 0; i--) {
        groupedData[`Semana -${i}`] = 0;
      }
      adminData.registros.forEach(r => {
        const rDate = new Date(r.dataHora);
        const diffTime = Math.abs(now.getTime() - rDate.getTime());
        const diffWeeks = Math.floor(diffTime / (1000 * 60 * 60 * 24 * 7));
        if (diffWeeks >= 0 && diffWeeks < 4) {
          groupedData[`Semana -${diffWeeks}`] += r.mlConsumido;
        }
      });
    } else {
      // Past 6 Months
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = d.toLocaleDateString("pt-BR", { month: "short" });
        groupedData[key] = 0;
      }
      adminData.registros.forEach(r => {
        const rDate = new Date(r.dataHora);
        const key = rDate.toLocaleDateString("pt-BR", { month: "short" });
        if (groupedData[key] !== undefined) {
          groupedData[key] += r.mlConsumido;
        }
      });
    }

    const labels = Object.keys(groupedData);
    const values = Object.values(groupedData);
    const maxVal = Math.max(...values, 100);

    const points = labels.map((label, idx) => {
      const x = paddingLeft + (idx / (labels.length - 1 || 1)) * chartWidth;
      const y = paddingTop + chartHeight - (values[idx] / maxVal) * chartHeight;
      return { x, y, label, value: values[idx] };
    });

    return { points, labels, values, maxVal, width, height, paddingLeft, paddingRight, paddingTop, paddingBottom, chartWidth, chartHeight };
  };

  const adminChart = getAdminChartData();

  return (
    <div className={styles.container}>
      {/* Background Glowing Orbs */}
      <div className="glow-orbs">
        <div className="orb-1"></div>
        <div className="orb-2"></div>
      </div>

      {/* TOP HEADER & ROLE CONTROLLER */}
      <header className={styles.header}>
        <div className={styles.logoArea}>
          <div className={styles.logoIcon}>S</div>
          <span className={styles.logoTitle}>SmartClean</span>
        </div>
        
        <div className={styles.controls}>
          <div className={styles.roleSelectorWrapper}>
            <span className={styles.roleLabel}>Visualizar como:</span>
            <select 
              className={styles.roleSelect} 
              value={currentRole} 
              onChange={(e) => {
                setCurrentRole(e.target.value);
                setClientData(null);
              }}
            >
              <option value="admin">Administrador (Distribuidora)</option>
              {adminData?.empresas.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  Cliente: {emp.razaoSocial}
                </option>
              ))}
            </select>
          </div>
        </div>
      </header>

      {loading && (
        <div className="glass-card animate-fade-in" style={{ padding: "40px", textAlign: "center" }}>
          <p className="animate-pulse-slow" style={{ fontSize: "1.2rem", color: "var(--primary)" }}>Carregando dados do SmartClean...</p>
        </div>
      )}

      {error && (
        <div className="glass-card animate-fade-in" style={{ padding: "30px", borderLeft: "4px solid var(--danger)" }}>
          <h3 style={{ color: "var(--danger)" }}>Erro Operacional</h3>
          <p>{error}</p>
        </div>
      )}

      {!loading && !error && (
        <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          
          {/* ========================================================================= */}
          {/* VIEW: ADMINISTRATOR                                                       */}
          {/* ========================================================================= */}
          {currentRole === "admin" && adminData && (
            <>
              {/* ADMIN METRICS PANEL */}
              <section className={styles.metricsGrid}>
                {/* Metric 1 */}
                <div className={`${styles.metricCard} glass-card`}>
                  <div className={styles.metricHeader}>
                    <span className={styles.metricTitle}>Faturamento Global (Mês)</span>
                    <div className={styles.metricIcon} style={{ background: "rgba(16, 185, 129, 0.1)", color: "var(--accent)" }}>$</div>
                  </div>
                  <div className={styles.metricValue}>
                    {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(adminData.faturamentoAcumuladoGlobal)}
                  </div>
                  <span className={styles.metricSubtitle}>Soma de consumo pay-per-use ativo</span>
                </div>

                {/* Metric 2 */}
                <div className={`${styles.metricCard} glass-card`}>
                  <div className={styles.metricHeader}>
                    <span className={styles.metricTitle}>Volume Total Consumido</span>
                    <div className={styles.metricIcon} style={{ background: "rgba(14, 165, 233, 0.1)", color: "var(--secondary)" }}>L</div>
                  </div>
                  <div className={styles.metricValue}>
                    {new Intl.NumberFormat("pt-BR").format(
                      adminData.registros.reduce((acc, r) => acc + r.mlConsumido, 0) / 1000
                    )} L
                  </div>
                  <span className={styles.metricSubtitle}>Volume químico acumulado movimentado</span>
                </div>

                {/* Metric 3 */}
                <div className={`${styles.metricCard} glass-card`}>
                  <div className={styles.metricHeader}>
                    <span className={styles.metricTitle}>Dispositivos Conectados</span>
                    <div className={styles.metricIcon} style={{ background: "rgba(99, 102, 241, 0.1)", color: "var(--primary)" }}>⚙️</div>
                  </div>
                  <div className={styles.metricValue}>
                    {adminData.dispositivos.filter(d => d.status === "Ativo").length} / {adminData.dispositivos.length}
                  </div>
                  <span className={styles.metricSubtitle}>Placas ESP32 ativas na rede</span>
                </div>
              </section>

              {/* ADMIN CENTRAL TELEMETRY CHART */}
              <section className="glass-card" style={{ padding: "24px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                  <div>
                    <h3 style={{ fontSize: "1.2rem", fontWeight: "700" }}>Gráficos de Telemetria</h3>
                    <p style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Volume total de produtos consumidos em mililitros (mL)</p>
                  </div>
                  <div className={styles.tabGroup}>
                    <button 
                      className={`${styles.tabBtn} ${timeframe === "daily" ? styles.tabBtnActive : ""}`}
                      onClick={() => setTimeframe("daily")}
                    >
                      Diário
                    </button>
                    <button 
                      className={`${styles.tabBtn} ${timeframe === "weekly" ? styles.tabBtnActive : ""}`}
                      onClick={() => setTimeframe("weekly")}
                    >
                      Semanal
                    </button>
                    <button 
                      className={`${styles.tabBtn} ${timeframe === "monthly" ? styles.tabBtnActive : ""}`}
                      onClick={() => setTimeframe("monthly")}
                    >
                      Mensal
                    </button>
                  </div>
                </div>

                <div className={styles.chartContainer}>
                  {adminChart.points.length > 0 ? (
                    <svg className={styles.chartSvg} viewBox={`0 0 ${adminChart.width} ${adminChart.height}`}>
                      {/* Gradient Definitions */}
                      <defs>
                        <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.4" />
                          <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
                        </linearGradient>
                      </defs>

                      {/* Grid Lines */}
                      <g className={styles.chartGridLines}>
                        {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
                          const y = adminChart.paddingTop + ratio * adminChart.chartHeight;
                          return <line key={idx} x1={adminChart.paddingLeft} y1={y} x2={adminChart.width - adminChart.paddingRight} y2={y} />;
                        })}
                      </g>

                      {/* Axes */}
                      <g className={styles.chartAxis}>
                        {/* Y Labels */}
                        {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
                          const val = Math.round(adminChart.maxVal * (1 - ratio));
                          const y = adminChart.paddingTop + ratio * adminChart.chartHeight + 4;
                          return (
                            <text key={idx} x={adminChart.paddingLeft - 10} y={y} textAnchor="end">
                              {val} mL
                            </text>
                          );
                        })}

                        {/* X Labels */}
                        {adminChart.points.map((pt, idx) => (
                          <text key={idx} x={pt.x} y={adminChart.height - adminChart.paddingBottom + 20} textAnchor="middle">
                            {pt.label}
                          </text>
                        ))}
                      </g>

                      {/* Fill Area */}
                      <path
                        d={`
                          M ${adminChart.points[0].x} ${adminChart.height - adminChart.paddingBottom}
                          ${adminChart.points.map(pt => `L ${pt.x} ${pt.y}`).join(" ")}
                          L ${adminChart.points[adminChart.points.length - 1].x} ${adminChart.height - adminChart.paddingBottom}
                          Z
                        `}
                        fill="url(#chartGradient)"
                        className={styles.chartArea}
                      />

                      {/* Line Path */}
                      <path
                        d={adminChart.points.map((pt, idx) => `${idx === 0 ? "M" : "L"} ${pt.x} ${pt.y}`).join(" ")}
                        fill="none"
                        stroke="var(--primary)"
                        className={styles.chartPath}
                      />

                      {/* Hover interactive nodes */}
                      {adminChart.points.map((pt, idx) => (
                        <circle
                          key={idx}
                          cx={pt.x}
                          cy={pt.y}
                          r={hoveredPoint?.label === pt.label ? 7 : 4}
                          fill={hoveredPoint?.label === pt.label ? "var(--secondary)" : "var(--primary)"}
                          stroke="#fff"
                          strokeWidth={hoveredPoint?.label === pt.label ? 2 : 1}
                          style={{ cursor: "pointer", transition: "all 0.1s ease" }}
                          onMouseEnter={(e) => {
                            setHoveredPoint({
                              x: pt.x,
                              y: pt.y,
                              label: pt.label,
                              value: `${new Intl.NumberFormat("pt-BR").format(pt.value)} mL`
                            });
                          }}
                          onMouseLeave={() => setHoveredPoint(null)}
                        />
                      ))}
                    </svg>
                  ) : (
                    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%", color: "var(--text-muted)" }}>
                      Nenhum registro de telemetria encontrado
                    </div>
                  )}

                  {/* SVG Chart Tooltip */}
                  {hoveredPoint && (
                    <div 
                      className={styles.tooltip}
                      style={{ 
                        left: `${(hoveredPoint.x / adminChart.width) * 100}%`, 
                        top: `${(hoveredPoint.y / adminChart.height) * 100}%` 
                      }}
                    >
                      <span style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>{hoveredPoint.label}</span>
                      <strong style={{ color: "white" }}>{hoveredPoint.value}</strong>
                    </div>
                  )}
                </div>
              </section>

              {/* ADMIN FORMS & LIST SECTION */}
              <section className={styles.mainGrid}>
                {/* Tables & Lists */}
                <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                  {/* Customers list */}
                  <div className="glass-card">
                    <div className={styles.cardHeader}>
                      <h3 className={styles.cardTitle}>💼 Empresas Clientes</h3>
                      <button className={styles.btnPrimary} style={{ padding: "6px 12px", fontSize: "0.8rem" }} onClick={() => setShowClientModal(true)}>
                        + Novo Cliente
                      </button>
                    </div>
                    <div className={styles.tableWrapper}>
                      <table className={styles.table}>
                        <thead>
                          <tr>
                            <th>Razão Social</th>
                            <th>CNPJ</th>
                            <th>Contato</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {adminData.empresas.map((emp) => (
                            <tr key={emp.id}>
                              <td><strong>{emp.razaoSocial}</strong></td>
                              <td>{emp.cnpj}</td>
                              <td>
                                <div style={{ fontSize: "0.8rem" }}>{emp.emailContato}</div>
                                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{emp.telefone || "-"}</div>
                              </td>
                              <td>
                                <span className={`${styles.badge} ${emp.status === "Ativo" ? styles.badgeActive : styles.badgeInactive}`}>
                                  {emp.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Devices list */}
                  <div className="glass-card">
                    <div className={styles.cardHeader}>
                      <h3 className={styles.cardTitle}>🔌 Dispositivos IoT (Placas ESP32)</h3>
                      <button className={styles.btnPrimary} style={{ padding: "6px 12px", fontSize: "0.8rem" }} onClick={() => setShowDeviceModal(true)}>
                        + Novo IoT
                      </button>
                    </div>
                    <div className={styles.tableWrapper}>
                      <table className={styles.table}>
                        <thead>
                          <tr>
                            <th>Device ID / MAC</th>
                            <th>Cliente</th>
                            <th>Instalação / Produto</th>
                            <th>Taxa (mL)</th>
                            <th>Último Pulso</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {adminData.dispositivos.map((dev) => {
                            const emp = adminData.empresas.find(e => e.id === dev.empresaClienteId);
                            return (
                              <tr key={dev.id}>
                                <td><code className={styles.logCode}>{dev.id}</code></td>
                                <td>{emp ? emp.razaoSocial : "Desconhecido"}</td>
                                <td>
                                  <div>{dev.localInstalacao}</div>
                                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{dev.produtoQuimicoAssociado}</div>
                                </td>
                                <td>
                                  <strong>{new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 3 }).format(dev.precoPormL)}</strong>
                                </td>
                                <td style={{ fontSize: "0.8rem" }}>
                                  {dev.ultimaConexao 
                                    ? new Date(dev.ultimaConexao).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) 
                                    : "Nunca conectado"}
                                </td>
                                <td>
                                  <span className={`${styles.badge} ${dev.status === "Ativo" ? styles.badgeActive : styles.badgeInactive}`}>
                                    {dev.status === "Ativo" && <span className={styles.pulseDot}></span>}
                                    {dev.status}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {/* TELEMETRY SIMULATOR */}
                <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                  <div className={`${styles.metricCard} ${styles.ingestCard} glass-card`}>
                    <h3 style={{ fontSize: "1.1rem", fontWeight: "700", marginBottom: "16px", color: "var(--secondary)" }}>
                      📡 Simulador de Hardware (ESP32)
                    </h3>
                    <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "20px" }}>
                      Envie dados de consumo em tempo real para a rota serverless segura <code style={{ color: "white" }}>/api/v1/consumo</code> via HTTP POST.
                    </p>

                    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                      <div>
                        <label>Selecione a ESP32 (Hardware)</label>
                        <select value={simDevice} onChange={(e) => setSimDevice(e.target.value)}>
                          {adminData.dispositivos.map((dev) => (
                            <option key={dev.id} value={dev.id}>
                              {dev.id} ({dev.localInstalacao})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label>Consumo em Mililitros (mL)</label>
                        <input 
                          type="number" 
                          value={simML} 
                          onChange={(e) => setSimML(Math.max(1, Number(e.target.value)))} 
                          min="1"
                        />
                      </div>

                      <button 
                        className={styles.btnPrimary} 
                        style={{ background: "var(--secondary)", boxShadow: "0 4px 14px var(--secondary-glow)" }} 
                        onClick={handleTriggerTelemetry}
                        disabled={isSimulating}
                      >
                        {isSimulating ? "Processando..." : "Disparar Webhook POST"}
                      </button>
                    </div>

                    <div style={{ marginTop: "24px" }}>
                      <h4 style={{ fontSize: "0.85rem", fontWeight: "600", color: "var(--text-muted)", marginBottom: "10px" }}>
                        Console de Telemetria (Últimas transmissões)
                      </h4>
                      <div className={styles.ingestLogs}>
                        {simLogs.length === 0 ? (
                          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", textAlign: "center", padding: "10px" }}>
                            Nenhuma transmissão disparada.
                          </div>
                        ) : (
                          simLogs.map((log, idx) => (
                            <div key={idx} className={styles.logEntry}>
                              <div>
                                <span style={{ marginRight: "10px" }}>[{log.time}]</span>
                                <span className={styles.badge} style={{ background: log.status === 201 ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)", color: log.status === 201 ? "#10b981" : "#ef4444" }}>
                                  HTTP {log.status}
                                </span>
                              </div>
                              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", textAlign: "right" }}>
                                {log.response}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            </>
          )}

          {/* ========================================================================= */}
          {/* VIEW: CLIENTE                                                             */}
          {/* ========================================================================= */}
          {currentRole !== "admin" && clientData && (
            <>
              {/* CLIENT METRICS PANEL */}
              <section className={styles.metricsGrid}>
                {/* Metric 1 */}
                <div className={`${styles.metricCard} glass-card`}>
                  <div className={styles.metricHeader}>
                    <span className={styles.metricTitle}>Consumo Total (Mês Corrente)</span>
                    <div className={styles.metricIcon} style={{ background: "rgba(14, 165, 233, 0.1)", color: "var(--secondary)" }}>mL</div>
                  </div>
                  <div className={styles.metricValue}>
                    {new Intl.NumberFormat("pt-BR").format(clientData.totalMLMensal)} mL
                  </div>
                  <span className={styles.metricSubtitle}>Volume químico acumulado este mês</span>
                </div>

                {/* Metric 2 */}
                <div className={`${styles.metricCard} glass-card`}>
                  <div className={styles.metricHeader}>
                    <span className={styles.metricTitle}>Valor Faturado (Mês Corrente)</span>
                    <div className={styles.metricIcon} style={{ background: "rgba(16, 185, 129, 0.1)", color: "var(--accent)" }}>R$</div>
                  </div>
                  <div className={styles.metricValue}>
                    {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(clientData.totalValorMensal)}
                  </div>
                  <span className={styles.metricSubtitle}>Valor dinâmico com faturamento parcial</span>
                </div>

                {/* Metric 3 */}
                <div className={`${styles.metricCard} glass-card`}>
                  <div className={styles.metricHeader}>
                    <span className={styles.metricTitle}>Pontos de Consumo Ativos</span>
                    <div className={styles.metricIcon} style={{ background: "rgba(99, 102, 241, 0.1)", color: "var(--primary)" }}>📡</div>
                  </div>
                  <div className={styles.metricValue}>
                    {clientData.devices.filter(d => d.status === "Ativo").length} / {clientData.devices.length}
                  </div>
                  <span className={styles.metricSubtitle}>Dispositivos em sua planta industrial</span>
                </div>
              </section>

              {/* CLIENT DETAILED DASHBOARD SPLIT */}
              <section className={styles.mainGrid}>
                
                {/* Left Side: Realtime consumption chart by point & Invoices */}
                <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                  {/* Consumption per installation point */}
                  <div className="glass-card" style={{ padding: "24px" }}>
                    <h3 style={{ fontSize: "1.1rem", fontWeight: "700", marginBottom: "16px" }}>
                      📊 Consumo por Ponto de Instalação
                    </h3>
                    <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "20px" }}>
                      Volume acumulado movimentado por cada ponto monitorado (placa ESP32).
                    </p>

                    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                      {clientData.devices.map(dev => {
                        // Calculate total mL for this device
                        const devLogs = clientData.logs.filter(l => l.dispositivoId === dev.id);
                        const devTotalML = devLogs.reduce((acc, l) => acc + l.mlConsumido, 0);
                        const devCost = devTotalML * dev.precoPormL;

                        // Calculate percentage of total client consumption
                        const percentage = clientData.totalMLMensal > 0 
                          ? (devTotalML / clientData.totalMLMensal) * 100 
                          : 0;

                        return (
                          <div key={dev.id}>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px", fontSize: "0.9rem" }}>
                              <div>
                                <strong>{dev.localInstalacao}</strong>
                                <span style={{ marginLeft: "10px", fontSize: "0.75rem", color: "var(--text-muted)" }}>
                                  ({dev.produtoQuimicoAssociado})
                                </span>
                              </div>
                              <div>
                                <strong>{new Intl.NumberFormat("pt-BR").format(devTotalML)} mL</strong> 
                                <span style={{ color: "var(--text-muted)", marginLeft: "8px" }}>
                                  ({new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(devCost)})
                                </span>
                              </div>
                            </div>
                            <div style={{ height: "10px", background: "rgba(255, 255, 255, 0.05)", borderRadius: "5px", overflow: "hidden", border: "1px solid var(--border-color)" }}>
                              <div 
                                style={{ 
                                  height: "100%", 
                                  width: `${percentage}%`, 
                                  background: "linear-gradient(to right, var(--primary), var(--secondary))", 
                                  boxShadow: "0 0 10px var(--primary-glow)",
                                  borderRadius: "5px",
                                  transition: "width 0.8s ease-in-out" 
                                }}
                              ></div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Telemetry log table */}
                  <div className="glass-card">
                    <div className={styles.cardHeader}>
                      <h3 className={styles.cardTitle}>📜 Histórico Recente de Consumos</h3>
                    </div>
                    <div className={styles.tableWrapper}>
                      <table className={styles.table}>
                        <thead>
                          <tr>
                            <th>Data / Hora</th>
                            <th>Ponto de Instalação</th>
                            <th>Produto</th>
                            <th>Volume (mL)</th>
                            <th>Custo Parcial</th>
                          </tr>
                        </thead>
                        <tbody>
                          {clientData.logs.length === 0 ? (
                            <tr>
                              <td colSpan={5} style={{ textAlign: "center", color: "var(--text-muted)" }}>
                                Nenhum log de telemetria registrado para esta empresa.
                              </td>
                            </tr>
                          ) : (
                            clientData.logs.slice().reverse().slice(0, 10).map((log) => {
                              const dev = clientData.devices.find(d => d.id === log.dispositivoId);
                              return (
                                <tr key={log.id}>
                                  <td>{new Date(log.dataHora).toLocaleString("pt-BR")}</td>
                                  <td>{dev ? dev.localInstalacao : "Desconhecido"}</td>
                                  <td>{dev ? dev.produtoQuimicoAssociado : "-"}</td>
                                  <td><strong>{new Intl.NumberFormat("pt-BR").format(log.mlConsumido)} mL</strong></td>
                                  <td>
                                    {dev 
                                      ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(log.mlConsumido * dev.precoPormL)
                                      : "-"}
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {/* Right Side: Billing Receipt */}
                <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                  <div className={`${styles.metricCard} glass-card`} style={{ borderLeft: "4px solid var(--accent)" }}>
                    <h3 style={{ fontSize: "1.1rem", fontWeight: "700", marginBottom: "16px", color: "var(--accent)" }}>
                      📑 Conta de Luz Química
                    </h3>
                    <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "20px" }}>
                      Demonstrativo transparente e auditável de consumo com base em contratos de faturamento pay-per-use.
                    </p>

                    <div className={styles.invoice}>
                      <div className={styles.invoiceRow} style={{ borderBottom: "2px dashed var(--border-color)", paddingBottom: "16px" }}>
                        <div>
                          <strong>{clientData.client.razaoSocial}</strong>
                          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "4px" }}>CNPJ: {clientData.client.cnpj}</div>
                        </div>
                        <span className={styles.badge} style={{ background: "rgba(16,185,129,0.1)", color: "#10b981", height: "fit-content" }}>Faturamento Aberto</span>
                      </div>

                      {clientData.devices.map(dev => {
                        const devLogs = clientData.logs.filter(l => l.dispositivoId === dev.id);
                        const devTotalML = devLogs.reduce((acc, l) => acc + l.mlConsumido, 0);
                        const devCost = devTotalML * dev.precoPormL;

                        return (
                          <div key={dev.id} className={styles.invoiceRow}>
                            <div>
                              <div>{dev.localInstalacao}</div>
                              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                                {dev.produtoQuimicoAssociado} • {new Intl.NumberFormat("pt-BR").format(devTotalML)} mL x R$ {dev.precoPormL.toFixed(3)}
                              </div>
                            </div>
                            <span style={{ fontWeight: "600" }}>
                              {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(devCost)}
                            </span>
                          </div>
                        );
                      })}

                      <div className={`${styles.invoiceRow} ${styles.invoiceTotalRow}`} style={{ borderTop: "2px dashed var(--border-color)", marginTop: "16px" }}>
                        <span>TOTAL PARCIAL</span>
                        <span className={styles.invoiceHighlight}>
                          {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(clientData.totalValorMensal)}
                        </span>
                      </div>

                      <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", textAlign: "center", marginTop: "10px" }}>
                        Valores apurados em conformidade com as medições volumétricas geradas por telemetria e integradas via blockchain/hashes criptográficos.
                      </div>
                    </div>
                  </div>
                </div>

              </section>
            </>
          )}

        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ADD CLIENT                                                         */}
      {/* ========================================================================= */}
      {showClientModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h3 style={{ fontWeight: "700" }}>Cadastrar Novo Cliente</h3>
              <button className={styles.modalClose} onClick={() => setShowClientModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleClientSubmit}>
              <div className={styles.modalBody} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div>
                  <label>Razão Social</label>
                  <input 
                    type="text" 
                    required 
                    value={clientForm.razaoSocial}
                    onChange={(e) => setClientForm({...clientForm, razaoSocial: e.target.value})}
                    placeholder="Distribuidora de Alimentos XYZ Ltda"
                  />
                </div>

                <div className={styles.formGrid}>
                  <div>
                    <label>CNPJ</label>
                    <input 
                      type="text" 
                      required 
                      value={clientForm.cnpj}
                      onChange={(e) => setClientForm({...clientForm, cnpj: e.target.value})}
                      placeholder="12.345.678/0001-90"
                    />
                  </div>
                  <div>
                    <label>Telefone</label>
                    <input 
                      type="text" 
                      value={clientForm.telefone}
                      onChange={(e) => setClientForm({...clientForm, telefone: e.target.value})}
                      placeholder="(11) 98765-4321"
                    />
                  </div>
                </div>

                <div>
                  <label>E-mail de Contato</label>
                  <input 
                    type="email" 
                    required 
                    value={clientForm.emailContato}
                    onChange={(e) => setClientForm({...clientForm, emailContato: e.target.value})}
                    placeholder="financeiro@empresa.com"
                  />
                </div>

                <div>
                  <label>Status Operacional</label>
                  <select 
                    value={clientForm.status}
                    onChange={(e) => setClientForm({...clientForm, status: e.target.value})}
                  >
                    <option value="Ativo">Ativo</option>
                    <option value="Inativo">Inativo</option>
                  </select>
                </div>
              </div>
              <div className={styles.modalFooter}>
                <button type="button" className={styles.btnSecondary} onClick={() => setShowClientModal(false)}>Cancelar</button>
                <button type="submit" className={styles.btnPrimary}>Salvar Cliente</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ADD DEVICE                                                         */}
      {/* ========================================================================= */}
      {showDeviceModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h3 style={{ fontWeight: "700" }}>Cadastrar Novo Dispositivo IoT</h3>
              <button className={styles.modalClose} onClick={() => setShowDeviceModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleDeviceSubmit}>
              <div className={styles.modalBody} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div className={styles.formGrid}>
                  <div>
                    <label>MAC Address / Token ID</label>
                    <input 
                      type="text" 
                      required 
                      value={deviceForm.id}
                      onChange={(e) => setDeviceForm({...deviceForm, id: e.target.value})}
                      placeholder="ESP32-LAV-03"
                    />
                  </div>
                  <div>
                    <label>Empresa Cliente</label>
                    <select 
                      required
                      value={deviceForm.empresaClienteId}
                      onChange={(e) => setDeviceForm({...deviceForm, empresaClienteId: e.target.value})}
                    >
                      <option value="">Selecione um cliente...</option>
                      {adminData?.empresas.map((emp) => (
                        <option key={emp.id} value={emp.id}>{emp.razaoSocial}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label>Local de Instalação</label>
                  <input 
                    type="text" 
                    required 
                    value={deviceForm.localInstalacao}
                    onChange={(e) => setDeviceForm({...deviceForm, localInstalacao: e.target.value})}
                    placeholder="Lavanderia Industrial - Bloco B"
                  />
                </div>

                <div>
                  <label>Produto Químico Concentrado Associado</label>
                  <input 
                    type="text" 
                    required 
                    value={deviceForm.produtoQuimicoAssociado}
                    onChange={(e) => setDeviceForm({...deviceForm, produtoQuimicoAssociado: e.target.value})}
                    placeholder="Detergente Enzimático 5X"
                  />
                </div>

                <div className={styles.formGrid}>
                  <div>
                    <label>Preço por mL (R$)</label>
                    <input 
                      type="number" 
                      required 
                      step="0.001"
                      min="0.001"
                      value={deviceForm.precoPormL}
                      onChange={(e) => setDeviceForm({...deviceForm, precoPormL: Number(e.target.value)})}
                      placeholder="0.05"
                    />
                  </div>
                  <div>
                    <label>Status Inicial</label>
                    <select 
                      value={deviceForm.status}
                      onChange={(e) => setDeviceForm({...deviceForm, status: e.target.value})}
                    >
                      <option value="Ativo">Ativo</option>
                      <option value="Inativo">Inativo</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className={styles.modalFooter}>
                <button type="button" className={styles.btnSecondary} onClick={() => setShowDeviceModal(false)}>Cancelar</button>
                <button type="submit" className={styles.btnPrimary}>Salvar Dispositivo</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
