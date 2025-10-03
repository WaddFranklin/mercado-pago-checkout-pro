import { NextRequest, NextResponse } from 'next/server';
import { MercadoPagoConfig, Payment } from 'mercadopago';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import crypto from 'crypto';

const mercadoPagoAccessToken = process.env.MERCADOPAGO_ACCESS_TOKEN!;
const webhookSecret = process.env.MERCADOPAGO_WEBHOOK_SECRET!;

const client = new MercadoPagoConfig({ accessToken: mercadoPagoAccessToken });
const payment = new Payment(client);

export async function POST(request: NextRequest) {
  console.log('Webhook recebido!');

  try {
    const body = await request.json();

    // --- INÍCIO DA VERIFICAÇÃO DE ASSINATURA ---
    const signature = request.headers.get('x-signature');
    const requestId = request.headers.get('x-request-id');

    if (!signature || !requestId) {
      console.error('Assinatura ou Request ID ausente.');
      return NextResponse.json(
        { error: 'Assinatura inválida.' },
        { status: 400 },
      );
    }

    const parts = signature.split(',');
    const ts = parts.find((part) => part.startsWith('ts='))?.split('=')[1];
    const hash = parts.find((part) => part.startsWith('v1='))?.split('=')[1];

    const manifest = `id:${body.data.id};request-id:${requestId};ts:${ts};`;

    const hmac = crypto.createHmac('sha265', webhookSecret); // Corrigido para sha256
    hmac.update(manifest);
    const computedHash = hmac.digest('hex');

    if (computedHash !== hash) {
      console.error('Verificação de assinatura falhou.');
      return NextResponse.json(
        { error: 'Assinatura inválida.' },
        { status: 400 },
      );
    }
    // --- FIM DA VERIFICAÇÃO DE ASSINATURA ---

    console.log('Assinatura verificada com sucesso.');

    if (body.type === 'payment') {
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
              (p: any, idx: number) => {
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
    }

    return NextResponse.json({ status: 'received' }, { status: 200 });
  } catch (error) {
    console.error('Erro no processamento do webhook:', error);
    return NextResponse.json(
      { error: 'Erro interno no servidor.' },
      { status: 500 },
    );
  }
}
