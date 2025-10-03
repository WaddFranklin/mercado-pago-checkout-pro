'use client';
import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { db, auth } from '@/lib/firebase';
import {
  collection,
  query,
  where,
  onSnapshot,
  orderBy,
} from 'firebase/firestore';
import Link from 'next/link';
import { signOut } from 'firebase/auth';

// Importando componentes do shadcn/ui
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress'; // NOVO: Importando Progress
import { PlusCircle, LogOut, PartyPopper } from 'lucide-react'; // NOVO: Importando ícone
import { toast } from 'sonner';

interface Participant {
  name: string;
  amount: number;
  status: 'pending' | 'paid' | string;
  firebasePaymentId: string | null;
}

interface Vaquinha {
  id: string;
  title: string;
  totalAmount: number;
  participants: Participant[];
  createdAt: {
    seconds: number;
    nanoseconds: number;
  } | null;
}

// Componente para o estado de carregamento, agora um pouco mais detalhado
function VaquinhasSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {[...Array(3)].map((_, i) => (
        <Card key={i}>
          <CardHeader>
            <Skeleton className="h-6 w-3/4 mb-2" />
            <Skeleton className="h-4 w-1/2" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-4 w-full mb-2" />
            <Skeleton className="h-4 w-1/3" />
          </CardContent>
          <CardFooter>
            <Skeleton className="h-8 w-full" />
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}

export default function MinhasVaquinhasPage() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const router = useRouter();
  const [vaquinhas, setVaquinhas] = useState<Vaquinha[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthLoading && !user) {
      router.push('/login');
      return;
    }

    if (user) {
      const q = query(
        collection(db, 'vaquinhas'),
        where('createdBy', '==', user.uid),
        orderBy('createdAt', 'desc'),
      );

      const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const userVaquinhas: Vaquinha[] = [];
        querySnapshot.forEach((doc) => {
          userVaquinhas.push({ id: doc.id, ...doc.data() } as Vaquinha);
        });
        setVaquinhas(userVaquinhas);
        setLoading(false);
      });

      return () => unsubscribe();
    }
  }, [user, isAuthLoading, router]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      toast.success('Você saiu da sua conta.');
      router.push('/login');
    } catch (error) {
      console.error(error);
      toast.error('Não foi possível sair. Tente novamente.');
    }
  };

  return (
    <main className="container mx-auto p-4 md:p-8">
      <div className="flex flex-wrap gap-4 justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">Minhas Vaquinhas</h1>
          <p className="text-muted-foreground">
            Gerencie e acompanhe o progresso das suas arrecadações.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Button asChild>
            <Link href="/create-vaquinha">
              <PlusCircle className="mr-2 h-4 w-4" />
              Criar Nova Vaquinha
            </Link>
          </Button>
          <Button variant="outline" onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            Sair
          </Button>
        </div>
      </div>

      {isAuthLoading || loading ? (
        <VaquinhasSkeleton />
      ) : vaquinhas.length === 0 ? (
        <Card className="text-center p-8 border-dashed">
          <CardHeader>
            <CardTitle className="flex items-center justify-center gap-2">
              <PartyPopper className="h-6 w-6" />
              Comece sua primeira arrecadação!
            </CardTitle>
            <CardDescription>
              Você ainda não criou nenhuma vaquinha. Clique no botão &quot;Criar
              Nova Vaquinha&quot; para começar.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {vaquinhas.map((vaquinha) => {
            // LÓGICA DA BARRA DE PROGRESSO
            const totalPaid = vaquinha.participants
              .filter((p) => p.status === 'paid')
              .reduce((sum, p) => sum + p.amount, 0);

            const progressPercentage =
              vaquinha.totalAmount > 0
                ? (totalPaid / vaquinha.totalAmount) * 100
                : 0;

            return (
              <Link
                key={vaquinha.id}
                href={`/vaquinha/${vaquinha.id}`}
                passHref
              >
                <Card className="h-full flex flex-col hover:border-primary transition-colors cursor-pointer">
                  <CardHeader>
                    <CardTitle className="truncate">{vaquinha.title}</CardTitle>
                    <CardDescription>
                      Criada em:{' '}
                      {vaquinha.createdAt
                        ? new Date(
                            vaquinha.createdAt.seconds * 1000,
                          ).toLocaleDateString()
                        : 'Data indisponível'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex-grow">
                    <div className="text-sm text-muted-foreground mb-2">
                      <span>R$ {totalPaid.toFixed(2)}</span>
                      <span className="float-right">
                        R$ {vaquinha.totalAmount.toFixed(2)}
                      </span>
                    </div>
                    <Progress value={progressPercentage} className="w-full" />
                  </CardContent>
                  <CardFooter>
                    <p className="text-sm text-gray-600 w-full text-center">
                      {vaquinha.participants?.length || 0} participante(s)
                    </p>
                  </CardFooter>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}
