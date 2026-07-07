"use server";

import { db, Empresa, Dispositivo } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function getAdminData() {
  try {
    const stats = await db.getAdminStats();
    
    // We need to serialize the response properly since Server Actions pass plain objects.
    // Date objects are automatically serialized, but we clean up formats just in case.
    return {
      success: true,
      data: {
        faturamentoAcumuladoGlobal: stats.faturamentoAcumuladoGlobal,
        empresas: stats.empresas,
        dispositivos: stats.dispositivos,
        // Map records for easier client processing
        registros: stats.registros.map(r => ({
          ...r,
          dataHora: r.dataHora.toISOString()
        }))
      }
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function getClientData(clientId: string) {
  try {
    const stats = await db.getClientStats(clientId);
    return {
      success: true,
      data: {
        client: stats.client,
        devices: stats.devices,
        totalMLMensal: stats.totalMLMensal,
        totalValorMensal: stats.totalValorMensal,
        logs: stats.logs.map(r => ({
          ...r,
          dataHora: r.dataHora.toISOString()
        }))
      }
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function createCliente(formData: {
  razaoSocial: string;
  cnpj: string;
  emailContato: string;
  telefone: string;
  status: string;
}) {
  try {
    if (!formData.razaoSocial || !formData.cnpj || !formData.emailContato) {
      throw new Error("Razão Social, CNPJ e E-mail de Contato são campos obrigatórios");
    }

    const created = await db.createEmpresa({
      razaoSocial: formData.razaoSocial,
      cnpj: formData.cnpj,
      emailContato: formData.emailContato,
      telefone: formData.telefone || null,
      status: formData.status,
    });

    revalidatePath("/");
    return { success: true, data: created };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function createDispositivo(formData: {
  id: string;
  empresaClienteId: string;
  localInstalacao: string;
  produtoQuimicoAssociado: string;
  precoPormL: number;
  status: string;
}) {
  try {
    if (!formData.id || !formData.empresaClienteId || !formData.localInstalacao || !formData.produtoQuimicoAssociado || formData.precoPormL === undefined) {
      throw new Error("Todos os campos do dispositivo são obrigatórios");
    }

    const created = await db.createDispositivo({
      id: formData.id,
      empresaClienteId: formData.empresaClienteId,
      localInstalacao: formData.localInstalacao,
      produtoQuimicoAssociado: formData.produtoQuimicoAssociado,
      precoPormL: Number(formData.precoPormL),
      status: formData.status,
      ultimaConexao: null
    });

    revalidatePath("/");
    return { success: true, data: created };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
