import { NextResponse } from 'next/server';
import { MercadoPagoConfig, Preference } from 'mercadopago';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

const client = new MercadoPagoConfig({
  accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN!,
});

export async function POST() {
  try {
    const baseUrl = process.env.APP_URL;
    if (!baseUrl)
      throw new Error('A variável de ambiente APP_URL não está definida.');

    const paymentData = {
      status: 'pending',
      createdAt: serverTimestamp(),
      description: 'Produto de Teste',
      price: 10.5,
    };
    const paymentRef = await addDoc(collection(db, 'payments'), paymentData);
    const paymentId = paymentRef.id;

    const preference = new Preference(client);

    // CORREÇÃO: Construindo as URLs de forma segura
    const successUrl = new URL('/feedback?status=success', baseUrl).toString();
    const failureUrl = new URL('/feedback?status=failure', baseUrl).toString();
    const pendingUrl = new URL('/feedback?status=pending', baseUrl).toString();
    const notificationUrl = new URL('/api/webhook', baseUrl).toString();

    const preferenceData = await preference.create({
      body: {
        items: [
          {
            id: paymentId,
            title: 'Produto Exemplo',
            quantity: 1,
            unit_price: 10.5,
            currency_id: 'BRL',
          },
        ],
        external_reference: paymentId,
        back_urls: {
          success: successUrl,
          failure: failureUrl,
          pending: pendingUrl,
        },
        auto_return: 'approved',
        notification_url: notificationUrl,
      },
    });

    return NextResponse.json({
      id: preferenceData.id,
      init_point: preferenceData.init_point,
    });
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : 'Falha ao criar o pagamento.';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
