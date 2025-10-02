"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePayment = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/create-payment", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Ocorreu um erro ao processar o pagamento."
        );
      }

      if (data.init_point) {
        window.location.href = data.init_point;
      }
    } catch (err: unknown) {
      // <-- CORREÇÃO AQUI: de 'any' para 'unknown'
      console.error(err);
      // Verificamos se o erro é uma instância de Error para acessar a propriedade message com segurança
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Ocorreu um erro inesperado.");
      }
      setIsLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="z-10 w-full max-w-5xl items-center justify-center font-mono text-sm flex">
        <div className="flex flex-col items-center gap-6">
          <h1 className="text-2xl font-semibold">Projeto de Pagamento</h1>
          <p>
            Clique no botão abaixo para ser redirecionado ao checkout do Mercado
            Pago.
          </p>

          <Button onClick={handlePayment} disabled={isLoading} size="lg">
            {isLoading ? "Processando..." : "Pagar R$ 10,50"}
          </Button>

          {error && <p className="text-red-500 mt-4">{error}</p>}
        </div>
      </div>
    </main>
  );
}
