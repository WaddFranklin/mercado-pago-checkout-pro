import { NextResponse } from 'next/server'; // CORREÇÃO: NextRequest não é mais necessário
import { MercadoPagoConfig, Preference } from 'mercadopago';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

const client = new MercadoPagoConfig({
  accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN!,
});

// CORREÇÃO: Removido o parâmetro '_request' que não era utilizado
export async function POST() {
  try {
    const baseUrl = process.env.APP_URL;
    if (!baseUrl)
      throw new Error('A variável de ambiente APP_URL não está definida.');

    const paymentData = {
      status: 'pending',
      createdAt: serverTimestamp(),
      description: 'Produto de Teste - Integração Next.js',
      price: 10.5,
    };

    const paymentRef = await addDoc(collection(db, 'payments'), paymentData);
    const paymentId = paymentRef.id;

    const preference = new Preference(client);
    const preferenceData = await preference.create({
      body: {
        items: [
          {
            id: paymentId,
            title: 'Produto de Exemplo',
            quantity: 1,
            unit_price: 10.5,
            currency_id: 'BRL',
          },
        ],
        external_reference: paymentId,
        back_urls: {
          success: `${baseUrl}/feedback?status=success`,
          failure: `${baseUrl}/feedback?status=failure`,
          pending: `${baseUrl}/feedback?status=pending`,
        },
        auto_return: 'approved',
        notification_url: `${baseUrl}/api/webhook`,
      },
    });

    return NextResponse.json({
      id: preferenceData.id,
      init_point: preferenceData.init_point,
    });
  } catch (error: unknown) {
    console.error('Erro ao criar pagamento:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'Falha ao criar o pagamento.';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
