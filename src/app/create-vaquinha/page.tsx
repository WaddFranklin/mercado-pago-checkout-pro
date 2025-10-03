'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { db } from '@/lib/firebase';
import {
  collection,
  doc,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface Participant {
  id: string;
  name: string;
  amount: number;
}

export default function CreateVaquinhaPage() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const router = useRouter();

  // Estados do formulário principal
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [totalAmount, setTotalAmount] = useState<number | ''>('');
  const [receiverPixKey, setReceiverPixKey] = useState('');
  const [participants, setParticipants] = useState<Participant[]>([
    { id: Date.now().toString(), name: '', amount: 0 },
  ]);
  const [isLoading, setIsLoading] = useState(false);

  // Estado para a área de texto de colar nomes
  const [pastedNames, setPastedNames] = useState('');

  // Redireciona se o usuário não estiver logado
  useEffect(() => {
    if (!isAuthLoading && !user) {
      toast.error('Você precisa estar logado para acessar esta página.');
      router.push('/login');
    }
  }, [user, isAuthLoading, router]);

  // Recalcula a divisão sempre que o valor total ou o número de participantes mudar
  useEffect(() => {
    if (Number(totalAmount) > 0 && participants.length > 0) {
      const amountPerParticipant =
        Math.floor((Number(totalAmount) * 100) / participants.length) / 100;
      const totalCalculated = amountPerParticipant * participants.length;
      const remainder = Number(totalAmount) - totalCalculated;
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

  // Funções para o modo Manual
  const handleAddParticipant = () =>
    setParticipants([
      ...participants,
      { id: Date.now().toString(), name: '', amount: 0 },
    ]);
  const handleRemoveParticipant = (id: string) =>
    setParticipants(participants.filter((p) => p.id !== id));
  const handleParticipantNameChange = (id: string, name: string) =>
    setParticipants(
      participants.map((p) => (p.id === id ? { ...p, name } : p)),
    );

  // Função para processar a string de nomes colados
  const processPastedNames = () => {
    const names = pastedNames
      .split('\n')
      .map((name) => name.trim())
      .filter(Boolean);
    if (names.length === 0) {
      toast.error('Nenhum nome válido encontrado na lista.');
      return;
    }
    const newParticipants = names.map((name) => ({
      id: `${Date.now()}-${Math.random()}`,
      name,
      amount: 0,
    }));
    setParticipants(newParticipants);
    toast.success(
      `${newParticipants.length} participantes adicionados da lista.`,
    );
  };

  // Função para processar o arquivo .txt
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.type !== 'text/plain') {
      toast.error('Por favor, envie um arquivo .txt');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      const names = content
        .split('\n')
        .map((name) => name.trim())
        .filter(Boolean);
      const newParticipants = names.map((name) => ({
        id: `${Date.now()}-${Math.random()}`,
        name,
        amount: 0,
      }));
      setParticipants(newParticipants);
      toast.success(
        `${newParticipants.length} participantes adicionados do arquivo.`,
      );
    };
    reader.readAsText(file);
  };

  // Função de Submit COMPLETA
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    if (!user) {
      toast.error('Você precisa estar logado para criar uma vaquinha.');
      setIsLoading(false);
      return;
    }

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
      await runTransaction(db, async (transaction) => {
        const userDocRef = doc(db, 'users', user.uid);
        const userDoc = await transaction.get(userDocRef);

        if (!userDoc.exists()) {
          throw new Error(
            'Documento do usuário não encontrado. Tente fazer login novamente.',
          );
        }

        const userData = userDoc.data();
        const isPro =
          userData.plan === 'pro' &&
          userData.proExpirationDate?.toDate() > new Date();

        if (!isPro && userData.freeVaquinhasCreated >= 3) {
          throw new Error(
            'Você atingiu o limite de 3 vaquinhas para contas gratuitas. Faça o upgrade para o plano Pro!',
          );
        }

        const newVaquinhaRef = doc(collection(db, 'vaquinhas'));
        transaction.set(newVaquinhaRef, {
          title,
          description,
          totalAmount: parseFloat(String(totalAmount)),
          receiverPixKey,
          createdBy: user.uid,
          createdAt: serverTimestamp(),
          participants: participants.map(({ name, amount }) => ({
            name,
            amount,
            status: 'pending',
            firebasePaymentId: null,
          })),
        });

        if (!isPro) {
          transaction.update(userDocRef, {
            freeVaquinhasCreated: userData.freeVaquinhasCreated + 1,
          });
        }
      });

      toast.success('Vaquinha criada com sucesso!');
      router.push('/minhas-vaquinhas');
    } catch (error: unknown) {
      console.error('Erro ao criar vaquinha:', error);
      const message =
        error instanceof Error ? error.message : 'Erro ao criar vaquinha.';
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  if (isAuthLoading || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        Carregando...
      </main>
    );
  }

  return (
    <main className="container mx-auto p-8 max-w-2xl">
      <h1 className="text-3xl font-bold mb-8 text-center">
        Criar Nova Vaquinha
      </h1>
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* CAMPOS GERAIS DA VAQUINHA */}
        <div className="space-y-4">
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
        </div>

        <h2 className="text-2xl font-semibold mt-8 mb-4">
          Adicionar Participantes
        </h2>

        {/* SISTEMA DE ABAS */}
        <Tabs defaultValue="manual" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="manual">Manual</TabsTrigger>
            <TabsTrigger value="paste">Colar Nomes</TabsTrigger>
            <TabsTrigger value="upload">Enviar Arquivo</TabsTrigger>
          </TabsList>

          <TabsContent value="manual">
            <div className="space-y-4 mt-4">
              {participants.map((participant) => (
                <div
                  key={participant.id}
                  className="flex items-center space-x-4"
                >
                  <div className="flex-grow">
                    <Label htmlFor={`participant-name-${participant.id}`}>
                      Nome do Participante
                    </Label>
                    <Input
                      id={`participant-name-${participant.id}`}
                      value={participant.name}
                      onChange={(e) =>
                        handleParticipantNameChange(
                          participant.id,
                          e.target.value,
                        )
                      }
                      required
                    />
                  </div>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => handleRemoveParticipant(participant.id)}
                    className="self-end mt-6"
                  >
                    Remover
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                onClick={handleAddParticipant}
              >
                Adicionar Participante
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="paste">
            <div className="space-y-4 mt-4">
              <Label htmlFor="pasted-names">
                Cole a lista de nomes (um por linha)
              </Label>
              <Textarea
                id="pasted-names"
                value={pastedNames}
                onChange={(e) => setPastedNames(e.target.value)}
                rows={10}
                placeholder="Franklin&#10;Gemini&#10;Fulano"
              />
              <Button type="button" onClick={processPastedNames}>
                Processar Lista
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="upload">
            <div className="space-y-4 mt-4">
              <Label htmlFor="file-upload">
                Envie um arquivo .txt com os nomes (um por linha)
              </Label>
              <Input
                id="file-upload"
                type="file"
                accept=".txt"
                onChange={handleFileUpload}
              />
            </div>
          </TabsContent>
        </Tabs>

        <div className="mt-8">
          <h3 className="text-xl font-semibold mb-4">
            Lista de Participantes ({participants.length})
          </h3>
          <div className="space-y-2 max-h-60 overflow-y-auto border p-4 rounded-md">
            {participants.length > 0 ? (
              participants.map((p) => (
                <div key={p.id} className="flex justify-between items-center">
                  <span>{p.name}</span>
                  <span className="font-mono">R$ {p.amount.toFixed(2)}</span>
                </div>
              ))
            ) : (
              <p className="text-gray-500">Nenhum participante adicionado.</p>
            )}
          </div>
        </div>

        <Button type="submit" className="w-full !mt-8" disabled={isLoading}>
          {isLoading ? 'Criando Vaquinha...' : 'Criar Vaquinha'}
        </Button>
      </form>
    </main>
  );
}
