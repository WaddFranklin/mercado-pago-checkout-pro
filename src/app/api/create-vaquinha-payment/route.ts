import { NextRequest, NextResponse } from 'next/server';
import { MercadoPagoConfig, Preference } from 'mercadopago';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';

const client = new MercadoPagoConfig({
  accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN!,
});

export async function POST(request: NextRequest) {
  try {
    const baseUrl = process.env.APP_URL;

    if (!baseUrl) {
      throw new Error('A variável de ambiente APP_URL não está definida.');
    }

    const { vaquinhaId, participantIndex, title, amount } =
      await request.json();

    if (!vaquinhaId || participantIndex === undefined || !title || !amount) {
      return NextResponse.json(
        { error: 'Dados da vaquinha ou participante incompletos.' },
        { status: 400 },
      );
    }

    const externalReferenceId = `${vaquinhaId}-${participantIndex}`;

    console.log(
      `Gerando PIX para vaquinha ${vaquinhaId}, participante ${participantIndex} com ref externa ${externalReferenceId}`,
    );

    const preference = new Preference(client);

    const preferenceData = await preference.create({
      body: {
        items: [
          {
            id: externalReferenceId,
            title: title,
            quantity: 1,
            unit_price: parseFloat(amount),
            currency_id: 'BRL',
          },
        ],
        payment_methods: {
          excluded_payment_types: [
            { id: 'credit_card' },
            { id: 'debit_card' },
            { id: 'ticket' },
            { id: 'atm' },
          ],
          installments: 1,
        },
        external_reference: externalReferenceId,
        notification_url: `${baseUrl}/api/webhook`,
      },
    });

    const qrCodeData = preferenceData.point_of_interaction?.transaction_data;
    if (!qrCodeData?.qr_code_base64 || !qrCodeData?.qr_code) {
      throw new Error(
        'Não foi possível obter os dados do PIX do Mercado Pago.',
      );
    }

    const vaquinhaDocRef = doc(db, 'vaquinhas', vaquinhaId);
    const vaquinhaSnapshot = await getDoc(vaquinhaDocRef);
    if (!vaquinhaSnapshot.exists()) {
      throw new Error('Vaquinha não encontrada no Firebase.');
    }
    const vaquinhaData = vaquinhaSnapshot.data();
    const updatedParticipants = vaquinhaData.participants.map(
      (p: any, idx: number) => {
        if (idx === participantIndex) {
          return { ...p, firebasePaymentId: preferenceData.id };
        }
        return p;
      },
    );

    await updateDoc(vaquinhaDocRef, {
      participants: updatedParticipants,
    });

    return NextResponse.json({
      qr_code_base64: qrCodeData.qr_code_base64,
      qr_code_text: qrCodeData.qr_code,
      preference_id: preferenceData.id,
    });
  } catch (error: unknown) {
    // <-- CORREÇÃO AQUI
    console.error('Erro ao gerar PIX para vaquinha:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'Falha ao gerar o PIX.';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
