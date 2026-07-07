import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Iniciando seed do banco de dados Neon...");

  // Limpar tabelas existentes em ordem de chave estrangeira
  await prisma.registroConsumo.deleteMany();
  await prisma.dispositivoIoT.deleteMany();
  await prisma.empresaCliente.deleteMany();

  // Criar Empresas Clientes
  const emp1 = await prisma.empresaCliente.create({
    data: {
      id: "emp-1",
      razaoSocial: "Lavanderia Brilho Extremo Ltda",
      cnpj: "12.345.678/0001-90",
      emailContato: "contato@brilhoextremo.com.br",
      telefone: "(11) 98765-4321",
      status: "Ativo",
      criadoEm: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    },
  });

  const emp2 = await prisma.empresaCliente.create({
    data: {
      id: "emp-2",
      razaoSocial: "Cozinha Industrial Sabor & Arte",
      cnpj: "98.765.432/0001-21",
      emailContato: "financeiro@saborearte.com.br",
      telefone: "(21) 3456-7890",
      status: "Ativo",
      criadoEm: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    },
  });

  console.log("Empresas criadas com sucesso.");

  // Criar Dispositivos IoT
  await prisma.dispositivoIoT.createMany({
    data: [
      {
        id: "ESP32-LAV-01",
        empresaClienteId: emp1.id,
        localInstalacao: "Setor de Lavagem Principal - Máquina 1",
        produtoQuimicoAssociado: "Detergente Concentrado Plus",
        precoPormL: 0.05,
        status: "Ativo",
        ultimaConexao: new Date(Date.now() - 5 * 60 * 1000),
      },
      {
        id: "ESP32-LAV-02",
        empresaClienteId: emp1.id,
        localInstalacao: "Setor de Lavagem Principal - Máquina 2",
        produtoQuimicoAssociado: "Amaciante Premium Soft",
        precoPormL: 0.03,
        status: "Ativo",
        ultimaConexao: new Date(Date.now() - 15 * 60 * 1000),
      },
      {
        id: "ESP32-COZ-01",
        empresaClienteId: emp2.id,
        localInstalacao: "Cozinha Central - Lava-Louças Industrial",
        produtoQuimicoAssociado: "Secante Abrilhantador Eco",
        precoPormL: 0.08,
        status: "Ativo",
        ultimaConexao: new Date(Date.now() - 2 * 60 * 1000),
      },
    ],
  });

  console.log("Dispositivos IoT criados com sucesso.");

  // Gerar 30 dias de logs de consumo simulados
  const registros = [];
  const now = new Date();

  for (let i = 29; i >= 0; i--) {
    const dayDate = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);

    // ESP32-LAV-01: ~10 a 30 ciclos por dia, ~150-300mL por ciclo
    const lav1Washes = 10 + Math.floor(Math.random() * 20);
    for (let w = 0; w < lav1Washes; w++) {
      const time = new Date(dayDate);
      time.setHours(8 + Math.floor(Math.random() * 12), Math.floor(Math.random() * 60));
      registros.push({
        dispositivoId: "ESP32-LAV-01",
        mlConsumido: 150 + Math.floor(Math.random() * 150),
        dataHora: time,
      });
    }

    // ESP32-LAV-02: ~8 a 20 ciclos por dia, ~100-250mL por ciclo
    const lav2Washes = 8 + Math.floor(Math.random() * 12);
    for (let w = 0; w < lav2Washes; w++) {
      const time = new Date(dayDate);
      time.setHours(8 + Math.floor(Math.random() * 12), Math.floor(Math.random() * 60));
      registros.push({
        dispositivoId: "ESP32-LAV-02",
        mlConsumido: 100 + Math.floor(Math.random() * 150),
        dataHora: time,
      });
    }

    // ESP32-COZ-01: ~15 a 40 ciclos por dia, ~50-120mL por ciclo
    const cozWashes = 15 + Math.floor(Math.random() * 25);
    for (let w = 0; w < cozWashes; w++) {
      const time = new Date(dayDate);
      time.setHours(7 + Math.floor(Math.random() * 15), Math.floor(Math.random() * 60));
      registros.push({
        dispositivoId: "ESP32-COZ-01",
        mlConsumido: 50 + Math.floor(Math.random() * 70),
        dataHora: time,
      });
    }
  }

  console.log(`Gerados ${registros.length} registros históricos. Inserindo no banco de dados...`);
  
  await prisma.registroConsumo.createMany({
    data: registros,
  });

  console.log("Seeding concluído com sucesso!");
}

main()
  .catch((e) => {
    console.error("Erro no seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
