import { NextRequest, NextResponse } from "next/server";
import { MercadoPagoConfig, Preference } from "mercadopago";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

// Inicializa o cliente do Mercado Pago com o Access Token
const client = new MercadoPagoConfig({
  accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN!,
});

export async function POST(request: NextRequest) {
  try {
    // Pega a URL base da variável de ambiente. É a forma correta para produção.
    const baseUrl = process.env.APP_URL;

    if (!baseUrl) {
      throw new Error("A variável de ambiente APP_URL não está definida.");
    }

    // Passo 1: Criar o documento de pagamento no Firebase com status 'pendente'
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

    // Passo 2: Criar a preferência de pagamento no Mercado Pago
    console.log("Criando preferência de pagamento no Mercado Pago...");
    const preference = new Preference(client);

    const preferenceData = await preference.create({
      body: {
        items: [
          {
            id: paymentId,
            title: "Produto de Exemplo",
            quantity: 1,
            unit_price: 10.5,
            currency_id: "BRL",
          },
        ],
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
    // Em um erro, é melhor retornar uma mensagem genérica para o usuário
    const errorMessage =
      error instanceof Error ? error.message : "Falha ao criar o pagamento.";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
