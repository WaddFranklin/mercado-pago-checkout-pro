import { NextRequest, NextResponse } from 'next/server';
import { MercadoPagoConfig, Payment } from 'mercadopago';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import crypto from 'crypto';

interface Participant {
  name: string;
  amount: number;
  status: 'pending' | 'paid' | string;
  firebasePaymentId: string | null;
}

const mercadoPagoAccessToken = process.env.MERCADOPAGO_ACCESS_TOKEN!;
const webhookSecret = process.env.MERCADOPAGO_WEBHOOK_SECRET!;

const client = new MercadoPagoConfig({ accessToken: mercadoPagoAccessToken });
const payment = new Payment(client);

export async function POST(request: NextRequest) {
  console.log('Webhook recebido!');

  try {
    const body = await request.json();
    console.log('Corpo da notificação:', body);

    // CORREÇÃO: Verificar o tipo da notificação ANTES de fazer qualquer outra coisa.
    if (body.type === 'payment') {
      // Toda a lógica de pagamento agora fica dentro deste 'if'.

      // PASSO 1: Verificar a assinatura de segurança
      const signature = request.headers.get('x-signature');
      const requestId = request.headers.get('x-request-id');
      if (!signature || !requestId) {
        console.error('Assinatura de pagamento ou Request ID ausente.');
        return NextResponse.json(
          { error: 'Assinatura inválida.' },
          { status: 400 },
        );
      }

      const parts = signature.split(',');
      const ts = parts.find((part) => part.startsWith('ts='))?.split('=')[1];
      const hash = parts.find((part) => part.startsWith('v1='))?.split('=')[1];

      const manifest = `id:${body.data.id};request-id:${requestId};ts:${ts};`;
      const hmac = crypto.createHmac('sha256', webhookSecret);
      hmac.update(manifest);
      const computedHash = hmac.digest('hex');

      if (computedHash !== hash) {
        console.error('Verificação de assinatura de pagamento falhou.');
        return NextResponse.json(
          { error: 'Assinatura inválida.' },
          { status: 400 },
        );
      }
      console.log('Assinatura de pagamento verificada com sucesso.');

      // PASSO 2: Processar o pagamento
      const paymentId = body.data.id;
      const paymentDetails = await payment.get({ id: paymentId });

      if (paymentDetails && paymentDetails.external_reference) {
        const fullExternalReference = paymentDetails.external_reference;
        const newStatus =
          paymentDetails.status === 'approved' ? 'paid' : paymentDetails.status;

        if (fullExternalReference.includes('-')) {
          const [vaquinhaId, participantIndexStr] =
            fullExternalReference.split('-');
          const participantIndex = parseInt(participantIndexStr);

          const vaquinhaDocRef = doc(db, 'vaquinhas', vaquinhaId);
          const vaquinhaSnapshot = await getDoc(vaquinhaDocRef);

          if (vaquinhaSnapshot.exists()) {
            const vaquinhaData = vaquinhaSnapshot.data();
            const updatedParticipants = vaquinhaData.participants.map(
              (p: Participant, idx: number) => {
                if (idx === participantIndex) {
                  return { ...p, status: newStatus };
                }
                return p;
              },
            );
            await updateDoc(vaquinhaDocRef, {
              participants: updatedParticipants,
            });
            console.log(`Vaquinha ${vaquinhaId} atualizada com sucesso.`);
          }
        } else {
          const paymentDocRef = doc(db, 'payments', fullExternalReference);
          await updateDoc(paymentDocRef, { status: newStatus });
          console.log(`Pagamento simples ${fullExternalReference} atualizado.`);
        }
      }
    } else {
      // Se não for uma notificação de pagamento, apenas logamos e ignoramos.
      console.log(`Notificação de tipo '${body.type}' recebida e ignorada.`);
    }

    // Respondemos OK para qualquer notificação recebida, para que o MP não tente reenviar.
    return NextResponse.json({ status: 'received' });
  } catch (error: unknown) {
    console.error('Erro no processamento do webhook:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'Erro interno no servidor.';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
