import { NextRequest, NextResponse } from "next/server";
import { MercadoPagoConfig, Payment } from "mercadopago";
import { db } from "@/lib/firebase";
import { doc, updateDoc } from "firebase/firestore";
import crypto from "crypto";

// Suas credenciais e chaves
const mercadoPagoAccessToken = process.env.MERCADOPAGO_ACCESS_TOKEN!;
const webhookSecret = process.env.MERCADOPAGO_WEBHOOK_SECRET!;

const client = new MercadoPagoConfig({ accessToken: mercadoPagoAccessToken });
const payment = new Payment(client);

export async function POST(request: NextRequest) {
  console.log("Webhook recebido!");

  try {
    const body = await request.json();

    // Passo 1: Verificar a assinatura de segurança (ESSENCIAL)
    // O SDK do Mercado Pago para Node.js ainda não tem uma função pronta para isso,
    // então verificamos manualmente como recomendado na documentação.
    const signature = request.headers.get("x-signature");
    const requestId = request.headers.get("x-request-id");

    if (!signature || !requestId) {
      console.error("Assinatura ou Request ID ausente.");
      return NextResponse.json(
        { error: "Assinatura inválida." },
        { status: 400 }
      );
    }

    // A assinatura é um hash HMAC-SHA256
    const parts = signature.split(",");
    const ts = parts.find((part) => part.startsWith("ts="))?.split("=")[1];
    const hash = parts.find((part) => part.startsWith("v1="))?.split("=")[1];

    const manifest = `id:${body.data.id};request-id:${requestId};ts:${ts};`;

    const hmac = crypto.createHmac("sha256", webhookSecret);
    hmac.update(manifest);
    const computedHash = hmac.digest("hex");

    if (computedHash !== hash) {
      console.error("Verificação de assinatura falhou.");
      return NextResponse.json(
        { error: "Assinatura inválida." },
        { status: 400 }
      );
    }

    console.log("Assinatura verificada com sucesso.");

    // Passo 2: Processar apenas notificações de pagamento
    if (body.type === "payment") {
      const paymentId = body.data.id;
      console.log(`Processando pagamento com ID: ${paymentId}`);

      // Passo 3: Buscar os detalhes completos do pagamento
      const paymentDetails = await payment.get({ id: paymentId });

      if (paymentDetails && paymentDetails.external_reference) {
        const firebaseDocId = paymentDetails.external_reference;
        const newStatus = paymentDetails.status;

        console.log(
          `Atualizando documento no Firebase: ${firebaseDocId} para status: ${newStatus}`
        );

        // Passo 4: Atualizar o status no Firebase
        const paymentDocRef = doc(db, "payments", firebaseDocId);
        await updateDoc(paymentDocRef, {
          status: newStatus,
          // Opcional: Salvar o paymentId do MP e detalhes completos se quiser
          mercadoPagoPaymentId: paymentId,
          fullPaymentDetails: paymentDetails,
        });

        console.log("Documento no Firebase atualizado com sucesso.");

        // Passo 5: NOTIFICAR O USUÁRIO
        // Este é o lugar onde você integraria um serviço de e-mail.
        if (newStatus === "approved") {
          console.log(
            `TODO: Enviar e-mail de confirmação para o usuário do pedido ${firebaseDocId}.`
          );
          // Exemplo: await enviarEmailDeConfirmacao(paymentDetails.payer.email, firebaseDocId);
        }
      } else {
        console.warn(
          "Detalhes do pagamento ou external_reference não encontrados."
        );
      }
    }

    // Passo 6: Responder ao Mercado Pago com status 200 OK
    // Isso informa ao MP que recebemos a notificação com sucesso.
    return NextResponse.json({ status: "received" }, { status: 200 });
  } catch (error) {
    console.error("Erro no processamento do webhook:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Ocorreu um erro desconhecido.";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
