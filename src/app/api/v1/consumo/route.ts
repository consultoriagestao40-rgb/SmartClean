import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);

    if (!body) {
      return NextResponse.json(
        { error: "Payload JSON inválido" },
        { status: 400 }
      );
    }

    const { dispositivo_id, ml_consumido } = body;

    // Validation
    if (!dispositivo_id || typeof dispositivo_id !== "string") {
      return NextResponse.json(
        { error: "Campo 'dispositivo_id' é obrigatório e deve ser uma string" },
        { status: 400 }
      );
    }

    if (ml_consumido === undefined || typeof ml_consumido !== "number" || ml_consumido <= 0) {
      return NextResponse.json(
        { error: "Campo 'ml_consumido' é obrigatório e deve ser um número maior que zero" },
        { status: 400 }
      );
    }

    // Verify if device exists and is active
    const dispositivo = await db.getDispositivoById(dispositivo_id);

    if (!dispositivo) {
      return NextResponse.json(
        { error: `Dispositivo com ID '${dispositivo_id}' não encontrado` },
        { status: 404 }
      );
    }

    if (dispositivo.status !== "Ativo") {
      return NextResponse.json(
        { error: `Dispositivo '${dispositivo_id}' está inativo` },
        { status: 403 }
      );
    }

    // Record consumption and update connection timestamp
    const registro = await db.registrarConsumo(dispositivo_id, ml_consumido);

    return NextResponse.json(
      {
        message: "Registro de consumo inserido com sucesso",
        data: {
          id: registro.id,
          dispositivo_id: registro.dispositivoId,
          ml_consumido: registro.mlConsumido,
          empresa_cliente_id: dispositivo.empresaClienteId,
          data_hora: registro.dataHora.toISOString(),
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Erro na API de consumo:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor", details: error.message },
      { status: 500 }
    );
  }
}
