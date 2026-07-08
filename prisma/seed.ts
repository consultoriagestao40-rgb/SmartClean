import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Limpando banco de dados Neon...");

  // Apagar todos os registros existentes para iniciar do zero
  await prisma.registroConsumo.deleteMany();
  await prisma.dispositivoIoT.deleteMany();
  await prisma.empresaCliente.deleteMany();

  console.log("Banco de dados zerado.");

  // Criar o cliente de teste JVS Facilities
  const jvs = await prisma.empresaCliente.create({
    data: {
      id: "emp-jvs",
      razaoSocial: "JVS Facilities",
      cnpj: "45.678.901/0001-23",
      emailContato: "contato@jvsfacilities.com.br",
      telefone: "(11) 99999-8888",
      status: "Ativo",
    },
  });

  console.log("Cliente 'JVS Facilities' cadastrado.");

  // Criar o dispositivo de teste ESP32-LAV-01 associado à JVS Facilities
  await prisma.dispositivoIoT.create({
    data: {
      id: "ESP32-LAV-01",
      empresaClienteId: jvs.id,
      localInstalacao: "Lavanderia Principal",
      produtoQuimicoAssociado: "Detergente Concentrado",
      precoPormL: 0.05, // R$ 0,05 por mL (R$ 50,00 por Litro)
      status: "Ativo",
      diluicao: "1:5",
      proporcaoDiluicao: 5.0,
      capacidadeBombonaL: 20.0,
      estoqueAtualmL: 20000.0, // Começa cheio (20L)
    },
  });

  console.log("Dispositivo 'ESP32-LAV-01' cadastrado e vinculado.");
  console.log("Pronto para testes físicos com hardware!");
}

main()
  .catch((e) => {
    console.error("Erro ao resetar banco:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
