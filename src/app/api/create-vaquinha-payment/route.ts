import { NextRequest, NextResponse } from 'next/server';
// CORREÇÃO: Importamos 'Payment' em vez de 'Preference'
import { MercadoPagoConfig, Payment } from 'mercadopago';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';

// A interface do participante permanece a mesma
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
    const { vaquinhaId, participantIndex, title, amount } =
      await request.json();

    if (!vaquinhaId || participantIndex === undefined || !title || !amount) {
      return NextResponse.json(
        { error: 'Dados da vaquinha ou participante incompletos.' },
        { status: 400 },
      );
    }

    const externalReferenceId = `${vaquinhaId}-${participantIndex}`;

    // CORREÇÃO: Instanciamos 'Payment' em vez de 'Preference'
    const payment = new Payment(client);

    // CORREÇÃO: O corpo da requisição para a API de Pagamentos é diferente
    const paymentData = await payment.create({
      body: {
        transaction_amount: Number(amount),
        description: title,
        payment_method_id: 'pix', // Especificamos PIX diretamente
        payer: {
          // O e-mail é um campo obrigatório para pagamentos PIX via API
          email: `pagador${Date.now()}@vaquinha.com`, // Usamos um e-mail de teste/placeholder
          first_name: 'Participante',
          last_name: 'da Vaquinha',
        },
        external_reference: externalReferenceId,
        notification_url: `${process.env.APP_URL}/api/webhook`,
      },
    });

    console.log(
      'RESPOSTA DA API DE PAGAMENTOS:',
      JSON.stringify(paymentData, null, 2),
    );

    const qrCodeData = paymentData.point_of_interaction?.transaction_data;
    if (!qrCodeData?.qr_code_base64 || !qrCodeData?.qr_code) {
      throw new Error(
        'Não foi possível obter os dados do PIX do Mercado Pago na API de Pagamentos.',
      );
    }

    // A lógica de atualizar o Firebase continua a mesma
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
    console.error('Erro ao gerar PIX para vaquinha:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'Falha ao gerar o PIX.';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
