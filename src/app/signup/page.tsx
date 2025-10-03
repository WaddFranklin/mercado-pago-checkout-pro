'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '@/lib/firebase'; // Importar db
import { doc, setDoc } from 'firebase/firestore'; // Importar setDoc
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

export default function SignUpPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password,
      );
      const user = userCredential.user;

      // CRIA O DOCUMENTO DO USUÁRIO NO FIRESTORE
      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        email: user.email,
        plan: 'free', // 'free' ou 'pro'
        proExpirationDate: null,
        freeVaquinhasCreated: 0,
      });

      toast.success('Conta criada com sucesso! Redirecionando...');
      router.push('/minhas-vaquinhas');
    } catch (error: unknown) {
      console.error(error);
      const message =
        error instanceof Error ? error.message : 'Erro ao criar conta.';
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center">
      <form onSubmit={handleSignUp} className="w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-bold text-center">Criar Conta</h1>
        <div>
          <Label htmlFor="email">E-mail</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div>
          <Label htmlFor="password">Senha</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />
        </div>
        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? 'Criando...' : 'Cadastrar'}
        </Button>
      </form>
    </main>
  );
}
