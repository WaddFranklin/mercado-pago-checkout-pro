"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { toast } from "sonner";

function FeedbackContent() {
  const searchParams = useSearchParams();

  const initialStatus = searchParams.get("status");
  const paymentId = searchParams.get("payment_id");
  const externalReference = searchParams.get("external_reference");

  const [currentStatus, setCurrentStatus] = useState(initialStatus);

  useEffect(() => {
    if (!externalReference) return;

    const docRef = doc(db, "payments", externalReference);

    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const newStatus = data.status;

        if (currentStatus !== newStatus) {
          if (newStatus === "approved") {
            // MUDANÇA 3: Usar a nova sintaxe do sonner
            toast.success("Pagamento Aprovado! 🎉", {
              description: "Sua compra foi confirmada com sucesso.",
            });
          } else if (
            newStatus === "failure" ||
            newStatus === "cancelled" ||
            newStatus === "rejected"
          ) {
            // MUDANÇA 4: Usar a nova sintaxe do sonner para erro
            toast.error("Pagamento Falhou", {
              description: "Houve um problema com o seu pagamento.",
            });
          }
        }

        setCurrentStatus(newStatus);
      }
    });

    return () => unsubscribe();
  }, [externalReference, currentStatus]);

  // ... (o restante do código da função getFeedbackMessage e do return continua o mesmo)
  const getFeedbackMessage = () => {
    switch (currentStatus) {
      case "success":
      case "approved":
        return {
          title: "Pagamento Aprovado!",
          message:
            "Obrigado pela sua compra. Seu pagamento foi processado com sucesso.",
          color: "text-green-500",
        };
      case "failure":
      case "rejected":
        return {
          title: "Pagamento Recusado",
          message:
            "Houve um problema ao processar seu pagamento. Por favor, tente novamente.",
          color: "text-red-500",
        };
      case "pending":
        return {
          title: "Processando seu Pagamento...",
          message:
            "Seu pagamento está pendente. Avisaremos assim que for aprovado. Você pode aguardar nesta tela.",
          color: "text-yellow-500",
        };
      default:
        return {
          title: "Aguardando Status",
          message: "Aguardando a confirmação do status do seu pagamento.",
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
            <strong>Status Atual:</strong> {currentStatus || "N/A"}
          </p>
          <p>
            <strong>ID do Pagamento (MP):</strong> {paymentId || "N/A"}
          </p>
          <p>
            <strong>ID do Pedido (Firebase):</strong>{" "}
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

export default function FeedbackPage() {
  return (
    <Suspense fallback={<div>Carregando...</div>}>
      <FeedbackContent />
    </Suspense>
  );
}
