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
    // !!! IMPORTANTE PARA TESTE LOCAL !!!
    // Use a URL HTTPS que o ngrok gerou para você.
    // Em produção, você voltaria a usar request.nextUrl.origin ou uma variável de ambiente.
    const baseUrl = "https://832d8b2f7cbd.ngrok-free.app"; // <-- TROQUE PELA SUA URL DO NGROK

    // Passo 1: Criar o documento de pagamento no Firebase com status 'pendente'
    console.log("Criando registro de pagamento no Firebase...");

    const paymentData = {
      status: "pending",
      createdAt: serverTimestamp(),
      description: "Produto de Teste - Integração Next.js",
      price: 10.5,
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

        // URLs para onde o usuário será redirecionado (AGORA COM HTTPS)
        back_urls: {
          success: `${baseUrl}/feedback?status=success`,
          failure: `${baseUrl}/feedback?status=failure`,
          pending: `${baseUrl}/feedback?status=pending`,
        },
        auto_return: "approved",

        // URL de notificação para o Webhook (AGORA COM HTTPS)
        notification_url: `${baseUrl}/api/webhook`,
      },
    });

    console.log("Preferência criada. Redirecionando usuário...");

    // Passo 3: Retornar a URL de pagamento para o frontend
    return NextResponse.json({
      id: preferenceData.id,
      init_point: preferenceData.init_point,
    });
  } catch (error) {
    console.error("Erro ao criar pagamento:", error);
    return NextResponse.json(
      { error: "Falha ao criar o pagamento." },
      { status: 500 }
    );
  }
}
