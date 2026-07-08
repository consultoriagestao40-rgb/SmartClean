import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";

const NEON_DB_URL = "postgresql://neondb_owner:npg_PsHZaX2r0BgA@ep-spring-voice-ahx4f765-pooler.c-3.us-east-1.aws.neon.tech/neondb?channel_binding=require&sslmode=require";

if (typeof process !== "undefined" && !process.env.DATABASE_URL) {
  process.env.DATABASE_URL = NEON_DB_URL;
}

// Initialize Prisma
const globalForPrisma = global as unknown as { prisma: PrismaClient };
export const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

const MOCK_DB_PATH = "/tmp/smart_clean_db.json";

// Type definitions matching database models
export interface Empresa {
  id: string;
  razaoSocial: string;
  cnpj: string;
  emailContato: string;
  telefone: string | null;
  status: string; // "Ativo" | "Inativo"
  criadoEm: Date;
}

export interface Dispositivo {
  id: string;
  empresaClienteId: string;
  localInstalacao: string;
  produtoQuimicoAssociado: string;
  precoPormL: number;
  status: string; // "Ativo" | "Inativo"
  ultimaConexao: Date | null;
  diluicao: string;
  proporcaoDiluicao: number;
  capacidadeBombonaL: number;
  estoqueAtualmL: number;
}

export interface Registro {
  id: string; // Serialized BigInt or string id
  dispositivoId: string;
  mlConsumido: number;
  dataHora: Date;
}

// Initial seed data for Mock DB
const INITIAL_EMPRESAS: Empresa[] = [
  {
    id: "emp-1",
    razaoSocial: "Lavanderia Brilho Extremo Ltda",
    cnpj: "12.345.678/0001-90",
    emailContato: "contato@brilhoextremo.com.br",
    telefone: "(11) 98765-4321",
    status: "Ativo",
    criadoEm: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
  },
  {
    id: "emp-2",
    razaoSocial: "Cozinha Industrial Sabor & Arte",
    cnpj: "98.765.432/0001-21",
    emailContato: "financeiro@saborearte.com.br",
    telefone: "(21) 3456-7890",
    status: "Ativo",
    criadoEm: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
  },
];

const INITIAL_DISPOSITIVOS: Dispositivo[] = [
  {
    id: "ESP32-LAV-01",
    empresaClienteId: "emp-1",
    localInstalacao: "Setor de Lavagem Principal - Máquina 1",
    produtoQuimicoAssociado: "Detergente Concentrado Plus",
    precoPormL: 0.05, // R$ 50,00 por Litro
    status: "Ativo",
    ultimaConexao: new Date(Date.now() - 5 * 60 * 1000),
    diluicao: "1:5",
    proporcaoDiluicao: 5.0,
    capacidadeBombonaL: 20.0,
    estoqueAtualmL: 12500.0,
  },
  {
    id: "ESP32-LAV-02",
    empresaClienteId: "emp-1",
    localInstalacao: "Setor de Lavagem Principal - Máquina 2",
    produtoQuimicoAssociado: "Amaciante Premium Soft",
    precoPormL: 0.03, // R$ 30,00 por Litro
    status: "Ativo",
    ultimaConexao: new Date(Date.now() - 15 * 60 * 1000),
    diluicao: "1:10",
    proporcaoDiluicao: 10.0,
    capacidadeBombonaL: 20.0,
    estoqueAtualmL: 18400.0,
  },
  {
    id: "ESP32-COZ-01",
    empresaClienteId: "emp-2",
    localInstalacao: "Cozinha Central - Lava-Louças Industrial",
    produtoQuimicoAssociado: "Secante Abrilhantador Eco",
    precoPormL: 0.08, // R$ 80,00 por Litro
    status: "Ativo",
    ultimaConexao: new Date(Date.now() - 2 * 60 * 1000),
    diluicao: "1:20",
    proporcaoDiluicao: 20.0,
    capacidadeBombonaL: 20.0,
    estoqueAtualmL: 9800.0,
  },
];

// Generate 30 days of mock consumption records
function generateInitialRegistros(): Registro[] {
  const registros: Registro[] = [];
  let idCounter = 1;
  const now = new Date();

  // Create telemetry data for the last 30 days
  for (let i = 29; i >= 0; i--) {
    const dayDate = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    
    // ESP32-LAV-01: ~10 to 30 washes a day, each wash uses ~150-300mL
    const lav1Washes = 10 + Math.floor(Math.random() * 20);
    for (let w = 0; w < lav1Washes; w++) {
      const time = new Date(dayDate);
      time.setHours(8 + Math.floor(Math.random() * 12), Math.floor(Math.random() * 60));
      registros.push({
        id: `reg-${idCounter++}`,
        dispositivoId: "ESP32-LAV-01",
        mlConsumido: 150 + Math.floor(Math.random() * 150),
        dataHora: time,
      });
    }

    // ESP32-LAV-02: ~8 to 20 washes a day, each uses ~100-250mL
    const lav2Washes = 8 + Math.floor(Math.random() * 12);
    for (let w = 0; w < lav2Washes; w++) {
      const time = new Date(dayDate);
      time.setHours(8 + Math.floor(Math.random() * 12), Math.floor(Math.random() * 60));
      registros.push({
        id: `reg-${idCounter++}`,
        dispositivoId: "ESP32-LAV-02",
        mlConsumido: 100 + Math.floor(Math.random() * 150),
        dataHora: time,
      });
    }

    // ESP32-COZ-01: ~15 to 40 washes a day, each uses ~50-120mL
    const cozWashes = 15 + Math.floor(Math.random() * 25);
    for (let w = 0; w < cozWashes; w++) {
      const time = new Date(dayDate);
      time.setHours(7 + Math.floor(Math.random() * 15), Math.floor(Math.random() * 60));
      registros.push({
        id: `reg-${idCounter++}`,
        dispositivoId: "ESP32-COZ-01",
        mlConsumido: 50 + Math.floor(Math.random() * 70),
        dataHora: time,
      });
    }
  }

  return registros;
}

// Memory-based state for mock mode
interface MockState {
  empresas: Empresa[];
  dispositivos: Dispositivo[];
  registros: Registro[];
}

let mockStateCache: MockState | null = null;

function getMockState(): MockState {
  if (mockStateCache) return mockStateCache;

  try {
    if (fs.existsSync(MOCK_DB_PATH)) {
      const rawData = fs.readFileSync(MOCK_DB_PATH, "utf-8");
      const parsed = JSON.parse(rawData);
      
      // Revive date strings to Date objects
      mockStateCache = {
        empresas: parsed.empresas.map((e: any) => ({ ...e, criadoEm: new Date(e.criadoEm) })),
        dispositivos: parsed.dispositivos.map((d: any) => ({
          ...d,
          ultimaConexao: d.ultimaConexao ? new Date(d.ultimaConexao) : null,
        })),
        registros: parsed.registros.map((r: any) => ({ ...r, dataHora: new Date(r.dataHora) })),
      };
      return mockStateCache!;
    }
  } catch (err) {
    console.warn("Could not read mock DB file, initializing new in-memory state:", err);
  }

  // Create initial state
  mockStateCache = {
    empresas: INITIAL_EMPRESAS,
    dispositivos: INITIAL_DISPOSITIVOS,
    registros: generateInitialRegistros(),
  };
  saveMockState();
  return mockStateCache;
}

function saveMockState() {
  if (!mockStateCache) return;
  try {
    fs.writeFileSync(MOCK_DB_PATH, JSON.stringify(mockStateCache, null, 2));
  } catch (err) {
    console.warn("Failed to save mock state to file system (expected on read-only serverless environments):", err);
  }
}

export const db = {
  isMockMode: () => {
    return process.env.MOCK_MODE === "true";
  },

  // GET ALL CLIENTS
  getEmpresas: async (): Promise<Empresa[]> => {
    if (db.isMockMode()) {
      return getMockState().empresas;
    }
    const list = await prisma.empresaCliente.findMany({
      orderBy: { razaoSocial: "asc" },
    });
    return list.map(item => ({
      id: item.id,
      razaoSocial: item.razaoSocial,
      cnpj: item.cnpj,
      emailContato: item.emailContato,
      telefone: item.telefone,
      status: item.status,
      criadoEm: item.criadoEm,
    }));
  },

  // CREATE CLIENT
  createEmpresa: async (data: Omit<Empresa, "id" | "criadoEm">): Promise<Empresa> => {
    if (db.isMockMode()) {
      const state = getMockState();
      // Check duplicate CNPJ
      if (state.empresas.some(e => e.cnpj === data.cnpj)) {
        throw new Error("CNPJ já cadastrado");
      }
      const newEmpresa: Empresa = {
        id: `emp-${Date.now()}`,
        ...data,
        criadoEm: new Date(),
      };
      state.empresas.push(newEmpresa);
      saveMockState();
      return newEmpresa;
    }
    const created = await prisma.empresaCliente.create({
      data: {
        razaoSocial: data.razaoSocial,
        cnpj: data.cnpj,
        emailContato: data.emailContato,
        telefone: data.telefone,
        status: data.status,
      },
    });
    return {
      id: created.id,
      razaoSocial: created.razaoSocial,
      cnpj: created.cnpj,
      emailContato: created.emailContato,
      telefone: created.telefone,
      status: created.status,
      criadoEm: created.criadoEm,
    };
  },

  // GET ALL DEVICES
  getDispositivos: async (): Promise<Dispositivo[]> => {
    if (db.isMockMode()) {
      return getMockState().dispositivos;
    }
    const list = await prisma.dispositivoIoT.findMany({
      orderBy: { id: "asc" },
    });
    return list.map(item => ({
      id: item.id,
      empresaClienteId: item.empresaClienteId,
      localInstalacao: item.localInstalacao,
      produtoQuimicoAssociado: item.produtoQuimicoAssociado,
      precoPormL: item.precoPormL,
      status: item.status,
      ultimaConexao: item.ultimaConexao,
      diluicao: item.diluicao,
      proporcaoDiluicao: item.proporcaoDiluicao,
      capacidadeBombonaL: item.capacidadeBombonaL,
      estoqueAtualmL: item.estoqueAtualmL,
    }));
  },

  // CREATE DEVICE
  createDispositivo: async (data: Dispositivo): Promise<Dispositivo> => {
    if (db.isMockMode()) {
      const state = getMockState();
      // Check duplicate ID
      if (state.dispositivos.some(d => d.id === data.id)) {
        throw new Error("Dispositivo ID (MAC/Token) já cadastrado");
      }
      state.dispositivos.push(data);
      saveMockState();
      return data;
    }
    const created = await prisma.dispositivoIoT.create({
      data: {
        id: data.id,
        empresaClienteId: data.empresaClienteId,
        localInstalacao: data.localInstalacao,
        produtoQuimicoAssociado: data.produtoQuimicoAssociado,
        precoPormL: data.precoPormL,
        status: data.status,
        diluicao: data.diluicao,
        proporcaoDiluicao: data.proporcaoDiluicao,
        capacidadeBombonaL: data.capacidadeBombonaL,
        estoqueAtualmL: data.estoqueAtualmL,
      },
    });
    return {
      id: created.id,
      empresaClienteId: created.empresaClienteId,
      localInstalacao: created.localInstalacao,
      produtoQuimicoAssociado: created.produtoQuimicoAssociado,
      precoPormL: created.precoPormL,
      status: created.status,
      ultimaConexao: created.ultimaConexao,
      diluicao: created.diluicao,
      proporcaoDiluicao: created.proporcaoDiluicao,
      capacidadeBombonaL: created.capacidadeBombonaL,
      estoqueAtualmL: created.estoqueAtualmL,
    };
  },

  // FIND DEVICE
  getDispositivoById: async (id: string): Promise<Dispositivo | null> => {
    if (db.isMockMode()) {
      const d = getMockState().dispositivos.find(x => x.id === id);
      return d || null;
    }
    const found = await prisma.dispositivoIoT.findUnique({
      where: { id },
    });
    if (!found) return null;
    return {
      id: found.id,
      empresaClienteId: found.empresaClienteId,
      localInstalacao: found.localInstalacao,
      produtoQuimicoAssociado: found.produtoQuimicoAssociado,
      precoPormL: found.precoPormL,
      status: found.status,
      ultimaConexao: found.ultimaConexao,
      diluicao: found.diluicao,
      proporcaoDiluicao: found.proporcaoDiluicao,
      capacidadeBombonaL: found.capacidadeBombonaL,
      estoqueAtualmL: found.estoqueAtualmL,
    };
  },

  // RECORD CONSUMPTION
  registrarConsumo: async (dispositivoId: string, mlConsumido: number): Promise<Registro> => {
    const dataHora = new Date();
    
    if (db.isMockMode()) {
      const state = getMockState();
      
      // Update device connection timestamp and decrement stock
      const dispIdx = state.dispositivos.findIndex(d => d.id === dispositivoId);
      if (dispIdx !== -1) {
        state.dispositivos[dispIdx].ultimaConexao = dataHora;
        state.dispositivos[dispIdx].estoqueAtualmL = Math.max(0, state.dispositivos[dispIdx].estoqueAtualmL - mlConsumido);
      }
      
      const newRegistro: Registro = {
        id: `reg-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        dispositivoId,
        mlConsumido,
        dataHora,
      };
      
      state.registros.push(newRegistro);
      saveMockState();
      return newRegistro;
    }

    // Prisma Transaction to update connection time, decrement stock and create log
    const [_, createdLog] = await prisma.$transaction([
      prisma.dispositivoIoT.update({
        where: { id: dispositivoId },
        data: { 
          ultimaConexao: dataHora,
          estoqueAtualmL: { decrement: mlConsumido }
        },
      }),
      prisma.registroConsumo.create({
        data: {
          dispositivoId,
          mlConsumido,
          dataHora,
        },
      }),
    ]);

    return {
      id: createdLog.id.toString(),
      dispositivoId: createdLog.dispositivoId,
      mlConsumido: createdLog.mlConsumido,
      dataHora: createdLog.dataHora,
    };
  },

  // GET DATA FOR ADMIN STATS
  getAdminStats: async () => {
    let empresas: Empresa[] = [];
    let dispositivos: Dispositivo[] = [];
    let registros: Registro[] = [];

    if (db.isMockMode()) {
      const state = getMockState();
      empresas = state.empresas;
      dispositivos = state.dispositivos;
      registros = state.registros;
    } else {
      empresas = (await prisma.empresaCliente.findMany()).map(e => ({
        id: e.id,
        razaoSocial: e.razaoSocial,
        cnpj: e.cnpj,
        emailContato: e.emailContato,
        telefone: e.telefone,
        status: e.status,
        criadoEm: e.criadoEm,
      }));
      dispositivos = (await prisma.dispositivoIoT.findMany()).map(d => ({
        id: d.id,
        empresaClienteId: d.empresaClienteId,
        localInstalacao: d.localInstalacao,
        produtoQuimicoAssociado: d.produtoQuimicoAssociado,
        precoPormL: d.precoPormL,
        status: d.status,
        ultimaConexao: d.ultimaConexao,
        diluicao: d.diluicao,
        proporcaoDiluicao: d.proporcaoDiluicao,
        capacidadeBombonaL: d.capacidadeBombonaL,
        estoqueAtualmL: d.estoqueAtualmL,
      }));
      const dbLogs = await prisma.registroConsumo.findMany({
        orderBy: { dataHora: "asc" },
      });
      registros = dbLogs.map(r => ({
        id: r.id.toString(),
        dispositivoId: r.dispositivoId,
        mlConsumido: r.mlConsumido,
        dataHora: r.dataHora,
      }));
    }

    // Build stats maps
    const deviceMap = new Map<string, Dispositivo>();
    dispositivos.forEach(d => deviceMap.set(d.id, d));

    const clientMap = new Map<string, Empresa>();
    empresas.forEach(e => clientMap.set(e.id, e));

    // Current Month Range
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const firstDayOfMonth = new Date(currentYear, currentMonth, 1);

    let faturamentoAcumuladoGlobal = 0;
    
    registros.forEach(reg => {
      const dev = deviceMap.get(reg.dispositivoId);
      if (dev && reg.dataHora >= firstDayOfMonth) {
        faturamentoAcumuladoGlobal += reg.mlConsumido * dev.precoPormL;
      }
    });

    return {
      faturamentoAcumuladoGlobal,
      empresas,
      dispositivos,
      registros,
    };
  },

  // GET DATA FOR SPECIFIC CLIENT VIEW
  getClientStats: async (clientId: string) => {
    let empresas: Empresa[] = [];
    let dispositivos: Dispositivo[] = [];
    let registros: Registro[] = [];

    if (db.isMockMode()) {
      const state = getMockState();
      empresas = state.empresas;
      dispositivos = state.dispositivos;
      registros = state.registros;
    } else {
      empresas = (await prisma.empresaCliente.findMany()).map(e => ({
        id: e.id,
        razaoSocial: e.razaoSocial,
        cnpj: e.cnpj,
        emailContato: e.emailContato,
        telefone: e.telefone,
        status: e.status,
        criadoEm: e.criadoEm,
      }));
      dispositivos = (await prisma.dispositivoIoT.findMany()).map(d => ({
        id: d.id,
        empresaClienteId: d.empresaClienteId,
        localInstalacao: d.localInstalacao,
        produtoQuimicoAssociado: d.produtoQuimicoAssociado,
        precoPormL: d.precoPormL,
        status: d.status,
        ultimaConexao: d.ultimaConexao,
        diluicao: d.diluicao,
        proporcaoDiluicao: d.proporcaoDiluicao,
        capacidadeBombonaL: d.capacidadeBombonaL,
        estoqueAtualmL: d.estoqueAtualmL,
      }));
      const dbLogs = await prisma.registroConsumo.findMany({
        orderBy: { dataHora: "asc" },
      });
      registros = dbLogs.map(r => ({
        id: r.id.toString(),
        dispositivoId: r.dispositivoId,
        mlConsumido: r.mlConsumido,
        dataHora: r.dataHora,
      }));
    }

    const client = empresas.find(e => e.id === clientId);
    if (!client) throw new Error("Cliente não encontrado");

    // Filter devices belonging to client
    const clientDevices = dispositivos.filter(d => d.empresaClienteId === clientId);
    const clientDeviceIds = new Set(clientDevices.map(d => d.id));

    // Filter logs for those devices
    const clientLogs = registros.filter(r => clientDeviceIds.has(r.dispositivoId));

    // Calculate total cost and ml consumed in the current month
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const firstDayOfMonth = new Date(currentYear, currentMonth, 1);

    let totalMLMensal = 0;
    let totalValorMensal = 0;

    const deviceMap = new Map<string, Dispositivo>();
    clientDevices.forEach(d => deviceMap.set(d.id, d));

    clientLogs.forEach(reg => {
      const dev = deviceMap.get(reg.dispositivoId);
      if (dev) {
        if (reg.dataHora >= firstDayOfMonth) {
          totalMLMensal += reg.mlConsumido;
          totalValorMensal += reg.mlConsumido * dev.precoPormL;
        }
      }
    });

    return {
      client,
      devices: clientDevices,
      logs: clientLogs,
      totalMLMensal,
      totalValorMensal,
    };
  },

  // UPDATE CLIENT
  updateEmpresa: async (id: string, data: Partial<Omit<Empresa, "id" | "criadoEm">>): Promise<Empresa> => {
    if (db.isMockMode()) {
      const state = getMockState();
      const idx = state.empresas.findIndex(e => e.id === id);
      if (idx === -1) throw new Error("Cliente não encontrado");
      state.empresas[idx] = { ...state.empresas[idx], ...data } as Empresa;
      saveMockState();
      return state.empresas[idx];
    }
    const updated = await prisma.empresaCliente.update({
      where: { id },
      data,
    });
    return {
      id: updated.id,
      razaoSocial: updated.razaoSocial,
      cnpj: updated.cnpj,
      emailContato: updated.emailContato,
      telefone: updated.telefone,
      status: updated.status,
      criadoEm: updated.criadoEm,
    };
  },

  // UPDATE DEVICE
  updateDispositivo: async (id: string, data: Partial<Omit<Dispositivo, "id" | "empresaClienteId" | "ultimaConexao">>): Promise<Dispositivo> => {
    if (db.isMockMode()) {
      const state = getMockState();
      const idx = state.dispositivos.findIndex(d => d.id === id);
      if (idx === -1) throw new Error("Dispositivo não encontrado");
      state.dispositivos[idx] = { ...state.dispositivos[idx], ...data } as Dispositivo;
      saveMockState();
      return state.dispositivos[idx];
    }
    const updated = await prisma.dispositivoIoT.update({
      where: { id },
      data,
    });
    return {
      id: updated.id,
      empresaClienteId: updated.empresaClienteId,
      localInstalacao: updated.localInstalacao,
      produtoQuimicoAssociado: updated.produtoQuimicoAssociado,
      precoPormL: updated.precoPormL,
      status: updated.status,
      ultimaConexao: updated.ultimaConexao,
      diluicao: updated.diluicao,
      proporcaoDiluicao: updated.proporcaoDiluicao,
      capacidadeBombonaL: updated.capacidadeBombonaL,
      estoqueAtualmL: updated.estoqueAtualmL,
    };
  },

  // REFILL DEVICE CANISTER
  reabastecerDispositivo: async (id: string): Promise<Dispositivo> => {
    const dev = await db.getDispositivoById(id);
    if (!dev) throw new Error("Dispositivo não encontrado");
    const fullStock = dev.capacidadeBombonaL * 1000;
    return db.updateDispositivo(id, { estoqueAtualmL: fullStock });
  },
};
