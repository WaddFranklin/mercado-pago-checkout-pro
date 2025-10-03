import { NextRequest, NextResponse } from 'next/server';
import { MercadoPagoConfig, Payment } from 'mercadopago';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import crypto from 'crypto';

// CORREÇÃO: Adicionada interface para tipagem
interface Participant {
  name: string;
  amount: number;
  status: 'pending' | 'paid' | string; // Permitir outros status do MP
  firebasePaymentId: string | null;
}

const mercadoPagoAccessToken = process.env.MERCADOPAGO_ACCESS_TOKEN!;
const webhookSecret = process.env.MERCADOPAGO_WEBHOOK_SECRET!;

const client = new MercadoPagoConfig({ accessToken: mercadoPagoAccessToken });
const payment = new Payment(client);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const signature = request.headers.get('x-signature');
    const requestId = request.headers.get('x-request-id');
    if (!signature || !requestId)
      return NextResponse.json(
        { error: 'Assinatura inválida.' },
        { status: 400 },
      );

    const parts = signature.split(',');
    const ts = parts.find((part) => part.startsWith('ts='))?.split('=')[1];
    const hash = parts.find((part) => part.startsWith('v1='))?.split('=')[1];
    const manifest = `id:${body.data.id};request-id:${requestId};ts:${ts};`;
    const hmac = crypto.createHmac('sha256', webhookSecret);
    hmac.update(manifest);
    const computedHash = hmac.digest('hex');

    if (computedHash !== hash)
      return NextResponse.json(
        { error: 'Assinatura inválida.' },
        { status: 400 },
      );

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
            // CORREÇÃO: Usando a interface Participant para tipar 'p'
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
          }
        } else {
          const paymentDocRef = doc(db, 'payments', fullExternalReference);
          await updateDoc(paymentDocRef, { status: newStatus });
        }
      }
    }
    return NextResponse.json({ status: 'received' });
  } catch (error: unknown) {
    console.error('Erro no processamento do webhook:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'Erro interno no servidor.';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
