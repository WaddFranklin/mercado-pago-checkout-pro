'use client';

import { useEffect, useState, Suspense } from 'react';
import { useParams } from 'next/navigation';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { CheckCircle, Clock } from 'lucide-react';
import Image from 'next/image';

interface ParticipantData {
  name: string;
  amount: number;
  status: 'pending' | 'paid' | string;
  firebasePaymentId: string | null;
}

interface VaquinhaData {
  title: string;
  description: string;
  totalAmount: number;
  receiverPixKey: string;
  participants: ParticipantData[];
}

function PixPaymentModal({
  pixData,
  onClose,
}: {
  pixData: { qrCodeBase64: string; qrCodeText: string } | null;
  onClose: () => void;
}) {
  if (!pixData) return null;
  const handleCopy = () => {
    navigator.clipboard.writeText(pixData.qrCodeText);
    toast.success('Código PIX copiado!');
  };
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full text-center">
        <h2 className="text-2xl font-bold mb-4">Pagar via PIX</h2>
        <p className="mb-4">Escaneie o QR Code ou use o código Copia e Cola.</p>
        <Image
          src={`data:image/png;base64,${pixData.qrCodeBase64}`}
          alt="QR Code PIX"
          width={200}
          height={200}
          className="mx-auto my-4 border rounded-md"
        />
        <div className="mb-4 p-3 bg-gray-100 rounded-md text-sm break-all">
          <p className="font-semibold mb-2">Código PIX:</p>
          <p>{pixData.qrCodeText}</p>
        </div>
        <Button onClick={handleCopy} className="w-full mb-3">
          Copiar Código
        </Button>
        <Button variant="outline" onClick={onClose} className="w-full">
          Fechar
        </Button>
      </div>
    </div>
  );
}

function VaquinhaContent() {
  const { id } = useParams();
  const [vaquinha, setVaquinha] = useState<VaquinhaData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generatingPix, setGeneratingPix] = useState<string | null>(null);
  const [currentPixData, setCurrentPixData] = useState<{
    qrCodeBase64: string;
    qrCodeText: string;
  } | null>(null);

  useEffect(() => {
    if (!id) return;
    const vaquinhaDocRef = doc(db, 'vaquinhas', id as string);
    const unsubscribe = onSnapshot(
      vaquinhaDocRef,
      (docSnap) => {
        if (docSnap.exists()) {
          setVaquinha(docSnap.data() as VaquinhaData);
          setLoading(false);
        } else {
          setError('Vaquinha não encontrada.');
          setLoading(false);
        }
      },
      (err: Error) => {
        console.error('Erro ao carregar vaquinha:', err);
        setError('Erro ao carregar vaquinha.');
        setLoading(false);
      },
    );
    return () => unsubscribe();
  }, [id]);

  const handleGeneratePix = async (participantIndex: number) => {
    if (!vaquinha) return;
    const participant = vaquinha.participants[participantIndex];
    setGeneratingPix(participant.name);

    try {
      const response = await fetch('/api/create-vaquinha-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // CORREÇÃO: O backend agora busca os dados do Firebase, só precisamos enviar os IDs
        body: JSON.stringify({
          vaquinhaId: id,
          participantIndex: participantIndex,
          title: `Pagamento Vaquinha: ${vaquinha.title} - ${participant.name}`,
          amount: participant.amount,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Erro ao gerar PIX.');

      if (data.qr_code_base64 && data.qr_code_text) {
        setCurrentPixData({
          qrCodeBase64: data.qr_code_base64,
          qrCodeText: data.qr_code_text,
        });
      } else {
        toast.error('Não foi possível gerar os dados do PIX.');
      }
    } catch (error: unknown) {
      console.error(error);
      const message =
        error instanceof Error ? error.message : 'Erro ao gerar PIX.';
      toast.error(message);
    } finally {
      setGeneratingPix(null);
    }
  };

  if (loading)
    return (
      <main className="flex min-h-screen items-center justify-center">
        Carregando...
      </main>
    );
  if (error)
    return (
      <main className="flex min-h-screen items-center justify-center text-red-500">
        {error}
      </main>
    );
  if (!vaquinha) return null;

  const totalPaid = vaquinha.participants
    .filter((p) => p.status === 'paid')
    .reduce((sum, p) => sum + p.amount, 0);

  return (
    <main className="container mx-auto p-8 max-w-3xl">
      <h1 className="text-4xl font-bold mb-4 text-center">{vaquinha.title}</h1>
      <p className="text-gray-600 mb-6 text-center">{vaquinha.description}</p>
      <div className="bg-blue-50 p-6 rounded-lg shadow-sm mb-8 text-center">
        <h2 className="text-xl font-semibold text-blue-800">
          Total: R$ {vaquinha.totalAmount.toFixed(2)}
        </h2>
        <p className="text-blue-700 text-lg">
          Arrecadado:{' '}
          <span className="font-bold text-green-700">
            R$ {totalPaid.toFixed(2)}
          </span>
        </p>
      </div>
      <h2 className="text-2xl font-semibold mb-6">Participantes:</h2>
      <div className="space-y-4">
        {vaquinha.participants.map((participant, index) => (
          <div
            key={index}
            className="flex items-center justify-between bg-white p-4 rounded-lg shadow-md"
          >
            <div className="flex items-center space-x-3">
              {participant.status === 'paid' ? (
                <CheckCircle className="text-green-500" size={20} />
              ) : (
                <Clock className="text-yellow-500" size={20} />
              )}
              <span className="text-lg font-medium">{participant.name}</span>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-lg font-bold text-gray-800">
                R$ {participant.amount.toFixed(2)}
              </span>
              {participant.status !== 'paid' && (
                <Button
                  onClick={() => handleGeneratePix(index)}
                  disabled={generatingPix === participant.name}
                  size="sm"
                >
                  {generatingPix === participant.name
                    ? 'Gerando...'
                    : 'Pagar PIX'}
                </Button>
              )}
              {participant.status === 'paid' && (
                <span className="text-green-600 font-semibold">PAGO</span>
              )}
            </div>
          </div>
        ))}
      </div>
      <PixPaymentModal
        pixData={currentPixData}
        onClose={() => setCurrentPixData(null)}
      />
    </main>
  );
}

export default function VaquinhaPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center">
          Carregando...
        </main>
      }
    >
      <VaquinhaContent />
    </Suspense>
  );
}
