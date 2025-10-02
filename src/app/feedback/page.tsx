"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

// Um componente wrapper para usar o `useSearchParams` que requer Suspense
function FeedbackContent() {
  const searchParams = useSearchParams();

  // Pegamos os parâmetros da URL que o Mercado Pago nos enviou
  const status = searchParams.get("status");
  const paymentId = searchParams.get("payment_id");
  const externalReference = searchParams.get("external_reference");

  const getFeedbackMessage = () => {
    switch (status) {
      case "success":
      case "approved":
        return {
          title: "Pagamento Aprovado!",
          message:
            "Obrigado pela sua compra. Seu pagamento foi processado com sucesso.",
          color: "text-green-500",
        };
      case "failure":
        return {
          title: "Pagamento Recusado",
          message:
            "Houve um problema ao processar seu pagamento. Por favor, tente novamente.",
          color: "text-red-500",
        };
      case "pending":
        return {
          title: "Pagamento Pendente",
          message:
            "Seu pagamento está pendente de processamento. Avisaremos assim que for aprovado.",
          color: "text-yellow-500",
        };
      default:
        return {
          title: "Ocorreu um erro",
          message:
            "Não foi possível identificar o status do seu pagamento. Entre em contato com o suporte.",
          color: "text-gray-500",
        };
    }
  };

  const feedback = getFeedbackMessage();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24 text-center">
      <div className="flex flex-col items-center gap-4">
        <h1 className={`text-3xl font-bold ${feedback.color}`}>
          {feedback.title}
        </h1>
        <p className="text-lg max-w-md">{feedback.message}</p>
        <div className="mt-4 p-4 border rounded-md bg-gray-50 text-left text-sm text-gray-700">
          <p>
            <strong>Status:</strong> {status || "N/A"}
          </p>
          <p>
            <strong>ID do Pagamento:</strong> {paymentId || "N/A"}
          </p>
          <p>
            <strong>Referência Externa (ID do Pedido):</strong>{" "}
            {externalReference || "N/A"}
          </p>
        </div>
        <Link
          href="/"
          className="mt-6 inline-block rounded-md bg-blue-600 px-6 py-2 text-white hover:bg-blue-700">
          Voltar para a página inicial
        </Link>
      </div>
    </main>
  );
}

// A página principal que exportamos
export default function FeedbackPage() {
  return (
    // O `useSearchParams` deve ser usado dentro de um boundary <Suspense>
    // Esta é uma boa prática no Next.js App Router
    <Suspense fallback={<div>Carregando...</div>}>
      <FeedbackContent />
    </Suspense>
  );
}
