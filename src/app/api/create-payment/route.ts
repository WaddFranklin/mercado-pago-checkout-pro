import { NextRequest, NextResponse } from "next/server";
import { MercadoPagoConfig, Preference } from "mercadopago";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

// Inicializa o cliente do Mercado Pago com o Access Token
const client = new MercadoPagoConfig({
  accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN!,
});

export async function POST(_request: NextRequest) {
  try {
    const baseUrl = process.env.APP_URL;

    if (!baseUrl) {
      throw new Error("A variável de ambiente APP_URL não está definida.");
    }

    console.log("Criando registro de pagamento no Firebase...");

    const paymentData = {
      status: "pending",
      createdAt: serverTimestamp(),
      description: "Produto de Teste - Integração Next.js",
      price: 1.99,
    };

    const paymentRef = await addDoc(collection(db, "payments"), paymentData);
    const paymentId = paymentRef.id;

    console.log(`Registro de pagamento criado com ID: ${paymentId}`);

    console.log("Criando preferência de pagamento no Mercado Pago...");
    const preference = new Preference(client);

    const preferenceData = await preference.create({
      body: {
        items: [
          {
            id: paymentId,
            title: "Produto de Exemplo",
            quantity: 1,
            unit_price: 1.99,
            currency_id: "BRL",
          },
        ],
        // 👇 CONFIGURAÇÃO EXPLÍCITA PARA ACEITAR APENAS PIX E CARTÃO DE CRÉDITO
        payment_methods: {
          excluded_payment_types: [
            // Excluímos tudo que NÃO é PIX ou Cartão de Crédito
            { id: "ticket" }, // Exclui Boleto
            { id: "atm" }, // Exclui Pagamento em Lotérica
          ],
          // Definimos o número máximo de parcelas para o cartão de crédito
          installments: 1,
        },
        external_reference: paymentId,
        back_urls: {
          success: `${baseUrl}/feedback?status=success`,
          failure: `${baseUrl}/feedback?status=failure`,
          pending: `${baseUrl}/feedback?status=pending`,
        },
        auto_return: "approved",
        notification_url: `${baseUrl}/api/webhook`,
      },
    });

    console.log("Preferência criada. Redirecionando usuário...");

    return NextResponse.json({
      id: preferenceData.id,
      init_point: preferenceData.init_point,
    });
  } catch (error) {
    console.error("Erro ao criar pagamento:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Falha ao criar o pagamento.";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
