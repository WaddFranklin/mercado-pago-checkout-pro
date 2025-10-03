import { NextRequest, NextResponse } from 'next/server';
import { MercadoPagoConfig, Payment } from 'mercadopago';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';

interface Participant {
  name: string;
  amount: number;
  status: 'pending' | 'paid';
  firebasePaymentId: string | null;
}

const client = new MercadoPagoConfig({
  accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN!,
});

export async function POST(request: NextRequest) {
  try {
    const baseUrl = process.env.APP_URL;
    if (!baseUrl)
      throw new Error('A variável de ambiente APP_URL não está definida.');

    const { vaquinhaId, participantIndex, title, amount } =
      await request.json();
    // ... (validações) ...
    const externalReferenceId = `${vaquinhaId}-${participantIndex}`;
    const payment = new Payment(client);

    // CORREÇÃO: Construindo a URL de notificação de forma segura
    const notificationUrl = new URL('/api/webhook', baseUrl).toString();

    const paymentData = await payment.create({
      body: {
        transaction_amount: Number(amount),
        description: title,
        payment_method_id: 'pix',
        payer: {
          email: `pagador${Date.now()}@vaquinha.com`,
          first_name: 'Participante',
          last_name: 'da Vaquinha',
        },
        external_reference: externalReferenceId,
        notification_url: notificationUrl, // Usando a URL segura
      },
    });

    // ... (resto do código permanece o mesmo)
    const qrCodeData = paymentData.point_of_interaction?.transaction_data;
    if (!qrCodeData?.qr_code_base64 || !qrCodeData?.qr_code) {
      throw new Error(
        'Não foi possível obter os dados do PIX do Mercado Pago na API de Pagamentos.',
      );
    }

    const vaquinhaDocRef = doc(db, 'vaquinhas', vaquinhaId);
    const vaquinhaSnapshot = await getDoc(vaquinhaDocRef);
    if (!vaquinhaSnapshot.exists())
      throw new Error('Vaquinha não encontrada no Firebase.');

    const vaquinhaData = vaquinhaSnapshot.data();
    const updatedParticipants = vaquinhaData.participants.map(
      (p: Participant, idx: number) => {
        if (idx === participantIndex) {
          return {
            ...p,
            firebasePaymentId: paymentData.id?.toString() || null,
          };
        }
        return p;
      },
    );

    await updateDoc(vaquinhaDocRef, { participants: updatedParticipants });

    return NextResponse.json({
      qr_code_base64: qrCodeData.qr_code_base64,
      qr_code_text: qrCodeData.qr_code,
      payment_id: paymentData.id,
    });
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : 'Falha ao gerar o PIX.';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
