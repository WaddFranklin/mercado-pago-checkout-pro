'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { toast } from 'sonner';

interface Participant {
  id: string;
  name: string;
  amount: number;
}

export default function CreateVaquinhaPage() {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [totalAmount, setTotalAmount] = useState<number | ''>('');
  const [receiverPixKey, setReceiverPixKey] = useState('');
  const [participants, setParticipants] = useState<Participant[]>([
    { id: Date.now().toString(), name: '', amount: 0 },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (totalAmount > 0 && participants.length > 0) {
      const amountPerParticipant =
        Math.floor((totalAmount * 100) / participants.length) / 100;
      const totalCalculated = amountPerParticipant * participants.length;
      const remainder = totalAmount - totalCalculated;

      setParticipants((prevParticipants) =>
        prevParticipants.map((p, index) => ({
          ...p,
          amount:
            index === 0
              ? parseFloat((amountPerParticipant + remainder).toFixed(2))
              : amountPerParticipant,
        })),
      );
    }
  }, [totalAmount, participants.length]);

  const handleAddParticipant = () => {
    setParticipants([
      ...participants,
      { id: Date.now().toString(), name: '', amount: 0 },
    ]);
  };

  const handleRemoveParticipant = (id: string) => {
    setParticipants(participants.filter((p) => p.id !== id));
  };

  const handleParticipantNameChange = (id: string, name: string) => {
    setParticipants(
      participants.map((p) => (p.id === id ? { ...p, name } : p)),
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    if (
      !title ||
      !totalAmount ||
      !receiverPixKey ||
      participants.some((p) => !p.name)
    ) {
      toast.error(
        'Preencha todos os campos da vaquinha e o nome de todos os participantes.',
      );
      setIsLoading(false);
      return;
    }

    try {
      const vaquinhaRef = await addDoc(collection(db, 'vaquinhas'), {
        title,
        description,
        // CORREÇÃO: Conversão segura sem 'as any'
        totalAmount: parseFloat(String(totalAmount)),
        receiverPixKey,
        createdBy: null,
        createdAt: serverTimestamp(),
        participants: participants.map(({ name, amount }) => ({
          name,
          amount,
          status: 'pending',
          firebasePaymentId: null,
        })),
      });

      toast.success('Vaquinha criada com sucesso!');
      router.push(`/vaquinha/${vaquinhaRef.id}`);
    } catch (error: unknown) {
      console.error('Erro ao criar vaquinha:', error);
      toast.error('Erro ao criar vaquinha. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="container mx-auto p-8 max-w-2xl">
      <h1 className="text-3xl font-bold mb-8 text-center">
        Criar Nova Vaquinha
      </h1>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <Label htmlFor="title">Título da Vaquinha</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </div>
        <div>
          <Label htmlFor="description">Descrição</Label>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
          />
        </div>
        <div>
          <Label htmlFor="totalAmount">Valor Total da Vaquinha (R$)</Label>
          <Input
            id="totalAmount"
            type="number"
            step="0.01"
            value={totalAmount}
            onChange={(e) => setTotalAmount(parseFloat(e.target.value) || '')}
            required
          />
        </div>
        <div>
          <Label htmlFor="receiverPixKey">Chave PIX do Recebedor</Label>
          <Input
            id="receiverPixKey"
            value={receiverPixKey}
            onChange={(e) => setReceiverPixKey(e.target.value)}
            required
          />
        </div>

        <h2 className="text-2xl font-semibold mt-8 mb-4">Participantes</h2>
        {participants.map((participant) => (
          <div
            key={participant.id}
            className="flex items-center space-x-4 bg-gray-50 p-4 rounded-md"
          >
            <div className="flex-grow">
              <Label htmlFor={`participant-name-${participant.id}`}>
                Nome do Participante
              </Label>
              <Input
                id={`participant-name-${participant.id}`}
                value={participant.name}
                onChange={(e) =>
                  handleParticipantNameChange(participant.id, e.target.value)
                }
                placeholder="Nome do participante"
                required
              />
            </div>
            <div className="text-right">
              <Label>Valor a Pagar</Label>
              <p className="font-bold text-lg">
                R$ {participant.amount.toFixed(2)}
              </p>
            </div>
            {participants.length > 1 && (
              <Button
                type="button"
                variant="destructive"
                size="icon"
                onClick={() => handleRemoveParticipant(participant.id)}
                className="self-end"
              >
                X
              </Button>
            )}
          </div>
        ))}
        <Button type="button" variant="outline" onClick={handleAddParticipant}>
          Adicionar Participante
        </Button>

        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? 'Criando Vaquinha...' : 'Criar Vaquinha'}
        </Button>
      </form>
    </main>
  );
}
